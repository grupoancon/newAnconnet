// Wrapper tipado sobre `/dashboard/*` en el backend (anconAPI). Mismo modelo que
// notificaciones-api.ts: `credentials: "include"` (cookie de sesión Better Auth), sin
// permiso propio — cualquier usuario logueado puede ver el resumen de la portada.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/dashboard`
const TIMEOUT_MS = 20_000

export class DashboardApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "DashboardApiError"
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
      throw new DashboardApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new DashboardApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    throw new DashboardApiError(
      cuerpo?.message ?? response.statusText ?? "Error desconocido",
      response.status,
    )
  }
  return cuerpo as T
}

export interface VentaPorMes {
  mes: string
  cantidad: number
}

export interface ResumenDashboard {
  totalVentas: number // ventas del mes actual
  tendenciaVentasPct: number // % de cambio vs. el mes anterior
  lotesDisponibles: number
  reservasActivas: number
  ventasPorMes: VentaPorMes[]
}

export const dashboardApi = {
  resumen: () => apiFetch<ResumenDashboard>("/resumen"),
}
