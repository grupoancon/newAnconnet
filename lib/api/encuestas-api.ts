// Wrappers tipados sobre los endpoints de encuestas (`/encuestas/*` en el backend).
// Encuesta de satisfacción del proceso de venta: se hace solo a procesos con oferta,
// financiamiento y pago aprobados. Todas las llamadas van con `credentials: "include"`.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const ENCUESTAS_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/encuestas`
const TIMEOUT_MS = 15_000

export class EncuestasApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "EncuestasApiError"
    this.status = status
  }
}

export type EncuestaListado = {
  processId: number
  ofertaId: number
  cliente: string | null
  lote: string | null
  proyecto: string | null
  asesor: string | null
  // YYYY-MM-DD
  fechaProceso: string | null
  realizada: boolean
  medioContacto: string | null
  medioVisita: string | null
  encuestador: string | null
  // YYYY-MM-DD HH:mm (null en encuestas hechas en la intranet vieja)
  fechaEncuesta: string | null
}

export type EncuestasResumen = {
  pendientes: number
  realizadas: number
  realizadasMes: number
}

export type EncuestaDetalle = EncuestaListado & {
  contactoOferta: string | null
  registradaPor: string | null
}

export type GuardarEncuestaInput = {
  medioContacto: string
  medioContactoDetalle?: string
  medioVisita: string
  encuestador: string
  encuestadorOtro?: string
}

// Opciones — misma lista que el backend (anconAPI apps/intranet/encuestas/
// encuestas.constants.ts), que es quien valida. Si se cambia allá, cambiarla acá.
export type OpcionEncuesta = { value: string; label: string }

export const MEDIOS_CONTACTO: { grupo: string | null; opciones: OpcionEncuesta[] }[] = [
  {
    grupo: "Redes sociales",
    opciones: [
      { value: "FACEBOOK PERSONAL", label: "Facebook personal" },
      { value: "FACEBOOK EMPRESA", label: "Facebook empresa" },
      { value: "TIKTOK", label: "TikTok" },
      { value: "INSTAGRAM", label: "Instagram" },
      { value: "PAGINA WEB", label: "Página web" },
    ],
  },
  {
    grupo: "Referidos",
    opciones: [
      { value: "REFERIDO EXTERNO", label: "Externo" },
      { value: "REFERIDO CLIENTE", label: "Cliente" },
      { value: "REFERIDO FAMILIAR ASESOR", label: "Familiar asesor" },
    ],
  },
  {
    grupo: "Rótulos",
    opciones: [
      { value: "ROTULO DE OFICINA", label: "Oficina" },
      { value: "ROTULO DE PROYECTO", label: "Proyecto" },
    ],
  },
  {
    grupo: "Ferias",
    opciones: [
      { value: "FERIA CLAVE MAYO", label: "Clave mayo" },
      { value: "FERIA CLAVE JUNIO", label: "Clave junio" },
      { value: "FERIA CLAVE NOVIEMBRE", label: "Clave noviembre" },
      { value: "FERIA CLAVE 2026", label: "Clave 2026" },
      { value: "FERIA BIESS", label: "BIESS" },
      { value: "FERIA OTROS", label: "Otra feria" },
    ],
  },
  {
    grupo: "Stand",
    opciones: [
      { value: "STAND RECREO", label: "Recreo" },
      { value: "STAND QUICENTRO SUR", label: "Quicentro Sur" },
      { value: "STAND OTROS", label: "Otro stand" },
    ],
  },
  {
    grupo: "Otros",
    opciones: [
      { value: "CLIENTE ANTIGUO", label: "Cliente antiguo" },
      { value: "LLAMADA OFICINA", label: "Llamada a oficina" },
      { value: "FUNCIONARIO DE LA EMPRESA", label: "Funcionario de la empresa" },
      { value: "ASESOR", label: "Asesor" },
      { value: "HOJA VOLANTE", label: "Hoja volante" },
      { value: "CONTACTO PERSONAL", label: "Contacto personal" },
      { value: "CANJE", label: "Canje" },
    ],
  },
]

export const MEDIOS_CON_DETALLE = ["FERIA OTROS", "STAND OTROS"]

export const MEDIOS_VISITA: OpcionEncuesta[] = [
  { value: "PAGINA WEB", label: "Página web" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIK TOK", label: "TikTok" },
  { value: "NINGUNO", label: "Ninguno" },
]

export const ENCUESTADORES: OpcionEncuesta[] = [
  { value: "CRUZ PEREZ THAIS STEPHANY", label: "Thais Cruz" },
  { value: "ALCAZAR SANTOS JHOANNA ELIZABETH", label: "Jhoanna Alcazar" },
]

export const ENCUESTADOR_OTRO = "OTRO"

async function encuestasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${ENCUESTAS_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options.headers },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new EncuestasApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new EncuestasApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje = Array.isArray(cuerpo?.message)
      ? cuerpo.message.join(", ")
      : (cuerpo?.message ?? cuerpo?.error ?? response.statusText)
    throw new EncuestasApiError(mensaje || "Error desconocido", response.status)
  }
  return cuerpo as T
}

// GET /encuestas
export function listarEncuestas() {
  return encuestasFetch<{ items: EncuestaListado[]; resumen: EncuestasResumen }>("")
}

// GET /encuestas/:processId
export function obtenerEncuesta(processId: number) {
  return encuestasFetch<EncuestaDetalle>(`/${processId}`)
}

// POST /encuestas/:processId
export function guardarEncuesta(processId: number, data: GuardarEncuestaInput) {
  return encuestasFetch<EncuestaDetalle>(`/${processId}`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

// Etiqueta legible de un valor guardado. Si no está en la lista (texto libre de "otra
// feria/stand", o valores viejos) se muestra tal cual.
export function etiquetaMedioContacto(valor: string | null): string {
  if (!valor) return "—"
  for (const grupo of MEDIOS_CONTACTO) {
    const opcion = grupo.opciones.find((o) => o.value === valor)
    if (opcion)
      return grupo.grupo && grupo.grupo !== "Otros"
        ? `${grupo.grupo} · ${opcion.label}`
        : opcion.label
  }
  return valor
}

export function etiquetaMedioVisita(valor: string | null): string {
  if (!valor) return "—"
  return MEDIOS_VISITA.find((o) => o.value === valor)?.label ?? valor
}

export function etiquetaEncuestador(valor: string | null): string {
  if (!valor) return "—"
  return ENCUESTADORES.find((o) => o.value === valor)?.label ?? valor
}
