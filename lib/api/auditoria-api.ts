// Cliente para `/auditoria/*` en anconAPI: ingesta de lo que hace el usuario en el
// navegador (vistas, clics, envíos) y consulta del registro completo (web + API).
//
// Lo que la API hace por su cuenta (peticiones y devoluciones) lo graba el backend en
// `audit_logs`; este archivo solo cubre lo que ocurre en el navegador y la lectura.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const AUDITORIA_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auditoria`
const TIMEOUT_MS = 20_000

export class AuditoriaApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AuditoriaApiError"
    this.status = status
  }
}

async function auditoriaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${AUDITORIA_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AuditoriaApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new AuditoriaApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    throw new AuditoriaApiError(
      cuerpo?.message ?? response.statusText ?? "Error desconocido",
      response.status
    )
  }
  return cuerpo as T
}

export type TipoEventoWeb = "PAGE_VIEW" | "CLICK" | "FORM_SUBMIT" | "UI_ACTION"

export type EventoWeb = {
  tipo: TipoEventoWeb
  ruta: string
  etiqueta?: string
  // Solo UI_ACTION: código de la acción (se normaliza a MAYÚSCULAS_Y_GUIONES).
  accion?: string
  elemento?: {
    tag?: string
    id?: string
    role?: string
    href?: string
    name?: string
  }
  detalle?: Record<string, unknown>
  ts?: number
}

// POST /auditoria/eventos — el actor lo resuelve el servidor desde la sesión.
// `keepalive` permite que el lote salga aunque la pestaña se esté cerrando.
export function enviarEventosWeb(
  eventos: EventoWeb[],
  opciones?: { keepalive?: boolean }
) {
  return auditoriaFetch<{ recibidos: number; guardados: number }>("/eventos", {
    method: "POST",
    body: JSON.stringify({ eventos }),
    keepalive: opciones?.keepalive,
  })
}

export type FiltrosAuditoria = {
  desde?: string
  hasta?: string
  actor?: string
  accion?: string
  entidad?: string
  fuente?: string
  estado?: string
  severidad?: string
  metodo?: string
  q?: string
  page?: number
  pageSize?: number
}

export type EventoAuditoriaResumen = {
  id: string
  uuid: string
  occurredAt: string
  actorId: string | null
  actorName: string | null
  actorEmail: string | null
  actorRole: string | null
  accion: string
  entidad: string
  entityId: string
  fuente: string | null
  estado: "success" | "failure"
  severidad: "info" | "warning" | "critical"
  descripcion: string | null
  ip: string | null
  requestId: string | null
}

export type EventoAuditoriaDetalle = {
  id: string
  uuid: string
  occurred_at: string
  actor_id: string | null
  actor_name_snapshot: string | null
  actor_email_snapshot: string | null
  actor_role_snapshot: string | null
  accion: string | null
  entidad: string | null
  entity_id: string
  source: string | null
  ip_address: string | null
  user_agent: string | null
  request_id: string | null
  session_id: string | null
  status: "success" | "failure"
  severity: "info" | "warning" | "critical"
  description: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  cambios: Array<{
    id: string
    field_name: string
    old_value: string | null
    new_value: string | null
  }>
}

export type CatalogosAuditoria = {
  acciones: string[]
  entidades: string[]
  fuentes: string[]
}

// GET /auditoria/logs
export function listarAuditoria(filtros: FiltrosAuditoria) {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== "" && valor !== null) {
      params.set(clave, String(valor))
    }
  })
  return auditoriaFetch<{
    total: number
    page: number
    pageSize: number
    items: EventoAuditoriaResumen[]
  }>(`/logs?${params.toString()}`)
}

// GET /auditoria/logs/:id
export function obtenerEventoAuditoria(id: string) {
  return auditoriaFetch<EventoAuditoriaDetalle>(`/logs/${encodeURIComponent(id)}`)
}

// GET /auditoria/catalogos
export function obtenerCatalogosAuditoria() {
  return auditoriaFetch<CatalogosAuditoria>("/catalogos")
}
