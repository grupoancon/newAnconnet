// Wrapper tipado sobre `/eventos/*` en el backend (anconAPI): calendario de LA EMPRESA
// en la portada, no personal — todo usuario logueado los ve, pero crear/eliminar
// requiere el permiso "eventos:gestionar" (gate del lado del backend; ver useCan en
// quien use `crear`/`eliminar` para no mostrar controles que van a fallar con 403).
// Mismo modelo que notificaciones-api.ts: `credentials: "include"` (cookie de sesión
// Better Auth).

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/eventos`
const TIMEOUT_MS = 20_000

export class EventosApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "EventosApiError"
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
      throw new EventosApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new EventosApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    throw new EventosApiError(
      cuerpo?.message ?? response.statusText ?? "Error desconocido",
      response.status,
    )
  }
  return cuerpo as T
}

export interface Evento {
  id: number
  creado_por: string
  titulo: string
  fecha: string // YYYY-MM-DD
  created_at: string
}

export interface CrearEventoInput {
  titulo: string
  fecha: string // YYYY-MM-DD
}

export const eventosApi = {
  // mes: "YYYY-MM"
  listarPorMes: (mes: string) => apiFetch<Evento[]>(`/?mes=${encodeURIComponent(mes)}`),

  crear: (data: CrearEventoInput) =>
    apiFetch<Evento>("/", { method: "POST", body: JSON.stringify(data) }),

  eliminar: (id: number) => apiFetch<{ ok: true }>(`/${id}`, { method: "DELETE" }),
}
