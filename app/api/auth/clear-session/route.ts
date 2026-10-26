import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { BETTER_AUTH_COOKIE_NAME } from "@/lib/auth/config"

// A esta ruta se llega cuando un layout/pagina protegida (getCurrentUser() devolvio
// null) detecta que la sesion ya no es valida pero el cookie todavia existe (vencio, se
// revoco, o quedo de antes de un cambio de base). Un Server Component no puede borrar
// cookies durante el render, por eso se redirige aca en vez de ir directo a /login: sin
// este paso, el middleware sigue viendo el cookie presente y rebota /login de vuelta a
// / (loop infinito de redirects).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const from = request.nextUrl.searchParams.get("from")
  // "sesion-vencida" cuando se llega desde avisarSiSesionVencida (lib/api) — la pantalla
  // de login muestra el aviso correspondiente.
  const motivo = request.nextUrl.searchParams.get("motivo")
  // Igual que en middleware.ts: con `next dev -H 0.0.0.0` request.url puede
  // resolver al host de bind (0.0.0.0) en vez del Host real del navegador.
  const host = request.headers.get("host") ?? request.nextUrl.host
  const loginUrl = new URL("/login", `${request.nextUrl.protocol}//${host}`)
  if (from) loginUrl.searchParams.set("from", from)
  if (motivo) loginUrl.searchParams.set("motivo", motivo)

  const response = NextResponse.redirect(loginUrl)
  response.cookies.delete(BETTER_AUTH_COOKIE_NAME)
  return response
}
