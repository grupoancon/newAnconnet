import type {
  DepositoBackend,
  DepositoRecibo,
  DepositoResumen,
} from "@/lib/api/depositos-api"

export type EstadoDeposito = "Pendiente" | "Aprobado" | "Devuelto"

export const MAX_RECIBOS_POR_LOTE = 3

export const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

// Estado de la tarjeta: se deriva de sus lotes. Solo es "Aprobado"/"Devuelto" cuando
// TODOS los lotes lo están; cualquier mezcla (o un lote "En Revision") cuenta como
// pendiente — así un depósito con un lote aprobado y otro por revisar sigue en la
// pestaña de pendientes hasta que se resuelva completo.
export function calcularEstadoDeposito(
  lotes: DepositoBackend["lotes_relacionados"] | undefined
): EstadoDeposito {
  if (!lotes || lotes.length === 0) return "Pendiente"
  if (lotes.every((lote) => lote.estado === "Aprobado")) return "Aprobado"
  if (lotes.every((lote) => lote.estado === "Devuelto")) return "Devuelto"
  return "Pendiente"
}

// "Pagos recibidos_9112_20260805_100858.pdf" -> "9112" (nombre del PDF que el cliente
// sube desde la app). Si el nombre no sigue ese formato, null.
function extraerNumeroDeNombre(nombre: string | null | undefined): string | null {
  if (!nombre) return null
  const coincidencia = nombre.match(/recibidos_([^_]+)_/i)
  return coincidencia ? (coincidencia[1] ?? null) : null
}

export function numeroReciboDeposito(deposito: DepositoBackend): string {
  return (
    extraerNumeroDeNombre(deposito.name_comprobante) || deposito.numero_transaccion || "—"
  )
}

// Recibos de caja ya adjuntos. Los depósitos viejos (previos a la tabla
// depositos_recibo) solo tienen el recibo en las columnas sueltas url/name_comprobante.
export function recibosDeCaja(deposito: DepositoBackend): Array<
  Pick<DepositoRecibo, "url" | "name"> & {
    id?: number
    numero_recibo: string | null
  }
> {
  if (Array.isArray(deposito.depositosRecibo) && deposito.depositosRecibo.length > 0) {
    return deposito.depositosRecibo
  }
  if (deposito.url_comprobante) {
    return [
      {
        url: deposito.url_comprobante,
        name: deposito.name_comprobante ?? "",
        numero_recibo: null,
      },
    ]
  }
  return []
}

// `resumen` llega como objeto o como string JSON según de dónde se creó el depósito.
export function parsearResumen(resumen: DepositoBackend["resumen"]): DepositoResumen {
  if (!resumen) return { lotesDetails: [] }
  if (typeof resumen !== "string") return resumen
  try {
    return JSON.parse(resumen) as DepositoResumen
  } catch {
    return { lotesDetails: [] }
  }
}

export function formatearMoneda(valor: number | string | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || Number.isNaN(numero)) return "$ 0.00"
  return `$ ${numero.toFixed(2)}`
}

export function formatearFechaLarga(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const fechaDate = new Date(fecha)
  if (Number.isNaN(fechaDate.getTime())) return "—"
  return fechaDate.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

// Número de recibo de caja que digita tesorería: "RC-" fijo + hasta 6 dígitos. Devuelve
// el valor normalizado, o null si lo digitado no es válido (el input lo ignora).
export function normalizarNumeroRecibo(raw: string): string | null {
  const valor = raw.toUpperCase()
  if (!valor.startsWith("RC-")) {
    return valor.length < 3 ? "RC-" : null
  }
  return /^\d{0,6}$/.test(valor.substring(3)) ? valor : null
}

export function numeroReciboValido(numero: string): boolean {
  return /^RC-\d{1,6}$/.test(numero)
}

// Código del recibo con el que se aprueba un lote devuelto: REC-YYYYMMDD-XXXX. Va
// limpiando mientras se digita (mayúsculas, solo A-Z/0-9/guion, cada tramo acotado).
export function formatearCodigoRecibo(raw: string): string {
  const limpio = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "")
  const partes = limpio.split("-")
  const prefijo = partes[0]?.substring(0, 3) ?? ""
  const fecha = partes[1]?.substring(0, 8) ?? ""
  const secuencia = partes[2]?.substring(0, 4) ?? ""

  if (prefijo.length === 3 && partes.length > 1) {
    if (fecha && partes.length > 2) return `${prefijo}-${fecha}-${secuencia}`
    return `${prefijo}-${fecha}`
  }
  return prefijo
}

export function codigoReciboValido(codigo: string): boolean {
  return /^REC-\d{8}-.+$/.test(codigo)
}

// Lotes que el cliente incluyó en el pago (`resumen.lotesDetails`) y que NO tienen su
// propia fila en `lotes_relacionados`. Un solo depósito/comprobante puede cubrir varios
// lotes: el backend solo agrupa por hash los que tienen fila propia en d_depositos, así
// que los demás sólo existen dentro del resumen. Comparación sin distinguir mayúsculas
// ni espacios.
export function lotesSoloEnResumen(deposito: DepositoBackend): string[] {
  const normalizar = (valor: string) => valor.trim().toUpperCase()
  const propios = new Set(
    [deposito.lote, ...(deposito.lotes_relacionados ?? []).map((l) => l.lote)]
      .filter((l): l is string => !!l)
      .map(normalizar)
  )

  const vistos = new Set<string>()
  const extras: string[] = []
  for (const detalle of parsearResumen(deposito.resumen).lotesDetails ?? []) {
    const id = detalle?.id != null ? String(detalle.id) : ""
    const clave = normalizar(id)
    if (!clave || propios.has(clave) || vistos.has(clave)) continue
    vistos.add(clave)
    extras.push(id.trim())
  }
  return extras
}
