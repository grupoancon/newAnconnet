// Pruebas de las condiciones de promociones en pantalla (qué casillas se pueden marcar
// en Financiamiento / Cotización / Refinanciamiento). Los mismos casos que
// newApi/apps/intranet/financiamiento/promociones-condiciones.spec.ts: si una
// promoción se rechaza allá al guardar, acá tiene que salir deshabilitada.
import { describe, expect, it } from "vitest"

import {
  abonoInicialDeTabla,
  describirCondicionesPromocion,
  filasAbonoInicialDeTabla,
  minimoDePromocion,
  motivoPromocionNoAplica,
  partesCondicionesPromocion,
  permiteAbonoRepartido,
  tiposDePromocion,
} from "./promociones"

type Fila = { formaPago: string; abonoLote: string | number }
type Promo = Parameters<typeof motivoPromocionNoAplica>[0]

// --- Datos de prueba ---------------------------------------------------------------

// En pantalla los montos de la tabla son texto (lo que escribe el asesor).
const abono = (monto: number | string): Fila => ({
  formaPago: "Abono inicial",
  abonoLote: String(monto),
})
const entrada = (monto: number): Fila => ({ formaPago: "Entrada", abonoLote: String(monto) })
const pagoTotal = (monto: number): Fila => ({
  formaPago: "Pago total",
  abonoLote: String(monto),
})

const promo = (extra: Partial<Promo> = {}): Promo => ({
  tipos_financiamiento: null,
  abono_inicial_minimo: null,
  permite_abono_repartido: 1,
  ...extra,
})

const TODOS_LOS_TIPOS = [
  "Crédito directo",
  "Crédito BIESS",
  "Contado",
  "Mixto",
  "Crédito BIESS (Sin Interés)",
]

/** Evalúa como lo hacen las pantallas: monto y filas salen de la tabla de entrada. */
function evaluar(p: Promo, tipo: string, filas: Fila[]) {
  return motivoPromocionNoAplica(
    p,
    tipo,
    abonoInicialDeTabla(filas),
    filasAbonoInicialDeTabla(filas)
  )
}

// --- Tabla de entrada ---------------------------------------------------------------

describe("abono inicial desde la tabla de entrada", () => {
  it("tabla vacía = 0 y 0 filas", () => {
    expect(abonoInicialDeTabla([])).toBe(0)
    expect(filasAbonoInicialDeTabla([])).toBe(0)
  })

  it("solo cuenta 'Abono inicial', no Entrada ni Pago total", () => {
    const filas = [abono(600), entrada(5000), pagoTotal(20000), abono(400)]
    expect(abonoInicialDeTabla(filas)).toBe(1000)
    expect(filasAbonoInicialDeTabla(filas)).toBe(2)
  })

  it("redondea a centavos (sin errores de coma flotante)", () => {
    expect(abonoInicialDeTabla([abono(0.1), abono(0.2)])).toBe(0.3)
    expect(abonoInicialDeTabla([abono(333.33), abono(333.33), abono(333.34)])).toBe(1000)
  })

  it("texto vacío o inválido mientras el asesor escribe cuenta como 0", () => {
    expect(abonoInicialDeTabla([abono(""), abono("abc"), abono("1000")])).toBe(1000)
    expect(filasAbonoInicialDeTabla([abono(""), abono("1000")])).toBe(1)
  })

  it("una fila en $0 no cuenta como repartido", () => {
    expect(filasAbonoInicialDeTabla([abono(1000), abono(0)])).toBe(1)
  })
})

// --- Lectura de la promoción --------------------------------------------------------

