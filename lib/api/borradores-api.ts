// Wrapper tipado sobre `/borradores/*` en el backend (anconAPI): borradores automáticos
// de formularios largos (hoy la oferta de compra). Cada usuario ve/guarda solo los
// suyos — sin permiso propio, igual que tareas-api.ts. Lo usa el hook
// useBorradorAutomatico (lib/borradores/use-borrador-automatico.ts), no las pantallas
// directo.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/borradores`
// Más corto que el resto: el autoguardado no puede quedarse colgado esperando — si no
// contesta rápido, el borrador ya quedó en el respaldo del navegador igual.
const TIMEOUT_MS = 10_000

export class BorradoresApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "BorradoresApiError"
    this.status = status
  }
}

export type TipoBorrador = "oferta"

export type BorradorServidor<T> = {
  datos: T
  // ms desde 1970, momento del cambio en el navegador.
  actualizadoEn: number
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
      throw new BorradoresApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new BorradoresApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      cuerpo?.message ?? cuerpo?.error ?? response.statusText ?? "Error desconocido"
    throw new BorradoresApiError(mensaje, response.status)
  }

  return cuerpo as T
}

// GET /borradores/:tipo/:clave — null si el usuario no tiene borrador de ese registro.
export function obtenerBorrador<T>(tipo: TipoBorrador, clave: string) {
  return apiFetch<BorradorServidor<T> | null>(`/${tipo}/${encodeURIComponent(clave)}`)
}

// PUT /borradores/:tipo/:clave — crea o reemplaza el borrador. Si en el servidor ya hay
// uno más nuevo (otra pestaña u otro equipo), no lo pisa (`aplicado: false`).
// `keepalive`: para el último guardado al cerrar la pestaña, que el navegador no
// cancele la petición a mitad de camino.
export function guardarBorrador<T>(
  tipo: TipoBorrador,
  clave: string,
  borrador: BorradorServidor<T>,
  opciones: { keepalive?: boolean } = {}
) {
  return apiFetch<BorradorServidor<T> & { aplicado: boolean }>(
    `/${tipo}/${encodeURIComponent(clave)}`,
    {
      method: "PUT",
      body: JSON.stringify(borrador),
      keepalive: opciones.keepalive,
    }
  )
}

// DELETE /borradores/:tipo/:clave — al enviar el formulario o al descartar el borrador.
export function eliminarBorrador(tipo: TipoBorrador, clave: string) {
  return apiFetch<void>(`/${tipo}/${encodeURIComponent(clave)}`, { method: "DELETE" })
}
