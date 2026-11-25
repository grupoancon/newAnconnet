import { describe, expect, it } from "vitest"

import { repartirMontos } from "@/app/(dashboard)/tesoreria/depositos/depositos-utils"

describe("repartirMontos", () => {
  it("al subir un lote, descuenta la diferencia del otro", () => {
    // Pago de $4000: G-M30-500 pasa de 200 a 400 → F-M30-400 baja de 3800 a 3600.
    expect(repartirMontos([3800, 400], 4000, 1)).toEqual([3600, 400])
  })

  it("al bajar un lote, la diferencia va al otro", () => {
    expect(repartirMontos([1000, 200], 4000, 0)).toEqual([1000, 3000])
  })

  it("con 3 lotes descuenta desde el último sin bajar de 0", () => {
    expect(repartirMontos([500, 300, 100], 600, 0)).toEqual([500, 100, 0])
  })

  it("si no alcanza deja los demás en 0", () => {
    expect(repartirMontos([5000, 200], 4000, 0)).toEqual([5000, 0])
  })

  it("sin lote fijo iguala la suma al total (un solo lote)", () => {
    expect(repartirMontos([19845], 198.45)).toEqual([198.45])
  })

  it("trabaja en centavos", () => {
    expect(repartirMontos([0.1, 0.2], 0.5, 0)).toEqual([0.1, 0.4])
  })
})
