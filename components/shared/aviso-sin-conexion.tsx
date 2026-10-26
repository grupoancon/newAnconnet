"use client"

import { useEffect, useState } from "react"
import { Wifi, WifiOff } from "lucide-react"

import { cn } from "@/lib/utils"

// Cuánto se muestra "Conexión restablecida" antes de desaparecer.
const MS_AVISO_RECONECTADO = 3_000

// Aviso fijo cuando el dispositivo pierde la red (eventos online/offline del
// navegador). Antes el usuario recién se enteraba al fallar un guardado. Ojo:
// navigator.onLine solo sabe si hay red, no si la API responde — una API caída con red
// disponible se ve en el error de cada pantalla o en ServidorNoDisponible.
export function AvisoSinConexion() {
  const [estado, setEstado] = useState<"conectado" | "sin-conexion" | "reconectado">(
    "conectado"
  )

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined

    function alPerderConexion() {
      clearTimeout(temporizador)
      setEstado("sin-conexion")
    }
    function alRecuperarConexion() {
      setEstado("reconectado")
      temporizador = setTimeout(() => setEstado("conectado"), MS_AVISO_RECONECTADO)
    }

    // El estado inicial se lee acá (no en useState) para que el render del servidor y
    // el primero del cliente coincidan.
    if (!navigator.onLine) setEstado("sin-conexion")
    window.addEventListener("offline", alPerderConexion)
    window.addEventListener("online", alRecuperarConexion)
    return () => {
      clearTimeout(temporizador)
      window.removeEventListener("offline", alPerderConexion)
      window.removeEventListener("online", alRecuperarConexion)
    }
  }, [])

  if (estado === "conectado") return null

  const sinConexion = estado === "sin-conexion"
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] flex justify-center px-4"
    >
      <div
        className={cn(
          "flex max-w-md items-center gap-2.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg",
          sinConexion ? "bg-neutral-900" : "bg-emerald-600"
        )}
      >
        {sinConexion ? (
          <WifiOff className="size-4 shrink-0" strokeWidth={2} />
        ) : (
          <Wifi className="size-4 shrink-0" strokeWidth={2} />
        )}
        {sinConexion
          ? "Sin conexión a internet. Lo que intentes guardar no se enviará hasta que vuelva la conexión."
          : "Conexión restablecida."}
      </div>
    </div>
  )
}
