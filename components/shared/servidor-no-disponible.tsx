"use client"

import { useState } from "react"
import { RefreshCw, ServerCrash } from "lucide-react"

import { Button } from "@/components/ui/button"

// Pantalla para cuando no se pudo verificar la sesión porque el backend (o la base de
// datos) no respondió — ver ServidorNoDisponibleError en lib/auth/session.ts. A
// diferencia de una sesión inválida, acá la cookie NO se borra: apenas el servidor
// vuelve, "Reintentar" deja al usuario donde estaba, sin volver a iniciar sesión.
export function ServidorNoDisponible() {
  const [reintentando, setReintentando] = useState(false)

  function reintentar() {
    setReintentando(true)
    // Recarga completa (no router.refresh): el layout del dashboard tiene que volver a
    // correr en el servidor para verificar la sesión de nuevo.
    window.location.reload()
  }

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-115 text-center">
        <div className="bg-card border-border mx-auto mb-5 flex size-14 items-center justify-center rounded-full border">
          <ServerCrash className="text-primary size-6" strokeWidth={1.8} />
        </div>
        <h1 className="mb-2.5 text-2xl font-extrabold tracking-tight">
          El servidor no está disponible
        </h1>
        <p className="text-muted-foreground mb-7 text-[14.5px] leading-[1.55]">
          No pudimos comunicarnos con el sistema en este momento. Tu sesión sigue abierta:
          espera un momento y vuelve a intentar. Si el problema continúa, avisa a
          sistemas.
        </p>
        <Button size="lg" onClick={reintentar} disabled={reintentando}>
          <RefreshCw className={reintentando ? "size-4 animate-spin" : "size-4"} />
          Reintentar
        </Button>
      </div>
    </div>
  )
}
