import { describe, expect, it } from "vitest"

import {
  ETIQUETA_ESTADO_REFINANCIAMIENTO,
  estadoRefinanciamiento,
  imprimeComoBorrador,
  sePuedeExportarExcel,
  sePuedeImprimirRefinanciamiento,
} from "@/lib/refinanciamiento-estado"

describe("estadoRefinanciamiento", () => {
  it.each([
    ["borrador", "borrador"],
    ["ingresado", "preaprobado"],
    [" Ingresado ", "preaprobado"],
    ["aprobado", "aprobado"],
    ["rechazado", "rechazado"],
    [null, "borrador"],
    ["", "borrador"],
  ] as const)("%s → %s", (crudo, esperado) => {
    expect(estadoRefinanciamiento(crudo)).toBe(esperado)
  })

  it("guardado se muestra como Preaprobado", () => {
    expect(ETIQUETA_ESTADO_REFINANCIAMIENTO[estadoRefinanciamiento("ingresado")]).toBe(
      "Preaprobado"
    )
  })
})

describe("qué se puede hacer en cada estado", () => {
  it("borrador: imprime con marca de agua, sin Excel", () => {
    expect(sePuedeImprimirRefinanciamiento("borrador")).toBe(true)
    expect(imprimeComoBorrador("borrador")).toBe(true)
    expect(sePuedeExportarExcel("borrador")).toBe(false)
  })

  it("preaprobado: reporte final sin marca de agua, sin Excel", () => {
    expect(sePuedeImprimirRefinanciamiento("preaprobado")).toBe(true)
    expect(imprimeComoBorrador("preaprobado")).toBe(false)
    expect(sePuedeExportarExcel("preaprobado")).toBe(false)
  })

  it("aprobado: reporte final y Excel", () => {
    expect(sePuedeImprimirRefinanciamiento("aprobado")).toBe(true)
    expect(imprimeComoBorrador("aprobado")).toBe(false)
    expect(sePuedeExportarExcel("aprobado")).toBe(true)
  })

  it("rechazado: no se imprime", () => {
    expect(sePuedeImprimirRefinanciamiento("rechazado")).toBe(false)
    expect(sePuedeExportarExcel("rechazado")).toBe(false)
  })
})
