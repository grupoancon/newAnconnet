import type { StatusVariant } from "@/components/shared/status-badge"

import type { EstadoNotificacion } from "./datos"

const formatoFechaHora = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatearFechaHora(valor: string | null | undefined): string {
  return valor ? formatoFechaHora.format(new Date(valor)) : "—"
}

export const VARIANTE_ESTADO: Record<EstadoNotificacion, StatusVariant> = {
  programada: "en-tramite",
  enviada: "disponible",
  parcial: "pendiente",
  fallo: "bloqueado",
  cancelada: "pronto",
  vencida: "pronto",
}
