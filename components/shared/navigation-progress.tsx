"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  iniciarNavegacion,
  suscribirNavegacion,
  terminarNavegacion,
} from "@/lib/navigation-progress"

// Barra fina arriba que aparece apenas se toca un enlace o se navega con el router, y
// se completa cuando la ruta nueva ya está lista. Sin esto, entre el toque y el cambio
// de página no hay ninguna señal y parece que no pasó nada.
function Barra() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const clave = `${pathname}?${searchParams?.toString() ?? ""}`

  const [progreso, setProgreso] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const seguroRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ocultarRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const claveInicioRef = useRef(clave)

  function limpiar() {
    if (intervaloRef.current) clearInterval(intervaloRef.current)
    if (seguroRef.current) clearTimeout(seguroRef.current)
    intervaloRef.current = null
    seguroRef.current = null
  }

  useEffect(() => {
    return suscribirNavegacion((activa) => {
      if (ocultarRef.current) clearTimeout(ocultarRef.current)
      limpiar()

      if (!activa) {
        setProgreso(100)
        ocultarRef.current = setTimeout(() => {
          setVisible(false)
          setProgreso(0)
        }, 250)
        return
      }

      claveInicioRef.current = window.location.pathname + window.location.search
      setVisible(true)
      setProgreso(8)
      // Avanza cada vez más despacio hacia ~90% sin llegar: la termina el cambio de ruta.
      intervaloRef.current = setInterval(() => {
        setProgreso((actual) => actual + (90 - actual) * 0.12)
      }, 200)
      // Seguro: si por algo la ruta no cambia (navegación cancelada), no queda colgada.
      seguroRef.current = setTimeout(() => terminarNavegacion(), 15000)
    })
  }, [])

  // La ruta cambió: terminó la navegación.
  useEffect(() => {
    terminarNavegacion()
  }, [clave])

  // Toques en enlaces <a> internos: se cubren aquí, sin tocar cada <Link>.
  useEffect(() => {
    function alHacerClic(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const ancla = (event.target as Element | null)?.closest?.("a[href]")
      if (!ancla) return
      const enlace = ancla as HTMLAnchorElement
      if (enlace.target && enlace.target !== "_self") return
      if (enlace.hasAttribute("download")) return
      const url = new URL(enlace.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return
      iniciarNavegacion()
    }
    document.addEventListener("click", alHacerClic)
    return () => document.removeEventListener("click", alHacerClic)
  }, [])

  useEffect(() => () => limpiar(), [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <div
        className="bg-brand-gradient h-full rounded-r-full shadow-[0_0_8px_rgba(245,137,31,0.6)]"
        style={{
          width: `${progreso}%`,
          transition: progreso === 0 ? "none" : "width 200ms ease-out",
        }}
      />
    </div>
  )
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Barra />
    </Suspense>
  )
}
