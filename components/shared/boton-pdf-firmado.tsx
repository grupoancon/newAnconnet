"use client"

import { useState } from "react"
import { FileSignature } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { FirmaClienteError } from "@/lib/firma-cliente"
import { descargarPdfFirmado, type OpcionesImprimir } from "@/lib/imprimir-reporte"

// Botón "PDF firmado" de oferta, financiamiento, refinanciamiento y convenio: arma el PDF del documento
// tal como se ve en pantalla, lo firma electrónicamente (PAdES) en el servidor con el
// certificado de la empresa y lo descarga. Solo aparece para quien tiene el permiso
// "firma:firmar" (el Administrador siempre).
export function BotonPdfFirmado({
  children = "PDF firmado",
  razon,
  ...opciones
}: OpcionesImprimir & {
  razon: string
  children?: React.ReactNode
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "children">) {
  const puedeFirmar = useCan("firma:firmar")
  const toast = useToast()
  const [firmando, setFirmando] = useState(false)
  const { selector, nombreArchivo, horizontal, margen, disabled, ...propsBoton } =
    opciones

  if (!puedeFirmar) return null

  async function manejarClick() {
    setFirmando(true)
    try {
      await descargarPdfFirmado({
        selector,
        nombreArchivo,
        horizontal,
        margen,
        firma: { razon },
      })
      toast({ variant: "success", description: "PDF firmado electrónicamente." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo firmar el PDF",
        description:
          err instanceof FirmaClienteError || err instanceof Error
            ? err.message
            : "Intenta de nuevo.",
      })
    } finally {
      setFirmando(false)
    }
  }

  return (
    <Button
      variant="outline"
      {...propsBoton}
      disabled={disabled || firmando}
      onClick={manejarClick}
    >
      <FileSignature className="size-3.5" strokeWidth={1.8} />
      {firmando ? "Firmando…" : children}
    </Button>
  )
}
