// "2026-10-22" o "2026-10-22 14:30" → "22/10/2026" / "22/10/2026 · 14:30"
export function formatearFecha(valor: string | null): string {
  if (!valor) return "—"
  const [fecha, hora] = valor.split(" ")
  const [anio, mes, dia] = (fecha ?? "").split("-")
  if (!anio || !mes || !dia) return valor
  return `${dia}/${mes}/${anio}${hora ? ` · ${hora}` : ""}`
}
