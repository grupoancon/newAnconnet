"use client"

import { useState, useTransition } from "react"

import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { EntregasApiError, reagendarEntrega } from "@/lib/api/entregas-api"

import { AdvertenciaAgenda } from "./advertencia-agenda"

// Formulario inline para mover la fecha/hora de entrega de un proceso. El motivo es
// obligatorio; el backend deja el re-agendamiento registrado.
export function ReagendarForm({
  id,
  asesorId,
  onCancelar,
  onGuardado,
}: {
  id: number
  // Asesor asignado: se avisa si ya tiene otra entrega a la fecha/hora elegida.
  asesorId: string | null
  onCancelar: () => void
  onGuardado: () => void
}) {
  const toast = useToast()
  const [guardando, startGuardando] = useTransition()
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [motivo, setMotivo] = useState("")

  const completo = Boolean(fecha && hora && motivo.trim())

  function guardar() {
    if (!completo) return
    startGuardando(async () => {
      try {
        await reagendarEntrega(id, { fecha, hora, motivo: motivo.trim() })
        toast({ variant: "success", description: "Entrega re-agendada." })
        onGuardado()
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo re-agendar",
          description:
            err instanceof EntregasApiError ? err.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <div className="border-border bg-muted/30 min-w-0 space-y-3 rounded-md border p-3.5 sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField type="date" label="Nueva fecha *" value={fecha} onChange={setFecha} />
        <TextField type="time" label="Nueva hora *" value={hora} onChange={setHora} />
      </div>
      <AdvertenciaAgenda
        asesorId={asesorId}
        fecha={fecha}
        hora={hora}
        excluirId={id}
        onSugerir={(sugerida) => {
          setFecha(sugerida.fecha)
          setHora(sugerida.hora)
        }}
      />
      <TextField
        label="Motivo del cambio *"
        placeholder="Por qué se cambia la fecha o la hora"
        value={motivo}
        onChange={setMotivo}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="sm" onClick={guardar} disabled={!completo || guardando}>
          {guardando ? "Guardando…" : "Guardar re-agendamiento"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
