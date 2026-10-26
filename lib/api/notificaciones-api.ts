// Wrappers tipados sobre `/notifications/*` en el backend (anconAPI). Todas las
// llamadas van con `credentials: "include"` (cookie de sesión), mismo modelo que
// inventario-api.ts / ventas-api.ts.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/notifications`
const TIMEOUT_MS = 20_000

export class NotificacionesApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "NotificacionesApiError"
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
    throw new NotificacionesApiError(
      cuerpo?.message ?? response.statusText ?? "Error desconocido",
      response.status,
    )
  }
  return cuerpo as T
}

// ─────────────── Tipos ───────────────

export type TipoNotificacion = "individual" | "global" | "segmentada"

export interface SegmentoFiltro {
  en_mora?: boolean
  dias_mora_min?: number
  cedulas?: string[]
  lotes?: string[]
  prefijos_proyecto?: string[]
}

export interface CrearNotificacionDto {
  titulo: string
  contenido: string
  imagen?: string
  url?: string
  tipo: TipoNotificacion
  user_id?: string
  segmento?: string // JSON string
  fecha_enviar?: string // ISO; vacío = enviar ya
  asunto?: string
}

export interface Notificacion {
  id: number
  titulo: string | null
  contenido: string | null
  imagen: string | null
  url: string | null
  tipo: TipoNotificacion
  user_id: string | null
  segmento: string | null
  estado: string | null
  asunto: string | null
  fecha_enviar: string | null
  fecha_envio: string | null
  novu_transaction_id: string | null
  created_at: string
  destinatarios?: number
}

export interface HistorialResp {
  data: Notificacion[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface EnvioFila {
  id: string
  user_id: string | null
  title: string | null
  body: string | null
  image_url: string | null
  url: string | null
  type: string | null
  sent_at: string | null
}

export interface EntregaResp {
  available: boolean
  jobs: { channel: string; status: string; detail: string | null }[]
}

// ─────────────── Métodos ───────────────

export const notificacionesApi = {
  crear: (dto: CrearNotificacionDto) =>
    apiFetch<Notificacion>("/", { method: "POST", body: JSON.stringify(dto) }),

  historial: (params: {
    page?: number
    limit?: number
    tipo?: string
    estado?: string
    q?: string
  } = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v))
    })
    return apiFetch<HistorialResp>(`/history?${qs.toString()}`)
  },

  detalle: (id: number) =>
    apiFetch<{ notification: Notificacion; sends: EnvioFila[] } | null>(`/history/${id}`),

  entrega: (id: number) => apiFetch<EntregaResp>(`/${id}/delivery`),

  editar: (id: number, dto: Partial<CrearNotificacionDto>) =>
    apiFetch(`/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),

  cancelar: (id: number) => apiFetch(`/${id}`, { method: "DELETE" }),

  enviarAhora: (id: number) => apiFetch(`/${id}/send-now`, { method: "POST" }),
}
