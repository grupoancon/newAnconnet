"use client"

import { useEffect, useMemo, useState, useTransition } from "react"

import { CampoSelect } from "@/components/shared/campo-select"
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
import { listarInventario, type LoteInventario } from "@/lib/api/inventario-api"
import {
  VentasApiError,
  actualizarVentaUrgente,
  crearVentaUrgente,
  type VentaUrgenteBackend,
} from "@/lib/api/ventas-api"

export function VentaUrgenteFormSheet({
  registro,
  open,
  onOpenChange,
  onGuardado,
}: {
  registro: VentaUrgenteBackend | null // null = marcar un lote nuevo
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const toast = useToast()
  const esEdicion = Boolean(registro)

  const [lotes, setLotes] = useState<LoteInventario[]>([])
  const [cargandoLotes, setCargandoLotes] = useState(false)
  const [proyectoNombre, setProyectoNombre] = useState("")
  const [lote, setLote] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (!open) return
    setLote(registro?.lote ?? "")
    setMensaje(registro?.mensaje ?? "")
    setProyectoNombre("")
  }, [open, registro])

  useEffect(() => {
    if (!open || esEdicion) return
    setCargandoLotes(true)
    listarInventario()
      .then(setLotes)
      .catch(() => setLotes([]))
      .finally(() => setCargandoLotes(false))
  }, [open, esEdicion])

  const proyectos = useMemo(() => {
    const nombres = new Set<string>()
    for (const l of lotes) if (l.proyecto?.nombre) nombres.add(l.proyecto.nombre)
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, "es"))
  }, [lotes])

  const lotesDelProyecto = useMemo(
    () =>
      lotes
        .filter((l) => l.proyecto?.nombre === proyectoNombre)
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es")),
    [lotes, proyectoNombre]
  )

  const puedeGuardar = lote.trim().length > 0

  function guardar() {
    startSaving(async () => {
      try {
        if (esEdicion && registro) {
          await actualizarVentaUrgente(registro.id, {
            lote: lote.trim(),
            mensaje: mensaje.trim(),
          })
          toast({ variant: "success", description: "Venta urgente actualizada." })
        } else {
          await crearVentaUrgente({
            lote: lote.trim(),
            mensaje: mensaje.trim() || undefined,
          })
          toast({
            variant: "success",
            description: `Lote ${lote.trim()} marcado como venta urgente.`,
          })
        }
        onGuardado()
        onOpenChange(false)
      } catch (error) {
        toast({
          variant: "error",
          title: esEdicion ? "No se pudo actualizar" : "No se pudo marcar el lote",
          description:
            error instanceof VentasApiError ? error.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>
            {esEdicion ? "Editar venta urgente" : "Marcar lote como venta urgente"}
          </SheetTitle>
          <SheetDescription>
            Un lote marcado como venta urgente permite crear un proceso de venta sin las
            validaciones de disponibilidad ni la orden SAP habituales.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          {esEdicion ? (
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Lote
              </label>
              <input
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                className="border-input bg-card focus:border-primary focus:ring-ring/15 h-11 w-full rounded-md border px-3.5 font-mono text-sm outline-none focus:ring-3"
              />
            </div>
          ) : (
            <>
              <CampoSelect
                label="Proyecto"
                value={proyectoNombre}
                onChange={(v) => {
                  setProyectoNombre(v)
                  setLote("")
                }}
                opciones={proyectos.map((n) => ({ value: n, label: n }))}
                placeholder={cargandoLotes ? "Cargando…" : "Seleccionar proyecto…"}
              />
              <CampoSelect
                label="Lote"
                value={lote}
                onChange={setLote}
                opciones={lotesDelProyecto.map((l) => ({
                  value: l.codigo,
                  label: `${l.codigo} · ${l.estado?.trim() || "—"}`,
                }))}
                placeholder={
                  proyectoNombre ? "Seleccionar lote…" : "Elige un proyecto primero"
                }
              />
            </>
          )}

          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              Motivo / mensaje (opcional)
            </label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Por qué este lote se toma como venta urgente…"
              className="border-input bg-card focus:border-primary focus:ring-ring/15 w-full rounded-md border px-3.5 py-2 text-sm outline-none focus:ring-3"
            />
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!puedeGuardar || isSaving} onClick={guardar}>
            {isSaving
              ? "Guardando…"
              : esEdicion
                ? "Guardar cambios"
                : "Marcar venta urgente"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
