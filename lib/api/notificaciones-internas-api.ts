// Wrappers tipados sobre `/notificaciones-internas/*` (anconAPI) — centro de
// notificaciones in-app para colaboradores, distinto del módulo "Notificaciones"
// existente (ese es push vía OneSignal para clientes externos, ver
// lib/api/notificaciones-api.ts). Mismo patrón de fetch que ventas-api.ts/rrhh-api.ts.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/notificaciones-internas`

export class NotificacionesInternasApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "NotificacionesInternasApiError"
    this.status = status
  }
}

const TIMEOUT_MS = 15_000

async function fetchInterno<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: timeoutController.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new NotificacionesInternasApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new NotificacionesInternasApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      cuerpo?.message ?? `Error ${response.status} al conectar con el servidor`
    throw new NotificacionesInternasApiError(
      Array.isArray(mensaje) ? mensaje.join(", ") : mensaje,
      response.status
    )
  }

  return cuerpo as T
}

export type NotificacionInternaBackend = {
  id: number
  titulo: string
  cuerpo: string | null
  link: string | null
  leida_at: string | null
  created_at: string | null
}

export function listarMisNotificacionesInternas() {
  return fetchInterno<NotificacionInternaBackend[]>("/mias")
}

export function contarNotificacionesInternasNoLeidas() {
  return fetchInterno<{ total: number }>("/no-leidas/contador")
}

export function marcarNotificacionInternaLeida(id: number | string) {
  return fetchInterno<NotificacionInternaBackend>(`/${id}/leer`, { method: "POST" })
}

export function marcarTodasNotificacionesInternasLeidas() {
  return fetchInterno<void>("/leer-todas", { method: "POST" })
}
