import { describe, expect, it } from "vitest"

import type { DepositoBackend } from "@/lib/api/depositos-api"
import {
  calcularEstadoDeposito,
  codigoReciboValido,
  formatearCodigoRecibo,
  lotesSoloEnResumen,
  normalizarNumeroRecibo,
  numeroReciboDeposito,
  numeroReciboValido,
  parsearResumen,
  recibosDeCaja,
} from "@/app/(dashboard)/tesoreria/depositos/depositos-utils"

const lote = (estado: string, id = 1) => ({ lote: `EJ-${id}`, id, estado })

describe("calcularEstadoDeposito", () => {
  it("sin lotes es pendiente", () => {
    expect(calcularEstadoDeposito([])).toBe("Pendiente")
    expect(calcularEstadoDeposito(undefined)).toBe("Pendiente")
  })

  it("todos aprobados -> Aprobado", () => {
    expect(calcularEstadoDeposito([lote("Aprobado", 1), lote("Aprobado", 2)])).toBe(
      "Aprobado"
    )
  })

  it("todos devueltos -> Devuelto", () => {
    expect(calcularEstadoDeposito([lote("Devuelto", 1), lote("Devuelto", 2)])).toBe(
      "Devuelto"
    )
  })

  it("mezcla o En Revision sigue pendiente", () => {
    expect(calcularEstadoDeposito([lote("Aprobado", 1), lote("Pendiente", 2)])).toBe(
      "Pendiente"
    )
    expect(calcularEstadoDeposito([lote("Aprobado", 1), lote("Devuelto", 2)])).toBe(
      "Pendiente"
    )
    expect(calcularEstadoDeposito([lote("En Revision")])).toBe("Pendiente")
  })
})

describe("numero de recibo de caja (RC-)", () => {
  it("fuerza el prefijo RC- y hasta 6 dígitos", () => {
    expect(normalizarNumeroRecibo("rc-123")).toBe("RC-123")
    expect(normalizarNumeroRecibo("RC-123456")).toBe("RC-123456")
    expect(normalizarNumeroRecibo("RC-1234567")).toBeNull()
    expect(normalizarNumeroRecibo("RC-12a")).toBeNull()
    expect(normalizarNumeroRecibo("x")).toBe("RC-")
    expect(normalizarNumeroRecibo("xyz")).toBeNull()
  })

  it("solo es válido con al menos un dígito", () => {
    expect(numeroReciboValido("RC-")).toBe(false)
    expect(numeroReciboValido("RC-1")).toBe(true)
    expect(numeroReciboValido("RC-123456")).toBe(true)
  })
})

describe("código de recibo REC-YYYYMMDD-XXXX", () => {
  it("formatea mientras se digita", () => {
    expect(formatearCodigoRecibo("rec")).toBe("REC")
    expect(formatearCodigoRecibo("rec-2026")).toBe("REC-2026")
    expect(formatearCodigoRecibo("rec-20260701-31229999")).toBe("REC-20260701-3122")
    expect(formatearCodigoRecibo("rec-20260701-")).toBe("REC-20260701-")
  })

  it("valida fecha de 8 dígitos y secuencia", () => {
    expect(codigoReciboValido("REC-20260701-3122")).toBe(true)
    expect(codigoReciboValido("REC-20260701-")).toBe(false)
    expect(codigoReciboValido("REC-2026-3122")).toBe(false)
  })
})

describe("datos derivados del depósito", () => {
  const base = {
    name_comprobante: null,
    numero_transaccion: null,
    url_comprobante: null,
    depositosRecibo: [],
  } as unknown as DepositoBackend

  it("extrae el N° de recibo del nombre del PDF del cliente", () => {
    expect(
      numeroReciboDeposito({
        ...base,
        name_comprobante: "Pagos recibidos_9112_20260805_100858.pdf",
      })
    ).toBe("9112")
  })

  it("cae al número de transacción y luego a —", () => {
    expect(numeroReciboDeposito({ ...base, numero_transaccion: "TX-77" })).toBe("TX-77")
    expect(numeroReciboDeposito(base)).toBe("—")
  })

  it("usa depositosRecibo y, si no hay, las columnas sueltas legacy", () => {
    const nuevos = [
      { id: 1, url: "u1", name: "n1", numero_recibo: "RC-1" },
    ] as DepositoBackend["depositosRecibo"]
    expect(recibosDeCaja({ ...base, depositosRecibo: nuevos })).toHaveLength(1)

    const legacy = recibosDeCaja({
      ...base,
      url_comprobante: "u0",
      name_comprobante: "n0",
    })
    expect(legacy).toEqual([{ url: "u0", name: "n0", numero_recibo: null }])
    expect(recibosDeCaja(base)).toEqual([])
  })

  it("parsea el resumen sea string JSON, objeto o inválido", () => {
    expect(parsearResumen(null)).toEqual({ lotesDetails: [] })
    expect(parsearResumen('{"totalPayment":10}')).toEqual({ totalPayment: 10 })
    expect(parsearResumen({ totalPayment: 5 })).toEqual({ totalPayment: 5 })
    expect(parsearResumen("{no json")).toEqual({ lotesDetails: [] })
  })
})

describe("lotesSoloEnResumen", () => {
  const dep = (resumen: unknown, extra: Partial<DepositoBackend> = {}) =>
    ({
      lote: "G-M4-31",
      lotes_relacionados: [{ lote: "G-M4-31", id: 1, estado: "Aprobado" }],
      resumen,
      ...extra,
    }) as unknown as DepositoBackend

  it("devuelve los lotes del resumen que no tienen fila propia", () => {
    const resumen = { lotesDetails: [{ id: "G-M4-31" }, { id: "G-M4-32" }] }
    expect(lotesSoloEnResumen(dep(resumen))).toEqual(["G-M4-32"])
  })

  it("ignora mayúsculas, espacios y duplicados", () => {
    const resumen = {
      lotesDetails: [{ id: " g-m4-31 " }, { id: "G-M4-32" }, { id: "g-m4-32" }],
    }
    expect(lotesSoloEnResumen(dep(resumen))).toEqual(["G-M4-32"])
  })

  it("sin resumen o resumen inválido no hay extras", () => {
    expect(lotesSoloEnResumen(dep(null))).toEqual([])
    expect(lotesSoloEnResumen(dep("{no json"))).toEqual([])
  })

  it("acepta el resumen como string JSON", () => {
    const json = JSON.stringify({ lotesDetails: [{ id: "G-M4-33" }] })
    expect(lotesSoloEnResumen(dep(json))).toEqual(["G-M4-33"])
  })
})
