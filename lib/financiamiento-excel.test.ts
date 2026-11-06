// Estructura del Excel de financiamiento: tiene que calzar con el archivo que generaba
// la intranet vieja (ej. "Financiamiento - PV-J-148 - ANDRADE MEJIA WILLIAM RICARDO.xlsx").
import { describe, expect, it } from "vitest"

import type { LoteInventario } from "@/lib/api/inventario-api"
import type { FinanciamientoBackend, ProcesoBackend } from "@/lib/api/ventas-api"
import { construirHojasFinanciamiento } from "@/lib/financiamiento-excel"

const fechas = [
  "2026-11-01",
  "2026-12-05",
  "2027-01-05",
  "2027-02-05",
  "2027-03-05",
  "2027-04-05",
  "2027-05-05",
  "2027-06-05",
  "2027-07-05",
  "2027-08-05",
]
const abonos = [1000, 300, 300, 300, 300, 300, 7000, 300, 299.7, 22545]

function ejemploBiess() {
  const entradas = fechas.map((fecha, i) => {
    const ali = i >= 7 ? 45 : 0
    const esc = i === 9 ? 250 : 0
    return {
      forma_pago: i === 0 ? "Abono inicial" : i === 9 ? "Desembolso BIESS" : "Entrada",
      fecha_pago: fecha,
      abono_lote: abonos[i],
      alicuotas: [
        { nombre: "Alicuota MZ y Serv. Generales", valor: ali, fechaInicio: null },
        { nombre: "Alicuota parques comunales", valor: 0, fechaInicio: "2027-06-01" },
      ],
      alicuota_comunal: ali,
      escritura: esc,
      total_cancelar: abonos[i] + ali + esc,
      observaciones: null,
    }
  })
  return {
    financiamiento: {
      init_date: "2026-10-31",
      created_at: null,
      financ_type: "Crédito BIESS",
      total_financ: "0",
      discount: "1009.63",
      extra_discount: "300",
      promo_discount: "0",
      ofrecimientos: "HUERTO, TANQUE BIODIGESTOR",
      entradas,
      detalle: [],
    } as unknown as FinanciamientoBackend,
    proceso: {
      cli_lote: "PV-J-148",
      lote_price: 33954.33,
      lote_mts: 625.31,
      titular: { nombre: "ANDRADE MEJIA WILLIAM RICARDO" },
    } as unknown as ProcesoBackend,
    loteInfo: {
      codigo: "PV-J-148",
      pvp: "33954.33",
      areaUtil: "625.31",
      proyecto: { nombre: "Perla Verde" },
    } as unknown as LoteInventario,
  }
}

