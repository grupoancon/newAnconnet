// Wrapper tipado sobre `/tareas/*` en el backend (anconAPI): checklist personal de la
// portada. Mismo modelo que notificaciones-api.ts: `credentials: "include"` (cookie de
// sesión Better Auth), sin permiso propio — cada usuario ve/gestiona solo sus tareas.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/tareas`
const TIMEOUT_MS = 20_000

export class TareasApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "TareasApiError"
    this.status = status
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TareasApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new TareasApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    throw new TareasApiError(
      cuerpo?.message ?? response.statusText ?? "Error desconocido",
      response.status,
    )
  }
  return cuerpo as T
}

export interface Tarea {
  id: number
  usuario_id: string
  titulo: string
  etiqueta: string | null
  fecha: string // YYYY-MM-DD
  completada: boolean
  created_at: string
}

export interface CrearTareaInput {
  titulo: string
  etiqueta?: string
  fecha: string // YYYY-MM-DD
}

export const tareasApi = {
  listar: () => apiFetch<Tarea[]>("/"),

  crear: (data: CrearTareaInput) =>
    apiFetch<Tarea>("/", { method: "POST", body: JSON.stringify(data) }),

  alternar: (id: number) => apiFetch<Tarea>(`/${id}/toggle`, { method: "POST" }),

  eliminar: (id: number) => apiFetch<{ ok: true }>(`/${id}`, { method: "DELETE" }),
}
