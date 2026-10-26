"use client"

import { useEffect, useState } from "react"
import { Check, CloudOff, Loader2 } from "lucide-react"

import type { EstadoAutoguardado } from "@/lib/borradores/use-borrador-automatico"
import { cn } from "@/lib/utils"

function hace(en: number, ahora: number): string {
  const segundos = Math.max(0, Math.round((ahora - en) / 1000))
  if (segundos < 10) return "hace un momento"
  if (segundos < 60) return `hace ${segundos} s`
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  return new Date(en).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
}

// Texto chico tipo Notion ("Borrador guardado hace un momento") para el estado de
// useBorradorAutomatico. Se refresca solo cada 15 s para que el "hace X" no quede
// congelado.
export function IndicadorAutoguardado({
  estado,
  className,
}: {
  estado: EstadoAutoguardado
  className?: string
}) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 15_000)
    return () => clearInterval(intervalo)
  }, [])
  useEffect(() => {
    setAhora(Date.now())
  }, [estado])

  if (estado.tipo === "sin-cambios") return null

  let icono = <Loader2 className="size-3.5 animate-spin" />
  let texto = "Guardando borrador…"
  if (estado.tipo === "guardado") {
    icono = <Check className="size-3.5" />
    texto = `Borrador guardado ${hace(estado.en, ahora)}`
  } else if (estado.tipo === "solo-local") {
    icono = <CloudOff className="size-3.5" />
    texto = "Sin conexión con el servidor — borrador guardado en este equipo"
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-1.5 text-xs font-medium", className)}
    >
      {icono}
      <span>{texto}</span>
    </div>
  )
}
