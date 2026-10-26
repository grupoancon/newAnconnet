"use client"

import { useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RefreshCw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Contenido común de app/error.tsx y app/(dashboard)/error.tsx — lo que ve el usuario
// cuando una pantalla falla con un error inesperado (antes no había ninguno: salía el
// error genérico de Next.js, sin forma de reintentar). En producción Next.js oculta el
// mensaje real de los errores del servidor, así que el texto es genérico a propósito.
export function PantallaError({
  error,
  reset,
  pantallaCompleta = false,
}: {
  error: Error & { digest?: string }
  reset: () => void
  pantallaCompleta?: boolean
}) {
  const router = useRouter()
  const [reintentando, startTransition] = useTransition()

  useEffect(() => {
    console.error(error)
  }, [error])

  // Patrón recomendado por Next.js para errores del servidor: router.refresh() vuelve a
  // pedir los datos al servidor y reset() vuelve a renderizar el segmento — solo reset()
  // reintentaría con lo mismo que ya falló.
  function reintentar() {
    startTransition(() => {
      router.refresh()
      reset()
    })
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center p-6",
        pantallaCompleta ? "bg-muted min-h-screen" : "min-h-[60vh]"
      )}
    >
      <div className="w-full max-w-115 text-center">
        <div className="bg-card border-border mx-auto mb-5 flex size-14 items-center justify-center rounded-full border">
          <TriangleAlert className="text-primary size-6" strokeWidth={1.8} />
        </div>
        <h1 className="mb-2.5 text-2xl font-extrabold tracking-tight">
          Algo salió mal
        </h1>
        <p className="text-muted-foreground mb-7 text-[14.5px] leading-[1.55]">
          No pudimos mostrar esta pantalla. Puede ser un problema momentáneo de conexión
          con el servidor: vuelve a intentar. Si sigue pasando, avisa a sistemas
          {error.digest ? " e indica este código" : ""}.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mb-7 font-mono text-xs">
            Código: {error.digest}
          </p>
        ) : null}
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="lg" asChild>
            <Link href="/">Ir al inicio</Link>
          </Button>
          <Button size="lg" onClick={reintentar} disabled={reintentando}>
            <RefreshCw className={reintentando ? "size-4 animate-spin" : "size-4"} />
            Reintentar
          </Button>
        </div>
      </div>
    </div>
  )
}
