import { type StatusVariant } from "@/components/shared/status-badge"
import type { LoteInventario } from "@/lib/api/inventario-api"

export const ESTADO_VARIANTE: Record<string, StatusVariant> = {
  disponible: "disponible",
  libre: "disponible",
  reservado: "reservado",
  convenio: "hipotecado",
  vendido: "hipotecado",
  hipotecado: "hipotecado",
  bloqueado: "bloqueado",
  inactivo: "bloqueado",
}

export function esLoteFacturado(lote: {
  numFac?: string | null
  anioFac?: string | null
}): boolean {
  return Boolean(lote.numFac?.trim()) && Boolean(lote.anioFac?.trim())
}

export function esConvenio(lote: { estado?: string | null }): boolean {
  return (lote.estado ?? "").trim().toLowerCase() === "convenio"
}

export function normalizarEstado(lote: {
  estado: string | null | undefined
  numFac?: string | null
  anioFac?: string | null
}): { label: string; variant: StatusVariant } {
  if (esLoteFacturado(lote)) return { label: "Facturado", variant: "hipotecado" }
  const texto = (lote.estado ?? "").trim()
  if (!texto) return { label: "—", variant: "pronto" }
  const clave = texto.toLowerCase()
  return {
    label: texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase(),
    variant: ESTADO_VARIANTE[clave] ?? "pronto",
  }
}

export function formatearPrecio(valor: string | null | undefined): string {
  const numero = Number(valor)
  if (!valor || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

export function formatearNumero(valor: number | string | null | undefined): string {
  const numero = typeof valor === "string" ? Number(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

export const SECTORES_LOTE: Record<string, string> = {
  J: "JADE",
  C: "CUARZO",
  E: "ESMERALDAS",
  Z: "ZAFIRO",
}

export function sectorDeLote(codigo: string | null | undefined): string | null {
  if (!codigo) return null
  const partes = codigo.split("-")
  if (partes.length < 2) return null
  const segmento = partes[1]?.trim().toUpperCase()
  if (!segmento) return null
  if (SECTORES_LOTE[segmento]) return SECTORES_LOTE[segmento]
  const manzana = segmento.match(/^M(\d+)$/)
  if (manzana) return `Manzana ${manzana[1]}`
  return null
}

// "PV-J-193" → "193": en el plano el prefijo de proyecto/sector se repite en todos los
// lotes y solo ensucia las etiquetas.
export function numeroDeLote(codigo: string | null | undefined): string {
  if (!codigo) return ""
  const partes = codigo.split("-")
  return partes[partes.length - 1]?.trim() || codigo
}

export const TASA_INTERES_ANUAL_REFERENCIA = 10.6
export const TASA_INTERES_ANUAL_REFERENCIA_BIESS = 9

export function calcularCuotaMensual(totalFinanciar: number, meses: number): number {
  if (meses <= 0 || !isFinite(totalFinanciar) || totalFinanciar <= 0) return 0
  const tasaMensual = TASA_INTERES_ANUAL_REFERENCIA / 100 / 12
  const factor = Math.pow(1 + tasaMensual, -meses)
  return (totalFinanciar * tasaMensual) / (1 - factor)
}

export function calcularCuotaMensualBIESS(totalFinanciar: number, meses: number): number {
  if (meses <= 0 || !isFinite(totalFinanciar) || totalFinanciar <= 0) return 0
  const tasaMensual = TASA_INTERES_ANUAL_REFERENCIA_BIESS / 100 / 12
  const factor = Math.pow(1 + tasaMensual, -meses)
  return (totalFinanciar * tasaMensual) / (1 - factor)
}

export const ENTRADA_PORCENTAJE_REFERENCIA = 0.2

export type FilaDetallada = {
  lote: LoteInventario
  precio: number
  entrada: number
  cuotaBiess120: number
  cuotaDirecto60: number
  terreno: number
  valorPorM2: number
}

export function calcularFilaDetallada(lote: LoteInventario): FilaDetallada {
  const precio = Number(lote.pvp) || 0
  const entrada = precio * ENTRADA_PORCENTAJE_REFERENCIA
  const totalFinanciar = precio - entrada
  const terreno = Number(lote.areaUtil) || 0
  return {
    lote,
    precio,
    entrada,
    cuotaBiess120: calcularCuotaMensualBIESS(totalFinanciar, 120),
    cuotaDirecto60: calcularCuotaMensual(totalFinanciar, 60),
    terreno,
    valorPorM2: terreno > 0 ? precio / terreno : 0,
  }
}
