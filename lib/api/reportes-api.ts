// Cliente para `/reportes/*` en anconAPI. Un endpoint por reporte, cada uno protegido
// solo por su permiso `reportes:<id>` en el backend: con el permiso del reporte alcanza
// para ver sus datos, sin exigir permisos de otros módulos.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const REPORTES_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/reportes`
const TIMEOUT_MS = 20_000

export class ReportesApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ReportesApiError"
    this.status = status
  }
}

async function reportesFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${REPORTES_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ReportesApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new ReportesApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje = Array.isArray(cuerpo?.message)
      ? cuerpo.message.join(", ")
      : (cuerpo?.message ?? response.statusText ?? "Error desconocido")
    throw new ReportesApiError(mensaje, response.status)
  }
  return cuerpo as T
}

export type VentasPorProyecto = {
  anio: number
  total: number
  proyectos: Array<{ nombre: string; ventas: number }>
}

// GET /reportes/administrativo/ventas-por-proyecto?anio=2026 — permiso
// "reportes:administrativo". Cuenta ventas completadas por el año en que se concretaron.
export function obtenerVentasPorProyecto(anio: number) {
  return reportesFetch<VentasPorProyecto>(
    `/administrativo/ventas-por-proyecto?anio=${encodeURIComponent(String(anio))}`
  )
}

// --- Constructor de reportes -------------------------------------------------

export type Visualizacion = "barras" | "tabla" | "kpi"
export type FormatoValor = "numero" | "moneda"

export type BloqueDefinicion = {
  id: string
  titulo: string
  dataset: string
  visualizacion: Visualizacion
}

export type DefinicionReporte = {
  id: string
  slug: string
  titulo: string
  descripcion: string
  bloques: BloqueDefinicion[]
  activo: boolean
  createdAt: string
}

export type DefinicionEntrada = {
  titulo: string
  descripcion: string
  bloques: BloqueDefinicion[]
  activo?: boolean
}

export type DatasetCatalogo = {
  id: string
  titulo: string
  descripcion: string
  formato: FormatoValor
}

export type ReporteVisible = { slug: string; titulo: string; descripcion: string }

export type BloqueResultado = {
  id: string
  titulo: string
  visualizacion: Visualizacion
  formato: FormatoValor
  filas: Array<{ etiqueta: string; valor: number }>
  total: number
}

// GET /reportes/mis-reportes — cards de los reportes del constructor que este usuario
// puede abrir (permiso reportes:<slug>, explícito).
export function listarMisReportes() {
  return reportesFetch<ReporteVisible[]>("/mis-reportes")
}

// GET /reportes/definiciones/:slug/datos?anio=
export function obtenerDatosReporte(slug: string, anio: number) {
  return reportesFetch<{ anio: number; bloques: BloqueResultado[] }>(
    `/definiciones/${encodeURIComponent(slug)}/datos?anio=${encodeURIComponent(String(anio))}`
  )
}

// --- Administración (rol Administrador o permiso reportes:administrar) ---

export function listarDatasets() {
  return reportesFetch<DatasetCatalogo[]>("/admin/datasets")
}

export function listarDefinicionesAdmin() {
  return reportesFetch<DefinicionReporte[]>("/admin/definiciones")
}

export function crearDefinicion(entrada: DefinicionEntrada) {
  return reportesFetch<DefinicionReporte>("/admin/definiciones", {
    method: "POST",
    body: JSON.stringify(entrada),
  })
}

export function actualizarDefinicion(id: string, entrada: DefinicionEntrada) {
  return reportesFetch<DefinicionReporte>(
    `/admin/definiciones/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(entrada),
    }
  )
}

export function eliminarDefinicion(id: string) {
  return reportesFetch<{ ok: true }>(`/admin/definiciones/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
