"use client"

import { useEffect, useState, useTransition } from "react"

import { useToast } from "@/components/shared/toast-provider"
import { ZONA_ECUADOR } from "@/components/shared/use-reloj"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TareasApiError, tareasApi } from "@/lib/api/tareas-api"

// "en-CA" formatea como YYYY-MM-DD — el mismo formato que espera <input type="date"> y
// el backend, sin andar concatenando a mano.
function hoyEnEcuadorISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_ECUADOR }).format(new Date())
}

export function CrearTareaSheet({
  open,
  onOpenChange,
  fechaSugerida,
  onCreada,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fechaSugerida?: string // YYYY-MM-DD — precargada al crear desde un día del calendario
  onCreada: () => void
}) {
  const toast = useToast()
  const [titulo, setTitulo] = useState("")
  const [etiqueta, setEtiqueta] = useState("")
  const [fecha, setFecha] = useState("")
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (!open) return
    setTitulo("")
    setEtiqueta("")
    setFecha(fechaSugerida ?? hoyEnEcuadorISO())
  }, [open, fechaSugerida])

  function guardar() {
    startSaving(async () => {
      try {
        await tareasApi.crear({
          titulo: titulo.trim(),
          etiqueta: etiqueta.trim() || undefined,
          fecha,
        })
        toast({ variant: "success", description: "Tarea creada." })
        onCreada()
        onOpenChange(false)
      } catch (error) {
        toast({
          variant: "error",
          title: "No se pudo crear la tarea",
          description: error instanceof TareasApiError ? error.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Crear tarea</SheetTitle>
          <SheetDescription>Se agrega a tu checklist personal de la portada.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              Título
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={255}
              placeholder="Ej. Confirmar reserva · Lote A-12"
              className="border-input bg-card focus:border-primary focus:ring-ring/15 h-11 w-full rounded-md border px-3.5 text-sm outline-none focus:ring-3"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              Etiqueta (opcional)
            </label>
            <input
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              maxLength={255}
              placeholder="Ej. Hoy, Mañana, Lote A-12"
              className="border-input bg-card focus:border-primary focus:ring-ring/15 h-11 w-full rounded-md border px-3.5 text-sm outline-none focus:ring-3"
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border-input bg-card focus:border-primary focus:ring-ring/15 h-11 w-full rounded-md border px-3.5 text-sm outline-none focus:ring-3"
            />
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!titulo.trim() || !fecha || isSaving} onClick={guardar}>
            {isSaving ? "Guardando…" : "Crear tarea"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
