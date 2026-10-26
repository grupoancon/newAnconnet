// Wrappers tipados sobre los endpoints de entregas (`/entregas/*` en el backend).
// Todas las llamadas van con `credentials: "include"`: el backend identifica al actor
// via la cookie de sesion.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const ENTREGAS_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/entregas`
// Mas holgado que 15 s: la entrega sube una foto.
const TIMEOUT_MS = 30_000

export class EntregasApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "EntregasApiError"
    this.status = status
    this.code = code
  }
}

// Revision de ofrecimientos: SI | NO | PD (pendiente) | NA (no aplica)
export type RevisionOfrecimiento = "SI" | "NO" | "PD" | "NA"

export type EstadoPaso = "PENDIENTE" | "COMPLETO" | "OBSERVACION"

export type EntregaListado = {
  id: number
  processId: number | null
  cliente: string | null
  lote: string | null
  proyectoId: number | null
  proyecto: string | null
  asesor: string | null
  encargado: string | null
  // YYYY-MM-DD y HH:mm tal como los formatea el backend (sin zona horaria).
  fechaPlanificada: string | null
  hora: string | null
  // Fecha/hora confirmada en la pre-entrega (= entrega agendada)
  fechaConfirmada: boolean
  // La pre-entrega ya se guardo (condicion para registrar la entrega)
  preRegistrada: boolean
  // Pasaron 2 dias de la fecha agendada y la entrega no se ha registrado (se pinta en amarillo)
  vencida: boolean
  tanque: RevisionOfrecimiento | null
  huerto: RevisionOfrecimiento | null
  preEntrega: EstadoPaso
  entrega: EstadoPaso
  cerrada: boolean
  reagendamientos: number
  ofrecimientosPendientes: number
  creadoEn: string | null
}

export type EntregasResumen = {
  sinFechaProgramada: number
  reagendamientos: number
  promedioDias: number | null
  ofrecimientosPendientes: number
}

export type EntregasListadoRespuesta = {
  items: EntregaListado[]
  resumen: EntregasResumen
}

