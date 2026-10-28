// Wrappers tipados sobre los endpoints de ventas (`/ventas/*` en el backend, distinto
// de `/inventarios/*` que vive en inventario-api.ts). Todas las llamadas van con
// `credentials: "include"`: el backend audita estas rutas e identifica al actor via la
// cookie de sesion.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type { LoteInventario, ProyectoInventario } from "@/lib/api/inventario-api"

const VENTAS_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/ventas`

export class VentasApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "VentasApiError"
    this.status = status
    this.code = code
  }
}

// Sin timeout, un backend colgado deja el fetch en pending para siempre y la UI se
// queda en el spinner de carga indefinidamente (nunca llega a .then ni a .catch). 15s
// es margen suficiente para una red lenta sin dejar al usuario esperando eternamente.
const TIMEOUT_MS = 15_000

// Exportado para que lib/api/convenios-api.ts (mismo backend, base "/ventas") lo
// reuse en vez de duplicar el manejo de timeout/errores.
export async function ventasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)
  // Con FormData (subida de archivos) no hay que fijar Content-Type a mano: el
  // navegador arma el boundary del multipart solo, y si uno mismo pone
  // "application/json" (como en el resto de las llamadas de este archivo) el body
  // multipart llega roto.
  const esFormData = options.body instanceof FormData
  try {
    response = await fetch(`${VENTAS_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: timeoutController.signal,
      headers: {
        ...(esFormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new VentasApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new VentasApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      cuerpo?.message ?? cuerpo?.error ?? response.statusText ?? "Error desconocido"
    throw new VentasApiError(mensaje, response.status, cuerpo?.code)
  }

  return cuerpo as T
}

// GET /ventas/proyectos/:idProyecto/lotes-libres — lotes en estado LIBRE de un proyecto
// (usado por el selector de "Nueva venta", /ventas/lotes/[proyect], donde [proyect] es
// el id numerico del proyecto). Misma forma de fila que GET /inventarios.
export function obtenerLotesLibres(idProyecto: number) {
  return ventasFetch<LoteInventario[]>(`/proyectos/${idProyecto}/lotes-libres`)
}

// Fila de GET /ventas/proyectos/:idProyecto/lotes-vendidos — a diferencia de
// LoteInventario (lotes-libres), trae `procesoId`: el id del sale_process de esa
// venta, para ir directo a /gestion/refinanciamiento/new/:procesoId. Viene null
// cuando ese lote no tiene ningún sale_process vinculado (frecuente en ventas
// históricas, migradas directo a `inventario` antes de que existiera el flujo de
// "Nueva Venta" en este sistema) — en ese caso el frontend ofrece "Registrar venta
// histórica" (ver registrarVentaHistorica) en vez de ir directo a refinanciar.
export type LoteVendido = {
  id: number
  codigo: string | null
  estado: string | null
  pvp: string | null
  areaUtil: string | null
  procesoId: number | null
}

// GET /ventas/proyectos/:idProyecto/lotes-vendidos — lotes ya vendidos (estado
// "convenio") de un proyecto, usado por el selector de Gestión > Refinanciamientos
// (/gestion/refinanciamiento/lotes/[proyect]) — mismo flujo "elegí proyecto, elegí
// lote" que Nueva Venta, pero sobre lotes vendidos en vez de libres.
export function obtenerLotesVendidos(idProyecto: number) {
  return ventasFetch<LoteVendido[]>(`/proyectos/${idProyecto}/lotes-vendidos`)
}

// POST /ventas/procesos/venta-historica — crea un sale_process mínimo (nombre +
// cédula) para un lote ya vendido que no tiene ningún proceso registrado en este
// sistema — ver VentasService.registrarVentaHistorica. Devuelve el proceso creado
// (SaleProcessBackend), listo para ir a /gestion/refinanciamiento/new/:id.
export function registrarVentaHistorica(datos: {
  cliLote: string
  idPry: number
  cliName: string
  identificacion?: string
}) {
  return ventasFetch<{ id: number }>(`/procesos/venta-historica`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// GET /ventas/procesos/validar/:cliLote — si `valido` es false, el lote no puede pasar
// a un proceso de venta nuevo (usado como gate en /ventas/nuevo-proceso antes de mostrar
// el formulario, junto con buscarOrdenSapPorLote en saps-api.ts).
export function validarLoteParaProceso(cliLote: string) {
  return ventasFetch<{ valido: boolean }>(
    `/procesos/validar/${encodeURIComponent(cliLote)}`
  )
}

// Forma real de sale_process (tabla "default" que usa este backend) — bastante mas
// angosta que la que sugeria el schema.prisma legado (cli_identif/cli_estcivil/etc no
// existen aca; cli_name si, se agrego aparte solo para mostrar en la tabla de procesos
// sin join — el resto de datos del cliente vive en process_users, ver
// crearProceso/CrearProcesoInput). offert_id/finan_id/payment_id son null hasta que se
// crea cada sub-proceso; offert_status/finan_status/payment_status vienen resueltos del
// backend (join contra ofertas/financiamientos/pagos, ver ventas.service.ts
// findProcesoByLote) — recien creado el proceso (respuesta de POST /procesos) los tres
// vienen undefined porque todavia no hay nada que unir.
export type ProcesoBackend = {
  id: number
  id_user: string | null
  cli_name: string | null
  cli_asesor: string | null
  id_pry: number | null
  cli_lote: string | null
  lote_price: number | null
  lote_mts: number | null
  offert_id: number | null
  finan_id: number | null
  payment_id: number | null
  sup_venta: string | null
  location: string | null
  created_at: string | null
  update_at: string | null
  // No nulo = venta completa (oferta + financiamiento + pago aprobados) — el lote ya
  // pasó a "convenio" en inventario y su proyecto perdió una unidad de stock (ver
  // PagoService.marcarVentaCompletada en el backend, que la pone al aprobar el pago).
  venta_nueva_at?: string | null
  offert_status?: string | null
  finan_status?: string | null
  payment_status?: string | null
  // Titular del proceso (process_users, rol="titular") — es donde vive el dato real
  // del cliente. null si el proceso no tiene titular (no deberia pasar para procesos
  // creados por crearProceso, pero sí para filas viejas insertadas antes de esto).
  titular?: {
    nombre: string | null
    identificacion: string | null
    nacionalidad: string | null
    sexo: string | null
    estado_civil: string | null
    fecha_nacimiento: string | null
  } | null
}

// GET /ventas/procesos/lote/:cliLote — TODOS los procesos de venta de un lote (array
// vacio si todavia no se creo ninguno). validateCreateProcess permite crear mas de un
// proceso para el mismo lote mientras ninguno este 100% aprobado, asi que puede haber
// varias filas — el backend ya los ordena del mas nuevo al mas viejo.
export function obtenerProcesoPorLote(cliLote: string) {
  return ventasFetch<ProcesoBackend[]>(`/procesos/lote/${encodeURIComponent(cliLote)}`)
}

// POST /ventas/procesos — crea el proceso de venta para un lote ya validado
// (validarLoteParaProceso). id_user lo pone el backend a partir de la sesion, no hace
// falta mandarlo. cli_name queda tal cual en sale_process (para mostrar en la tabla de
// procesos sin join); el resto de datos del cliente el backend los usa para crear el
// titular en process_users, vinculado a este proceso.
export type CrearProcesoInput = {
  cli_name: string
  identificacion: string
  nacionalidad: string
  sexo: string
  estado_civil: string
  fecha_nacimiento: string
  cli_asesor: string
  id_pry: number
  cli_lote: string
  lote_price: number
  lote_mts: number
  location: string
}

// GET /ventas/procesos/:id — un solo proceso por su id numerico (con titular incluido,
// igual shape que obtenerProcesoPorLote). Hace falta porque la pantalla de oferta
// (/ventas/oferta/new/[id]) solo conoce el id via la URL, no el lote.
export function obtenerProceso(id: number) {
  return ventasFetch<ProcesoBackend | null>(`/procesos/${id}`)
}

export function crearProceso(datos: CrearProcesoInput) {
  return ventasFetch<ProcesoBackend>("/procesos", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// PATCH /ventas/procesos/:id — edita un proceso ya creado (panel "Editar proceso" de
// la tabla de Procesos). Todo opcional: solo se mandan los campos que ese panel expone
// (no cli_lote/id_pry/lote_price/lote_mts, que no son editables ahí).
export type ActualizarProcesoInput = Partial<{
  cli_name: string
  identificacion: string
  nacionalidad: string
  sexo: string
  estado_civil: string
  fecha_nacimiento: string
  cli_asesor: string
  location: string
}>

export function actualizarProceso(idProceso: number | string, datos: ActualizarProcesoInput) {
  return ventasFetch<ProcesoBackend>(`/procesos/${idProceso}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  })
}

// Cliente adicional del proceso (además del titular, rol="titular") — mismo storage
// que el titular pero con rol="extra": nombre, identificación, relación con el cliente,
// país de residencia y si es PEP (relacion/pais_residencia/es_pep requieren soporte en
// el backend de POST /procesos/:id/clientes-extra). Hasta 3 por
// proceso (validado en el wizard, no acá).
export type ClienteExtraInput = {
  nombre: string
  identificacion: string
  // Datos que pide el formulario UAFE (sección de beneficiarios / PEP) por cada cliente.
  relacion: string
  pais_residencia: string
  es_pep: boolean
}

// POST /ventas/procesos/:idProceso/clientes-extra — guarda cada cliente en
// process_users con rol="extra" (igual que el titular). Upsert por posición: la fila
// N de la lista actualiza la fila N ya guardada; si se agregan más se crean, si se
// quitan se borran las sobrantes.
export function guardarClientesExtra(
  idProceso: number | string,
  clientes: ClienteExtraInput[]
) {
  return ventasFetch<void>(`/procesos/${idProceso}/clientes-extra`, {
    method: "POST",
    body: JSON.stringify({ clientes }),
  })
}

// Persona de cualquier proceso (titular, cónyuge, cliente extra, etc. — la tabla que
// el usuario del wizard conoce como "procesos_person") — "lote" para diferenciar
// coincidencias de nombre en el picker de "¿Cómo nos contactó? → Referidos → Cliente".
export type PersonaProceso = { nombre: string; lote: string | null }

// GET /ventas/procesos/personas — TODAS las personas ya registradas en cualquier
// proceso/lote (process_users), para que el wizard de oferta arme un buscador (nombre +
// lote) y el usuario elija quién refirió al cliente nuevo.
export function listarPersonasProceso() {
  return ventasFetch<PersonaProceso[]>("/procesos/personas")
}

// GET /ventas/venta-urgente/:lote — si el lote SI es venta urgente devuelve sus
// datos; si NO lo es, devuelve 200 con `{ error: true }` en el cuerpo (no `false` ni un
// status de error) — por eso el tipo es `unknown` y quien llama debe revisar la forma
// con esVentaUrgente() en vez de solo chequear si el valor es truthy.
export function consultarVentaUrgente(lote: string) {
  return ventasFetch<unknown>(`/venta-urgente/${encodeURIComponent(lote)}`)
}

// Distingue "SI es venta urgente" (datos reales) de "NO lo es" ({ error: true }): un
// simple `if (dato)` trata el segundo caso como verdadero porque un objeto siempre es
// truthy en JS, aunque tenga adentro `error: true`.
export function esVentaUrgente(dato: unknown): boolean {
  if (!dato || typeof dato !== "object") return false
  return !("error" in dato && (dato as { error?: unknown }).error)
}

// --- Módulo "Ventas urgentes" (CRUD, permiso venta:urgente) ---
// Marca un lote como venta urgente: /ventas/nuevo-proceso se salta la validación de
// disponibilidad y la orden SAP de ese lote (ver consultarVentaUrgente más arriba).
export type VentaUrgenteBackend = {
  id: number
  lote: string
  usuario: string
  mensaje: string | null
  imagen_url: string | null
  created_at: string | null
}

// GET /ventas/ventas-urgentes
export function listarVentasUrgentes() {
  return ventasFetch<VentaUrgenteBackend[]>("/ventas-urgentes")
}

// POST /ventas/ventas-urgentes — falla 409 si el lote ya está marcado.
export function crearVentaUrgente(datos: { lote: string; mensaje?: string }) {
  return ventasFetch<VentaUrgenteBackend>("/ventas-urgentes", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// PATCH /ventas/ventas-urgentes/:id
export function actualizarVentaUrgente(
  id: number,
  datos: { lote?: string; mensaje?: string }
) {
  return ventasFetch<VentaUrgenteBackend>(`/ventas-urgentes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  })
}

// DELETE /ventas/ventas-urgentes/:id — quita la marca de venta urgente del lote.
export function eliminarVentaUrgente(id: number) {
  return ventasFetch<{ success: boolean }>(`/ventas-urgentes/${id}`, {
    method: "DELETE",
  })
}

// Forma esperada de la respuesta de POST /ventas/documento-identidad — solo nombre y
// numero de identificacion: el resto de campos (estado_civil/sexo/fecha_nacimiento/
// nacionalidad) se sacaron del lado del backend porque el adapter de Textract los
// devolvia cruzados entre si con confianza baja.
export type DatosDocumentoIdentidad = {
  nombre?: string | null
  numero_identificacion?: string | null
}

// POST /ventas/documento-identidad — sube el frontal de cedula (o la pagina de datos
// del pasaporte), base64 plano sin el prefijo "data:image/...;base64,", para que el
// backend extraiga nombre y numero de identificacion y autocompletar el formulario de
// nuevo proceso. Ya no se manda el reverso: no aportaba datos confiables.
export type EntradaDocumentoIdentidad =
  { tipo: "pasaporte"; imagen: string } | { tipo: "cedula"; imagenFrontal: string }

export function procesarDocumentoIdentidad(entrada: EntradaDocumentoIdentidad) {
  const body =
    entrada.tipo === "cedula"
      ? { imagenFrontal: entrada.imagenFrontal }
      : { imagen: entrada.imagen }

  return ventasFetch<DatosDocumentoIdentidad>("/documento-identidad", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// Forma real de process_documentos (ver ProcessDocumento en el backend) — nombres tal
// cual la entidad TypeORM, snake_case (no_aplica, no "noAplica"). "url" es el link
// directo al archivo en S3 (subido tal cual, sirve para <img>/abrir en pestaña/imprimir
// sin transformacion — puede ser imagen o PDF segun lo que se haya subido).
export type DocumentoProcesoBackend = {
  id: number
  id_process: number
  tipo: string
  orden: number | null
  url: string | null
  no_aplica: boolean
  created_at: string
}

// GET /ventas/procesos/:idProceso/documentos — todos los documentos ya cargados para
// ese proceso.
export function listarDocumentosProceso(idProceso: number | string) {
  return ventasFetch<DocumentoProcesoBackend[]>(`/procesos/${idProceso}/documentos`)
}

// POST /ventas/procesos/:idProceso/documentos — sube (o marca "no aplica") un
// documento de respaldo del proceso, ya creado (a diferencia de documento-identidad,
// que corre ANTES de crear el proceso solo para autocompletar el formulario). Va como
// multipart/form-data, no JSON:
//   - archivo: tipo (ej. "cedula_frontal") + file. "orden" es opcional, para
//     documentos repetibles como "rol_pago" (rol_pago #1, #2...).
//   - no aplica: tipo + noAplica=true, sin file (ej. papeleta_votacion cuando el
//     cliente no la tiene).
export type SubidaDocumentoProceso =
  { tipo: string; archivo: File; orden?: number } | { tipo: string; noAplica: true }

export function subirDocumentoProceso(
  idProceso: number | string,
  datos: SubidaDocumentoProceso
) {
  const formData = new FormData()
  formData.append("tipo", datos.tipo)
  if ("noAplica" in datos) {
    formData.append("noAplica", "true")
  } else {
    formData.append("file", datos.archivo)
    if (datos.orden != null) formData.append("orden", String(datos.orden))
  }

  return ventasFetch<unknown>(`/procesos/${idProceso}/documentos`, {
    method: "POST",
    body: formData,
  })
}

// PATCH /ventas/procesos/:idProceso/documentos/:tipo — renombra un tipo de documento
// personalizado (no los del catalogo) en documentos, solicitudes y verificaciones.
export function renombrarTipoDocumento(
  idProceso: number | string,
  tipo: string,
  nuevoTipo: string
) {
  return ventasFetch<{ tipo: string }>(
    `/procesos/${idProceso}/documentos/${encodeURIComponent(tipo)}`,
    { method: "PATCH", body: JSON.stringify({ nuevoTipo }) }
  )
}

// DELETE /ventas/procesos/:idProceso/documentos/:tipo — elimina un tipo de documento
// personalizado del proceso (su documento subido, solicitudes y verificacion).
export function eliminarTipoDocumento(idProceso: number | string, tipo: string) {
  return ventasFetch<{ success: boolean }>(
    `/procesos/${idProceso}/documentos/${encodeURIComponent(tipo)}`,
    { method: "DELETE" }
  )
}

// --- Revision de documentacion (solicitar / verificar / listar) ---
//
// Forma real de document_requests (ver DocumentRequest en el backend) — log tipo
// evento, no se upsertea: cada solicitud es una fila nueva con ciclo de vida
// pendiente -> resuelto (subida real del asesor) | cancelado.
export type SolicitudDocumentoBackend = {
  id: number
  id_process: number
  tipo: string
  estado: "pendiente" | "resuelto" | "cancelado"
  comentario: string | null
  id_reviewer: string
  id_asesor_destino: string | null
  email_asesor_destino: string | null
  created_at: string
  resuelto_at: string | null
  resuelto_por_documento_id: number | null
  cancelado_at: string | null
}

// Forma real de document_verifications — una fila vigente por (id_process, tipo).
export type DocumentoVerificacionBackend = {
  id: number
  id_process: number
  tipo: string
  id_reviewer: string
  process_documento_id: number | null
  created_at: string
}

export type AsesorVentas = { id: string; nombre: string; email: string }

export type ProcesoPendienteRevision = {
  id: number
  cli_name: string | null
  cli_lote: string | null
  cli_asesor: string | null
  id_pry: number | null
  created_at: string | null
  resumenDocumentos: { revisados: number; total: number }
  tiposPendientes: string[]
}

// GET /ventas/procesos/pendientes-revision — listado paginado para la pantalla del
// revisor. "estado" filtra por ventas con al menos un tipo de documento sin verificar
// ("pendiente", default) o trae todas ("todos").
export function listarProcesosPendientesRevision(params: {
  page?: number
  pageSize?: number
  estado?: "pendiente" | "todos"
  busqueda?: string
}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  qs.set("estado", params.estado ?? "pendiente")
  if (params.busqueda) qs.set("busqueda", params.busqueda)
  return ventasFetch<{
    items: ProcesoPendienteRevision[]
    total: number
    page: number
    pageSize: number
  }>(`/procesos/pendientes-revision?${qs.toString()}`)
}

// GET /ventas/revision/procesos/:idProceso — todo lo que necesita el detalle del
// revisor en una sola llamada: proceso + titular, documentos subidos, solicitudes y
// verificaciones existentes.
export function obtenerDetalleRevision(idProceso: number | string) {
  return ventasFetch<{
    proceso: ProcesoBackend
    documentos: DocumentoProcesoBackend[]
    solicitudes: SolicitudDocumentoBackend[]
    verificaciones: DocumentoVerificacionBackend[]
  }>(`/revision/procesos/${idProceso}`)
}

// POST /ventas/procesos/:idProceso/documentos/:tipo/solicitar — crea una solicitud y
// dispara el correo al Asesor de Ventas destino. 409 si ya hay una pendiente para ese
// mismo tipo. Si el backend no puede resolver el asesor automaticamente, responde 400
// con code "ASESOR_NO_RESUELTO" (VentasApiError.code) — el caller debe entonces listar
// listarAsesoresDeVentas() y reintentar pasando idAsesorDestino.
export function solicitarDocumento(
  idProceso: number | string,
  tipo: string,
  datos: { comentario?: string; etiqueta?: string; idAsesorDestino?: string }
) {
  return ventasFetch<SolicitudDocumentoBackend>(
    `/procesos/${idProceso}/documentos/${encodeURIComponent(tipo)}/solicitar`,
    { method: "POST", body: JSON.stringify(datos) }
  )
}

// POST /ventas/procesos/:idProceso/documentos/:tipo/verificar — el revisor confirma
// que el documento ya subido (o no_aplica) esta correcto. 400 si todavia no hay nada
// subido para ese tipo.
export function verificarDocumento(idProceso: number | string, tipo: string) {
  return ventasFetch<DocumentoVerificacionBackend>(
    `/procesos/${idProceso}/documentos/${encodeURIComponent(tipo)}/verificar`,
    { method: "POST" }
  )
}

// GET /ventas/asesores — usuarios con rol "Asesor de Ventas", para el selector manual
// cuando solicitarDocumento no puede resolver el destino solo.
export function listarAsesoresDeVentas() {
  return ventasFetch<AsesorVentas[]>("/asesores")
}

// GET /ventas/asesores/telefono?nombre= — teléfono guardado en el usuario del asesor
// (con prefijo, "+593987654321"), o null si no tiene o no hay usuario con ese nombre.
export function obtenerTelefonoAsesor(nombre: string) {
  return ventasFetch<{ telefono: string | null }>(
    `/asesores/telefono?nombre=${encodeURIComponent(nombre)}`
  )
}

// GET /ventas/representantes-empresa — usuarios con permiso "ofertas:revisar", para el
// select de "Representante de la empresa (firma)" del reporte imprimible de oferta.
export function listarRepresentantesEmpresa() {
  return ventasFetch<AsesorVentas[]>("/representantes-empresa")
}

// GET /ventas/procesos/:idProceso/documentos/solicitudes — solicitudes (de cualquier
// estado) de un proceso puntual, para mostrar el banner "se solicito este documento"
// en la pantalla de subida del asesor.
export function listarSolicitudesDocumento(idProceso: number | string) {
  return ventasFetch<SolicitudDocumentoBackend[]>(
    `/procesos/${idProceso}/documentos/solicitudes`
  )
}

// GET /ventas/procesos/:idProceso/documentos/verificaciones — verificaciones vigentes
// de un proceso puntual, para poder mostrar el badge "Verificado" en la pantalla
// compartida de documentos (antes solo se traia en el detalle del revisor, que ya no
// se usa como panel aparte).
export function listarVerificacionesDocumento(idProceso: number | string) {
  return ventasFetch<DocumentoVerificacionBackend[]>(
    `/procesos/${idProceso}/documentos/verificaciones`
  )
}

// GET /ventas/mis-solicitudes-pendientes — solicitudes pendientes asignadas al usuario
// logeado, con cliente/lote ya resueltos — alimenta la campanita de notificaciones.
export function listarMisSolicitudesPendientes() {
  return ventasFetch<{
    items: (SolicitudDocumentoBackend & {
      cli_name: string | null
      cli_lote: string | null
    })[]
    total: number
  }>("/mis-solicitudes-pendientes")
}

// --- Oferta de compra ---
// La tabla legacy `ofertas` tiene ~90 columnas (incluye un cuestionario AML/KYC que no
// captura este wizard) — este tipo sólo expone lo que la pantalla /ventas/oferta/new/[id]
// necesita mostrar/precargar, no un mapeo 1:1 de la tabla completa.
export type OfertaBackend = {
  id: number
  cli_descuento: number | null
  cli_telef: string | null
  cli_mail: string | null
  cli_representante: string | null
  cli_representanteID: string | null
  cli_telefR: string | null
  cli_representanteMail: string | null
  cli_reFami1: string | null
  cli_paren1: string | null
  cli_telParen1: string | null
  cli_reFami2: string | null
  cli_paren2: string | null
  cli_telParen2: string | null
  cli_conyuName: string | null
  cli_conyuID: string | null
  // YYYY-MM-DD
  cli_conyuFecNac?: string | null
  cli_conyuCell: string | null
  // Datos laborales del cónyuge — opcionales, se piden en el paso Cónyuge del wizard.
  cli_conyuTrabEmpresa?: string | null
  cli_conyuTrabDireccion?: string | null
  cli_conyuTrabTelefono?: string | null
  referido_nombre: string | null
  referido_telefono: string | null
  referido_relacion: string | null
  cli_asesorTelf: string | null
  cli_contac?: string | null
  cli_contacNombre?: string | null
  prospectador?: string | null
  cli_motivoCompra?: string | null
  cli_asistenciaProyecto?: string | null
  // "Sí" / "No" — el asesor indica si el cliente visitó el proyecto.
  cli_visitaProyecto?: string | null
  cli_observation?: string | null
  // Pais / provincia (o estado si el pais es Estados Unidos) / ciudad / sector — la
  // cascada de habilitado/deshabilitado y el literal "No aplica" se resuelven en el
  // wizard (app/(dashboard)/ventas/oferta/new/[id]/page.tsx), no aca.
  cli_pais: string | null
  cli_provin: string | null
  cli_ciudad: string | null
  cli_sector: string | null
  // Dirección (calle) del domicilio del titular — la pide el formulario de licitud.
  cli_direccion?: string | null
  cli_state: string | null
  cli_trabActividad?: string | null
  cli_trabEmpresa?: string | null
  // Profesión / ocupación del titular — mismo catálogo que cli_trabCargo (cargos, en
  // lib/const/actividades.ts). Se muestra en el reporte de licitud de fondos.
  cli_trabProfesion?: string | null
  cli_trabCargo?: string | null
  cli_trabTiempo?: string | null
  cli_trabSector?: string | null
  cli_trabDireccion?: string | null
  cli_trabTelefono?: string | null
  cli_trabIngresos?: number | string | null
  cli_trabRuc?: string | null
  cli_trabTipoNegocio?: string | null
  // Persona que efectúa la transacción cuando no es el titular (sección 3 del formulario
  // UAFE) — solo aplica cuando cli_trabActividad = "OTRO". cli_transIntermediario = "Sí" | "No".
  cli_transNombre?: string | null
  cli_transID?: string | null
  cli_transNacionalidad?: string | null
  cli_transProfesion?: string | null
  cli_transCargo?: string | null
  cli_transTelefono?: string | null
  cli_transDireccion?: string | null
  cli_transCiudad?: string | null
  cli_transEstadoCivil?: string | null
  cli_transIntermediario?: string | null
  cli_transRelacionDueno?: string | null
  // Inmueble — solo usados en el reporte imprimible (/ventas/oferta/reporte/[id]/
  // imprimir); no hay paso del wizard todavia que los pida.
  cli_tipoInmueble?: string | null
  cli_ofrecimiento?: string | null
  // Tipo de operación (paso "Inmueble" del wizard) — se muestra en el reporte de
  // licitud de fondos (/ventas/licitud/reporte/[id]), no en el reporte de la oferta.
  cli_tipoOperacion?: string | null
  // Solo cuando cli_tipoOperacion = "Otro" — detalle libre que escribe el asesor.
  cli_tipoOperacionOtro?: string | null
  // Fecha de creación de la oferta — para el encabezado del reporte imprimible.
  created_at?: string | null
}

// Mismos campos que OfertaBackend salvo id/cli_state/created_at (no se mandan) +
// "finalizar", el flag que le dice al backend "esto es el submit final" (pone
// cli_state = "ingresado" para que la columna OFERTA de /ventas/procesos deje de
// mostrar "pendiente").
export type OfertaFormInput = Partial<
  Omit<OfertaBackend, "id" | "cli_state" | "created_at">
> & {
  finalizar?: boolean
}

// GET /ventas/procesos/:idProceso/oferta — null si el proceso todavia no tiene oferta
// creada (offert_id null en sale_process); el wizard arranca en blanco en ese caso.
export function obtenerOferta(idProceso: number | string) {
  return ventasFetch<OfertaBackend | null>(`/procesos/${idProceso}/oferta`)
}

// POST /ventas/procesos/:idProceso/oferta — crea la oferta del proceso (falla 400 si
// ya existe, o si el titular es casado y no vino cli_conyuName).
export function crearOferta(idProceso: number | string, datos: OfertaFormInput) {
  return ventasFetch<OfertaBackend>(`/procesos/${idProceso}/oferta`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// PATCH /ventas/procesos/:idProceso/oferta — actualiza la oferta ya creada (falla 400
// si todavia no existe, hay que crearOferta primero).
export function actualizarOferta(idProceso: number | string, datos: OfertaFormInput) {
  return ventasFetch<OfertaBackend>(`/procesos/${idProceso}/oferta`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  })
}

// --- Datos financieros (paso "Datos financieros" del wizard) ---
// Vive en tablas propias del backend (oferta_pld / referencias bancarias y comerciales), no en la
// tabla `ofertas` — por eso es un endpoint aparte de crearOferta/actualizarOferta, y
// solo se puede guardar despues de que la oferta ya existe (necesita su id).
export type ReferenciaBancariaInput = {
  institucion: string
  numeroCuenta: string
  // "Ahorros" | "Corriente"
  tipo: string
  ciudad: string
}

export type ReferenciaComercialInput = {
  institucion: string
  contacto: string
  telefono: string
  ciudad: string
}

export type DatosFinancierosBackend = {
  // Otros ingresos mensuales (USD/mes) — se suman a ingresoMensual para ahorroMensual.
  otrosIngresos: number | null
  fuenteIngresos: string | null
  // Solo cuando fuenteIngresos = "Otro" — detalle libre que escribe el asesor.
  fuenteIngresosOtro: string | null
  patrimonio: number | null
  fuentePatrimonio: string | null
  ingresoMensual: number | null
  gastosMensual: number | null
  ahorroMensual: number | null
  ahorroActual: number | null
  referenciasBancarias: ReferenciaBancariaInput[]
  referenciasComerciales: ReferenciaComercialInput[]
}

export type DatosFinancierosInput = {
  otrosIngresos?: number
  fuenteIngresos?: string
  fuenteIngresosOtro?: string
  patrimonio?: number
  fuentePatrimonio?: string
  ingresoMensual?: number
  gastosMensual?: number
  ahorroMensual?: number
  ahorroActual?: number
  referenciasBancarias: ReferenciaBancariaInput[]
  referenciasComerciales: ReferenciaComercialInput[]
}

// GET /ventas/procesos/:idProceso/oferta/financiero — null si la oferta todavia no
// tiene datos financieros guardados.
export function obtenerDatosFinancieros(idProceso: number | string) {
  return ventasFetch<DatosFinancierosBackend | null>(
    `/procesos/${idProceso}/oferta/financiero`
  )
}

// POST /ventas/procesos/:idProceso/oferta/financiero — upsert: guarda o actualiza el
// ingreso/patrimonio/fuente y reemplaza las listas de referencias bancarias y
// comerciales por las que lleguen (actualiza las que ya existian por posicion, agrega las nuevas, borra las
// sobrantes).
export function guardarDatosFinancieros(
  idProceso: number | string,
  datos: DatosFinancierosInput
) {
  return ventasFetch<DatosFinancierosBackend>(
    `/procesos/${idProceso}/oferta/financiero`,
    {
      method: "POST",
      body: JSON.stringify(datos),
    }
  )
}

// --- Licitud de fondos (paso "Licitud de Fondos" del wizard) ---
// Vive en oferta_licitud_fondos / oferta_licitud_fondos_transacciones — mismo patron
// que Datos financieros: endpoint aparte, solo disponible con la oferta ya creada.
export type TransaccionLicitudFondosInput = {
  monto?: number
  tipoTransaccion?: string
  // Banco al que se deposita — el valor de cuentaDestino sale automático de este banco
  // (ver CUENTAS_BANCOS_RECEPTORES en select-options.ts).
  institucionFinanciera?: string
  cuentaDestino?: string
}

// Preguntas PEP (sí/no): funcionarioElecto = "es o ha sido funcionario, electo o designado",
// relacionGobierno = "relación familiar o de negocio con funcionario/entidad de gobierno",
// trabajoSectorPublico = "realiza trabajos o contratos para el sector público". Si al menos
// una es "Sí" se piden los pep* (fechas en YYYY-MM-DD).
export type LicitudFondosBackend = {
  relacionGobierno: string | null
  trabajoSectorPublico: string | null
  funcionarioElecto: string | null
  pepCargo: string | null
  pepPais: string | null
  pepFechaInicio: string | null
  pepFechaFin: string | null
  pepRelacion: string | null
  fondosOrigen: string | null
  fondosDestino: string | null
  transacciones: TransaccionLicitudFondosInput[]
}

export type LicitudFondosInput = {
  relacionGobierno?: string
  trabajoSectorPublico?: string
  funcionarioElecto?: string
  pepCargo?: string
  pepPais?: string
  pepFechaInicio?: string
  pepFechaFin?: string
  pepRelacion?: string
  fondosOrigen?: string
  fondosDestino?: string
  transacciones: TransaccionLicitudFondosInput[]
}

// GET /ventas/procesos/:idProceso/oferta/licitud-fondos — null si todavia no se guardo.
export function obtenerLicitudFondos(idProceso: number | string) {
  return ventasFetch<LicitudFondosBackend | null>(
    `/procesos/${idProceso}/oferta/licitud-fondos`
  )
}

// POST /ventas/procesos/:idProceso/oferta/licitud-fondos — upsert, mismo patron que
// guardarDatosFinancieros (reemplaza la lista de transacciones por posicion).
export function guardarLicitudFondos(
  idProceso: number | string,
  datos: LicitudFondosInput
) {
  return ventasFetch<LicitudFondosBackend>(
    `/procesos/${idProceso}/oferta/licitud-fondos`,
    {
      method: "POST",
      body: JSON.stringify(datos),
    }
  )
}

// GET /ventas/procesos/:idProceso/clientes-extra — clientes adicionales ya guardados
// (process_users con rol="extra"). No existia hasta ahora (solo el POST); hace falta
// para poder mostrarlos en el reporte de oferta.
export type ClienteExtraBackend = {
  id: number
  nombre: string | null
  identificacion: string | null
  relacion?: string | null
  pais_residencia?: string | null
  es_pep?: boolean | null
}

export function listarClientesExtra(idProceso: number | string) {
  return ventasFetch<ClienteExtraBackend[]>(`/procesos/${idProceso}/clientes-extra`)
}

// --- Reporte / aprobación de oferta ---
// El revisor (permiso "ofertas:revisar", separado del asesor que crea la oferta) ve
// el reporte de /ventas/oferta/new/[id] ya finalizado y puede aprobarlo, devolverlo
// marcando campos puntuales como incorrectos, o el asesor puede simplemente editarlo
// de nuevo (ruta ya existente).
export type ObservacionOfertaInput = {
  campo: string
  campoLabel: string
  comentario?: string
}

export type ObservacionOfertaBackend = {
  id: number
  campo: string | null
  campo_label: string | null
  comentario: string | null
  resuelta: boolean
  created_at: string
}

// GET /ventas/procesos/:idProceso/oferta/observaciones — observaciones vigentes (no
// resueltas) de la última devolución; [] si nunca se devolvió o ya se corrigieron.
export function listarObservacionesPendientes(idProceso: number | string) {
  return ventasFetch<ObservacionOfertaBackend[]>(
    `/procesos/${idProceso}/oferta/observaciones`
  )
}

// POST /ventas/procesos/:idProceso/oferta/aprobar — pone cli_state = "Aprobado",
// desbloqueando el siguiente paso del proceso (financiamiento) para ese lote.
export function aprobarOferta(idProceso: number | string) {
  return ventasFetch<OfertaBackend>(`/procesos/${idProceso}/oferta/aprobar`, {
    method: "POST",
  })
}

// POST /ventas/procesos/:idProceso/oferta/devolver — pone cli_state = "rechazado" y
// guarda las observaciones marcadas; falla 400 si no se marcó ningún campo.
export function devolverOferta(
  idProceso: number | string,
  observaciones: ObservacionOfertaInput[]
) {
  return ventasFetch<OfertaBackend>(`/procesos/${idProceso}/oferta/devolver`, {
    method: "POST",
    body: JSON.stringify({ observaciones }),
  })
}

// --- Financiamiento (tabla de amortización francesa) ---
// Vive en la tabla legacy `financiamientos` — el cronograma completo (una fila por
// cuota) se guarda en su columna `detalle` (JSON), no en una tabla aparte.

// Un cargo de alícuota con nombre propio — ver ComponenteAlicuota en inventario-api.ts.
// La mayoría de los financiamientos tienen uno solo ("Alicuota"), algunos (proyectos
// como Perla Verde) tienen varios, cada uno en su propia columna en la tabla.
export type ComponenteAlicuota = {
  nombre: string
  valor: number
  // Desde cuándo se cobra este componente (YYYY-MM-DD) — null = desde siempre.
  fechaInicio: string | null
}

export type CuotaAmortizacion = {
  mes: number
  fecha: string
  capital: number
  interes: number
  abono: number
  // Componentes de alícuota de esta cuota (nombre + monto) — todas las filas de un
  // mismo financiamiento comparten la misma estructura (vienen del mismo proyecto).
  // Ausente/vacío en financiamientos guardados antes de este cambio — ahí se cae al
  // escalar legado `alicuota` de abajo.
  alicuotas?: ComponenteAlicuota[]
  // Legado — suma de `alicuotas`, se mantiene para financiamientos guardados antes de
  // que se pudiera dividir en componentes con nombre propio.
  alicuota: number
  escritura: number
  cuota: number
  saldo: number
  editado: boolean
  // true si el préstamo ya se terminó de pagar antes de esta fila (queda en $0, es
  // "de más").
  sobrante: boolean
  // true si el asesor fijó a mano la escritura de esta fila — no se toca al repartir
  // el total de escritura entre las demás cuotas reales.
  escrituraEditada: boolean
}

// Tabla de entrada (abono inicial + cuotas de entrada) — va arriba del cronograma de
// amortización, sin interés. Para "Crédito directo" la suma de montos tiene que
// calzar con el 5% del valor del lote (lo valida el backend).
// `abono_lote` es lo que se aplica al lote (la "entrada" que reduce el saldo a
// financiar); `alicuotas`/`escritura` son cargos aparte; `total_cancelar` = abono_lote
// + suma de `alicuotas` + escritura.
export type EntradaPago = {
  forma_pago: string
  fecha_pago: string
  abono_lote: number
  // Ver CuotaAmortizacion.alicuotas — mismo criterio de compatibilidad.
  alicuotas?: ComponenteAlicuota[]
  // Legado — suma de `alicuotas`, ver CuotaAmortizacion.alicuota.
  alicuota_comunal: number
  // Solo "Contado": los $250 fijos de escritura, cargados en la fila "Pago total"
  // (cargo aparte, igual que alicuotas — no se resta del saldo a financiar).
  escritura?: number
  total_cancelar: number
  observaciones: string | null
  // Campos del formato anterior (registros ya guardados) — se leen por compatibilidad.
  concepto?: string
  fecha?: string
  monto?: number
}

export type FinanciamientoBackend = {
  id: number
  created_at: string | null
  init_date: string | null
  financ_type: string | null
  valor_alic: string | null
  total_financ: string | null
  anual_interes: string | null
  no_cuotas: number | null
  cuota_sugerida: string | null
  discount: string | null
  extra_discount: string | null
  promo_discount: string | null
  entrada: string | null
  entradas: EntradaPago[] | null
  detalle: CuotaAmortizacion[] | null
  comentarios: string[] | null
  ofrecimientos: string | null
  status: string | null
  update_at: string | null
  // Promociones aplicadas a este financiamiento (solo las devuelve el GET).
  promociones?: Array<{
    id: number | null
    nombre: string | null
    descuento_aplicado: string | null
  }>
}

export type EntradaPagoInput = {
  formaPago: string
  fechaPago: string
  abonoLote: number
  alicuotas?: ComponenteAlicuota[]
  // Legado — un único monto de alícuota, ver EntradaPago.alicuota_comunal.
  alicuotaComunal?: number
  escritura?: number
  observaciones?: string
}

export type CrearFinanciamientoInput = {
  financType: string
  discount?: number
  extraDiscount?: number
  promocionesIds?: number[]
  entradas: EntradaPagoInput[]
  meses: number
  comentarios?: string[]
  ofrecimientos?: string[]
  fechaInicio?: string
  cuotaSugerida?: number
  // true solo al "Guardar" (finalizar) — deja status en "ingresado". Sin esto el
  // registro queda (o vuelve) en "borrador".
  confirmar?: boolean
  // true solo al "Regenerar cuotas" — arma el cronograma desde cero como si fuera la
  // primera vez, descartando cualquier cuota editada a mano (sin esto, regenerar
  // conserva las cuotas que el asesor ya haya editado).
  descartarEdiciones?: boolean
}

// GET /ventas/procesos/:idProceso/financiamiento — null si el proceso todavía no
// tiene financiamiento creado (finan_id null en sale_process).
export function obtenerFinanciamiento(idProceso: number | string) {
  return ventasFetch<FinanciamientoBackend | null>(
    `/procesos/${idProceso}/financiamiento`
  )
}

// POST /ventas/procesos/:idProceso/financiamiento — crea el financiamiento y genera
// el cronograma (tasa fija de la empresa, 10.6% anual); falla 400 si ya existe uno.
export function crearFinanciamiento(
  idProceso: number | string,
  datos: CrearFinanciamientoInput
) {
  return ventasFetch<FinanciamientoBackend>(`/procesos/${idProceso}/financiamiento`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// POST /ventas/procesos/:idProceso/financiamiento/regenerar — recalcula el
// financiamiento ya creado desde cero con una nueva configuración (descuentos,
// promociones, entrada, meses) — pisa cualquier cuota editada a mano.
export function regenerarFinanciamiento(
  idProceso: number | string,
  datos: CrearFinanciamientoInput
) {
  return ventasFetch<FinanciamientoBackend>(
    `/procesos/${idProceso}/financiamiento/regenerar`,
    {
      method: "POST",
      body: JSON.stringify(datos),
    }
  )
}

// POST /ventas/procesos/:idProceso/financiamiento/cuotas/:mes — edita el abono lote
// y/o la escritura de una cuota puntual (fecha, capital, interés y alícuota no son
// editables). Al editar abonoLote, el interés se conserva y el capital se recalcula
// como la diferencia, y el resto del cronograma se recalcula en cascada para que el
// saldo siga llegando a $0 en la última cuota real (alícuota/escritura se reajustan
// solas al nuevo mes real). Al fijar la escritura de una fila a mano, esa fila queda
// fija y el resto del total de escritura se reparte entre las demás cuotas reales.
export function actualizarCuotaFinanciamiento(
  idProceso: number | string,
  mes: number,
  cambios: { abonoLote?: number; escritura?: number }
) {
  return ventasFetch<FinanciamientoBackend>(
    `/procesos/${idProceso}/financiamiento/cuotas/${mes}`,
    { method: "POST", body: JSON.stringify(cambios) }
  )
}

// POST /ventas/procesos/:idProceso/financiamiento/aprobar — pone financiamiento.status
// = "aprobado" (de donde procesos-content.tsx deriva finan_status), habilitando la
// impresión del anexo. Requiere permiso "financiamiento:aprobar" en el backend —
// solo puede aprobarse un financiamiento que ya esté "ingresado"; esta llamada solo
// ejecuta la acción, la UI ya oculta el botón sin ese permiso (ver <Can> en
// financiamiento-reporte-content.tsx). Devuelve el financiamiento actualizado, no el
// proceso.
export function aprobarFinanciamiento(idProceso: number | string) {
  return ventasFetch<FinanciamientoBackend>(
    `/procesos/${idProceso}/financiamiento/aprobar`,
    {
      method: "POST",
    }
  )
}

// --- Refinanciamiento (mismo motor que Financiamiento, sobre un lote ya vendido) ---
// Vive en la tabla `refinanciamientos` — mismo esquema que `financiamientos`, más la
// tasa anual editable y tres ajustes manuales sobre el valor del lote antes del resto
// del cálculo: abonoRealizado/abonoCapital restan, adicionales suma. Se llega acá desde
// Gestión > Refinanciamientos (/gestion/refinanciamiento), eligiendo un proyecto y
// luego un lote ya vendido — no desde el flujo de Nueva Venta.

export type RefinanciamientoBackend = {
  id: number
  id_process: number
  created_at: string | null
  init_date: string | null
  financ_type: string | null
  valor_alic: string | null
  total_financ: string | null
  anual_interes: string | null
  no_cuotas: number | null
  cuota_sugerida: string | null
  discount: string | null
  extra_discount: string | null
  promo_discount: string | null
  entrada: string | null
  abono_realizado: string | null
  abono_capital: string | null
  adicionales: string | null
  entradas: EntradaPago[] | null
  detalle: CuotaAmortizacion[] | null
  comentarios: string[] | null
  ofrecimientos: string | null
  status: string | null
  // Solo si status === "rechazado" — ver rechazarRefinanciamiento.
  motivo_rechazo: string | null
  update_at: string | null
  promociones?: Array<{
    id: number | null
    nombre: string | null
    descuento_aplicado: string | null
  }>
}

export type CrearRefinanciamientoInput = {
  financType: string
  // Tasa anual editable (a diferencia de Financiamiento, que siempre usa la tasa
  // fija de la empresa) — si se omite, el backend cae a la tasa fija.
  tasaInteres?: number
  // Los tres ajustes manuales sobre el valor del lote — abonoRealizado/abonoCapital
  // restan, adicionales suma.
  abonoRealizado?: number
  abonoCapital?: number
  adicionales?: number
  discount?: number
  extraDiscount?: number
  promocionesIds?: number[]
  entradas: EntradaPagoInput[]
  meses: number
  comentarios?: string[]
  ofrecimientos?: string[]
  fechaInicio?: string
  cuotaSugerida?: number
  confirmar?: boolean
  descartarEdiciones?: boolean
}

// Un lote puede refinanciarse más de una vez — GET procesos/:id/refinanciamiento
// (singular) sigue siendo el activo (sale_process.refinan_id, el más reciente);
// listarRefinanciamientosDeProceso/obtenerRefinanciamientoPorId operan sobre el
// historial completo. Ver mismo comentario en refinanciamiento.controller.ts.

// GET /ventas/procesos/:idProceso/refinanciamiento — el refinanciamiento activo del
// proceso (null si todavía no tiene ninguno). Lo usa la pantalla new/[id] para saber
// si hay un borrador/ingresado que retomar.
export function obtenerRefinanciamientoActivo(idProceso: number | string) {
  return ventasFetch<RefinanciamientoBackend | null>(
    `/procesos/${idProceso}/refinanciamiento`
  )
}

// GET /ventas/procesos/:idProceso/refinanciamientos (plural) — historial completo de
// refinanciamientos de ese proceso, del más reciente al más viejo, cada uno con su
// propio estado.
export function listarRefinanciamientosDeProceso(idProceso: number | string) {
  return ventasFetch<RefinanciamientoBackend[]>(
    `/procesos/${idProceso}/refinanciamientos`
  )
}

// GET /ventas/refinanciamientos/:id — un refinanciamiento puntual por su propio id,
// sea o no el activo del proceso. Lo usan el reporte y el anexo, para poder ver
// cualquiera del historial.
export function obtenerRefinanciamientoPorId(id: number | string) {
  return ventasFetch<RefinanciamientoBackend | null>(`/refinanciamientos/${id}`)
}

// POST /ventas/procesos/:idProceso/refinanciamiento — crea un refinanciamiento nuevo
// y genera el cronograma; falla 400 si el proceso ya tiene uno en curso (borrador o
// ingresado) — una vez aprobado, se puede crear otro.
export function crearRefinanciamiento(
  idProceso: number | string,
  datos: CrearRefinanciamientoInput
) {
  return ventasFetch<RefinanciamientoBackend>(
    `/procesos/${idProceso}/refinanciamiento`,
    {
      method: "POST",
      body: JSON.stringify(datos),
    }
  )
}

// POST /ventas/refinanciamientos/:id/regenerar — recalcula ese refinanciamiento
// puntual desde cero con una nueva configuración — pisa cualquier cuota editada a
// mano (salvo que se reaplique, ver mismo criterio que Financiamiento).
export function regenerarRefinanciamiento(
  idRefinanciamiento: number | string,
  datos: CrearRefinanciamientoInput
) {
  return ventasFetch<RefinanciamientoBackend>(
    `/refinanciamientos/${idRefinanciamiento}/regenerar`,
    {
      method: "POST",
      body: JSON.stringify(datos),
    }
  )
}

// POST /ventas/refinanciamientos/:id/cuotas/:mes — edita el abono lote y/o la
// escritura de una cuota puntual, igual que actualizarCuotaFinanciamiento.
export function actualizarCuotaRefinanciamiento(
  idRefinanciamiento: number | string,
  mes: number,
  cambios: { abonoLote?: number; escritura?: number }
) {
  return ventasFetch<RefinanciamientoBackend>(
    `/refinanciamientos/${idRefinanciamiento}/cuotas/${mes}`,
    { method: "POST", body: JSON.stringify(cambios) }
  )
}

// POST /ventas/refinanciamientos/:id/aprobar — pone refinanciamiento.status =
// "aprobado", habilitando la impresión del anexo. Requiere permiso
// "refinanciamiento:aprobar" en el backend.
export function aprobarRefinanciamiento(idRefinanciamiento: number | string) {
  return ventasFetch<RefinanciamientoBackend>(
    `/refinanciamientos/${idRefinanciamiento}/aprobar`,
    {
      method: "POST",
    }
  )
}

// POST /ventas/refinanciamientos/:id/rechazar — pone refinanciamiento.status =
// "rechazado" con el motivo indicado. Requiere permiso "refinanciamiento:aprobar"
// en el backend (misma acción de revisor que aprobar). Solo se puede rechazar uno
// "ingresado" — se puede editar después (regenerarRefinanciamiento) para corregir y
// volver a dejarlo "ingresado".
export function rechazarRefinanciamiento(
  idRefinanciamiento: number | string,
  motivo: string
) {
  return ventasFetch<RefinanciamientoBackend>(
    `/refinanciamientos/${idRefinanciamiento}/rechazar`,
    {
      method: "POST",
      body: JSON.stringify({ motivo }),
    }
  )
}

// --- Cotizador (mismo motor que Financiamiento, sin vínculo a sale_process) ---
// Vive en la tabla `cotizaciones` — cualquier usuario logeado puede crear las suyas
// (sin el permiso "ventas:crear" que exige Financiamiento): se llega acá desde
// Gestión > Cotizaciones (/gestion/cotizaciones), que primero lista lo ya creado y
// recién al pedir "Nueva cotización" se elige proyecto y lote. El cliente no tiene por
// qué estar registrado como titular de un proceso — nombre/correo/teléfono se guardan
// directo en el registro. Por defecto cada quien ve solo lo suyo; el permiso
// "cotizaciones:ver_todas" agrega la pestaña "Todas las cotizaciones".

export type CotizacionBackend = {
  id: number
  id_user: string
  id_proyecto: number
  codigo_lote: string
  cliente_nombre: string
  cliente_correo: string | null
  cliente_telefono: string | null
  created_at: string | null
  init_date: string | null
  financ_type: string | null
  valor_alic: string | null
  total_financ: string | null
  anual_interes: string | null
  no_cuotas: number | null
  cuota_sugerida: string | null
  discount: string | null
  extra_discount: string | null
  promo_discount: string | null
  entrada: string | null
  entradas: EntradaPago[] | null
  detalle: CuotaAmortizacion[] | null
  comentarios: string[] | null
  ofrecimientos: string | null
  // "borrador" | "ingresado" — sin aprobación: "ingresado" ya es el estado final.
  status: string | null
  update_at: string | null
  promociones?: Array<{
    id: number | null
    nombre: string | null
    descuento_aplicado: string | null
  }>
}

// Solo la trae GET /ventas/cotizaciones/todas (listarTodasCotizaciones) — quién la
// creó, para la columna "Creado por" de esa pestaña.
export type CotizacionConCreador = CotizacionBackend & {
  creador_nombre: string | null
}

export type CrearCotizacionInput = {
  idProyecto: number
  codigoLote: string
  clienteNombre: string
  clienteCorreo?: string
  clienteTelefono?: string
}

export type GuardarCotizacionInput = {
  financType: string
  discount?: number
  extraDiscount?: number
  promocionesIds?: number[]
  entradas: EntradaPagoInput[]
  meses: number
  comentarios?: string[]
  ofrecimientos?: string[]
  fechaInicio?: string
  cuotaSugerida?: number
  confirmar?: boolean
  descartarEdiciones?: boolean
}

// GET /ventas/cotizaciones — solo las cotizaciones creadas por el usuario logeado,
// de la más reciente a la más vieja.
export function listarMisCotizaciones() {
  return ventasFetch<CotizacionBackend[]>("/cotizaciones")
}

// GET /ventas/cotizaciones/todas — todas las cotizaciones de todos los usuarios,
// orden de creación. Requiere permiso "cotizaciones:ver_todas" en el backend.
export function listarTodasCotizaciones() {
  return ventasFetch<CotizacionConCreador[]>("/cotizaciones/todas")
}

// GET /ventas/cotizaciones/promociones-activas — catálogo de promociones vigentes,
// sin exigir "ventas:crear" (a diferencia de listarPromocionesActivas) ya que
// cualquiera puede armar una cotización.
export function listarPromocionesActivasCotizacion() {
  return ventasFetch<PromocionBackend[]>("/cotizaciones/promociones-activas")
}

// GET /ventas/cotizaciones/:id — 403 si no es tuya y no tenés "cotizaciones:ver_todas".
export function obtenerCotizacion(id: number | string) {
  return ventasFetch<CotizacionBackend | null>(`/cotizaciones/${id}`)
}

// POST /ventas/cotizaciones — crea el "casco" (proyecto, lote, datos del cliente) sin
// configuración de financiamiento todavía — el siguiente paso es regenerarCotizacion.
export function crearCotizacion(datos: CrearCotizacionInput) {
  return ventasFetch<CotizacionBackend>("/cotizaciones", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// POST /ventas/cotizaciones/:id/regenerar — única vía de guardado real (arma/recalcula
// la configuración de financiamiento sobre el casco ya creado). Solo quien la creó
// puede llamarla.
export function regenerarCotizacion(
  id: number | string,
  datos: GuardarCotizacionInput
) {
  return ventasFetch<CotizacionBackend>(`/cotizaciones/${id}/regenerar`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// POST /ventas/cotizaciones/:id/cuotas/:mes — edita el abono lote y/o la escritura de
// una cuota puntual, igual que actualizarCuotaFinanciamiento.
export function actualizarCuotaCotizacion(
  id: number | string,
  mes: number,
  cambios: { abonoLote?: number; escritura?: number }
) {
  return ventasFetch<CotizacionBackend>(`/cotizaciones/${id}/cuotas/${mes}`, {
    method: "POST",
    body: JSON.stringify(cambios),
  })
}

// Los tres siguientes son equivalentes a listarProyectos/obtenerLotesLibres
// (inventario-api.ts) y obtenerLote, pero SIN el permiso de Ventas que esas rutas
// exigen (GET /inventarios/proyectos, GET /ventas/proyectos/:id/lotes-libres, GET
// /inventarios/:lote) — "Nueva cotización" (proyecto → lote → datos del cliente)
// tiene que andar para cualquier usuario logeado, no solo quien tenga acceso a
// Ventas. Usar SIEMPRE estos en vez de los de inventario-api.ts dentro de
// /gestion/cotizaciones.

export function listarProyectosCotizacion() {
  return ventasFetch<ProyectoInventario[]>("/cotizaciones/proyectos")
}

export function listarLotesLibresCotizacion(idProyecto: number) {
  return ventasFetch<LoteInventario[]>(
    `/cotizaciones/proyectos/${idProyecto}/lotes-libres`
  )
}

export function obtenerLoteCotizacion(codigo: string) {
  return ventasFetch<LoteInventario | null>(
    `/cotizaciones/lotes/${encodeURIComponent(codigo)}`
  )
}

// --- Pago (vive en la tabla `pagos`) ---
// Solo puede ingresarse una vez que oferta y financiamiento del proceso ya están
// aprobados (ver pagoHabilitado en procesos-content.tsx) — el backend también lo
// rechaza igual que hace con financiamiento/aprobar, la UI solo lo oculta.
// no_recibo y valor_total los pone el backend (recibo autogenerado de 6 dígitos único,
// valor = abono inicial del financiamiento) — nunca los manda el cliente.
export type PagoBackend = {
  id: number
  tipo_pago: string
  // Monto real del pago — igual a valor_esperado salvo que se haya usado "Otro monto".
  valor_total: number
  // Snapshot del abono inicial del financiamiento al momento de crear/editar el pago —
  // se conserva siempre, aunque valor_total termine siendo un monto distinto.
  valor_esperado: number
  no_recibo: string
  ref_pago: string | null
  fec_pago: string | null
  // Banco receptor del pago y su cuenta (ver CUENTAS_BANCOS_RECEPTORES en
  // select-options.ts) — se muestra en el reporte de licitud de fondos, Sección 6.
  institucion_financiera: string | null
  cuenta_destino: string | null
  comentario: string | null
  status: string
  creado_por: string | null
  aprobado_por: string | null
  rechazado_por: string | null
  motivo_rechazo: string | null
  created_at: string | null
  update_at: string | null
}

export type PagoInput = {
  tipoPago: string
  refPago?: string
  fecPago: string
  institucionFinanciera?: string
  comentario?: string
  // "Otro monto" del formulario — si no viene, el backend calcula el valor del abono
  // inicial del financiamiento (ver resolverValorFinal en el backend).
  valorTotal?: number
}

// GET /ventas/procesos/:idProceso/pago — null si el proceso todavía no tiene pago
// creado (payment_id null en sale_process).
export function obtenerPago(idProceso: number | string) {
  return ventasFetch<PagoBackend | null>(`/procesos/${idProceso}/pago`)
}

// POST /ventas/procesos/:idProceso/pago — crea el pago del proceso (falla 400 si ya
// existe, hay que usar actualizarPago).
export function crearPago(idProceso: number | string, datos: PagoInput) {
  return ventasFetch<PagoBackend>(`/procesos/${idProceso}/pago`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// PATCH /ventas/procesos/:idProceso/pago — actualiza el pago ya creado (ej. cuando el
// revisor lo devolvió y el asesor corrige e ingresa de nuevo).
export function actualizarPago(idProceso: number | string, datos: PagoInput) {
  return ventasFetch<PagoBackend>(`/procesos/${idProceso}/pago`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  })
}

// POST /ventas/procesos/:idProceso/pago/aprobar — pone payment_status = "aprobado".
// Requiere permiso "pago:aprobar" en el backend; la UI solo oculta el botón sin ese
// permiso (ver <Can> en pago-reporte-content.tsx).
export function aprobarPago(idProceso: number | string) {
  return ventasFetch<PagoBackend>(`/procesos/${idProceso}/pago/aprobar`, {
    method: "POST",
  })
}

// POST /ventas/procesos/:idProceso/pago/devolver — pone payment_status = "rechazado"
// con el motivo indicado, para que el asesor corrija y vuelva a ingresar.
export function devolverPago(idProceso: number | string, motivo: string) {
  return ventasFetch<PagoBackend>(`/procesos/${idProceso}/pago/devolver`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  })
}

// --- Promociones (motor de descuentos configurables, usado por Financiamiento) ---
export type PromocionBackend = {
  id: number
  nombre: string | null
  tipo_efecto: string | null
  valor_efecto: string | null
  campo_objetivo: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: boolean
}

export type PromocionInput = {
  nombre: string
  tipoEfecto: string
  valorEfecto: number
  campoObjetivo?: string
  fechaInicio?: string
  fechaFin?: string
  activo?: boolean
}

// GET /ventas/promociones — todas (para la pantalla de gestión).
export function listarPromociones() {
  return ventasFetch<PromocionBackend[]>("/promociones")
}

// GET /ventas/promociones/activas — solo las vigentes hoy (activo=true y fecha actual
// dentro de fecha_inicio/fecha_fin), para el selector dentro de Financiamiento.
export function listarPromocionesActivas() {
  return ventasFetch<PromocionBackend[]>("/promociones/activas")
}

export function crearPromocion(datos: PromocionInput) {
  return ventasFetch<PromocionBackend>("/promociones", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function actualizarPromocion(id: number, datos: Partial<PromocionInput>) {
  return ventasFetch<PromocionBackend>(`/promociones/${id}`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// DELETE /ventas/promociones/:id — falla 400 si la promoción ya se aplicó a algún
// financiamiento (el backend protege ese historial); en ese caso solo se puede
// desactivar (actualizarPromocion con activo:false), no eliminar.
export function eliminarPromocion(id: number) {
  return ventasFetch<void>(`/promociones/${id}`, { method: "DELETE" })
}

// --- Catálogo de tipo de inmueble (reporte imprimible de la oferta) ---
// Arranca con "TERRENO"; el usuario puede agregar valores nuevos desde el panel
// "Configurar antes de imprimir" y quedan guardados para todos los reportes.
export type TipoInmuebleBackend = {
  id: number
  nombre: string
}

// GET /ventas/tipos-inmueble
export function listarTiposInmueble() {
  return ventasFetch<TipoInmuebleBackend[]>("/tipos-inmueble")
}

// POST /ventas/tipos-inmueble — el backend normaliza a MAYÚSCULAS y evita duplicados.
export function crearTipoInmueble(nombre: string) {
  return ventasFetch<TipoInmuebleBackend>("/tipos-inmueble", {
    method: "POST",
    body: JSON.stringify({ nombre }),
  })
}

// --- "Mis ventas" / "Reporte de ventas" (botones del topbar) ---

export type EstadoGeneralVenta = "aprobado" | "rechazado" | "en-tramite"

export type MiVenta = {
  id: number
  cliLote: string | null
  cliName: string | null
  cliAsesor: string | null
  proyectoNombre: string | null
  lotePrice: number | null
  createdAt: string | null
  ventaNuevaAt: string | null
  offertStatus: string | null
  financStatus: string | null
  paymentStatus: string | null
  estadoGeneral: EstadoGeneralVenta
  // Cuántos tipos de documento del catálogo requerido le faltan subir o verificar a
  // este proceso (0 = completo) — mismo cálculo que usa el revisor en
  // "pendientes-revision".
  documentosPendientes: number
  // Lugar de venta real (ver LUGARES_VENTA_OPCIONES en select-options.ts) — "oficina" |
  // "Puerto Quito", para la columna "Venta" (OF/PQ) del reporte general.
  location: string | null
  // Tipo de financiamiento de la venta (ver TIPOS_FINANCIAMIENTO) — "Crédito directo",
  // "Crédito BIESS", "Contado", "Mixto".
  tipoVenta: string | null
  // "¿Cómo nos contactó?" de la oferta (ver MEDIOS_CONTACTO_GRUPOS).
  comoNosContacto: string | null
  prospectador: string | null
  // true si "Asistencia en proyecto" (cli_asistenciaProyecto) de la oferta es "Sí" — el
  // reporte general muestra "Karina Coveña" junto al prospectador en ese caso.
  apoyoProyecto: boolean
}

export type ResumenMisVentas = {
  totalProcesos: number
  totalCompletadas: number
  montoTotalVendido: number
}

// GET /ventas/mis-ventas — el backend resuelve el asesor por el nombre de la sesión
// (req.user.name), matcheado contra sale_process.cli_asesor (texto libre, sin FK) —
// nunca se manda el nombre desde acá, evita que el cliente pueda pedir las ventas de
// otro asesor con solo cambiar un query param.
export function obtenerMisVentas(filtros: {
  proyectoId?: number
  desde?: string // YYYY-MM-DD
  hasta?: string // YYYY-MM-DD
  estado?: EstadoGeneralVenta
} = {}) {
  const qs = new URLSearchParams()
  if (filtros.proyectoId) qs.set("proyectoId", String(filtros.proyectoId))
  if (filtros.desde) qs.set("desde", filtros.desde)
  if (filtros.hasta) qs.set("hasta", filtros.hasta)
  if (filtros.estado) qs.set("estado", filtros.estado)
  const query = qs.toString()
  return ventasFetch<{ resumen: ResumenMisVentas; procesos: MiVenta[] }>(
    `/mis-ventas${query ? `?${query}` : ""}`
  )
}

// GET /ventas/reporte-ventas — igual que obtenerMisVentas pero de TODA la empresa
// (permiso "ventas:reporte", no "ventas:crear"); admite filtrar por asesor (coincidencia
// parcial contra cli_asesor, texto libre).
export function obtenerReporteVentas(filtros: {
  proyectoId?: number
  desde?: string // YYYY-MM-DD
  hasta?: string // YYYY-MM-DD
  estado?: EstadoGeneralVenta
  asesor?: string
} = {}) {
  const qs = new URLSearchParams()
  if (filtros.proyectoId) qs.set("proyectoId", String(filtros.proyectoId))
  if (filtros.desde) qs.set("desde", filtros.desde)
  if (filtros.hasta) qs.set("hasta", filtros.hasta)
  if (filtros.estado) qs.set("estado", filtros.estado)
  if (filtros.asesor) qs.set("asesor", filtros.asesor)
  const query = qs.toString()
  return ventasFetch<{ resumen: ResumenMisVentas; procesos: MiVenta[] }>(
    `/reporte-ventas${query ? `?${query}` : ""}`
  )
}
