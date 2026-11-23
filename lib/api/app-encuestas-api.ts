// Encuestas para los usuarios de la app móvil (`/app-encuestas` en newApi). Exigen
// sesión de intranet + el permiso app:encuestas (ver prisma/sql/permiso_app_encuestas.sql).
import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type {
  Asignacion,
  Destinatario,
  EncuestaDetalle,
  EncuestaResumen,
  EstadoEncuesta,
  Pregunta,
  ResultadosEncuesta,
} from "@/app/(dashboard)/app/encuestas/datos"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
const TIMEOUT_MS = 30_000

export class EncuestasAppApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "EncuestasAppApiError"
    this.status = status
  }
}

async function encuestasFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_URL}/app-encuestas${path}`, {
      ...init,
      headers: init.body
        ? { "Content-Type": "application/json", ...init.headers }
        : init.headers,
      credentials: "include",
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new EncuestasAppApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new EncuestasAppApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const detalle = Array.isArray(cuerpo?.message)
      ? cuerpo.message.join(". ")
      : cuerpo?.message
    const mensaje =
      response.status === 403
        ? "No tienes el permiso app:encuestas para gestionar las encuestas de la app."
        : response.status === 404 && !detalle
          ? "El backend no tiene el módulo de encuestas (falta desplegar newApi)."
          : (detalle ?? response.statusText ?? "Error desconocido")
    throw new EncuestasAppApiError(mensaje, response.status)
  }
  return cuerpo as T
}

export type DatosEncuesta = {
  title: string
  description?: string | null
  internal_label?: string | null
  status?: EstadoEncuesta
  questions?: Pick<Pregunta, "type" | "text" | "required" | "config" | "options">[]
}

// Lo que se manda al backend: opciones vacías fuera y solo los campos que usa.
export function preguntasParaGuardar(preguntas: Pregunta[]): DatosEncuesta["questions"] {
  return preguntas.map((p) => ({
    type: p.type,
    text: p.text.trim(),
    required: p.required,
    config: p.config,
    options:
      p.type === "single_choice" || p.type === "multiple_choice"
        ? p.options
            .map((o) => ({ label: o.label.trim() }))
            .filter((o) => o.label.length > 0)
        : [],
  }))
}

export function listarEncuestasApp(): Promise<EncuestaResumen[]> {
  return encuestasFetch("")
}

export function obtenerEncuestaApp(id: number): Promise<EncuestaDetalle> {
  return encuestasFetch(`/${id}`)
}

export function crearEncuestaApp(datos: DatosEncuesta): Promise<EncuestaDetalle> {
  return encuestasFetch("", { method: "POST", body: JSON.stringify(datos) })
}

export function editarEncuestaApp(
  id: number,
  datos: Partial<DatosEncuesta>
): Promise<EncuestaDetalle> {
  return encuestasFetch(`/${id}`, { method: "PATCH", body: JSON.stringify(datos) })
}

export function duplicarEncuestaApp(id: number): Promise<EncuestaDetalle> {
  return encuestasFetch(`/${id}/duplicar`, { method: "POST" })
}

export function listarDestinatariosApp(): Promise<Destinatario[]> {
  return encuestasFetch("/destinatarios")
}

export function listarAsignacionesApp(id: number): Promise<Asignacion[]> {
  return encuestasFetch(`/${id}/asignaciones`)
}

export function asignarEncuestaApp(
  id: number,
  datos: { cedulas: string[]; scheduled_for?: string }
): Promise<{ asignadas: number; omitidas: string[]; programada: string | null }> {
  return encuestasFetch(`/${id}/asignar`, { method: "POST", body: JSON.stringify(datos) })
}

export function cancelarAsignacionApp(asignacionId: number): Promise<unknown> {
  return encuestasFetch(`/asignaciones/${asignacionId}/cancelar`, { method: "POST" })
}

export function obtenerResultadosEncuestaApp(id: number): Promise<ResultadosEncuesta> {
  return encuestasFetch(`/${id}/resultados`)
}
