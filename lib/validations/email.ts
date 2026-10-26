// Validación básica de formato de correo — no verifica que el dominio exista, solo la
// forma general "algo@algo.algo" (sin espacios), suficiente para atajar valores como
// "hola" que hoy pasan sin marcar error.
export function validarEmail(valor: string): string | null {
  const limpio = valor.trim()
  if (!limpio) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio) ? null : "Correo electrónico inválido."
}
