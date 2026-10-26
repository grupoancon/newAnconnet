import { useEffect, useState } from "react"

// Reloj en vivo compartido por WelcomeBanner/AppTopbar. Devuelve `null` hasta que el
// componente ya está montado en el navegador — NUNCA `new Date()` directo en el primer
// render. Si el estado inicial se calcula con `useState(() => new Date())`, esa función
// corre una vez en el server (SSR) y otra vez en el cliente al hidratar: son dos
// llamadas a `new Date()` en instantes distintos, así que el texto que Next.js manda en
// el HTML del servidor casi nunca coincide con lo que React calcula al hidratar en el
// cliente — "Error: Text content does not match server-rendered HTML." (confirmado en
// pantalla por el usuario). Por eso acá el estado arranca en `null` (mismo valor en
// server y en el primer render del cliente, sin mismatch posible) y recién se llena con
// la hora real dentro de un useEffect, que solo corre en el navegador después de
// hidratar — quien use este hook tiene que mostrar un placeholder mientras es `null`.
export function useReloj(): Date | null {
  const [ahora, setAhora] = useState<Date | null>(null)

  useEffect(() => {
    const resincronizar = () => setAhora(new Date())
    resincronizar()
    const intervalId = setInterval(resincronizar, 1000)

    // El navegador tira MUY fuerte del setInterval en pestañas en segundo plano (y lo
    // pausa del todo si la laptop se suspende) — una pestaña del dashboard dejada
    // abierta y minimizada durante días se queda con la hora congelada en el momento en
    // que se fue a segundo plano. Por eso también se resincroniza al toque cuando la
    // pestaña vuelve a estar visible/en foco, en vez de depender solo del intervalo.
    document.addEventListener("visibilitychange", resincronizar)
    window.addEventListener("focus", resincronizar)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener("visibilitychange", resincronizar)
      window.removeEventListener("focus", resincronizar)
    }
  }, [])

  return ahora
}

// Ecuador es siempre UTC-5 (no tiene horario de verano) — quien formatee la fecha/hora
// de este hook debe usar este timeZone, nunca el huso horario del navegador/servidor
// (que puede ser cualquier otro).
export const ZONA_ECUADOR = "America/Guayaquil"
