// Wrappers tipados sobre los endpoints de gestion de inventario (`/inventarios/*` en el
// backend): un solo lugar para la URL base y el manejo de errores — cambiar
// NEXT_PUBLIC_API_URL en .env alcanza para apuntar a otro servidor. Todas las llamadas
// van con `credentials: "include"`: el backend audita estas rutas (audit_logs) e
// identifica al actor via la cookie de sesion.
//
// "Eliminar" un lote es siempre soft-delete: el backend cambia el estado, nunca borra
// la fila fisica de `inventario`.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const INVENTARIO_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/inventarios`

export class InventarioApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "InventarioApiError"
    this.status = status
    this.code = code
  }
}

// Sin timeout, un backend colgado deja el fetch en pending para siempre y la UI se
// queda en el spinner de carga indefinidamente (nunca llega a .then ni a .catch). 15s
// es margen suficiente para una red lenta sin dejar al usuario esperando eternamente.
const TIMEOUT_MS = 15_000

async function inventarioFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)
  // Con FormData (subida del plano) no hay que fijar Content-Type a mano: el navegador
  // arma el boundary del multipart solo, y si uno mismo pone "application/json" el body
  // multipart llega roto (mismo criterio que ventasFetch en ventas-api.ts).
  const esFormData = options.body instanceof FormData
  try {
    response = await fetch(`${INVENTARIO_BASE_URL}${path}`, {
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
      throw new InventarioApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new InventarioApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      cuerpo?.message ?? cuerpo?.error ?? response.statusText ?? "Error desconocido"
    throw new InventarioApiError(mensaje, response.status, cuerpo?.code)
  }

  return cuerpo as T
}

// Estados canonicos que devuelve el backend en `estado` (a veces con espacio inicial,
// tipo " LIBRE" — ver normalizarEstado en inventario-content.tsx para el trim/display).
// "Facturado" no está acá: no se elige a mano, se deriva de numFac+anioFac (ver
// esLoteFacturado en inventario-content.tsx). Vendido/Bloqueado/Inactivo se sacaron del
// selector de "Cambiar estado" — el conjunto real que se usa es Libre/Reservado/
// Convenio/Hipotecado; eliminarLote() sigue mandando "INACTIVO" directo al backend, no
// depende de esta lista.
export const ESTADOS_LOTE = [
  { value: "LIBRE", label: "Libre" },
  { value: "RESERVADO", label: "Reservado" },
  { value: "CONVENIO", label: "Convenio" },
  { value: "HIPOTECADO", label: "Hipotecado" },
] as const

export type EstadoLote = (typeof ESTADOS_LOTE)[number]["value"]

// Un cargo de alícuota con nombre propio — la mayoría de los proyectos tienen uno solo
// (nombre genérico "Alicuota", sintetizado por el backend a partir del escalar legado
// `alicuota` si el proyecto todavía no tiene componentes propios configurados), pero
// algunos (ej. Perla Verde) cobran varios por separado, cada uno en su propia columna
// en la tabla de entrada/cronograma de financiamiento.
export type ComponenteAlicuota = {
  nombre: string
  valor: number
  // Desde cuándo se cobra este componente (YYYY-MM-DD) — null = desde siempre. Las
  // cuotas/filas con fecha anterior a esta muestran $0 en este componente.
  fechaInicio: string | null
}

// Resumen del proyecto embebido en cada fila de inventario (viene anidado tal cual en
// la respuesta de GET /inventarios, no es un fetch aparte).
export type ProyectoInventario = {
  id: number
  stock: number
  escritura: number
  // Legado — reemplazado por componentesAlicuota, se deja de solo lectura.
  alicuota: number
  componentesAlicuota: ComponenteAlicuota[]
  fecha_entrega: string | null
  estado: string
  nomenclatura: string
  nombre: string
  etapa: number
  // Se muestra en el reporte de licitud de fondos como "Dirección del inmueble".
  direccion: string | null
  // URL de la imagen del plano del proyecto (ver subirPlanoProyecto) — null si todavía
  // no se subió ninguna.
  plano_url: string | null
  // Posición elegida en Gestión de inventario → "Ordenar" (null = sin orden, va al
  // final). GET /inventarios/proyectos ya devuelve la lista en este orden.
  orden?: number | null
  // Texto y foto de la tarjeta del proyecto (Nueva Venta / catálogo). null = se usa la
  // vitrina por defecto del frontend (ver selector-proyectos-content.tsx).
  descripcion?: string | null
  imagen_url?: string | null
}

export type PuntoPlano = { x: number; y: number }

// Forma real de una fila que devuelve GET /inventarios.
export type LoteInventario = {
  id: number
  id_proyecto: number
  proyecto: ProyectoInventario
  codigo: string
  estado: string
  numFac: string
  anioFac: string
  pvp: string
  costo: string
  areaUtil: string
  areaProtec: string
  created_at: string | null
  // Posición del lote sobre proyecto.plano_url — porcentaje (0-100) relativo al
  // ancho/alto de esa imagen, no píxeles. null = todavía no ubicado en el plano.
  plano_x: number | null
  plano_y: number | null
  // Segunda esquina de una zona rectangular (plano_x/plano_y son la primera, siempre la
  // esquina superior izquierda) — mismo porcentaje 0-100. Ambas null = el lote sigue
  // usando el punto simple de arriba (compatibilidad con lo mapeado antes de que
  // existiera esta opción); si están, se dibuja un rectángulo en vez de un pin.
  plano_x2: number | null
  plano_y2: number | null
  // Forma libre (polígono) del lote — lista de puntos en orden, mismo porcentaje 0-100
  // (se cierra implícitamente del último punto al primero). Con 3+ puntos tiene
  // prioridad sobre plano_x2/plano_y2 para dibujar la zona.
  plano_poligono: PuntoPlano[] | null
}

export type LoteInventarioInput = {
  id_proyecto: number
  codigo: string
  estado: EstadoLote
  numFac?: string
  anioFac?: string
  pvp?: number
  costo?: number
  areaUtil?: number
  areaProtec?: number
}

// GET /inventarios — lista completa (filtros opcionales por querystring); la pantalla
// pagina/busca en el cliente sobre este resultado, igual que InventarioLotesContent.
export function listarInventario(filtros?: { proyecto?: string; estado?: string }) {
  const query = new URLSearchParams()
  if (filtros?.proyecto) query.set("proyecto", filtros.proyecto)
  if (filtros?.estado) query.set("estado", filtros.estado)
  const qs = query.toString()
  return inventarioFetch<LoteInventario[]>(`${qs ? `?${qs}` : ""}`)
}

// GET /inventarios/:codigo — detalle de un lote (usado, p. ej., por el formulario de
// "Nuevo proceso" para traer proyecto/precio/metraje a partir del codigo en la URL).
export function obtenerLote(codigo: string) {
  return inventarioFetch<LoteInventario>(`/${encodeURIComponent(codigo)}`)
}

// POST /inventarios — crea un lote nuevo (el codigo lo define quien lo crea, no es
// autogenerado: son codigos tipo "G-M2-45").
export function crearLote(data: LoteInventarioInput) {
  return inventarioFetch<LoteInventario>("", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// Una fila de la importación masiva, tal como viene del archivo (todo texto).
export type FilaImportacionLote = {
  codigo: string
  estado: string
  areaUtil: string
  areaProtec: string
  pvp: string
  costo: string
  numFac: string
  anioFac: string
}

export type ResultadoImportacionLotes = {
  total: number
  validas: number
  // fila = número de fila de datos (1 = la primera después del encabezado).
  errores: { fila: number; codigo: string; mensajes: string[] }[]
  creados: number
}

// POST /inventarios/importar — crea muchos lotes de un proyecto de una vez. Con
// soloValidar no guarda nada y devuelve los errores por fila (vista previa). Si hay un
// solo error tampoco guarda nada: es todo o nada.
export function importarLotes(
  idProyecto: number,
  filas: FilaImportacionLote[],
  soloValidar: boolean
) {
  return inventarioFetch<ResultadoImportacionLotes>("/importar", {
    method: "POST",
    body: JSON.stringify({ idProyecto, filas, soloValidar }),
  })
}

// PATCH /inventarios/:codigo — actualiza los datos de un lote existente (no toca el
// estado; para eso ver cambiarEstadoLote, que usa un endpoint aparte).
export function actualizarLote(
  codigo: string,
  data: Partial<Omit<LoteInventarioInput, "codigo" | "estado">>
) {
  return inventarioFetch<LoteInventario>(`/${encodeURIComponent(codigo)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

// PATCH /inventarios/:id/estado — cambia solo el estado de un lote, identificado por
// `id` (no por `codigo`, a diferencia de los demas endpoints de este archivo). El
// backend espera el estado en minuscula (ej. "vendido", "libre"), aunque el resto de la
// app lo maneje en mayuscula (ESTADOS_LOTE, GET /inventarios) — se hace el lowercase
// aca mismo para no filtrar esa inconsistencia al resto del codigo. "motivo" es
// opcional, para la bitacora (tabla `inventario_mod`).
export function cambiarEstadoLote(id: number, estado: EstadoLote, motivo?: string) {
  return inventarioFetch<LoteInventario>(`/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado: estado.toLowerCase(), motivo }),
  })
}

