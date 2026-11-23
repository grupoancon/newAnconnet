import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { cabecerasBorrarSesion } from "@/lib/auth/borrar-cookies"

// Se llega aquí cuando la sesión ya no es válida pero la cookie sigue en el navegador
// (vencida, revocada o de antes de un cambio de base): desde getCurrentUser() == null en
// layouts/páginas (lib/auth/guard.ts), desde un 401 en el cliente (lib/api/sesion-vencida)
// o al cerrar sesión. Un Server Component no puede borrar cookies durante el render, por
// eso se redirige aquí en vez de ir directo a /login: sin borrar la cookie, el
// middleware la sigue viendo y rebota /login de vuelta a / (bucle de redirects).
//
// El borrado se hace en todas las variantes de dominio (ver lib/auth/borrar-cookies.ts):
// en producción la cookie la crea la API con Domain=ancongroups.com y un borrado simple
// no la tocaba.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const from = request.nextUrl.searchParams.get("from")
  // "sesion-vencida" cuando se llega desde avisarSiSesionVencida (lib/api) — la pantalla
  // de login muestra el aviso correspondiente.
  const motivo = request.nextUrl.searchParams.get("motivo")
  // Con `next dev -H 0.0.0.0` request.url puede resolver al host de bind (0.0.0.0) en
  // vez del Host real del navegador.
  const host = request.headers.get("host") ?? request.nextUrl.host
  const protocolo =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    request.nextUrl.protocol.replace(":", "")
  const loginUrl = new URL("/login", `${protocolo}://${host}`)
  if (from) loginUrl.searchParams.set("from", from)
  if (motivo) loginUrl.searchParams.set("motivo", motivo)
  // Marca para el middleware: aunque el navegador no haya podido borrar la cookie, en
  // /login?salida=1 se muestra el login en vez de rebotar a / (corta cualquier bucle).
  loginUrl.searchParams.set("salida", "1")

  const response = NextResponse.redirect(loginUrl)
  response.headers.set("Cache-Control", "no-store")
  for (const cabecera of cabecerasBorrarSesion({
    nombresEnRequest: request.cookies.getAll().map((c) => c.name),
    host,
    cookieDomain: process.env.COOKIE_DOMAIN,
    https: protocolo === "https",
  })) {
    response.headers.append("Set-Cookie", cabecera)
  }
  return response
}
