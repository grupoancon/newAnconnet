// Valida el número de un PhoneField (sin el prefijo de país, que se elige aparte en un
// selector propio) — solo exige que sea numérico, sin espacios/guiones/símbolos.
export function validarTelefono(valor: string): string | null {
  const limpio = valor.trim()
  if (!limpio) return null
  return /^\d+$/.test(limpio) ? null : "El teléfono debe contener solo números."
}
