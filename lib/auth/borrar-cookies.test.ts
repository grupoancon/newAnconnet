import { describe, expect, it } from "vitest"

import { cabecerasBorrarSesion, dominiosABorrar } from "./borrar-cookies"

describe("dominiosABorrar", () => {
  it("incluye el host y su dominio padre en producción", () => {
    expect(dominiosABorrar("anconnet.ancongroups.com", "ancongroups.com")).toEqual([
      "ancongroups.com",
      "anconnet.ancongroups.com",
    ])
  })

  it("sin COOKIE_DOMAIN igual prueba el dominio padre", () => {
    expect(dominiosABorrar("anconnet.ancongroups.com:443")).toEqual([
      "anconnet.ancongroups.com",
      "ancongroups.com",
    ])
  })

  it("en local (localhost o IP) no agrega dominios", () => {
    expect(dominiosABorrar("localhost:3000")).toEqual([])
    expect(dominiosABorrar("192.168.18.209:3000")).toEqual([])
  })
})

describe("cabecerasBorrarSesion", () => {
  const cabeceras = cabecerasBorrarSesion({
    nombresEnRequest: ["better-auth.session_token", "better-auth.session_data", "otra"],
    host: "anconnet.ancongroups.com",
    cookieDomain: ".ancongroups.com",
    https: true,
  })

  it("borra la cookie de la API con Domain=ancongroups.com (la que causaba el bucle)", () => {
    expect(cabeceras).toContain(
      "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; Domain=ancongroups.com"
    )
  })

  it("también la borra sin Domain y borra las demás cookies de Better Auth", () => {
    expect(cabeceras).toContain(
      "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure"
    )
    expect(cabeceras.some((c) => c.startsWith("better-auth.session_data=;"))).toBe(true)
    expect(cabeceras.some((c) => c.startsWith("otra="))).toBe(false)
  })

  it("las __Secure- siempre llevan Secure, aunque sea http", () => {
    const local = cabecerasBorrarSesion({
      nombresEnRequest: [],
      host: "localhost:3000",
      https: false,
    })
    expect(local).toContain(
      "__Secure-better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure"
    )
    expect(local).toContain(
      "better-auth.session_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    )
  })
})
