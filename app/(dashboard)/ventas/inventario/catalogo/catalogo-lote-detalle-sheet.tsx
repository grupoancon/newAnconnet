"use client"

import { useRouter } from "@/lib/navigation"
import { FilePlus2 } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { LoteInventario } from "@/lib/api/inventario-api"
import {
  calcularFilaDetallada,
  ENTRADA_PORCENTAJE_REFERENCIA,
  formatearNumero,
  normalizarEstado,
} from "./catalogo-helpers"

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="border-border flex items-center justify-between border-b py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold">{valor}</span>
    </div>
  )
}

// Ficha de un lote clickeado desde "Simple" o "Planos" — mismos números que la fila de
// "Detallada" (calcularFilaDetallada), en un panel en vez de una tabla, para no repetir
// la cuenta en dos lugares. "Crear oferta" es la acción que antes hacía el click directo
// sobre el tile/marcador — deshabilitada si el lote no está disponible (reservado,
// vendido, etc.), porque esa venta no se puede arrancar igual.
export function CatalogoLoteDetalleSheet({
  lote,
  onOpenChange,
}: {
  lote: LoteInventario | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  const fila = lote ? calcularFilaDetallada(lote) : null
  const estado = lote ? normalizarEstado(lote) : null
  const disponible = estado?.variant === "disponible"

  return (
    <Sheet open={Boolean(lote)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm">
        {lote && fila && estado ? (
          <>
            <SheetHeader className="border-border border-b">
              <div className="flex items-center gap-2">
                <SheetTitle className="font-mono">{lote.codigo}</SheetTitle>
                <StatusBadge variant={estado.variant}>{estado.label}</StatusBadge>
              </div>
              <SheetDescription>
                {lote.proyecto?.nombre || "Sin proyecto"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4">
              <Dato label="Valor (precio/m²)" valor={formatearNumero(fila.valorPorM2)} />
              <Dato label="Terreno" valor={formatearNumero(fila.terreno)} />
              <Dato label="Precio" valor={formatearNumero(fila.precio)} />
              <Dato
                label={`Entrada ${Math.round(ENTRADA_PORCENTAJE_REFERENCIA * 100)}%`}
                valor={formatearNumero(fila.entrada)}
              />
              <Dato
                label="Crédito BIESS (120 meses)"
                valor={formatearNumero(fila.cuotaBiess120)}
              />
              <Dato
                label="Crédito directo (60 meses, con interés)"
                valor={formatearNumero(fila.cuotaDirecto60)}
              />
            </div>

            <SheetFooter className="border-border border-t">
              <Button
                disabled={!disponible}
                title={disponible ? undefined : "Este lote no está disponible"}
                onClick={() =>
                  router.push(
                    `/ventas/nuevo-proceso?lote=${encodeURIComponent(lote.codigo)}`
                  )
                }
              >
                <FilePlus2 className="size-3.5" strokeWidth={1.8} />
                Crear oferta
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