describe("lectura de las condiciones que manda el API", () => {
  it("tipos: lista, texto JSON, vacío o basura", () => {
    expect(tiposDePromocion(["Contado"])).toEqual(["Contado"])
    expect(tiposDePromocion('["Contado","Mixto"]')).toEqual(["Contado", "Mixto"])
    expect(tiposDePromocion("")).toEqual([])
    expect(tiposDePromocion(null)).toEqual([])
    expect(tiposDePromocion(undefined)).toEqual([])
    expect(tiposDePromocion("no es json")).toEqual([])
  })

  it("mínimo: '1000.00', número, 0, vacío, inválido o negativo", () => {
    expect(minimoDePromocion("1000.00")).toBe(1000)
    expect(minimoDePromocion(1000)).toBe(1000)
    expect(minimoDePromocion("0.00")).toBe(0)
    expect(minimoDePromocion(null)).toBe(0)
    expect(minimoDePromocion("")).toBe(0)
    expect(minimoDePromocion("abc")).toBe(0)
    expect(minimoDePromocion(-5)).toBe(0)
  })

  it.each([
    [1, true],
    ["1", true],
    [true, true],
    [null, true],
    [undefined, true],
    [0, false],
    ["0", false],
    [false, false],
  ])("permite repartido %p → %p", (valor, esperado) => {
    expect(permiteAbonoRepartido({ permite_abono_repartido: valor })).toBe(esperado)
  })
})

// --- Condición 1: tipo ---------------------------------------------------------------

describe("condición: tipo de financiamiento", () => {
  const filas = [abono(1000)]

  it.each(TODOS_LOS_TIPOS)("sin tipos aplica a %s", (tipo) => {
    expect(evaluar(promo(), tipo, filas)).toBeNull()
    expect(evaluar(promo({ tipos_financiamiento: [] }), tipo, filas)).toBeNull()
  })

  const pares = TODOS_LOS_TIPOS.flatMap((permitido) =>
    TODOS_LOS_TIPOS.map((financ) => [permitido, financ] as const)
  )
  it.each(pares)("solo '%s' con financiamiento '%s'", (permitido, financ) => {
    const motivo = evaluar(promo({ tipos_financiamiento: [permitido] }), financ, filas)
    expect(motivo).toBe(permitido === financ ? null : `Solo para ${permitido}`)
  })

  it("varios tipos", () => {
    const p = promo({ tipos_financiamiento: ["Crédito directo", "Mixto"] })
    expect(evaluar(p, "Mixto", filas)).toBeNull()
    expect(evaluar(p, "Contado", filas)).toBe("Solo para Crédito directo, Mixto")
  })

  it("tipos como texto JSON no coinciden por pedazos de texto", () => {
    const p = promo({ tipos_financiamiento: '["Contado"]' })
    expect(evaluar(p, "Contado", filas)).toBeNull()
    expect(evaluar(p, "Cont", filas)).not.toBeNull()
  })
})

// --- Condición 2: mínimo -------------------------------------------------------------

describe("condición: abono inicial mínimo ($1000)", () => {
  const p = promo({ abono_inicial_minimo: "1000.00" })
  const motivo = "Pide abono inicial de al menos $1,000.00"

  it.each([
    ["exacto 1000", [abono(1000)], null],
    ["1500", [abono(1500)], null],
    ["999.99", [abono(999.99)], motivo],
    ["sin abono inicial", [entrada(5000)], motivo],
    ["tabla vacía", [], motivo],
    ["500 + 500", [abono(500), abono(500)], null],
    ["333.33 + 333.33 + 333.34", [abono(333.33), abono(333.33), abono(333.34)], null],
    ["500 + 499.99", [abono(500), abono(499.99)], motivo],
    ["las Entrada no cuentan", [abono(500), entrada(5000)], motivo],
  ] as Array<[string, Fila[], string | null]>)("%s", (_n, filas, esperado) => {
    expect(evaluar(p, "Crédito directo", filas)).toBe(esperado)
  })

  it.each([null, undefined, "0.00", 0, "", "abc"])("mínimo %p = sin mínimo", (minimo) => {
    expect(evaluar(promo({ abono_inicial_minimo: minimo }), "Contado", [])).toBeNull()
  })

  it("abono inicial NaN (generador vacío) no rompe y cuenta como 0", () => {
    expect(motivoPromocionNoAplica(p, "Contado", NaN, 1)).toBe(motivo)
  })
})

// --- Condición 3: repartido ----------------------------------------------------------

