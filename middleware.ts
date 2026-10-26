import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { BETTER_AUTH_COOKIE_NAME } from "@/lib/auth/config"

const PUBLIC_PATHS = ["/login", "/verificar"]

// Aqui solo se verifica que el cookie de Better Auth exista (checkeo rapido en edge, sin
// llamar al backend); la validacion real de la sesion pasa siempre por GET
// /api/auth/get-session cuando hace falta (ver lib/auth/session.ts). Si esa validacion
// profunda determina que la sesion no es valida, redirige a /api/auth/clear-session en
// vez de /login directo, para borrar el cookie y que este checkeo rapido deje de
// confiar en el — si no, un cookie vencido/revocado rebota /login de vuelta a / en loop.

// Aca no hay filtro por rol: el cookie de Better Auth es opaco (no un JWT con claims
// legibles en el edge). Cada pagina protegida verifica el acceso real en servidor —
// las de /admin y /configuracion con su propio chequeo de rol/permiso (ver
// requirePermiso en lib/auth/guard.ts), y el layout del dashboard valida la sesion
// contra el backend (getCurrentUser en lib/auth/session.ts).

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname)
}

// Con `next dev -H 0.0.0.0` (necesario para poder entrar desde otras IPs de la
// red local), `request.url`/`request.nextUrl` a veces resuelven al host en el
// que escucha el server (0.0.0.0:3000) en vez del Host real que mandó el
// navegador — eso hacía que estos redirects mandaran a 0.0.0.0:3000, donde el
// navegador no puede conectar. El header `Host` siempre refleja lo que puso el
// navegador sin importar la interfaz en la que escucha el server, así que las
// URLs absolutas de redirect se arman a partir de ahí.
function absoluteUrl(request: NextRequest, pathname: string): URL {
  const host = request.headers.get("host") ?? request.nextUrl.host
  const url = new URL(pathname, `${request.nextUrl.protocol}//${host}`)
  return url
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  const autenticado = request.cookies.has(BETTER_AUTH_COOKIE_NAME)

  if (isPublicPath(pathname)) {
    if (autenticado) {
      return NextResponse.redirect(absoluteUrl(request, "/"))
    }
    return NextResponse.next()
  }

  if (!autenticado) {
    const loginUrl = absoluteUrl(request, "/login")
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // El manifest, el service worker, la página offline y los íconos tienen que ser públicos:
  // el navegador los pide sin sesión (y el SW sin cookies de navegación) — si pasaran por
  // este middleware se redirigirían a /login y la app no sería instalable.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|apple-touch-icon.png|icons/).*)",
  ],
}
