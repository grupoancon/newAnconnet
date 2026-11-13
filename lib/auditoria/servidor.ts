import "server-only"

import type { NextRequest } from "next/server"

import type { EventoWeb } from "@/lib/api/auditoria-api"

// Registrar una acción en la auditoría DESDE EL SERVIDOR de Next (rutas /api/*), para
// lo que no debe depender del navegador (ej. la firma electrónica: si se registrara
// desde el navegador, alguien podría firmar sin dejar rastro).
//
// Usa el mismo POST /auditoria/eventos que el navegador, reenviando la cookie de la
// sesión: el backend saca el actor de esa sesión, igual que siempre. Va directo a
// API_INTERNAL_URL (ver lib/auth/session.ts: desde Node una URL relativa no sirve).
const AUDITORIA_URL = `${process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auditoria/eventos`
const TIMEOUT_MS = 5_000

// Nunca lanza: si la auditoría falla se deja constancia en el log del servidor, pero la
// acción del usuario (ya hecha) no se rompe.
export async function registrarAccionServidor(
  request: NextRequest,
  accion: string,
  etiqueta?: string,
  detalle?: Record<string, unknown>
): Promise<void> {
  const evento: EventoWeb = {
    tipo: "UI_ACTION",
    accion,
    etiqueta,
    detalle,
    ruta: rutaDeOrigen(request),
    ts: Date.now(),
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    cookie: request.headers.get("cookie") ?? "",
  }
  const userAgent = request.headers.get("user-agent")
  if (userAgent) headers["user-agent"] = userAgent
  const ip = request.headers.get("x-forwarded-for") ?? request.ip
  if (ip) headers["x-forwarded-for"] = ip

  try {
    const respuesta = await fetch(AUDITORIA_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ eventos: [evento] }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!respuesta.ok) {
      console.error(`[auditoria] ${accion} no se registró: HTTP ${respuesta.status}`)
    }
  } catch (err) {
    console.error(
      `[auditoria] ${accion} no se registró: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// Pantalla desde la que se hizo la acción (ej. /ventas/oferta/reporte/18/imprimir), en
// vez de la ruta interna /api/...
function rutaDeOrigen(request: NextRequest): string {
  const referer = request.headers.get("referer")
  if (referer) {
    try {
      return new URL(referer).pathname
    } catch {
      // Referer inválido: se usa la ruta de la API.
    }
  }
  return request.nextUrl.pathname
}
