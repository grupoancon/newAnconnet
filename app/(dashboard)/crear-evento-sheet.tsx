"use client"

import { useEffect, useState, useTransition } from "react"

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
import { EventosApiError, eventosApi } from "@/lib/api/eventos-api"

export function CrearEventoSheet({
  open,
  onOpenChange,
  fechaSugerida,
  onCreado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fechaSugerida: string // YYYY-MM-DD
  onCreado: () => void
}) {
  const toast = useToast()
  const [titulo, setTitulo] = useState("")
  const [fecha, setFecha] = useState(fechaSugerida)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (!open) return
    setTitulo("")
    setFecha(fechaSugerida)
  }, [open, fechaSugerida])

  function guardar() {
    startSaving(async () => {
      try {
        await eventosApi.crear({ titulo: titulo.trim(), fecha })
        toast({ variant: "success", description: "Evento creado." })
        onCreado()
        onOpenChange(false)
      } catch (error) {
        toast({
          variant: "error",
          title: "No se pudo crear el evento",
          description: error instanceof EventosApiError ? error.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Crear evento</SheetTitle>
          <SheetDescription>
            Se agrega al calendario de la empresa — lo va a ver todo el mundo en la
            portada.
          </SheetDescription>
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
              placeholder="Ej. Firma de convenio · La Fontana"
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
            {isSaving ? "Guardando…" : "Crear evento"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
