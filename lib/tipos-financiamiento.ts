// "Crédito directo sin interés": se habilita por proyecto (Gestión de inventario →
// editar proyecto), con una fecha límite opcional para el último pago. Funciona igual
// que "Contado" (abono inicial + cuotas + "Pago total", sin cronograma ni interés) pero
// sin el descuento por tipo de financiamiento. Mismo criterio que
// validaciones.util.ts en newApi (assertTipoPermitidoParaProyecto).
export const CREDITO_DIRECTO_SIN_INTERES = "Crédito directo sin interés"

// Tipos con la estructura de "Contado": una sola tabla que cierra con "Pago total".
export function esTipoContado(tipo: string): boolean {
  return tipo === "Contado" || tipo === CREDITO_DIRECTO_SIN_INTERES
}

export type ConfigSinInteres =
  | {
      sin_interes_habilitado?: boolean | number | null
      sin_interes_fecha_limite?: string | null
    }
  | null
  | undefined

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/

export function fechaLimiteSinInteres(proyecto: ConfigSinInteres): string | null {
  const fecha = String(proyecto?.sin_interes_fecha_limite ?? "").slice(0, 10)
  return FORMATO_ISO.test(fecha) ? fecha : null
}

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split("-")
  return `${dia}/${mes}/${anio}`
}

// Tipos que se ofrecen para un lote: "Crédito directo sin interés" solo si el proyecto
// lo tiene habilitado (o si el registro ya lo tenía guardado, para no dejar el select
// en blanco — al guardar, el backend igual lo rechaza si ya no está habilitado).
export function tiposFinanciamientoParaProyecto(
  tipos: readonly string[],
  proyecto: ConfigSinInteres,
  tipoActual?: string
): string[] {
  const permitido =
    Boolean(proyecto?.sin_interes_habilitado) ||
    tipoActual === CREDITO_DIRECTO_SIN_INTERES
  return permitido ? [...tipos, CREDITO_DIRECTO_SIN_INTERES] : [...tipos]
}

// Nota bajo el selector de tipo: hasta cuándo se puede aplicar.
export function avisoSinInteres(proyecto: ConfigSinInteres): string | null {
  const limite = fechaLimiteSinInteres(proyecto)
  return limite
    ? `Disponible hasta el ${formatearFecha(limite)}: ningún pago puede caer después.`
    : null
}

// Error si el tipo no se puede usar con estas fechas de pago — null si está bien.
export function errorSinInteres(
  tipo: string,
  proyecto: ConfigSinInteres,
  fechasPago: (string | null | undefined)[]
): string | null {
  if (tipo !== CREDITO_DIRECTO_SIN_INTERES) return null
  if (!proyecto?.sin_interes_habilitado) {
    return `"${CREDITO_DIRECTO_SIN_INTERES}" ya no está habilitado para este proyecto.`
  }
  const limite = fechaLimiteSinInteres(proyecto)
  if (!limite) return null
  const ultimo = fechasPago
    .map((f) => String(f ?? "").slice(0, 10))
    .filter((f) => FORMATO_ISO.test(f))
    .sort()
    .pop()
  if (ultimo && ultimo > limite) {
    return `"${CREDITO_DIRECTO_SIN_INTERES}" solo se puede aplicar hasta el ${formatearFecha(limite)}: el último pago cae el ${formatearFecha(ultimo)}.`
  }
  return null
}
