const formatoFecha = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export function formatearFecha(valor: string | null | undefined): string {
  return valor ? formatoFecha.format(new Date(valor)) : "—"
}

// Fecha de hoy en Ecuador como "YYYY-MM-DD" (para los campos de fecha de entrega).
export function hoyISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" })
}

export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("")
}