// DELETE /inventarios/:codigo — "eliminar" desde la UI, pero el backend NUNCA borra la
// fila: internamente equivale a cambiarEstadoLote(id, "INACTIVO") + registro en la
// bitacora. Se expone como DELETE (verbo REST correcto desde la perspectiva del cliente)
// aunque la implementacion real sea un UPDATE.
export function eliminarLote(codigo: string, motivo?: string) {
  return inventarioFetch<{ success: boolean }>(`/${encodeURIComponent(codigo)}`, {
    method: "DELETE",
    body: JSON.stringify({ motivo }),
  })
}

// Solo "ACTIVO" aparece hoy en los datos reales, pero el modulo de gestion permite
// marcar un proyecto como INACTIVO (no hay endpoint de borrado, este es el equivalente).
export const ESTADOS_PROYECTO = [
  { value: "ACTIVO", label: "Activo" },
  { value: "INACTIVO", label: "Inactivo" },
] as const

export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]["value"]

// stock no entra acá: ya no es editable, el backend lo calcula solo (lotes del
// proyecto en `inventario` menos los que ya están en estado "convenio").
export type ProyectoInventarioInput = {
  nombre: string
  nomenclatura: string
  etapa: number
  escritura: number
  componentesAlicuota: ComponenteAlicuota[]
  fecha_entrega: string | null
  estado: EstadoProyecto
  direccion?: string
  descripcion?: string | null
  // Solo para quitar la foto (null); para ponerla se usa subirImagenProyecto.
  imagen_url?: null
}

