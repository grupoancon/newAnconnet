// Tipos de "App → Diagnóstico" (telemetría de la app móvil de clientes: errores,
// advertencias y eventos). Réplica de pages/telemetria.tsx de la intranet anterior.
//
// Los datos salen de anconAPI (`/telemetry/*`, ver lib/api/telemetria-api.ts), que
// exige sesión de intranet + el permiso app:diagnostico porque devuelve datos
// personales de clientes (cédula, correo, dispositivo). La vista "Por usuario" filtra
// exacto por user_id (cédula), sin búsqueda por correo, y trae como máximo 7 días /
// 500 registros.

export type Ventana = "24h" | "7d"
export type Nivel = "error" | "warn" | "event" | "info" | "debug"

export type Bucket = {
  total: number
  error: number
  warn: number
  event: number
  info: number
  debug: number
  errorSessions: number
  errorUsers: number
}

export type Resumen = { last24h: Bucket; last7d: Bucket; generatedAt: string }

export type Tendencias = {
  granularity: "hour" | "day"
  series: { t: string; errores: number; advertencias: number }[]
  byScreen: { name: string; value: number }[]
  byPlatform: { name: string; value: number }[]
  byVersion: { name: string; value: number }[]
}

export type GrupoError = {
  message: string
  errors: number
  warns: number
  count: number
  sessions: number
  users: number
  firstSeen: string
  lastSeen: string
  screens: string[]
  platforms: string[]
  versions: string[]
  sampleId: string
}

export type Evento = {
  id: string
  level: Nivel
  message: string
  screen: string | null
  userId: string | null
  userEmail: string | null
  platform: string | null
  appVersion: string | null
  build: string | null
  osVersion: string | null
  deviceModel: string | null
  statusCode: number | null
  receivedAt: string
}

export type MigaDePan = {
  ts: string
  category: string
  message: string
  data?: Record<string, unknown>
}

export type DetalleEvento = Evento & {
  session: string
  deviceId: string | null
  release: string | null
  error: { name?: string; message?: string; stack?: string } | null
  meta: Record<string, unknown> | null
  breadcrumbs: MigaDePan[] | null
}

export type SesionTelemetria = {
  session: string
  count: number
  user: { id: string | null; email: string | null }
  appVersion: string | null
  events: Evento[]
}

export type UltimaAccion = {
  message: string
  level: string
  props: Record<string, unknown> | null
}

export type SesionEnVivo = {
  session: string
  userId: string | null
  userEmail: string | null
  platform: string | null
  appVersion: string | null
  deviceModel: string | null
  screen: string | null
  state: "active" | "background"
  errors: number
  lastError: string | null
  lastSeen: string
  lastAction: UltimaAccion | null
}

export type AccionEnVivo = UltimaAccion & {
  id: string
  screen: string | null
  statusCode: number | null
  time: number
  cause: string | null
}

export type ChequeoSalud = { name: string; ok: boolean; ms: number; detail?: string }

export type EstadoSistema = {
  checkedAt: string | null
  ageSeconds: number | null
  stale: boolean
  checks: ChequeoSalud[]
}

export type CausaServidor = {
  receivedAt: string
  status: number | null
  method: string
  route: string
  errorName: string
  errorCode: string | null
  errorMessage: string
  stack: string | null
}

export const NIVEL_LABELS: Record<Nivel, string> = {
  error: "Error",
  warn: "Advertencia",
  event: "Evento",
  info: "Info",
  debug: "Debug",
}
