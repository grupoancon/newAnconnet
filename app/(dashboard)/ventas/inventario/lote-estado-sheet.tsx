"use client"

import { useEffect, useState, useTransition } from "react"

import { CampoSelect } from "@/components/shared/campo-select"
import { StatusBadge } from "@/components/shared/status-badge"
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
import {
  ESTADOS_LOTE,
  InventarioApiError,
  cambiarEstadoLote,
  type EstadoLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"

// Mismo mapeo de estado -> variante que inventario-content.tsx, para poder preseleccionar
// en el select el estado canonico mas parecido al que trae la fila (trim de espacios de
// mas, tipo " LIBRE"). "Vendido"/"Bloqueado"/"Inactivo" ya no son opciones del selector
// (ver ESTADOS_LOTE) pero pueden seguir existiendo en filas viejas — se remapean al
// equivalente mas cercano del conjunto actual en vez de romper el tipo.
const ESTADO_VARIANTE: Record<string, EstadoLote> = {
  disponible: "LIBRE",
  libre: "LIBRE",
  reservado: "RESERVADO",
  convenio: "CONVENIO",
  vendido: "CONVENIO",
  hipotecado: "HIPOTECADO",
  bloqueado: "HIPOTECADO",
  inactivo: "LIBRE",
}

function estadoCanonico(crudo: string | null | undefined): EstadoLote {
  const texto = (crudo ?? "").trim().toLowerCase()
  return ESTADO_VARIANTE[texto] ?? "LIBRE"
}

export function LoteEstadoSheet({
  lote,
  onOpenChange,
  onGuardado,
}: {
  lote: LoteInventario | null
  onOpenChange: (open: boolean) => void
  onGuardado: (lote: LoteInventario) => void
}) {
  const toast = useToast()
  const open = Boolean(lote)
  const [estado, setEstado] = useState<string>("LIBRE")
  const [motivo, setMotivo] = useState("")
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (!lote) return
    setEstado(estadoCanonico(lote.estado))
    setMotivo("")
  }, [lote])

  function guardar() {
    if (!lote) return
    startSaving(async () => {
      try {
        const loteActualizado = await cambiarEstadoLote(
          lote.id,
          estado as EstadoLote,
          motivo.trim() || undefined
        )
        toast({
          variant: "success",
          description: `Estado de ${lote.codigo} actualizado.`,
        })
        onGuardado(loteActualizado)
      } catch (error) {
        toast({
          variant: "error",
          title: "No se pudo cambiar el estado",
          description:
            error instanceof InventarioApiError ? error.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onOpenChange(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Cambiar estado</SheetTitle>
          <SheetDescription>
            {lote ? (
              <>
                Lote <span className="font-mono font-bold">{lote.codigo}</span> —{" "}
                <StatusBadge variant="pronto">
                  estado actual: {lote.estado?.trim() || "—"}
                </StatusBadge>
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <CampoSelect
            label="Nuevo estado"
            value={estado}
            onChange={setEstado}
            opciones={ESTADOS_LOTE.map((e) => ({ ...e }))}
          />

          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              Motivo (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              rows={3}
              placeholder="Se registra en la bitácora de cambios del lote."
              className="border-input bg-card focus:border-primary focus:ring-ring/15 w-full resize-none rounded-md border px-3.5 py-2.5 text-sm outline-none focus:ring-3"
            />
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={isSaving} onClick={guardar}>
            {isSaving ? "Guardando..." : "Guardar estado"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
