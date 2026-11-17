// Sesiones de la app móvil: cuántos la usan y qué sesiones siguen abiertas
// (`/app-sesiones` en newApi). La actividad sale de la telemetría; las sesiones, de Redis.

export type Conteo = { nombre: string; total: number }

export type ResumenSesiones = {
  activosAhora: number
  ventanaActivosMinutos: number
  usuariosHoy: number
  dispositivosHoy: number
  usuarios7d: number
  sesionesAbiertas: number
  usuariosConSesion: number
  plataformas: Conteo[]
  versiones: Conteo[]
  cierres7d: { evento: string; motivo: string; total: number }[]
  generadoEn: string
}

export type SesionApp = {
  sessionId: string
  usuario: { id: string; nombre: string | null; cedula: string | null; email: string | null }
  dispositivo: string | null
  sistema: string | null
  ip: string | null
  metodo: string | null
  iniciada: string
  ultimoUso: string | null
}

export type ListaSesiones = {
  sesiones: SesionApp[]
  total: number
  pagina: number
  hayMas: boolean
}

export const POR_PAGINA = 50

const MOTIVOS: Record<string, string> = {
  SESSION_EXPIRED: "Caducó (30 días sin usar la app o sin motivo guardado)",
  SESSION_REPLACED: "Reemplazada por otro inicio en el mismo teléfono",
  NEW_LOGIN: "Nuevo inicio en otro dispositivo",
  PASSWORD_CHANGED: "Cambio de contraseña",
  SUSPICIOUS_ACTIVITY: "Actividad sospechosa",
  LOTE_ENTREGADO: "Lote entregado",
  LOTE_RETIRADO: "Lote retirado",
  USUARIO_RETIRADO: "Usuario dado de baja",
  UNKNOWN: "Sin motivo",
}

/** Texto legible de un cierre de sesión (eventos session_ended / app_locked / logout_manual). */
export function describirCierre(evento: string, motivo: string): string {
  if (evento === "app_locked") return "Bloqueo al volver (pidió PIN o biometría)"
  if (evento === "logout_manual") return "El cliente cerró sesión"
  return `Cerrada: ${MOTIVOS[motivo] ?? (motivo || "sin motivo")}`
}

export const METODOS: Record<string, string> = {
  password: "Contraseña",
  pin: "PIN",
  biometric: "Biometría",
}

/** "hace 3 min", "hace 2 h", "hace 5 días". */
export function haceCuanto(fecha: string | null, ahora = Date.now()): string {
  if (!fecha) return "Sin registro"
  const min = Math.max(0, Math.round((ahora - Date.parse(fecha)) / 60000))
  if (min < 1) return "Ahora"
  if (min < 60) return `Hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `Hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? "Hace 1 día" : `Hace ${d} días`
}
