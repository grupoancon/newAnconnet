"use client"

import { useState } from "react"
import { Printer } from "lucide-react"

import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { imprimirReporte, type OpcionesImprimir } from "@/lib/imprimir-reporte"

// Botón "Imprimir" de los reportes: en la computadora abre la impresión del navegador;
// en el teléfono genera un PDF y abre el menú de compartir (ver
// lib/imprimir-reporte.ts).
export function BotonImprimir({
  children = "Imprimir",
  ...opciones
}: OpcionesImprimir & {
  children?: React.ReactNode
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "children">) {
  const toast = useToast()
  const [generando, setGenerando] = useState(false)
  const { selector, nombreArchivo, horizontal, margen, firma, disabled, ...propsBoton } =
    opciones

  async function manejarClick() {
    setGenerando(true)
    try {
      await imprimirReporte({ selector, nombreArchivo, horizontal, margen, firma })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo generar el PDF",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGenerando(false)
    }
  }

  return (
    <Button {...propsBoton} disabled={disabled || generando} onClick={manejarClick}>
      <Printer className="size-3.5" strokeWidth={1.8} />
      {generando ? "Generando PDF…" : children}
    </Button>
  )
}
