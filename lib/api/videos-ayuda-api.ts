// Gestión de los videos de la sección Ayuda de la app móvil (`/videos-ayuda` en newApi).
// Exigen sesión de intranet + el permiso app:ayudas. La app los lee desde anconAPI.
import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type { VideoAyuda, VideoAyudaForm } from "@/app/(dashboard)/app/ayudas/datos"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/videos-ayuda`
const TIMEOUT_MS = 30_000

export class VideosAyudaApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "VideosAyudaApiError"
    this.status = status
  }
}

async function videosAyudaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
      throw new VideosAyudaApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new VideosAyudaApiError("No se pudo conectar con el servidor", 0)
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
        ? "No tienes el permiso app:ayudas para gestionar los videos de ayuda."
        : response.status === 404 && !detalle
          ? "El backend no tiene el módulo de videos de ayuda (falta desplegar newApi)."
          : (detalle ?? response.statusText ?? "Error desconocido")
    throw new VideosAyudaApiError(mensaje, response.status)
  }
  return cuerpo as T
}

const json = (cuerpo: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
})

// GET /videos-ayuda
export function listarVideosAyuda(): Promise<VideoAyuda[]> {
  return videosAyudaFetch<VideoAyuda[]>("")
}

// POST /videos-ayuda
export function crearVideoAyuda(form: VideoAyudaForm): Promise<VideoAyuda> {
  return videosAyudaFetch<VideoAyuda>("", { method: "POST", ...json(form) })
}

// PATCH /videos-ayuda/:id
export function actualizarVideoAyuda(id: number, cambios: Partial<VideoAyudaForm>): Promise<VideoAyuda> {
  return videosAyudaFetch<VideoAyuda>(`/${id}`, { method: "PATCH", ...json(cambios) })
}

// DELETE /videos-ayuda/:id
export function eliminarVideoAyuda(id: number): Promise<{ eliminado: number }> {
  return videosAyudaFetch(`/${id}`, { method: "DELETE" })
}
