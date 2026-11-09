// Descuento por tipo de financiamiento (5% Contado, 3% Crédito BIESS / BIESS sin
// interés) tal como quedó guardado en un financiamiento/refinanciamiento — para los
// reportes, la impresión y el Excel.
//
// Una promoción que "no se acumula" (Configuración → Promociones) anula ese descuento:
// el backend lo guarda en 0 (promocionesAnulanDescuentoTipo en newApi). Los reportes
// tenían un respaldo que recalculaba el % cuando el campo venía vacío o en 0 (registros
// viejos); con un 0 guardado JUNTO con promociones aplicadas, eso ahora significa
// "anulado por la promoción" y no se recalcula — se muestra tachado.
// Pruebas: lib/descuento-tipo.test.ts.

export function porcentajeDescuentoTipo(tipo: string | null | undefined): number {
  if (tipo === "Contado") return 0.05
  if (tipo === "Crédito BIESS" || tipo === "Crédito BIESS (Sin Interés)") return 0.03
  return 0
}

export type DescuentoTipo = {
  // Lo que se descuenta de verdad (0 si está anulado).
  monto: number
  // true = una promoción que no se acumula lo dejó en $0.
  anulado: boolean
  // Lo que se habría descontado sin la promoción (para mostrarlo tachado).
  montoSinPromocion: number
  porcentaje: number
}

export function descuentoTipoDeRegistro(registro: {
  financType: string | null | undefined
  discount: string | number | null | undefined
  promoDiscount?: string | number | null
  cantidadPromociones: number
  valorLote: number
}): DescuentoTipo {
  const porcentaje = porcentajeDescuentoTipo(registro.financType)
  const guardado =
    registro.discount == null || registro.discount === ""
      ? null
      : Number(registro.discount)
  const anulado = porcentaje > 0 && guardado === 0 && registro.cantidadPromociones > 0
  const subtotal = Math.max(0, registro.valorLote - (Number(registro.promoDiscount) || 0))
  const montoSinPromocion = Math.round(subtotal * porcentaje * 100) / 100
  if (anulado) return { monto: 0, anulado, montoSinPromocion, porcentaje }
  // Respaldo de siempre: registro guardado sin "discount" → se recalcula el %.
  const monto = guardado || 0 || registro.valorLote * porcentaje
  return { monto, anulado, montoSinPromocion, porcentaje }
}
