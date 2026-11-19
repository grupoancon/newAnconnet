// Valor del lote que se muestra en el reporte/impresión/Excel del financiamiento.
//
// Mientras no está aprobado se usa el precio actual del inventario (pvp). Una vez
// aprobado, el precio del inventario puede cambiar después, así que se toma el valor
// con el que quedó guardado el financiamiento. El backend no guarda el precio como
// tal, pero sí total_financ = valor del lote − discount − extra_discount −
// promo_discount (financiamiento.service.ts), así que se reconstruye sumándolos.
type FinanciamientoGuardado = {
  total_financ: string | null
  discount: string | null
  extra_discount: string | null
  promo_discount: string | null
} | null

function numero(valor: string | number | null | undefined): number | null {
  if (valor == null || valor === "") return null
  const n = typeof valor === "string" ? parseFloat(valor) : valor
  return Number.isFinite(n) ? n : null
}

export function valorLoteFinanciamiento({
  financiamiento,
  finanStatus,
  pvpInventario,
  lotePriceProceso,
}: {
  financiamiento: FinanciamientoGuardado | undefined
  finanStatus: string | null | undefined
  pvpInventario: string | number | null | undefined
  lotePriceProceso: string | number | null | undefined
}): number | null {
  const aprobado = (finanStatus ?? "").trim().toLowerCase() === "aprobado"
  const total = numero(financiamiento?.total_financ)
  if (aprobado && total != null) {
    const guardado =
      total +
      (numero(financiamiento?.discount) ?? 0) +
      (numero(financiamiento?.extra_discount) ?? 0) +
      (numero(financiamiento?.promo_discount) ?? 0)
    return Math.round(guardado * 100) / 100
  }
  return numero(pvpInventario) ?? numero(lotePriceProceso)
}
