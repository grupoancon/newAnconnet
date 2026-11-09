// Descuento por tipo de financiamiento guardado vs. anulado por una promoción que no
// se acumula (ver lib/descuento-tipo.ts).
import { describe, expect, it } from "vitest"

import { descuentoTipoDeRegistro, porcentajeDescuentoTipo } from "@/lib/descuento-tipo"

describe("porcentajeDescuentoTipo", () => {
  it.each([
    ["Contado", 0.05],
    ["Crédito BIESS", 0.03],
    ["Crédito BIESS (Sin Interés)", 0.03],
    ["Mixto", 0],
    ["Crédito directo", 0],
    [null, 0],
  ] as Array<[string | null, number]>)("%s = %s", (tipo, esperado) => {
    expect(porcentajeDescuentoTipo(tipo)).toBe(esperado)
  })
})

describe("descuentoTipoDeRegistro", () => {
  const base = { valorLote: 53338.48, promoDiscount: 0, cantidadPromociones: 0 }

  it("usa el descuento guardado", () => {
    const r = descuentoTipoDeRegistro({
      ...base,
      financType: "Contado",
      discount: "2666.92",
    })
    expect(r).toMatchObject({ monto: 2666.92, anulado: false })
  })

  it("registro viejo sin 'discount': recalcula el %", () => {
    const r = descuentoTipoDeRegistro({ ...base, financType: "Contado", discount: null })
    expect(r.monto).toBeCloseTo(2666.92, 2)
    expect(r.anulado).toBe(false)
  })

  it("0 guardado + promociones = anulado por la promoción (no se recalcula)", () => {
    const r = descuentoTipoDeRegistro({
      valorLote: 53338.48,
      financType: "Contado",
      discount: "0.00",
      promoDiscount: "5333.85",
      cantidadPromociones: 1,
    })
    expect(r.monto).toBe(0)
    expect(r.anulado).toBe(true)
    // Lo que habría sido: 5% sobre (valor − promoción)
    expect(r.montoSinPromocion).toBe(2400.23)
    expect(r.porcentaje).toBe(0.05)
  })

  it("0 guardado sin promociones = registro viejo, se recalcula", () => {
    const r = descuentoTipoDeRegistro({
      ...base,
      financType: "Crédito BIESS",
      discount: "0",
    })
    expect(r.anulado).toBe(false)
    expect(r.monto).toBeCloseTo(1600.15, 2)
  })

  it("Crédito directo / Mixto: el descuento guardado tal cual, nunca anulado", () => {
    for (const tipo of ["Crédito directo", "Mixto"]) {
      expect(
        descuentoTipoDeRegistro({
          ...base,
          financType: tipo,
          discount: "0",
          cantidadPromociones: 2,
        })
      ).toMatchObject({ monto: 0, anulado: false })
      expect(
        descuentoTipoDeRegistro({ ...base, financType: tipo, discount: "300" }).monto
      ).toBe(300)
    }
  })
})
