// Wrappers tipados sobre el panel de telemetría de la app móvil de clientes
// (`/telemetry/*` en anconAPI) — pantalla "App → Diagnóstico". Todas las rutas exigen
// sesión de intranet + el permiso app:diagnostico, por eso van con
// `credentials: "include"`. El backend devuelve las filas tal cual vienen de
// `telemetry_events` (snake_case); acá se pasan a los tipos de
// app/(dashboard)/app/diagnostico/datos.ts.
import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type {
  DetalleEvento,
  Evento,
  GrupoError,
  MigaDePan,
  Nivel,
  Resumen,
  SesionTelemetria,
  Tendencias,
  Ventana,
} from "@/app/(dashboard)/app/diagnostico/datos"

const TELEMETRIA_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/telemetry`

export class TelemetriaApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "TelemetriaApiError"
    this.status = status
  }
}

// Mismo criterio que inventarioFetch: sin timeout un backend colgado deja la pantalla
// en el spinner para siempre.
const TIMEOUT_MS = 15_000

async function telemetriaFetch<T>(path: string): Promise<T> {
  let response: Response
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)
  try {
    response = await fetch(`${TELEMETRIA_BASE_URL}${path}`, {
      credentials: "include",
      signal: timeoutController.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TelemetriaApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new TelemetriaApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      response.status === 403
        ? "No tienes el permiso app:diagnostico para ver la telemetría de la app."
        : response.status === 404
          ? "El backend no tiene el módulo de telemetría (falta desplegar anconAPI)."
          : (cuerpo?.message ??
            cuerpo?.error ??
            response.statusText ??
            "Error desconocido")
    throw new TelemetriaApiError(mensaje, response.status)
  }

  return cuerpo as T
}

function query(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== "")
      qs.set(clave, String(valor))
  }
  const texto = qs.toString()
  return texto ? `?${texto}` : ""
}

// ── Filas crudas del backend ────────────────────────────────────────────────────────

type FilaEvento = {
  id: string
  level: Nivel
  message: string
  screen: string | null
  user_id: string | null
  user_email: string | null
  platform: string | null
  app_version: string | null
  build: string | null
  os_version: string | null
  device_model: string | null
  status_code: number | null
  received_at: string
}

type FilaEventoCompleta = FilaEvento & {
  session: string
  device_id: string | null
  release: string | null
  error: DetalleEvento["error"]
  meta: Record<string, unknown> | null
  breadcrumbs: MigaDePan[] | null
}

type Pagina<T> = { rows: T[]; page: number; limit: number; hasMore: boolean }

function aEvento(fila: FilaEvento): Evento {
  return {
    id: fila.id,
    level: fila.level,
    message: fila.message,
    screen: fila.screen,
    userId: fila.user_id || null,
    userEmail: fila.user_email || null,
    platform: fila.platform,
    appVersion: fila.app_version,
    build: fila.build,
    osVersion: fila.os_version,
    deviceModel: fila.device_model,
    statusCode: fila.status_code,
    receivedAt: fila.received_at,
  }
}

function aDetalle(fila: FilaEventoCompleta): DetalleEvento {
  return {
    ...aEvento(fila),
    session: fila.session,
    deviceId: fila.device_id,
    release: fila.release,
    error: fila.error,
    meta: fila.meta,
    breadcrumbs: Array.isArray(fila.breadcrumbs) ? fila.breadcrumbs : null,
  }
}

// ── Endpoints ───────────────────────────────────────────────────────────────────────

// GET /telemetry/summary
export function obtenerResumen(): Promise<Resumen> {
  return telemetriaFetch<Resumen>("/summary")
}

// GET /telemetry/trends?window=
export async function obtenerTendencias(ventana: Ventana): Promise<Tendencias> {
  const crudo = await telemetriaFetch<{
    granularity: Tendencias["granularity"]
    series: { t: string; Errores: number; Advertencias: number }[]
    byScreen: { name: string; value: number }[]
    byPlatform: { name: string; value: number }[]
    byVersion: { name: string; value: number }[]
  }>(`/trends${query({ window: ventana })}`)
  const soloNombreValor = (lista: { name: string; value: number }[]) =>
    lista.map(({ name, value }) => ({ name, value }))
  return {
    granularity: crudo.granularity,
    series: crudo.series.map((p) => ({
      t: p.t,
      errores: p.Errores,
      advertencias: p.Advertencias,
    })),
    byScreen: soloNombreValor(crudo.byScreen),
    byPlatform: soloNombreValor(crudo.byPlatform),
    byVersion: soloNombreValor(crudo.byVersion),
  }
}

// GET /telemetry/errors?window=&q=&level=&limit=
export async function listarGruposError(params: {
  ventana: Ventana
  busqueda?: string
  nivel?: "error" | "warn"
}): Promise<GrupoError[]> {
  const respuesta = await telemetriaFetch<Pagina<GrupoError>>(
    `/errors${query({ window: params.ventana, q: params.busqueda, level: params.nivel, limit: 100 })}`
  )
  return respuesta.rows
}

// GET /telemetry/events?window=&q=&level=&message=&user=&page=&limit=
export async function listarEventos(params: {
  ventana: Ventana
  busqueda?: string
  nivel?: Nivel
  mensaje?: string
  usuario?: string
  pagina?: number
  limite?: number
}): Promise<{ eventos: Evento[]; hayMas: boolean }> {
  const respuesta = await telemetriaFetch<Pagina<FilaEvento>>(
    `/events${query({
      window: params.ventana,
      q: params.busqueda,
      level: params.nivel,
      message: params.mensaje,
      user: params.usuario,
      page: params.pagina,
      limit: params.limite,
    })}`
  )
  return { eventos: respuesta.rows.map(aEvento), hayMas: respuesta.hasMore }
}

// GET /telemetry/events/:id
export async function obtenerDetalleEvento(id: string): Promise<DetalleEvento | null> {
  const fila = await telemetriaFetch<FilaEventoCompleta | null>(
    `/events/${encodeURIComponent(id)}`
  )
  return fila ? aDetalle(fila) : null
}

// GET /telemetry/sessions/:session
export async function obtenerSesion(session: string): Promise<SesionTelemetria> {
  const crudo = await telemetriaFetch<{
    session: string
    count: number
    user: { id: string | null; email: string | null }
    device: { app_version: string | null } | null
    events: FilaEvento[]
  }>(`/sessions/${encodeURIComponent(session)}`)
  return {
    session: crudo.session,
    count: crudo.count,
    user: crudo.user,
    appVersion: crudo.device?.app_version ?? null,
    events: crudo.events.map(aEvento),
  }
}

// No hay endpoint de "usuarios recientes": se deriva de los últimos eventos de 7 días
// (como máximo 500, el tope del backend), quedándose con el más reciente de cada cédula.
export async function listarUsuariosRecientes(): Promise<
  { userId: string; email: string | null; ultimo: string }[]
> {
  const { eventos } = await listarEventos({ ventana: "7d", limite: 500 })
  const porUsuario = new Map<
    string,
    { userId: string; email: string | null; ultimo: string }
  >()
  for (const e of eventos) {
    if (!e.userId) continue
    const actual = porUsuario.get(e.userId)
    if (!actual || e.receivedAt > actual.ultimo) {
      porUsuario.set(e.userId, {
        userId: e.userId,
        email: e.userEmail,
        ultimo: e.receivedAt,
      })
    }
  }
  return Array.from(porUsuario.values()).sort((a, b) => b.ultimo.localeCompare(a.ultimo))
}
