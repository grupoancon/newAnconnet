// Wrappers tipados sobre los endpoints de RRHH (`/rrhh/*` en el backend) — mismo
// patrón que ventas-api.ts. Todas las llamadas van con `credentials: "include"`: el
// backend audita estas rutas e identifica al actor via la cookie de sesión.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const RRHH_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/rrhh`

export class RrhhApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "RrhhApiError"
    this.status = status
    this.code = code
  }
}

const TIMEOUT_MS = 15_000

async function rrhhFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)
  try {
    response = await fetch(`${RRHH_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: timeoutController.signal,
      headers: {
        // Con FormData el navegador arma solo el Content-Type (con el boundary del multipart).
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new RrhhApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new RrhhApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      cuerpo?.message ?? `Error ${response.status} al conectar con el servidor`
    throw new RrhhApiError(
      Array.isArray(mensaje) ? mensaje.join(", ") : mensaje,
      response.status,
      cuerpo?.code
    )
  }

  return cuerpo as T
}

// GET /rrhh/mi-perfil — nombre/cargo/departamento del usuario logeado (tabla `user`,
// Better Auth) — para precargar los campos de solo lectura "Solicitante"/
// "Departamento"/"Cargo" antes de crear una solicitud.
export type PerfilRrhh = {
  nombre: string
  cargo: string | null
  departamento: string | null
}

export function obtenerMiPerfilRrhh() {
  return rrhhFetch<PerfilRrhh | null>("/mi-perfil")
}

// --- Solicitudes de permiso ---

export type SolicitudPermisoBackend = {
  id: number
  dateS: string | null
  departmentSoliciter: string | null
  details: string | null
  finalTime: string | null
  observation: string | null
  requestedHour: string | null
  soliciter: string | null
  startTime: string | null
  state: string | null
  typePermissions: string | null
  aprovedDate: string | null
  idUserAprobado: string | null
  motivoRechazo: string | null
  created_at: string | null
  // Solo en permisos "con cargo a vacaciones" aprobados: de dónde se descontó y cuánto.
  descuentoFuente: FuenteDescuentoPermiso | null
  descuentoValor: string | null
}

export type GuardarPermisoInput = {
  fechaPermiso: string
  horaInicial: string
  horaFinal: string
  tipoPermiso: string
  detalle?: string
}

// GET /rrhh/permisos — solo las solicitudes creadas por el usuario logeado.
export function listarMisPermisos() {
  return rrhhFetch<SolicitudPermisoBackend[]>("/permisos")
}

// Solo la trae GET /permisos/todas — nombre de quien creó la solicitud.
export type SolicitudPermisoConCreador = SolicitudPermisoBackend & {
  creador_nombre: string | null
}

// Todas las solicitudes de permiso de todos los colaboradores — requiere rrhh:gestionar.
export function listarTodosPermisos() {
  return rrhhFetch<SolicitudPermisoConCreador[]>("/permisos/todas")
}

export function crearPermiso(datos: GuardarPermisoInput) {
  return rrhhFetch<SolicitudPermisoBackend>("/permisos", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// Requiere permiso "rrhh:gestionar" en el backend — sin él, 403 incluso sobre una
// solicitud propia.
export function actualizarPermiso(
  id: number | string,
  datos: Partial<GuardarPermisoInput>
) {
  return rrhhFetch<SolicitudPermisoBackend>(`/permisos/${id}`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function eliminarPermiso(id: number | string) {
  return rrhhFetch<void>(`/permisos/${id}`, { method: "DELETE" })
}

// De dónde se descuenta un permiso "con cargo a vacaciones" al aprobarlo: 1 día de los
// días normales, 1 día de los aumentados, o las horas del permiso de las horas a favor.
export type FuenteDescuentoPermiso = "dias" | "aumentados" | "horas"

// `fuente` es obligatoria solo para el tipo "PERMISO CARGO A VACACIONES".
export function aprobarPermiso(id: number | string, fuente?: FuenteDescuentoPermiso) {
  return rrhhFetch<SolicitudPermisoBackend>(`/permisos/${id}/aprobar`, {
    method: "POST",
    body: JSON.stringify({ fuente }),
  })
}

export function rechazarPermiso(id: number | string, motivo: string) {
  return rrhhFetch<SolicitudPermisoBackend>(`/permisos/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  })
}

// --- Solicitudes de préstamo / anticipo ---

export type SolicitudPrestamoBackend = {
  id: number
  cobroM: string | null
  plazos: string | null
  dateState: string | null
  departmentSoliciter: string | null
  observation: string | null
  cargo: string | null
  soliciter: string | null
  state: string | null
  type: string | null
  created_at: string | null
  valor: number | null
  idUserAprobado: string | null
  motivoRechazo: string | null
}

export type GuardarPrestamoInput = {
  valor: number
  tipoPrestamo: string
  plazos: string
  mesCobro: string
  fecha: string
  detalle?: string
}

export function listarMisPrestamos() {
  return rrhhFetch<SolicitudPrestamoBackend[]>("/prestamos")
}

