// Valor del lote que se muestra en el reporte/impresión/Excel del financiamiento.
//
// Es siempre el precio del inventario (pvp); si el lote no viene del inventario se usa
// el lote_price del proceso. Antes, ya aprobado, se reconstruía sumando total_financ +
// descuentos, pero en los financiamientos de Crédito directo/Mixto total_financ
// además resta la entrada (ver importesDeVenta en convenios.service.ts del backend),
// así que el valor salía por debajo del real (ej. G-M1-45: 27,598.26 en vez de
// 36,398.26).
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
  pvpInventario,
  lotePriceProceso,
}: {
  financiamiento?: FinanciamientoGuardado | undefined
  finanStatus?: string | null | undefined
  pvpInventario: string | number | null | undefined
  lotePriceProceso: string | number | null | undefined
}): number | null {
  return numero(pvpInventario) ?? numero(lotePriceProceso)
}