// GET /inventarios/proyectos — lista completa de proyectos.
export function listarProyectos() {
  return inventarioFetch<ProyectoInventario[]>("/proyectos")
}

// GET /inventarios/proyectos/:id — detalle de un proyecto.
export function obtenerProyecto(id: number) {
  return inventarioFetch<ProyectoInventario>(`/proyectos/${id}`)
}

// POST /inventarios/proyectos — crea un proyecto nuevo (el id lo autogenera el backend).
export function crearProyecto(data: ProyectoInventarioInput) {
  return inventarioFetch<ProyectoInventario>("/proyectos", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// PATCH /inventarios/proyectos/:id — actualiza un proyecto existente.
export function actualizarProyecto(id: number, data: Partial<ProyectoInventarioInput>) {
  return inventarioFetch<ProyectoInventario>(`/proyectos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

// PATCH /inventarios/proyectos/orden — guarda el orden de los proyectos: `ids` en el
// orden en que se deben mostrar. Devuelve la lista completa ya ordenada.
export function ordenarProyectos(ids: number[]) {
  return inventarioFetch<ProyectoInventario[]>("/proyectos/orden", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  })
}

// POST /inventarios/proyectos/:id/plano — sube (o reemplaza) la imagen del plano de un
// proyecto. Si el usuario eligió un PDF, quien llama ya lo convirtió a imagen antes
// (ver pdfPaginaAImagen en el editor de plano) — acá siempre viaja un archivo de imagen.
export function subirPlanoProyecto(idProyecto: number, archivo: File | Blob) {
  const formData = new FormData()
  formData.append("file", archivo, "plano.png")
  return inventarioFetch<ProyectoInventario>(`/proyectos/${idProyecto}/plano`, {
    method: "POST",
    body: formData,
  })
}

// POST /inventarios/proyectos/:id/imagen — sube (o reemplaza) la foto de la tarjeta del
// proyecto. Solo imágenes, máx. 8 MB.
export function subirImagenProyecto(idProyecto: number, archivo: File) {
  const formData = new FormData()
  formData.append("file", archivo, archivo.name)
  return inventarioFetch<ProyectoInventario>(`/proyectos/${idProyecto}/imagen`, {
    method: "POST",
    body: formData,
  })
}

export type ZonaLotePayload = {
  planoX: number | null
  planoY: number | null
  planoX2?: number | null
  planoY2?: number | null
  planoPoligono?: PuntoPlano[] | null
}

// PATCH /inventarios/:id — guarda dónde/cómo va un lote sobre el plano de su proyecto,
// en uno de 3 modos excluyentes entre sí (el que se manda "gana" y limpia los campos de
// los otros dos, ver comentario en la entidad del backend):
// - Punto simple: solo planoX/planoY.
// - Zona rectangular: + planoX2/planoY2 (planoX/planoY son la esquina superior
//   izquierda).
// - Zona poligonal: + planoPoligono (3+ puntos en orden); planoX/planoY ahí son la
//   esquina superior izquierda de su bounding box, no una posición real "clickeable".
// Todo en null (sin planoX2/planoY2/planoPoligono) para sacarlo del plano. Va por el id
// numérico del lote, no por su código — mismo criterio que cambiarEstadoLote más abajo.
export function actualizarPosicionLote(id: number, zona: ZonaLotePayload) {
  return inventarioFetch<LoteInventario>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      plano_x: zona.planoX,
      plano_y: zona.planoY,
      plano_x2: zona.planoX2 ?? null,
      plano_y2: zona.planoY2 ?? null,
      plano_poligono: zona.planoPoligono ?? null,
    }),
  })
}
