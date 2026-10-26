"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { DepositosApiError, devolverDeposito } from "@/lib/api/depositos-api"

import type { LoteSeleccionado } from "./registrar-lote-sheet"

export function DevolverLoteSheet({
  lote,
  onCerrar,
  onDevuelto,
}: {
  lote: LoteSeleccionado | null
  onCerrar: () => void
  onDevuelto: () => void
}) {
  const toast = useToast()
  const [motivo, setMotivo] = useState("")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    setMotivo("")
    setEnviando(false)
  }, [lote?.id])

  async function confirmar() {
    if (!lote || enviando) return
    setEnviando(true)
    try {
      await devolverDeposito({ id: lote.id, lote: lote.lote, motivo: motivo.trim() })
      toast({ variant: "success", description: "Depósito devuelto exitosamente" })
      onDevuelto()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof DepositosApiError
            ? err.message
            : "Error al devolver el depósito",
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Sheet open={!!lote} onOpenChange={(abierto) => !abierto && !enviando && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Devolver pago</SheetTitle>
          <SheetDescription>El cliente verá el motivo en su aplicación.</SheetDescription>
        </SheetHeader>

        {lote && (
          <div className="flex flex-col gap-4 p-5">
            <div className="bg-muted rounded-lg p-4">
              <p className="font-bold">Lote: {lote.lote}</p>
            </div>

            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                RAZÓN DE LA DEVOLUCIÓN <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={motivo}
                disabled={enviando}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Ingrese la razón por la cual se devuelve este pago…"
                className="bg-card h-32 resize-none"
              />
            </div>

            <div className="bg-status-reservado-bg border-status-reservado-border flex gap-3 rounded-md border p-4">
              <AlertTriangle
                className="text-status-reservado-fg mt-0.5 size-5 shrink-0"
                strokeWidth={1.8}
              />
              <p className="text-status-reservado-fg text-[13px] leading-snug">
                <strong>Advertencia:</strong> una vez devuelto, este pago no se podrá
                anular; solo se podrá aprobar con el código del nuevo pago aprobado que se
                suba.
              </p>
            </div>
          </div>
        )}

        <SheetFooter className="border-border border-t p-5">
          <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!motivo.trim() || enviando}
            onClick={confirmar}
          >
            {enviando ? "Devolviendo…" : "Confirmar devolución"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