describe("construirHojasFinanciamiento", () => {
  it("arma la hoja Financiamiento como el ejemplo", () => {
    const { hojas, nombreArchivo } = construirHojasFinanciamiento(ejemploBiess())
    expect(nombreArchivo).toBe(
      "Financiamiento - PV-J-148 - ANDRADE MEJIA WILLIAM RICARDO.xlsx"
    )
    const [anexo] = hojas
    expect(anexo.nombre).toBe("Financiamiento")
    expect(anexo.filas[1][1]).toBe("ANEXO")
    expect(anexo.filas[4].slice(1, 4)).toEqual(["FECHA", "", "31 oct 2026"])
    expect(anexo.filas[6].slice(1)).toEqual(["PROYECTO", "", "PERLA VERDE - JADE"])
    expect(anexo.filas[7].slice(1)).toEqual(["INMUEBLE", "", "PV-J-148", "Mts", 625.31])
    expect(anexo.filas[13].slice(1)).toEqual([
      "FORMA DE PAGO",
      "",
      "FECHA",
      "# CUOTAS",
      "ABONO LOTE",
      "ALICUOTA MZ Y SERV. GENERALES",
      "TOTAL A CANCELAR",
      "OBSERVACION",
    ])
    expect(anexo.filas[14].slice(1, 8)).toEqual([
      "ABONO INICIAL",
      "",
      "01/11/2026",
      1,
      1000,
      0,
      1000,
    ])
    expect(anexo.filas[23].slice(1, 8)).toEqual([
      "CRED. BIESS",
      "",
      "05/08/2027",
      1,
      22545,
      45,
      22840,
    ])
    expect(anexo.filas[24].slice(1)).toEqual(["TOTAL", "", "", "", 32644.7, 135, 33029.7])
    expect(anexo.combinadas).toContain("B25:E25")
  })

  it("arma la hoja SAP separada por concepto y fecha", () => {
    const { hojas } = construirHojasFinanciamiento(ejemploBiess())
    const sap = hojas[1]
    expect(sap.nombre).toBe("SAP")
    expect(sap.filas[0]).toEqual(["item", "cantidad", "fec_pago", "total", "texto"])
    expect(sap.filas.slice(9)).toEqual([
      ["VALI", 1, "05/06/2027", 45, "ENTRADA 8"],
      ["VENT", 1, "05/07/2027", 299.7, "ENTRADA 9"],
      ["VALI", 1, "05/07/2027", 45, "ENTRADA 9"],
      ["VENT", 1, "05/08/2027", 22545, "ENTRADA 10"],
      ["VALI", 1, "05/08/2027", 45, "ENTRADA 10"],
      ["VESC", 1, "05/08/2027", 250, "ESCRITURA 1"],
      ["LT-P", 1, "05/08/2027", 32644.7, "Pago total lote"],
    ])
  })

  it("usa el código SAP correcto para cada proyecto", () => {
    const casos: Array<[string, string]> = [
      ["Balcón del Caony", "LT-BC"],
      ["El Edén", "LT-ED"],
      ["El Jardín", "LT-EJ"],
      ["El Manantial", "LT-EM"],
      ["La Fontana", "LT-F"],
      ["Puerto Quito Garden", "LT-G"],
      ["Mirador del Lago", "LT-ML"],
      ["Perla Verde", "LT-P"],
      ["Praderas de Puerto Quito", "LT-PQ"],
    ]
    for (const [nombre, codigo] of casos) {
      const datos = ejemploBiess()
      datos.loteInfo = {
        ...datos.loteInfo,
        codigo: "X-1",
        proyecto: { nombre },
      } as unknown as LoteInventario
      const sap = construirHojasFinanciamiento(datos).hojas[1]
      expect(sap.filas[sap.filas.length - 1][0], nombre).toBe(codigo)
    }
  })

  it("crédito directo: agrega el cronograma y separa capital, interés y alícuota en SAP", () => {
    const datos = ejemploBiess()
    const cuota = (mes: number, fecha: string, sobrante = false) => ({
      mes,
      fecha,
      capital: sobrante ? 0 : 500,
      interes: sobrante ? 0 : 20.5,
      abono: sobrante ? 0 : 520.5,
      alicuota: 45,
      alicuotas: [
        { nombre: "Alicuota MZ y Serv. Generales", valor: 45, fechaInicio: null },
      ],
      escritura: mes === 1 ? 250 : 0,
      cuota: sobrante ? 0 : 565.5 + (mes === 1 ? 250 : 0),
      saldo: 1000 - mes * 500,
      editado: false,
      sobrante,
      escrituraEditada: false,
    })
    datos.financiamiento = {
      ...datos.financiamiento,
      financ_type: "Crédito directo",
      total_financ: "1000",
      entradas: [datos.financiamiento.entradas![0]],
      detalle: [
        cuota(1, "2026-12-05"),
        cuota(2, "2027-01-05"),
        cuota(3, "2027-02-05", true),
      ],
    } as FinanciamientoBackend

    const [anexo, sap] = construirHojasFinanciamiento(datos).hojas
    // Abono inicial (fila 15), TOTAL (16), vacía (17), encabezado del cronograma (18)
    expect(anexo.filas[17].slice(1)).toEqual([
      "NUMERO MESES",
      "Fecha de pago",
      "CAPITAL",
      "INTERES",
      "ABONO LOTE",
      "ALICUOTA MZ Y SERV. GENERALES",
      "ESCRITURA",
      "CUOTA A CANCELAR",
      "SALDO CAPITAL",
    ])
    expect(anexo.filas[18].slice(1)).toEqual([
      1,
      "05/12/2026",
      500,
      20.5,
      520.5,
      45,
      250,
      815.5,
      500,
    ])
    // La cuota "sobrante" no se exporta.
    expect(anexo.filas).toHaveLength(20)

    expect(sap.filas.slice(1)).toEqual([
      ["VENT", 1, "01/11/2026", 1000, "ENTRADA 1"],
      ["VLOT", 1, "05/12/2026", 500, "CUOTA 1"],
      ["VINT", 1, "05/12/2026", 20.5, "CUOTA 1"],
      ["VALI", 1, "05/12/2026", 45, "CUOTA 1"],
      ["VESC", 1, "05/12/2026", 250, "ESCRITURA 1"],
      ["VLOT", 1, "05/01/2027", 500, "CUOTA 2"],
      ["VINT", 1, "05/01/2027", 20.5, "CUOTA 2"],
      ["VALI", 1, "05/01/2027", 45, "CUOTA 2"],
      ["LT-P", 1, "05/01/2027", 2041, "Pago total lote"],
    ])
  })

  it("Contado/BIESS no llevan cronograma", () => {
    const [anexo] = construirHojasFinanciamiento(ejemploBiess()).hojas
    expect(anexo.filas).toHaveLength(27)
    expect(anexo.filas[26]).toEqual([null, ""])
  })
})
