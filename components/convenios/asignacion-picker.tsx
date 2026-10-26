"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  asignarConvenio,
  eliminarAsignacion,
  type ConvenioAsignacionBackend,
} from "@/lib/api/convenios-api"
import { listarInventario, listarProyectos, type LoteInventario, type ProyectoInventario } from "@/lib/api/inventario-api"
import { useToast } from "@/components/shared/toast-provider"

// El backend no filtra /inventarios por querystring (ver InventarioController.findAll) —
// se trae todo una vez y se filtra por proyecto acá mismo, igual que ya hacen otras
// pantallas de inventario del lado del cliente.
export function AsignacionPicker({
  convenioId,
  asignaciones,
  onAsignacionesChange,
}: {
  convenioId: number
  asignaciones: ConvenioAsignacionBackend[]
  onAsignacionesChange: (asignaciones: ConvenioAsignacionBackend[]) => void
}) {
  const toast = useToast()
  const [proyectos, setProyectos] = useState<ProyectoInventario[] | null>(null)
  const [lotes, setLotes] = useState<LoteInventario[] | null>(null)
  const [proyectoId, setProyectoId] = useState<string>("")
  const [inventarioId, setInventarioId] = useState<string>("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    listarProyectos().then(setProyectos).catch(() => setProyectos([]))
    listarInventario().then(setLotes).catch(() => setLotes([]))
  }, [])

  const lotesDelProyecto = (lotes ?? []).filter(
    (lote) => proyectoId && lote.id_proyecto === Number(proyectoId)
  )

  function nombreProyecto(id: number | null): string {
    if (id == null) return "—"
    return proyectos?.find((p) => p.id === id)?.nombre ?? `Proyecto #${id}`
  }

  function nombreLote(id: number | null): string {
    if (id == null) return "—"
    const lote = lotes?.find((l) => l.id === id)
    return lote ? `${lote.codigo} (${lote.proyecto?.nombre ?? nombreProyecto(lote.id_proyecto)})` : `Lote #${id}`
  }

  async function agregar() {
    if (!proyectoId) return
    setGuardando(true)
    try {
      const datos = inventarioId
        ? { inventarioId: Number(inventarioId) }
        : { proyectoId: Number(proyectoId) }
      const creada = await asignarConvenio(convenioId, datos)
      onAsignacionesChange([...asignaciones, creada])
      setProyectoId("")
      setInventarioId("")
      toast({ variant: "success", description: "Asignación agregada." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo asignar el convenio",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  async function quitar(asignacion: ConvenioAsignacionBackend) {
    try {
      await eliminarAsignacion(convenioId, asignacion.id)
      onAsignacionesChange(asignaciones.filter((a) => a.id !== asignacion.id))
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo quitar la asignación",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      })
    }
  }

  return (
    <div className="space-y-3.5">
      {asignaciones.length > 0 ? (
        <div className="border-border divide-border divide-y rounded-lg border">
          {asignaciones.map((asignacion) => (
            <div key={asignacion.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="text-sm">
                {asignacion.inventario_id != null ? (
                  <>
                    <span className="font-semibold">Lote específico:</span>{" "}
                    {nombreLote(asignacion.inventario_id)}
                  </>
                ) : (
                  <>
                    <span className="font-semibold">Proyecto completo:</span>{" "}
                    {nombreProyecto(asignacion.proyecto_id)}
                  </>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar asignación"
                onClick={() => quitar(asignacion)}
              >
                <Trash2 className="text-destructive size-3.5" strokeWidth={1.8} />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Este convenio todavía no está asignado a ningún proyecto o lote.
        </p>
      )}

      <div className="bg-muted/40 border-border grid grid-cols-1 gap-2.5 rounded-lg border p-3.5 sm:grid-cols-3">
        <div>
          <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">Proyecto</label>
          <select
            className="border-input bg-card h-11 w-full rounded-md border px-3 text-sm"
            value={proyectoId}
            onChange={(event) => {
              setProyectoId(event.target.value)
              setInventarioId("")
            }}
            disabled={!proyectos}
          >
            <option value="">Seleccione</option>
            {(proyectos ?? []).map((proyecto) => (
              <option key={proyecto.id} value={proyecto.id}>
                {proyecto.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
            Lote (opcional)
          </label>
          <select
            className="border-input bg-card h-11 w-full rounded-md border px-3 text-sm"
            value={inventarioId}
            onChange={(event) => setInventarioId(event.target.value)}
            disabled={!proyectoId}
          >
            <option value="">Todo el proyecto</option>
            {lotesDelProyecto.map((lote) => (
              <option key={lote.id} value={lote.id}>
                {lote.codigo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="button" disabled={!proyectoId || guardando} onClick={agregar}>
            <Plus className="size-3.5" strokeWidth={1.8} />
            {guardando ? "Agregando…" : "Agregar asignación"}
          </Button>
        </div>
      </div>
    </div>
  )
}
