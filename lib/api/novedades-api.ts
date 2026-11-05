// Gestión de las novedades del Inicio de la app móvil (`/novedades` en newApi).
// Exigen sesión de intranet + el permiso app:novedades. La app las lee desde anconAPI.
import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type { Novedad, NovedadForm } from "@/app/(dashboard)/app/novedades/datos"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/novedades`
const TIMEOUT_MS = 30_000

export class NovedadesApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "NovedadesApiError"
    this.status = status
  }
}

async function novedadesFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
      throw new NovedadesApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new NovedadesApiError("No se pudo conectar con el servidor", 0)
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
        ? "No tienes el permiso app:novedades para gestionar las novedades."
        : response.status === 404 && !detalle
          ? "El backend no tiene el módulo de novedades (falta desplegar newApi)."
          : (detalle ?? response.statusText ?? "Error desconocido")
    throw new NovedadesApiError(mensaje, response.status)
  }
  return cuerpo as T
}

const json = (cuerpo: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cuerpo),
})

// GET /novedades
export function listarNovedades(): Promise<Novedad[]> {
  return novedadesFetch<Novedad[]>("")
}

// POST /novedades
export function crearNovedad(form: NovedadForm): Promise<Novedad> {
  return novedadesFetch<Novedad>("", { method: "POST", ...json(form) })
}

// PATCH /novedades/:id
export function actualizarNovedad(id: number, cambios: Partial<NovedadForm>): Promise<Novedad> {
  return novedadesFetch<Novedad>(`/${id}`, { method: "PATCH", ...json(cambios) })
}

// DELETE /novedades/:id
export function eliminarNovedad(id: number): Promise<{ eliminada: number }> {
  return novedadesFetch(`/${id}`, { method: "DELETE" })
}

// POST /novedades/imagen (multipart, campo "file") → URL pública de la imagen
export async function subirImagenNovedad(archivo: File): Promise<string> {
  const datos = new FormData()
  datos.append("file", archivo)
  const { url } = await novedadesFetch<{ url: string }>("/imagen", { method: "POST", body: datos })
  return url
}
