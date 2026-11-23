// Tipos y catálogos de "App → Encuestas" (encuestas para los usuarios de la app móvil).
// Los datos vienen de newApi (/app-encuestas, permiso app:encuestas) — ver
// lib/api/app-encuestas-api.ts. La app responde por anconAPI (mismas tablas).

import type { StatusVariant } from "@/components/shared/status-badge"

export type TipoPregunta = "rating" | "single_choice" | "multiple_choice" | "text" | "yesno"
export type EstadoEncuesta = "draft" | "published" | "archived"
export type EstadoAsignacion = "pending" | "answered" | "cancelled"

export type OpcionPregunta = { id?: number; label: string; order?: number }

export type Pregunta = {
  id?: number
  type: TipoPregunta
  text: string
  required: boolean
  config: { scale_min?: number; scale_max?: number; allow_other?: boolean } | null
  options: OpcionPregunta[]
}

export type EncuestaResumen = {
  id: number
  titulo: string
  descripcion: string | null
  etiquetaInterna: string | null
  estado: EstadoEncuesta
  creadaEn: string
  actualizadaEn: string | null
  totalPreguntas: number
  asignadas: number
  respondidas: number
  pendientes: number
}

export type EncuestaDetalle = Omit<
  EncuestaResumen,
  "totalPreguntas" | "asignadas" | "respondidas" | "pendientes"
> & {
  preguntas: (Pregunta & { id: number })[]
  tieneAsignaciones: boolean
}

export type Asignacion = {
  id: number
  cedula: string
  nombre: string | null
  estado: EstadoAsignacion
  asignadaEn: string
  programadaPara: string | null
  respondidaEn: string | null
}

export type Destinatario = { cedula: string; nombre: string; email: string | null }

export type ResultadoPregunta = Pregunta & {
  id: number
  respuestas: number
  promedio?: number | null
  distribucion?: { valor: number; cantidad: number }[]
  si?: number
  no?: number
  conteoOpciones?: { id: number; label: string; cantidad: number }[]
  otros?: string[]
  textos?: string[]
}

export type ResultadosEncuesta = {
  encuesta: Omit<EncuestaDetalle, "preguntas" | "tieneAsignaciones">
  asignadas: number
  respondidas: number
  pendientes: number
  canceladas: number
  tasaRespuesta: number
  satisfaccionGeneral: number | null
  preguntas: ResultadoPregunta[]
  personas: {
    asignacionId: number
    cedula: string
    nombre: string | null
    respondidaEn: string | null
    // Respuesta de cada pregunta, por id de pregunta.
    valores: Record<string, string>
  }[]
}

export const TIPO_PREGUNTA_LABELS: Record<TipoPregunta, string> = {
  rating: "Escala del 1 al 5",
  single_choice: "Selección única",
  multiple_choice: "Selección múltiple",
  yesno: "Sí / No",
  text: "Texto libre",
}

export const ESTADO_ENCUESTA_LABELS: Record<EstadoEncuesta, string> = {
  draft: "Borrador",
  published: "Publicada",
  archived: "Archivada",
}

export const VARIANTE_ESTADO_ENCUESTA: Record<EstadoEncuesta, StatusVariant> = {
  draft: "pendiente",
  published: "disponible",
  archived: "pronto",
}

export const ESTADO_ASIGNACION_LABELS: Record<EstadoAsignacion, string> = {
  pending: "Pendiente",
  answered: "Respondida",
  cancelled: "Cancelada",
}

export const VARIANTE_ESTADO_ASIGNACION: Record<EstadoAsignacion, StatusVariant> = {
  pending: "en-tramite",
  answered: "aprobado",
  cancelled: "pronto",
}

// Mismos límites que valida newApi (app-encuestas.util.ts).
export const LIMITES = {
  titulo: 255,
  etiquetaInterna: 255,
  descripcion: 1000,
  pregunta: 500,
  preguntas: 50,
  opciones: 20,
} as const

export const esSeleccion = (tipo: TipoPregunta) =>
  tipo === "single_choice" || tipo === "multiple_choice"

export function preguntaVacia(): Pregunta {
  return { type: "rating", text: "", required: true, config: null, options: [] }
}

// Mismo criterio que el backend: devuelve el primer problema o null.
export function problemaEnPreguntas(preguntas: Pregunta[]): string | null {
  if (preguntas.length === 0) return "Agrega al menos una pregunta."
  if (preguntas.length > LIMITES.preguntas) {
    return `Máximo ${LIMITES.preguntas} preguntas.`
  }
  const vistas = new Set<string>()
  for (let i = 0; i < preguntas.length; i++) {
    const p = preguntas[i]
    const n = i + 1
    const texto = p.text.trim()
    if (!texto) return `Escribe el texto de la pregunta ${n}.`
    if (vistas.has(texto.toLowerCase())) return `La pregunta ${n} está repetida.`
    vistas.add(texto.toLowerCase())
    if (esSeleccion(p.type)) {
      const etiquetas = p.options.map((o) => o.label.trim()).filter(Boolean)
      if (etiquetas.length < 2) return `La pregunta ${n} necesita al menos 2 opciones.`
      if (etiquetas.length > LIMITES.opciones) {
        return `La pregunta ${n} puede tener hasta ${LIMITES.opciones} opciones.`
      }
      const minus = etiquetas.map((e) => e.toLowerCase())
      if (new Set(minus).size !== minus.length) {
        return `La pregunta ${n} tiene opciones repetidas.`
      }
      if (minus.includes("otro")) {
        return `En la pregunta ${n} usa la casilla "Agregar opción Otro" en vez de escribir "Otro".`
      }
    }
  }
  return null
}

const formatoFechaHora = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
const formatoFecha = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

export function formatearFechaHora(valor: string | null | undefined): string {
  return valor ? formatoFechaHora.format(new Date(valor)) : "—"
}

export function formatearFecha(valor: string | null | undefined): string {
  return valor ? formatoFecha.format(new Date(valor)) : "—"
}

export function porcentaje(valor: number): string {
  return `${Math.round(valor * 100)}%`
}
