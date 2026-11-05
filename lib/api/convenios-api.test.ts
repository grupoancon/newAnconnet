// Qué representantes aparecen en el selector de firma de cada documento impreso.
import { describe, expect, it, vi } from "vitest"

const ventasFetch = vi.fn()
vi.mock("@/lib/api/ventas-api", () => ({
  ventasFetch: (...args: unknown[]) => ventasFetch(...args),
  VentasApiError: class extends Error {},
}))

import {
  DOCUMENTOS_FIRMA,
  listarRepresentantesActivos,
  representanteAplicaEn,
  type DocumentoFirma,
} from "./convenios-api"

const DOCS = DOCUMENTOS_FIRMA.map((d) => d.valor)

describe("representanteAplicaEn", () => {
  it.each([null, undefined, []])("sin documentos (%p) aparece en todos", (documentos) => {
    for (const doc of DOCS) {
      expect(representanteAplicaEn({ documentos: documentos as never }, doc)).toBe(true)
    }
  })

  it.each(DOCS)("solo '%s' aparece únicamente ahí", (soloEn) => {
    for (const doc of DOCS) {
      expect(representanteAplicaEn({ documentos: [soloEn] }, doc)).toBe(doc === soloEn)
    }
  })

  it("varios documentos", () => {
    const rep = { documentos: ["convenio", "refinanciamiento"] as DocumentoFirma[] }
    expect(representanteAplicaEn(rep, "convenio")).toBe(true)
    expect(representanteAplicaEn(rep, "refinanciamiento")).toBe(true)
    expect(representanteAplicaEn(rep, "oferta")).toBe(false)
    expect(representanteAplicaEn(rep, "financiamiento")).toBe(false)
  })

  it("columna JSON como texto (MariaDB) y texto inválido", () => {
    expect(
      representanteAplicaEn({ documentos: '["refinanciamiento"]' as never }, "oferta")
    ).toBe(false)
    expect(
      representanteAplicaEn({ documentos: '["refinanciamiento"]' as never }, "refinanciamiento")
    ).toBe(true)
    expect(representanteAplicaEn({ documentos: "basura" as never }, "oferta")).toBe(true)
  })
})

describe("listarRepresentantesActivos(documento)", () => {
  const lista = [
    { id: 1, nombre: "Todos", documentos: null },
    { id: 2, nombre: "Solo refinanciamiento", documentos: ["refinanciamiento"] },
    { id: 3, nombre: "Convenio y oferta", documentos: ["convenio", "oferta"] },
  ]

  it.each([
    ["refinanciamiento", ["Todos", "Solo refinanciamiento"]],
    ["financiamiento", ["Todos"]],
    ["convenio", ["Todos", "Convenio y oferta"]],
    ["oferta", ["Todos", "Convenio y oferta"]],
  ] as Array<[DocumentoFirma, string[]]>)("%s → %p", async (doc, esperados) => {
    ventasFetch.mockResolvedValueOnce(lista)
    const resultado = await listarRepresentantesActivos(doc)
    expect(resultado.map((r) => r.nombre)).toEqual(esperados)
    expect(ventasFetch).toHaveBeenLastCalledWith("/convenio-representantes/activos")
  })
})