async function entregasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  // Con FormData el navegador arma solo el Content-Type (con el boundary del multipart).
  const esFormData = options.body instanceof FormData
  try {
    response = await fetch(`${ENTREGAS_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: {
        ...(esFormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new EntregasApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new EntregasApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    throw new EntregasApiError(
      cuerpo?.message ?? cuerpo?.error ?? response.statusText ?? "Error desconocido",
      response.status,
      cuerpo?.code
    )
  }
  return cuerpo as T
}

// GET /entregas
export function listarEntregas() {
  return entregasFetch<EntregasListadoRespuesta>("")
}

export const TIPOS_FINANCIAMIENTO = [
  "Contado",
  "Crédito directo",
  "BIESS",
  "Mixto",
  "Trueque",
]

export type AsesorOpcion = { id: string; name: string }

export type LoteSap = {
  lote: string
  cliente: string | null
  asesor: string | null
  asesorId: string | null
  asesorCandidatos: AsesorOpcion[]
  tipoFinanciamiento: string | null
  ofrecimientos: string | null
  sapDocEntry: number | null
}

// GET /entregas/asesores — usuarios activos que pueden asignarse a una entrega.
export function listarAsesoresEntrega() {
  return entregasFetch<AsesorOpcion[]>("/asesores")
}

// GET /entregas/sap/:lote — orden abierta (proceso activo) del lote en SAP. 404 si no
// hay ninguna, 409 si el lote ya tiene proceso de entrega.
export function buscarLoteEnSap(lote: string) {
  return entregasFetch<LoteSap>(`/sap/${encodeURIComponent(lote)}`)
}

// Cliente y ofrecimientos no se envian: el backend los vuelve
// a leer de SAP a partir del lote.
export type CrearEntregaPayload = {
  lote: string
  // id del usuario (asesor) que realiza la entrega
  asesorId: string
  tipoFinanciamiento?: string
  // YYYY-MM-DD y HH:mm
  fechaPlanificada: string
  horaPlanificada: string
  revision: {
    huerto: RevisionOfrecimiento | null
    tanque: RevisionOfrecimiento | null
    tag: RevisionOfrecimiento | null
  }
  trabajosExtra?: string
  comentario?: string
}

// POST /entregas — falla 409 si el lote ya tiene proceso de entrega.
export function crearEntrega(datos: CrearEntregaPayload) {
  return entregasFetch<{ id: number }>("", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export const ITEMS_PRE_ENTREGA = [
  { id: "limpieza", label: "Limpieza" },
  { id: "tanque", label: "Tanque" },
  { id: "huerto", label: "Huerto" },
  { id: "linderos", label: "Linderos" },
  { id: "llave", label: "Llave de agua" },
] as const
export type ItemPreEntrega = (typeof ITEMS_PRE_ENTREGA)[number]["id"]
export type ChecklistPreEntrega = Record<ItemPreEntrega, RevisionOfrecimiento>

// La entrega repite los puntos de la pre-entrega y suma tres propios.
export const ITEMS_ENTREGA = [
  ...ITEMS_PRE_ENTREGA,
  { id: "naranjo", label: "Naranjo con lazo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "tag", label: "Tag de ingreso" },
] as const
export type ItemEntrega = (typeof ITEMS_ENTREGA)[number]["id"]
export type ChecklistEntrega = Record<ItemEntrega, RevisionOfrecimiento>

// Con que se marco como completado un paso que tenia observaciones o PD.
export type ResolucionPaso = {
  fecha: string | null
  por: string | null
  nota: string | null
}

export type EntregaDetalle = {
  id: number
  lote: string | null
  cliente: string | null
  proyecto: string | null
  asesor: string | null
  fechaPlanificada: string | null
  hora: string | null
  fechaConfirmada: boolean
  historialReagendamientos: {
    fechaAnterior: string | null
    horaAnterior: string | null
    fecha: string | null
    hora: string | null
    motivo: string | null
    por: string | null
  }[]
  tipoFinanciamiento: string | null
  ofrecimientos: string[]
  revision: {
    huerto: RevisionOfrecimiento | null
    tanque: RevisionOfrecimiento | null
    tag: RevisionOfrecimiento | null
  }
  trabajosExtra: string | null
  comentario: string | null
  origen: string
  creadoEn: string | null
  creadoPor: string | null
  reagendamientos: number
  cerrada: boolean
  // id del usuario asignado (asesor que realiza la entrega)
  asesorId: string | null
  entrega: {
    estado: EstadoPaso
    // null = aun no se registro; con fila, solo trae los puntos que tienen valor
    items: Partial<ChecklistEntrega> | null
    motivos: Partial<Record<ItemEntrega, string>>
    resolucion: ResolucionPaso | null
    fotoUrl: string | null
    // id de quien hizo la entrega (el asesor asignado u otro asesor de ventas)
    realizadaPorId: string | null
    observacion: string | null
    fecha: string | null
    registradoPor: string | null
  }
  cierre: {
    cerrada: boolean
    fecha: string | null
    cerradoPor: string | null
    observacion: string | null
  }
  preEntrega: {
    estado: EstadoPaso
    items: ChecklistPreEntrega | null
    resolucion: ResolucionPaso | null
    observacion: string | null
    fecha: string | null
    registradoPor: string | null
  }
}

// GET /entregas/:id
export function obtenerEntrega(id: number) {
  return entregasFetch<EntregaDetalle>(`/${id}`)
}

// POST /entregas/:id/pre-entrega — crea o actualiza la pre-entrega. Los cinco puntos
// son obligatorios; el backend calcula el estado (PD -> pendiente, NO -> observacion).
export function guardarPreEntrega(
  id: number,
  datos: {
    items: ChecklistPreEntrega
    observacion?: string
    // Confirmar la fecha/hora del proceso, o elegir otra (con motivo).
    agenda:
      | { confirmar: true }
      | { confirmar: false; fecha: string; hora: string; motivo: string }
  }
) {
  return entregasFetch<{ id: number; estado: EstadoPaso }>(`/${id}/pre-entrega`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// POST /entregas/:id/reagendar — mueve la fecha/hora de entrega (con motivo) y deja el
// re-agendamiento registrado. Falla 409 si la entrega ya se realizo o el proceso cerro.
export function reagendarEntrega(
  id: number,
  datos: { fecha: string; hora: string; motivo: string }
) {
  return entregasFetch<{ id: number; fecha: string; hora: string }>(`/${id}/reagendar`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// POST /entregas/:id/entrega (multipart) — solo el asesor asignado, y solo con la
// pre-entrega ya guardada. Cada punto distinto al de la pre-entrega, o en PD, lleva su
// motivo. La foto es obligatoria la primera vez; al corregir se conserva la guardada si
// no se envia una nueva.
export function guardarEntrega(
  id: number,
  datos: {
    items: ChecklistEntrega
    observacion?: string
    motivos: Partial<Record<ItemEntrega, string>>
    // Solo si la entrega la hizo otro asesor de ventas; vacio = el asesor asignado.
    realizadaPorId?: string
  },
  foto: File | null
) {
  const formData = new FormData()
  formData.append("datos", JSON.stringify(datos))
  if (foto) formData.append("foto", foto)
  return entregasFetch<{ id: number; estado: EstadoPaso }>(`/${id}/entrega`, {
    method: "POST",
    body: formData,
  })
}

// GET /entregas/asesores-ventas — usuarios con rol "Asesor de Ventas" (quien puede hacer
// una entrega en lugar del asesor asignado).
export function listarAsesoresVentasEntrega() {
  return entregasFetch<AsesorOpcion[]>("/asesores-ventas")
}

export type ConflictoAgenda = {
  id: number
  cliente: string | null
  lote: string | null
  fecha: string
  hora: string
  // CONFIRMADA = la pre-entrega ya confirmo esa fecha/hora; PLANIFICADA = solo agendada
  estado: "PLANIFICADA" | "CONFIRMADA"
}

export type ResultadoConflictos = {
  conflictos: ConflictoAgenda[]
  // Primera hora libre del mismo dia a partir de la pedida (null si no queda ninguna)
  sugerencia: { fecha: string; hora: string } | null
}

// GET /entregas/conflictos — entregas abiertas del asesor ese dia que chocan (cada
// entrega ocupa 60 min) y la primera hora libre. `excluirId` deja fuera el proceso que
// se esta re-agendando o confirmando.
export function buscarConflictosAgenda(params: {
  asesorId: string
  fecha: string
  hora: string
  excluirId?: number
}) {
  const query = new URLSearchParams({
    asesorId: params.asesorId,
    fecha: params.fecha,
    hora: params.hora,
  })
  if (params.excluirId) query.set("excluirId", String(params.excluirId))
  return entregasFetch<ResultadoConflictos>(`/conflictos?${query.toString()}`)
}

// POST /entregas/:id/pre-entrega/completar | /entrega/completar — marca como COMPLETO un
// paso con observaciones o PD (permiso entregas:cerrar). Los datos originales no cambian.
export function completarPaso(
  id: number,
  paso: "pre-entrega" | "entrega",
  nota?: string
) {
  return entregasFetch<{ id: number; paso: string; estado: EstadoPaso }>(
    `/${id}/${paso}/completar`,
    { method: "POST", body: JSON.stringify({ nota }) }
  )
}

// POST /entregas/:id/cerrar — requiere pre-entrega y entrega completas (409 si no).
export function cerrarProceso(id: number, observacion?: string) {
  return entregasFetch<{ id: number }>(`/${id}/cerrar`, {
    method: "POST",
    body: JSON.stringify({ observacion }),
  })
}
