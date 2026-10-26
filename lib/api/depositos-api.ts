// Cliente para el módulo de depósitos (`/depositoss/*` en anconAPI — la doble "s" es
// real, así se llama el controller en `apps/depositos/depositos.controller.ts`).
//
// OJO con dos rarezas del backend que este wrapper absorbe para que las pantallas no
// tengan que saberlas:
//  - `aproved`, `reject` y `changeState` devuelven HTTP 200 con `{ error: "..." }` cuando
//    la regla de negocio falla (no lanzan 4xx), así que `depositosFetch` también trata
//    un cuerpo con `error` como fallo.
//  - `/upload-recibo` rechaza archivos duplicados (mismo hash) con 400.

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const DEPOSITOS_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/depositoss`

export class DepositosApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "DepositosApiError"
    this.status = status
    this.code = code
  }
}

// Mismo criterio que ventasFetch: sin timeout un backend colgado deja la pantalla en el
// spinner para siempre. La subida de recibos (Cloudinary) es la llamada más lenta.
const TIMEOUT_MS = 30_000

async function depositosFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)
  // Con FormData el navegador arma el boundary multipart solo; fijar Content-Type a
  // mano rompe el body.
  const esFormData = options.body instanceof FormData
  try {
    response = await fetch(`${DEPOSITOS_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: timeoutController.signal,
      headers: {
        ...(esFormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new DepositosApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new DepositosApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      (typeof cuerpo?.message === "string" ? cuerpo.message : null) ??
      (typeof cuerpo?.error === "string" ? cuerpo.error : null) ??
      response.statusText ??
      "Error desconocido"
    throw new DepositosApiError(mensaje, response.status, cuerpo?.code)
  }

  if (cuerpo && !Array.isArray(cuerpo) && typeof cuerpo.error === "string") {
    throw new DepositosApiError(cuerpo.error, response.status)
  }

  return cuerpo as T
}

export type EstadoLote = "Pendiente" | "En Revision" | "Aprobado" | "Devuelto"

export type DepositoComprobante = {
  id: number
  name: string
  url: string
  hash: string
  depositos_id: number
}

// Recibo de caja que tesorería adjunta al aprobar (tabla `depositos_recibo`, hasta 3).
export type DepositoRecibo = {
  id: number
  name: string
  url: string
  hash: string
  numero_recibo: string | null
  lote: string | null
  createdAt: string | null
  depositos_id: number
}

// Un mismo comprobante (hash) puede cubrir varios lotes: el backend agrupa los
// depósitos duplicados y deja uno solo con la lista de lotes en `lotes_relacionados`.
// `id` es el id del depósito de ESE lote — es el que se manda a aprobar/devolver.
export type LoteRelacionado = {
  lote: string
  id: number
  estado: EstadoLote | string
  rec_asociado?: string | null
}

// Snapshot del cálculo de pago que hizo el cliente en la app (`d_depositos.resumen`,
// LONGTEXT con JSON). Llega como objeto o como string según el origen del registro.
export type ResumenDetalleLote = {
  id: string
  principal?: number
  alicuota?: number
  mora?: number
}

export type DepositoResumen = {
  lotesDetails?: ResumenDetalleLote[]
  customAmountsMulti?: Record<string, number | string>
  customAmount?: number | string
  totalPayment?: number
  multiCustomTotal?: number
}

export type DepositoBackend = {
  id: number
  recibo: string
  valor: string
  banco: string
  tipo: string
  fecha_act: string | null
  observaciones: string
  estado: EstadoLote | string
  coment_reject: string
  hash_comprobante: string | null
  name_comprobante: string | null
  url_comprobante: string | null
  fecha_carga: string | null
  lote: string | null
  cli_name: string | null
  // Nombre del cliente que resuelve el backend desde Redis (`order:<lote>.cardName`),
  // con fallback a cli_name. Null si no hay ninguno.
  cliente_nombre: string | null
  idUser: string | null
  createdAt: string | null
  rec_asociado: string | null
  monto_pagado: string | null
  numero_transaccion: string | null
  banco_origen: string | null
  resumen: DepositoResumen | string | null
  depositosComprobante: DepositoComprobante[]
  depositosRecibo: DepositoRecibo[]
  lotes_relacionados: LoteRelacionado[]
}

export type ReciboSubido = {
  name: string
  url: string
  hash: string
}

export type ReciboAprobacion = ReciboSubido & {
  numero_recibo: string
  lote: string
}

// GET /depositoss
export function listarDepositos() {
  return depositosFetch<DepositoBackend[]>("")
}

// POST /depositoss/upload-recibo — multipart, hasta 3 archivos por request. El orden de
// la respuesta coincide con el de `archivos`.
export function subirRecibos(archivos: File[], carpeta = "recibos_caja") {
  const formData = new FormData()
  archivos.forEach((archivo) => formData.append("files", archivo))
  formData.append("url", carpeta)
  return depositosFetch<ReciboSubido[]>("/upload-recibo", {
    method: "POST",
    body: formData,
  })
}

// POST /depositoss/aproved — aprueba el depósito `id` (el del lote) y guarda los
// recibos en depositos_recibo. El primer recibo también se copia a las columnas sueltas
// url/name/hash_comprobante por retrocompatibilidad con la app móvil.
export function aprobarDeposito(input: {
  id: number
  lote: string
  recibos: ReciboAprobacion[]
}) {
  const [primero] = input.recibos
  return depositosFetch<unknown>("/aproved", {
    method: "POST",
    body: JSON.stringify({
      id: input.id,
      lote: input.lote,
      estado: "Aprobado",
      fecha_carga: new Date(),
      url_comprobante: primero?.url ?? "",
      name_comprobante: primero?.name ?? "",
      hash_comprobante: primero?.hash ?? "",
      recibos: input.recibos,
    }),
  })
}

// POST /depositoss/reject — devuelve el depósito al cliente con el motivo.
export function devolverDeposito(input: { id: number; lote: string; motivo: string }) {
  return depositosFetch<unknown>("/reject", {
    method: "POST",
    body: JSON.stringify({
      id: input.id,
      lote: input.lote,
      estado: "Devuelto",
      coment_reject: input.motivo,
      fecha_act: new Date(),
    }),
  })
}

// POST /depositoss/changeState — aprueba un lote devuelto asociándolo al recibo
// (`rec_asociado`) de otro depósito del MISMO lote que ya esté aprobado. El backend
// valida las dos cosas y responde `{ error }` si no se cumplen.
export function cambiarEstadoDeposito(input: {
  id: number
  lote: string
  recAsociado: string
}) {
  return depositosFetch<unknown>("/changeState", {
    method: "POST",
    body: JSON.stringify({
      id: input.id,
      lote: input.lote,
      estado: "Aprobado",
      rec_asociado: input.recAsociado,
    }),
  })
}
