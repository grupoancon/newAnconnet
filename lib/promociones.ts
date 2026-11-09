import type { PromocionBackend } from "@/lib/api/ventas-api"

// Condiciones de una promoción (Configuración → Promociones): tipo de financiamiento
// permitido, abono inicial mínimo y si acepta el abono inicial repartido en varias
// fechas. Mismo criterio y mismo orden de revisión que assertPromocionesAplican en
// newApi (financiamiento/validaciones.util.ts), que es el límite duro al guardar.
// Pruebas: lib/promociones.test.ts.

type CondicionesPromocion = {
  tipos_financiamiento?: string[] | string | null
  abono_inicial_minimo?: string | number | null
  permite_abono_repartido?: boolean | number | string | null
  acumula_descuento_tipo?: boolean | number | string | null
}

type FilaTabla = { formaPago: string; abonoLote?: string | number | null }

/** Suma de las filas "Abono inicial" de la tabla de entrada. */
export function abonoInicialDeTabla(filas: FilaTabla[]): number {
  const total = filas
    .filter((fila) => fila.formaPago === "Abono inicial")
    .reduce((acc, fila) => acc + (Number(fila.abonoLote) || 0), 0)
  return Math.round(total * 100) / 100
}

/** Filas "Abono inicial" con monto (más de una = repartido en varias fechas); una fila
 * en $0 no cuenta como repartir. */
export function filasAbonoInicialDeTabla(filas: FilaTabla[]): number {
  return filas.filter(
    (fila) => fila.formaPago === "Abono inicial" && (Number(fila.abonoLote) || 0) > 0
  ).length
}

/** Monto de la primera fila "Abono inicial" con monto (la primera cuota del abono
 * inicial cuando se reparte en varias fechas); 0 si no hay ninguna. */
export function primerAbonoInicialDeTabla(filas: FilaTabla[]): number {
  const primera = filas.find(
    (fila) => fila.formaPago === "Abono inicial" && (Number(fila.abonoLote) || 0) > 0
  )
  return Math.round((Number(primera?.abonoLote) || 0) * 100) / 100
}

/** Primera cuota del abono inicial antes de generar la tabla: mismo reparto que
 * repartirMonto en los formularios (partes iguales; la última absorbe el residuo). */
export function primerAbonoInicialRepartido(total: number, partes: number): number {
  const monto = Number(total) || 0
  if (partes <= 1) return Math.round(monto * 100) / 100
  return Math.round((monto / partes) * 100) / 100
}

/** La columna es JSON: normalmente llega como lista, pero algunos motores (ej.
 * MariaDB) la devuelven como texto. */
export function tiposDePromocion(valor: CondicionesPromocion["tipos_financiamiento"]) {
  if (Array.isArray(valor)) return valor.filter((t) => typeof t === "string")
  if (typeof valor === "string" && valor.trim()) {
    try {
      const parseado: unknown = JSON.parse(valor)
      return Array.isArray(parseado)
        ? parseado.filter((t): t is string => typeof t === "string")
        : []
    } catch {
      return []
    }
  }
  return []
}

/** DECIMAL llega como texto ("1000.00"); null, vacío o inválido = sin mínimo. */
export function minimoDePromocion(valor: CondicionesPromocion["abono_inicial_minimo"]) {
  const minimo = Number(valor ?? 0)
  return Number.isFinite(minimo) && minimo > 0 ? minimo : 0
}

/** TINYINT llega como 0/1 (o "0"/"1"); null = sin dato = sí permite. */
export function permiteAbonoRepartido(promo: CondicionesPromocion): boolean {
  const valor = promo.permite_abono_repartido
  if (valor == null) return true
  if (typeof valor === "boolean") return valor
  return Number(valor) !== 0
}

/** TINYINT llega como 0/1 (o "0"/"1"); null = sin dato = sí se acumula con el
 * descuento por tipo de financiamiento. */
export function acumulaDescuentoTipo(promo: CondicionesPromocion): boolean {
  const valor = promo.acumula_descuento_tipo
  if (valor == null) return true
  if (typeof valor === "boolean") return valor
  return Number(valor) !== 0
}

