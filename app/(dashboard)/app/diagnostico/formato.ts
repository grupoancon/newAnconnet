import type { StatusVariant } from "@/components/shared/status-badge"

import type { Nivel } from "./datos"

const formatoFechaHora = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

export function formatearFechaHora(valor: string | null | undefined): string {
  return valor ? formatoFechaHora.format(new Date(valor)) : "—"
}

// 24 h (14:05:09): más corta que "2:05:09 p. m." y no se parte en las líneas de tiempo.
export function formatearHora(valor: string): string {
  return new Date(valor).toLocaleTimeString("es-EC", { hour12: false })
}

export function haceCuanto(valor: string | null | undefined): string {
  if (!valor) return "—"
  const segundos = Math.round((Date.now() - new Date(valor).getTime()) / 1000)
  if (segundos < 60) return `hace ${segundos} s`
  if (segundos < 3600) return `hace ${Math.round(segundos / 60)} min`
  if (segundos < 86400) return `hace ${Math.round(segundos / 3600)} h`
  return `hace ${Math.round(segundos / 86400)} d`
}

export const VARIANTE_NIVEL: Record<Nivel, StatusVariant> = {
  error: "bloqueado",
  warn: "pendiente",
  event: "ingresado",
  info: "pronto",
  debug: "pronto",
}
