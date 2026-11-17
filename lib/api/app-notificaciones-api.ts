// Notificaciones push a la app móvil (`/app-notificaciones` en newApi). Exigen sesión
// de intranet + el permiso app:notificaciones (ver prisma/sql/permiso_app_notificaciones.sql).
import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type {
  EnvioNotificacion,
  EstadoNotificacion,
  Notificacion,
  TipoNotificacion,
} from "@/app/(dashboard)/app/notificaciones/datos"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
const TIMEOUT_MS = 30_000

export class NotificacionesApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "NotificacionesApiError"
    this.status = status
  }
}

async function notificacionesFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init.body
        ? { "Content-Type": "application/json", ...init.headers }
        : init.headers,
      credentials: "include",
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new NotificacionesApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new NotificacionesApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const detalle = Array.isArray(cuerpo?.message)
      ? cuerpo.message.join(". ")
      : cuerpo?.message
    const mensaje =
      response.status === 403
        ? "No tienes el permiso app:notificaciones para gestionar las notificaciones de la app."
        : response.status === 404 && !detalle
          ? "El backend no tiene el módulo de notificaciones (falta desplegar newApi)."
          : (detalle ?? response.statusText ?? "Error desconocido")
    throw new NotificacionesApiError(mensaje, response.status)
  }
  return cuerpo as T
}

export type NuevaNotificacion = {
  titulo: string
  contenido: string
  tipo: TipoNotificacion
  imagen?: string
  url?: string
  user_id?: string
  segmento?: Record<string, unknown>
  // ISO. Sin fecha = enviar ya.
  fecha_enviar?: string
}

export function listarNotificaciones(
  estado?: EstadoNotificacion
): Promise<Notificacion[]> {
  const params = new URLSearchParams({ limite: "50" })
  if (estado) params.set("estado", estado)
  return notificacionesFetch(`/app-notificaciones?${params.toString()}`)
}

export function obtenerNotificacion(
  id: number
): Promise<{ notificacion: Notificacion; envios: EnvioNotificacion[] }> {
  return notificacionesFetch(`/app-notificaciones/${id}`)
}

export function crearNotificacion(datos: NuevaNotificacion): Promise<Notificacion> {
  return notificacionesFetch("/app-notificaciones", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function enviarNotificacionYa(id: number): Promise<unknown> {
  return notificacionesFetch(`/app-notificaciones/${id}/enviar-ya`, { method: "POST" })
}

export function cancelarNotificacion(id: number): Promise<unknown> {
  return notificacionesFetch(`/app-notificaciones/${id}`, { method: "DELETE" })
}
