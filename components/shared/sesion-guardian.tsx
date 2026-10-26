"use client"

import { useEffect } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

// Vigila las respuestas 401 del API. Si la sesión venció o se revocó en el backend, las
// pantallas ya cargadas no se enteraban: seguían mostrándose y cada petición fallaba en
// silencio (p. ej. POST /auditoria/eventos → 401). Aquí, ante un 401, se confirma contra
// get-session y, si de verdad ya no hay sesión, se pasa por /api/auth/clear-session, que
// borra las cookies y manda a /login (ir directo a /login rebotaría de vuelta, ver esa ruta).
//
// El 401 por sí solo no basta como señal: /api/auth/* devuelve 401 con una contraseña o un
// código OTP incorrectos, y eso no es una sesión vencida — por eso se confirma.
export function SesionGuardian() {
  useEffect(() => {
    const fetchOriginal = window.fetch.bind(window)
    let verificando = false
    let saliendo = false

    async function confirmarSesionVencida() {
      if (verificando || saliendo) return
      verificando = true
      try {
        const respuesta = await fetchOriginal(`${API_URL}/api/auth/get-session`, {
          credentials: "include",
          cache: "no-store",
        })
        const datos = respuesta.ok
          ? ((await respuesta.json().catch(() => null)) as { user?: unknown } | null)
          : null
        // 200 con user = la sesión sigue viva (el 401 fue de otra cosa, ej. permisos).
        if (respuesta.ok && datos?.user) return
        // Sin respuesta útil por error de red no se cierra: solo si el backend contesta
        // que no hay sesión.
        if (!respuesta.ok && respuesta.status !== 401) return

        saliendo = true
        const from = window.location.pathname + window.location.search
        window.location.assign(`/api/auth/clear-session?from=${encodeURIComponent(from)}`)
      } catch {
        // Sin red: no se toca la sesión.
      } finally {
        verificando = false
      }
    }

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const respuesta = await fetchOriginal(...args)
      if (respuesta.status === 401) {
        const entrada = args[0]
        const url =
          typeof entrada === "string"
            ? entrada
            : entrada instanceof URL
              ? entrada.href
              : entrada.url
        if (url.startsWith(API_URL) && !url.includes("/api/auth/")) {
          void confirmarSesionVencida()
        }
      }
      return respuesta
    }

    return () => {
      window.fetch = fetchOriginal
    }
  }, [])

  return null
}
