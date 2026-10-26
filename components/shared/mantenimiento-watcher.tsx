"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { accionHuellaMantenimiento } from "@/server/actions/mantenimiento"

const INTERVALO_MS = 60_000

// El layout del dashboard (que decide banner / pantalla de mantenimiento) no se vuelve
// a renderizar al navegar del lado del cliente, así que sin esto un usuario con la
// intranet abierta no se enteraría de que se activó el mantenimiento hasta recargar.
// Cada minuto (y al volver a la pestaña) compara la huella con la del render inicial y,
// si cambió, pide un router.refresh() para que el layout se recalcule.
export function MantenimientoWatcher({ huellaInicial }: { huellaInicial: string }) {
  const router = useRouter()
  const huella = useRef(huellaInicial)

  useEffect(() => {
    huella.current = huellaInicial
  }, [huellaInicial])

  useEffect(() => {
    let cancelado = false

    async function revisar() {
      if (document.visibilityState !== "visible") return
      try {
        const actual = await accionHuellaMantenimiento()
        if (cancelado || actual == null || actual === huella.current) return
        huella.current = actual
        router.refresh()
      } catch {
        // Sin conexión o server caído: se reintenta en el próximo ciclo.
      }
    }

    const intervalo = setInterval(revisar, INTERVALO_MS)
    document.addEventListener("visibilitychange", revisar)
    return () => {
      cancelado = true
      clearInterval(intervalo)
      document.removeEventListener("visibilitychange", revisar)
    }
  }, [router])

  return null
}