describe("condición: abono inicial repartido", () => {
  const noReparte = promo({ permite_abono_repartido: 0 })
  const motivo = "No aplica con el abono inicial repartido en varias fechas"

  it.each([
    ["una sola fila", [abono(1000)], null],
    ["tabla vacía", [], null],
    ["500 + 500", [abono(500), abono(500)], motivo],
    ["tres fechas", [abono(300), abono(300), abono(400)], motivo],
    ["1000 + fila en $0", [abono(1000), abono(0)], null],
    ["una fila + cuotas Entrada", [abono(1000), entrada(100), entrada(100)], null],
  ] as Array<[string, Fila[], string | null]>)("no permite repartir — %s", (_n, filas, esperado) => {
    expect(evaluar(noReparte, "Contado", filas)).toBe(esperado)
  })

  it("sin tabla todavía: usa la cantidad de fechas del generador", () => {
    expect(motivoPromocionNoAplica(noReparte, "Contado", 1000, 2)).toBe(motivo)
    expect(motivoPromocionNoAplica(noReparte, "Contado", 1000, 1)).toBeNull()
    // Sin pasar la cantidad, se asume una sola fecha.
    expect(motivoPromocionNoAplica(noReparte, "Contado", 1000)).toBeNull()
  })

  it.each([1, true, null])("valor %p sí deja repartir", (valor) => {
    expect(
      evaluar(promo({ permite_abono_repartido: valor }), "Contado", [abono(500), abono(500)])
    ).toBeNull()
  })
})

// --- Combinadas ----------------------------------------------------------------------

describe("condiciones combinadas: Contado + $1000 + sin repartir", () => {
  const p = promo({
    tipos_financiamiento: ["Contado"],
    abono_inicial_minimo: "1000.00",
    permite_abono_repartido: 0,
  })

  // Mismo orden de revisión que el backend: tipo → mínimo → repartido.
  it.each([
    ["todo cumple", "Contado", [abono(1000)], null],
    ["tipo no", "Mixto", [abono(1000)], /^Solo para/],
    ["mínimo no", "Contado", [abono(999)], /^Pide abono/],
    ["repartido", "Contado", [abono(600), abono(600)], /repartido/],
    ["tipo no + mínimo no", "Mixto", [abono(10)], /^Solo para/],
    ["tipo no + repartido", "Mixto", [abono(600), abono(600)], /^Solo para/],
    ["mínimo no + repartido", "Contado", [abono(400), abono(400)], /^Pide abono/],
    ["nada cumple", "Mixto", [abono(1), abono(1)], /^Solo para/],
  ] as Array<[string, string, Fila[], RegExp | null]>)("%s", (_n, tipo, filas, esperado) => {
    const motivo = evaluar(p, tipo, filas)
    if (esperado === null) expect(motivo).toBeNull()
    else expect(motivo).toMatch(esperado)
  })
})

// --- Texto de las condiciones --------------------------------------------------------

describe("texto de las condiciones en los listados", () => {
  it("sin condiciones = null (se muestra 'Siempre' o nada)", () => {
    expect(describirCondicionesPromocion(promo())).toBeNull()
    expect(partesCondicionesPromocion(promo())).toEqual({
      tipos: null,
      abonoMinimo: null,
      sinRepartir: false,
    })
  })

  it("las tres juntas", () => {
    const p = promo({
      tipos_financiamiento: ["Contado", "Mixto"],
      abono_inicial_minimo: "1000.00",
      permite_abono_repartido: 0,
    })
    expect(describirCondicionesPromocion(p)).toBe(
      "Contado, Mixto · Abono inicial ≥ $1,000.00 · Abono sin repartir"
    )
    expect(partesCondicionesPromocion(p)).toEqual({
      tipos: "Contado, Mixto",
      abonoMinimo: "$1,000.00",
      sinRepartir: true,
    })
  })

  it("cada una sola", () => {
    expect(describirCondicionesPromocion(promo({ tipos_financiamiento: ["Contado"] }))).toBe(
      "Contado"
    )
    expect(describirCondicionesPromocion(promo({ abono_inicial_minimo: "1000.5" }))).toBe(
      "Abono inicial ≥ $1,000.50"
    )
    expect(describirCondicionesPromocion(promo({ permite_abono_repartido: 0 }))).toBe(
      "Abono sin repartir"
    )
  })
})
