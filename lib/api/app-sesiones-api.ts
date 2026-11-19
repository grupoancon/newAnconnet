// Gestión de las sesiones de la app móvil (`/app-sesiones` en newApi).
// Exigen sesión de intranet + el permiso app:diagnostico.
import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type { ListaSesiones, ResumenSesiones } from "@/app/(dashboard)/app/sesiones/datos"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/app-sesiones`
const TIMEOUT_MS = 30_000

export class SesionesApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "SesionesApiError"
    this.status = status
  }
}

async function sesionesFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new SesionesApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new SesionesApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const detalle = Array.isArray(cuerpo?.message) ? cuerpo.message.join(". ") : cuerpo?.message
    const mensaje =
      response.status === 403
        ? "No tienes el permiso app:diagnostico para ver las sesiones de la app."
        : response.status === 404 && !detalle
          ? "El backend no tiene el módulo de sesiones (falta desplegar newApi)."
          : (detalle ?? response.statusText ?? "Error desconocido")
    throw new SesionesApiError(mensaje, response.status)
  }
  return cuerpo as T
}

// GET /app-sesiones/resumen
export function obtenerResumenSesiones(): Promise<ResumenSesiones> {
  return sesionesFetch<ResumenSesiones>("/resumen")
}

// GET /app-sesiones?buscar=&pagina=
export function listarSesiones(buscar: string, pagina: number): Promise<ListaSesiones> {
  const params = new URLSearchParams({ pagina: String(pagina) })
  if (buscar.trim()) params.set("buscar", buscar.trim())
  return sesionesFetch<ListaSesiones>(`?${params.toString()}`)
}

// DELETE /app-sesiones/:sessionId
export function cerrarSesionApp(sessionId: string): Promise<{ cerrada: string }> {
  return sesionesFetch(`/${encodeURIComponent(sessionId)}`, { method: "DELETE" })
}
