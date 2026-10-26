"use client"

import { useEffect, useState } from "react"

import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DepositosApiError, cambiarEstadoDeposito } from "@/lib/api/depositos-api"

import { codigoReciboValido, formatearCodigoRecibo } from "./depositos-utils"
import type { LoteSeleccionado } from "./registrar-lote-sheet"

// Aprueba un lote que estaba devuelto asociándolo al recibo (REC-YYYYMMDD-XXXX) de otro
// depósito del mismo lote que ya fue aprobado. El backend valida que el recibo exista,
// que sea del mismo lote y que esté aprobado, y responde con el error si no.
export function CambiarEstadoSheet({
  lote,
  onCerrar,
  onActualizado,
}: {
  lote: LoteSeleccionado | null
  onCerrar: () => void
  onActualizado: () => void
}) {
  const toast = useToast()
  const [codigo, setCodigo] = useState("")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    setCodigo("")
    setEnviando(false)
  }, [lote?.id])

  async function actualizar() {
    if (!lote || enviando) return
    setEnviando(true)
    try {
      await cambiarEstadoDeposito({
        id: lote.id,
        lote: lote.lote,
        recAsociado: codigo,
      })
      toast({ variant: "success", description: "Depósito aprobado exitosamente" })
      onActualizado()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof DepositosApiError
            ? err.message
            : "Error al actualizar el estado",
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Sheet open={!!lote} onOpenChange={(abierto) => !abierto && !enviando && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Actualizar estado</SheetTitle>
          <SheetDescription>
            Ingrese el código del recibo para aprobar este lote.
          </SheetDescription>
        </SheetHeader>

        {lote && (
          <div className="flex flex-col gap-4 p-5">
            <div className="bg-muted rounded-lg p-4">
              <p className="font-bold">Lote: {lote.lote}</p>
            </div>

            <TextField
              label="CÓDIGO DEL RECIBO"
              placeholder="REC-20260701-3122"
              value={codigo}
              disabled={enviando}
              onChange={(valor) => setCodigo(formatearCodigoRecibo(valor))}
            />
          </div>
        )}

        <SheetFooter className="border-border border-t p-5">
          <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!codigoReciboValido(codigo) || enviando}
            onClick={actualizar}
          >
            {enviando ? "Actualizando…" : "Actualizar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
