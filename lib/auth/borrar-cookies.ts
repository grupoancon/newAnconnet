import { BETTER_AUTH_COOKIE_NAME } from "@/lib/auth/config"

// Cabeceras Set-Cookie para borrar de verdad la sesión de Better Auth.
//
// En producción la API crea la cookie para todo el dominio (Domain=ancongroups.com, ver
// COOKIE_DOMAIN / crossSubDomainCookies en newApi lib/auth.ts). Un borrado sin Domain
// (lo que hace `response.cookies.delete`) solo apaga una cookie "del host"
// anconnet.ancongroups.com, que es OTRA cookie para el navegador: la de la API seguía
// ahí, el middleware la veía y mandaba /login -> / -> /api/auth/clear-session ->
// /login… hasta "Load cannot follow more than 20 redirections". Por eso se borra en
// todas las variantes posibles: sin Domain, con COOKIE_DOMAIN y con cada dominio padre
// del host. Las que no existan el navegador simplemente las ignora.

const PREFIJOS = ["better-auth.", "__Secure-better-auth."]

export function esCookieDeSesion(nombre: string): boolean {
  return PREFIJOS.some((p) => nombre.startsWith(p))
}

// Dominios para los que se intenta el borrado, además del borrado "del host".
export function dominiosABorrar(host: string, cookieDomain?: string): string[] {
  const dominios = new Set<string>()
  const limpio = cookieDomain?.trim().replace(/^\./, "")
  if (limpio) dominios.add(limpio)

  const sinPuerto = host.split(":")[0]?.toLowerCase() ?? ""
  const esIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(sinPuerto) || sinPuerto.includes("[")
  if (sinPuerto && !esIp && sinPuerto.includes(".")) {
    // anconnet.ancongroups.com -> anconnet.ancongroups.com, ancongroups.com
    const partes = sinPuerto.split(".")
    for (let i = 0; i <= partes.length - 2; i++) {
      dominios.add(partes.slice(i).join("."))
    }
  }
  return Array.from(dominios)
}

export function cabecerasBorrarSesion(opciones: {
  nombresEnRequest: string[]
  host: string
  cookieDomain?: string
  https: boolean
}): string[] {
  const nombres = new Set<string>([
    BETTER_AUTH_COOKIE_NAME,
    `__Secure-${BETTER_AUTH_COOKIE_NAME}`,
    ...opciones.nombresEnRequest.filter(esCookieDeSesion),
  ])
  const dominios = dominiosABorrar(opciones.host, opciones.cookieDomain)
  const cabeceras: string[] = []
  for (const nombre of Array.from(nombres)) {
    // Las cookies "__Secure-" solo se aceptan (y se borran) con Secure.
    const seguro = nombre.startsWith("__Secure-") || opciones.https ? "; Secure" : ""
    const base = `${nombre}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${seguro}`
    cabeceras.push(base)
    for (const dominio of dominios) cabeceras.push(`${base}; Domain=${dominio}`)
  }
  return cabeceras
}