/** true si alguna promoción aplicada NO se acumula: el descuento por tipo de
 * financiamiento (5% Contado, 3% BIESS, 3% Mixto) queda en $0. Mismo criterio que
 * promocionesAnulanDescuentoTipo en newApi (validaciones.util.ts). */
export function promocionesAnulanDescuentoTipo(promos: CondicionesPromocion[]): boolean {
  return promos.some((promo) => !acumulaDescuentoTipo(promo))
}

/** null si la promoción se puede aplicar; si no, el motivo para mostrarlo.
 *
 * Promoción "sin repartir" con abono mínimo: el abono inicial SÍ se puede repartir en
 * varias fechas siempre que la PRIMERA cuota alcance el mínimo (ej. mínimo $1.000:
 * $2.000 en 2 cuotas de $1.000 aplica; en 3 cuotas de $666,67 no). Sin abono mínimo,
 * "sin repartir" sigue exigiendo una sola fecha. */
export function motivoPromocionNoAplica(
  promo: CondicionesPromocion,
  financType: string,
  abonoInicial: number,
  filasAbonoInicial = 1,
  primerAbonoInicial = abonoInicial
): string | null {
  const tipos = tiposDePromocion(promo.tipos_financiamiento)
  if (tipos.length > 0 && !tipos.includes(financType)) {
    return `Solo para ${tipos.join(", ")}`
  }
  const minimo = minimoDePromocion(promo.abono_inicial_minimo)
  if (minimo > 0 && (Number(abonoInicial) || 0) + 0.005 < minimo) {
    return `Pide abono inicial de al menos ${formatearDolares(minimo)}`
  }
  if (!permiteAbonoRepartido(promo) && filasAbonoInicial > 1) {
    if (minimo <= 0) return "No aplica con el abono inicial repartido en varias fechas"
    if ((Number(primerAbonoInicial) || 0) + 0.005 < minimo) {
      return `La primera cuota del abono inicial debe ser de al menos ${formatearDolares(minimo)}`
    }
  }
  return null
}

/** Texto corto con las condiciones, para listados
 * ("Crédito directo · Abono inicial ≥ $1,000.00 · Abono sin repartir"). */
export function describirCondicionesPromocion(
  promo: CondicionesPromocion
): string | null {
  const { tipos, abonoMinimo, sinRepartir } = partesCondicionesPromocion(promo)
  const partes: string[] = []
  if (tipos) partes.push(tipos)
  if (abonoMinimo) partes.push(`Abono inicial ≥ ${abonoMinimo}`)
  if (sinRepartir) partes.push(textoSinRepartir(Boolean(abonoMinimo)))
  if (!acumulaDescuentoTipo(promo)) partes.push(TEXTO_NO_ACUMULA)
  return partes.length ? partes.join(" · ") : null
}

/** Las mismas condiciones por separado, para pintarlas con formato propio (ej. el
 * monto mínimo en negrilla). null/false en cada parte que no aplica. */
export function partesCondicionesPromocion(promo: CondicionesPromocion): {
  tipos: string | null
  abonoMinimo: string | null
  sinRepartir: boolean
} {
  const tipos = tiposDePromocion(promo.tipos_financiamiento)
  const minimo = minimoDePromocion(promo.abono_inicial_minimo)
  return {
    tipos: tipos.length > 0 ? tipos.join(", ") : null,
    abonoMinimo: minimo > 0 ? formatearDolares(minimo) : null,
    sinRepartir: !permiteAbonoRepartido(promo),
  }
}

/** Texto para las promociones que anulan el descuento por tipo de financiamiento. */
export const TEXTO_NO_ACUMULA = "No se acumula con el descuento por tipo"

/** Texto de la condición "sin repartir": con abono mínimo, lo que cuenta es la primera
 * cuota del abono inicial (ver motivoPromocionNoAplica). */
export function textoSinRepartir(tieneMinimo: boolean): string {
  return tieneMinimo ? "Mínimo en la 1.ª cuota del abono" : "Abono sin repartir"
}

function formatearDolares(valor: number): string {
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

// Re-export para quien tipe con la forma del backend.
export type { PromocionBackend }
