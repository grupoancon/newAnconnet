"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

// Cuánto tiene que bajar el indicador (el dedo recorre el doble, ver RESISTENCIA) para
// que al soltar recargue.
const UMBRAL_PX = 60
// El indicador se mueve más lento que el dedo, como el pull-to-refresh nativo.
const RESISTENCIA = 0.5
const MAX_ARRASTRE_PX = 110

// Arrastrar hacia abajo para recargar, en el celular. El AppShell es `fixed inset-0`
// con el scroll dentro del <main> (el documento nunca se desplaza), así que el gesto
// nativo del navegador no se dispara — y en la PWA instalada en iOS directamente no
// existe. Este componente va dentro del <main> y escucha los toques sobre él.
//
// No se activa si el toque empieza en algo que maneja sus propios gestos (ej. el visor
// del plano, `touch-none`, o cualquier elemento con `data-sin-pull-refresh`), ni si
// hay algún contenedor con scroll propio entre el dedo y el <main> que no esté arriba.
export function PullToRefresh() {
  const anclaRef = useRef<HTMLSpanElement>(null)
  const [arrastre, setArrastre] = useState(0)
  const [recargando, setRecargando] = useState(false)

  useEffect(() => {
    const contenedor = anclaRef.current?.parentElement
    if (!contenedor) return

    let inicioY: number | null = null
    let distanciaActual = 0

    function puedeEmpezar(target: EventTarget | null): boolean {
      if (contenedor!.scrollTop > 0) return false
      let nodo = target instanceof Element ? target : null
      while (nodo && nodo !== contenedor) {
        if (nodo.matches("[data-sin-pull-refresh], .touch-none")) return false
        if (nodo.scrollTop > 0) return false
        nodo = nodo.parentElement
      }
      return true
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1 || !puedeEmpezar(event.target)) {
        inicioY = null
        return
      }
      inicioY = event.touches[0].clientY
      distanciaActual = 0
    }

    function onTouchMove(event: TouchEvent) {
      if (inicioY == null) return
      const delta = event.touches[0].clientY - inicioY
      // Si el usuario arrastra hacia arriba o el contenido ya se desplazó, es scroll
      // normal y no un pull-to-refresh.
      if (delta <= 0 || contenedor!.scrollTop > 0) {
        if (distanciaActual !== 0) {
          distanciaActual = 0
          setArrastre(0)
        }
        return
      }
      distanciaActual = Math.min(MAX_ARRASTRE_PX, delta * RESISTENCIA)
      setArrastre(distanciaActual)
    }

    function onTouchEnd() {
      if (inicioY == null) return
      inicioY = null
      if (distanciaActual >= UMBRAL_PX) {
        setRecargando(true)
        window.location.reload()
        return
      }
      distanciaActual = 0
      setArrastre(0)
    }

    contenedor.addEventListener("touchstart", onTouchStart, { passive: true })
    contenedor.addEventListener("touchmove", onTouchMove, { passive: true })
    contenedor.addEventListener("touchend", onTouchEnd, { passive: true })
    contenedor.addEventListener("touchcancel", onTouchEnd, { passive: true })
    return () => {
      contenedor.removeEventListener("touchstart", onTouchStart)
      contenedor.removeEventListener("touchmove", onTouchMove)
      contenedor.removeEventListener("touchend", onTouchEnd)
      contenedor.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [])

  const listo = arrastre >= UMBRAL_PX
  const visible = arrastre > 0 || recargando
  const desplazamiento = recargando ? UMBRAL_PX : arrastre

  return (
    <span ref={anclaRef} aria-hidden className="contents">
      <span
        style={{
          transform: `translate(-50%, ${desplazamiento - 44}px)`,
          opacity: visible ? Math.min(1, desplazamiento / 40) : 0,
        }}
        className={cn(
          "bg-card text-primary pointer-events-none fixed top-[calc(env(safe-area-inset-top)+8px)] left-1/2 z-50 flex size-9 items-center justify-center rounded-full shadow-md",
          arrastre === 0 && "transition-[transform,opacity] duration-200"
        )}
      >
        <RefreshCw
          className={cn("size-4", recargando && "animate-spin")}
          style={recargando ? undefined : { transform: `rotate(${arrastre * 3}deg)` }}
          strokeWidth={listo ? 2.6 : 2}
        />
      </span>
    </span>
  )
}