export type SolicitudPrestamoConCreador = SolicitudPrestamoBackend & {
  creador_nombre: string | null
}

// Todas las solicitudes de préstamo de todos los colaboradores — requiere rrhh:gestionar.
export function listarTodosPrestamos() {
  return rrhhFetch<SolicitudPrestamoConCreador[]>("/prestamos/todas")
}

export function crearPrestamo(datos: GuardarPrestamoInput) {
  return rrhhFetch<SolicitudPrestamoBackend>("/prestamos", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function actualizarPrestamo(
  id: number | string,
  datos: Partial<GuardarPrestamoInput>
) {
  return rrhhFetch<SolicitudPrestamoBackend>(`/prestamos/${id}`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function eliminarPrestamo(id: number | string) {
  return rrhhFetch<void>(`/prestamos/${id}`, { method: "DELETE" })
}

export function aprobarPrestamo(id: number | string) {
  return rrhhFetch<SolicitudPrestamoBackend>(`/prestamos/${id}/aprobar`, {
    method: "POST",
  })
}

export function rechazarPrestamo(id: number | string, motivo: string) {
  return rrhhFetch<SolicitudPrestamoBackend>(`/prestamos/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  })
}

// --- Colaboradores (saldo de vacaciones) — solo rrhh:gestionar ---

export type ColaboradorBackend = {
  id: string
  nombre: string
  email: string
  cargo: string | null
  departamento: string | null
  fechaIngreso: string | null
  diasVacaciones: number
  diasAumentados: number
  diasDescontados: number
  anosTrabajados: number
  // Horas a favor, decimal (1.5 = 1 h 30 min).
  horasFavor: number
}

export type ActualizarSaldoVacacionesInput = {
  diasVacaciones?: number
  diasAumentados?: number
  diasDescontados?: number
  horasFavor?: number
}

export function listarColaboradores() {
  return rrhhFetch<ColaboradorBackend[]>("/colaboradores")
}

export function actualizarSaldoVacaciones(
  idUsuario: string,
  datos: ActualizarSaldoVacacionesInput
) {
  return rrhhFetch<void>(`/colaboradores/${idUsuario}/vacaciones`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// --- Vacaciones: periodos (calendario) y solicitudes ---

export type PeriodoVacacionalBackend = {
  id: number
  etiqueta: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  created_by: string | null
  created_at: string | null
}

export type CrearPeriodoInput = {
  etiqueta: string
  fechaInicio: string
  fechaFin: string
}

// Los activos y vigentes — lo que ve cualquier colaborador para elegir.
export function listarPeriodosDisponibles() {
  return rrhhFetch<PeriodoVacacionalBackend[]>("/vacaciones/periodos")
}

// Todos (incluye inactivos/pasados) — requiere rrhh:gestionar.
export function listarTodosPeriodos() {
  return rrhhFetch<PeriodoVacacionalBackend[]>("/vacaciones/periodos/todos")
}

// Crea el periodo y notifica a todos los colaboradores de una — requiere
// rrhh:gestionar.
export function crearPeriodoVacacional(datos: CrearPeriodoInput) {
  return rrhhFetch<PeriodoVacacionalBackend>("/vacaciones/periodos", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function desactivarPeriodoVacacional(id: number | string) {
  return rrhhFetch<PeriodoVacacionalBackend>(`/vacaciones/periodos/${id}/desactivar`, {
    method: "POST",
  })
}

export type SolicitudVacacionBackend = {
  id: number
  dateS: string | null
  dateE: string | null
  departmentSoliciter: string | null
  details: string | null
  requestedDays: number | null
  soliciter: string | null
  state: string | null
  type: string | null
  observation: string | null
  approvedDays: number | null
  holidaysPeriod: string | null
  aprovedDate: string | null
  created_at: string | null
  periodo_id: number | null
  idUserAprobado: string | null
  // Vacaciones de diciembre asignadas por RRHH a todos (no las eligió el colaborador).
  // Llega como boolean o 0/1 según el endpoint (TypeORM vs SQL crudo) — usar truthy.
  colectiva: boolean | number
  // Cuándo el colaborador descargó su reporte; null = todavía no.
  reporte_descargado_at: string | null
}

// Solo la trae GET /vacaciones/solicitudes/todas — quién la creó.
export type SolicitudVacacionConCreador = SolicitudVacacionBackend & {
  creador_nombre: string | null
}

export type CrearSolicitudVacacionInput = {
  periodoId: number
  detalle?: string
}

export function listarMisSolicitudesVacaciones() {
  return rrhhFetch<SolicitudVacacionBackend[]>("/vacaciones/solicitudes")
}

// Requiere rrhh:gestionar.
export function listarTodasSolicitudesVacaciones() {
  return rrhhFetch<SolicitudVacacionConCreador[]>("/vacaciones/solicitudes/todas")
}

export function crearSolicitudVacacion(datos: CrearSolicitudVacacionInput) {
  return rrhhFetch<SolicitudVacacionBackend>("/vacaciones/solicitudes", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function aprobarSolicitudVacacion(id: number | string) {
  return rrhhFetch<SolicitudVacacionBackend>(`/vacaciones/solicitudes/${id}/aprobar`, {
    method: "POST",
  })
}

export function rechazarSolicitudVacacion(id: number | string, motivo: string) {
  return rrhhFetch<SolicitudVacacionBackend>(`/vacaciones/solicitudes/${id}/rechazar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  })
}

// Asigna las vacaciones de diciembre a todos los colaboradores activos (fin = inicio + 8
// días) — requiere rrhh:gestionar.
export type AsignarVacacionesColectivasResultado = {
  asignados: number
  fechaInicio: string
  fechaFin: string
}

export function asignarVacacionesColectivas(fechaInicio: string) {
  return rrhhFetch<AsignarVacacionesColectivasResultado>("/vacaciones/colectivas", {
    method: "POST",
    body: JSON.stringify({ fechaInicio }),
  })
}

// El colaborador avisa que descargó el reporte de su propia solicitud aprobada.
export function marcarReporteVacacionDescargado(id: number | string) {
  return rrhhFetch<SolicitudVacacionBackend>(
    `/vacaciones/solicitudes/${id}/reporte-descargado`,
    { method: "POST" }
  )
}

// RRHH saca (noAplica=true) o reincorpora (false) a un colaborador de las vacaciones
// colectivas de diciembre — requiere rrhh:gestionar. Si no aplica, deja de verlas y no
// puede descargar el reporte.
export function marcarVacacionColectivaNoAplica(id: number | string, noAplica: boolean) {
  return rrhhFetch<SolicitudVacacionBackend>(`/vacaciones/solicitudes/${id}/no-aplica`, {
    method: "POST",
    body: JSON.stringify({ noAplica }),
  })
}

// Saldo de días de vacaciones del usuario logeado (el backend lo deja al día antes de
// responder: 15 + 1 por cada 5 años de antigüedad, menos las vacaciones aprobadas del
// periodo, más lo no tomado del periodo anterior).
export type MiSaldoVacaciones = {
  periodo: number
  anosTrabajados: number
  diasVacaciones: number
  diasAumentados: number
  diasDescontados: number
  saldoTotal: number
}

export function obtenerMiSaldoVacaciones() {
  return rrhhFetch<MiSaldoVacaciones | null>("/colaboradores/mi-saldo")
}

// --- Documentos (reglamentos generales y expediente individual) ---

export const CATEGORIAS_DOCUMENTO_GENERAL = ["Reglamento", "Política", "Formato", "Otro"]
export const CATEGORIAS_DOCUMENTO_INDIVIDUAL = [
  "Contrato",
  "Addendum",
  "Certificado",
  "Acción de personal",
  "Otro",
]

export type DocumentoRrhhBackend = {
  id: number
  ambito: "general" | "individual"
  usuario_id: string | null
  categoria: string
  titulo: string
  descripcion: string | null
  nombre_archivo: string
  mime: string | null
  tamano: number | null
  subido_por: string | null
  subido_por_nombre: string | null
  created_at: string | null
}

export type SubirDocumentoInput = {
  ambito: "general" | "individual"
  usuarioId?: string
  categoria: string
  titulo: string
  descripcion?: string
}

export function listarDocumentosGenerales() {
  return rrhhFetch<DocumentoRrhhBackend[]>("/documentos/generales")
}

// Los documentos individuales (contratos, addendums...) del usuario logeado.
export function listarMisDocumentos() {
  return rrhhFetch<DocumentoRrhhBackend[]>("/documentos/mios")
}

// Requiere rrhh:gestionar.
export function listarDocumentosDeUsuario(usuarioId: string) {
  return rrhhFetch<DocumentoRrhhBackend[]>(`/documentos/usuario/${usuarioId}`)
}

// Cuántos documentos individuales tiene cada colaborador (id -> total) — rrhh:gestionar.
export function contarDocumentosPorUsuario() {
  return rrhhFetch<Record<string, number>>("/documentos/conteo")
}

// Requiere rrhh:gestionar. Sube el archivo (PDF/Word/Excel/imagen, máx. 15 MB).
export function subirDocumento(datos: SubirDocumentoInput, archivo: File) {
  const formData = new FormData()
  formData.append("ambito", datos.ambito)
  if (datos.usuarioId) formData.append("usuarioId", datos.usuarioId)
  formData.append("categoria", datos.categoria)
  formData.append("titulo", datos.titulo)
  if (datos.descripcion) formData.append("descripcion", datos.descripcion)
  formData.append("archivo", archivo)
  return rrhhFetch<DocumentoRrhhBackend>("/documentos", {
    method: "POST",
    body: formData,
  })
}

// URL firmada y temporal (5 min) para abrir el archivo — el bucket es privado.
export function obtenerUrlDocumento(id: number | string) {
  return rrhhFetch<{ url: string }>(`/documentos/${id}/url`)
}

export function eliminarDocumento(id: number | string) {
  return rrhhFetch<void>(`/documentos/${id}`, { method: "DELETE" })
}
