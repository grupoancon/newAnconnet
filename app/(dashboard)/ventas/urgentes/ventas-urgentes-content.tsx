"use client"

import { useEffect, useMemo, useState } from "react"
import { Flame, Pencil, Plus, Trash2 } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { RowActionButton, RowActions } from "@/components/shared/row-actions"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  VentasApiError,
  eliminarVentaUrgente,
  listarVentasUrgentes,
  type VentaUrgenteBackend,
} from "@/lib/api/ventas-api"
import { cn } from "@/lib/utils"

import { VentaUrgenteFormSheet } from "./venta-urgente-form-sheet"

function formatearFecha(valor: string | null): string {
  if (!valor) return "—"
  const fecha = new Date(valor)
  if (isNaN(fecha.getTime())) return "—"
  return fecha.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function VentasUrgentesContent() {
  const toast = useToast()
  const [registros, setRegistros] = useState<VentaUrgenteBackend[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [formAbierto, setFormAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<VentaUrgenteBackend | null>(null)
  const [idsEnAccion, setIdsEnAccion] = useState<Set<number>>(new Set())

  useEffect(() => {
    cargar()
  }, [])

  function cargar() {
    setError(null)
    listarVentasUrgentes()
      .then(setRegistros)
      .catch((err) => {
        setRegistros([])
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  const filtrados = useMemo(() => {
    if (!registros) return []
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return registros
    return registros.filter(
      (r) =>
        r.lote.toLowerCase().includes(termino) ||
        (r.mensaje ?? "").toLowerCase().includes(termino) ||
        (r.usuario ?? "").toLowerCase().includes(termino)
    )
  }, [registros, busqueda])

  async function quitar(registro: VentaUrgenteBackend) {
    if (
      !window.confirm(
        `¿Quitar la marca de venta urgente del lote ${registro.lote}? El lote volverá a las validaciones normales.`
      )
    ) {
      return
    }
    setIdsEnAccion((prev) => new Set(prev).add(registro.id))
    try {
      await eliminarVentaUrgente(registro.id)
      setRegistros((prev) => prev?.filter((r) => r.id !== registro.id) ?? prev)
      toast({ variant: "success", description: "Marca de venta urgente quitada." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo quitar",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setIdsEnAccion((prev) => {
        const s = new Set(prev)
        s.delete(registro.id)
        return s
      })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Ventas · Urgentes"
            title="Ventas urgentes"
            actions={
              <Button
                size="sm"
                onClick={() => {
                  setEnEdicion(null)
                  setFormAbierto(true)
                }}
              >
                <Plus className="size-3.5" strokeWidth={2} />
                Marcar lote urgente
              </Button>
            }
          />

          <FilterBar>
            <FilterSearchInput
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar por lote, motivo o usuario…"
            />
          </FilterBar>

          <div className="p-5">
            {registros === null ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error ? (
              <EmptyState title="No se pudo cargar" description={error} dashed />
            ) : filtrados.length === 0 ? (
              <EmptyState
                title={
                  busqueda ? "Sin resultados" : "No hay lotes marcados como venta urgente"
                }
                description={
                  busqueda
                    ? "Prueba con otro término de búsqueda."
                    : "Marca un lote para que pueda venderse sin las validaciones habituales."
                }
                dashed
              />
            ) : (
              <div className="border-border overflow-x-auto rounded-lg border">
                <div className="bg-muted/40 text-muted-foreground grid min-w-[720px] grid-cols-[1fr_2fr_1.2fr_1fr_120px] items-center px-6 py-2.5 text-[11px] font-semibold uppercase">
                  <span>Lote</span>
                  <span>Motivo</span>
                  <span>Marcado por</span>
                  <span>Fecha</span>
                  <span className="text-right">Acciones</span>
                </div>
                {filtrados.map((registro, index) => (
                  <div
                    key={registro.id}
                    className={cn(
                      "hover:bg-muted/40 grid min-w-[720px] grid-cols-[1fr_2fr_1.2fr_1fr_120px] items-center px-6 py-3.5 text-[13px] transition-colors",
                      index < filtrados.length - 1 && "border-border border-b",
                      idsEnAccion.has(registro.id) && "opacity-60"
                    )}
                  >
                    <span className="flex items-center gap-2 font-mono font-bold">
                      <Flame className="text-destructive size-3.5" strokeWidth={2} />
                      {registro.lote}
                    </span>
                    <span className="text-muted-foreground truncate pr-4">
                      {registro.mensaje || "—"}
                    </span>
                    <span className="truncate pr-4">{registro.usuario || "—"}</span>
                    <span className="text-muted-foreground">
                      {formatearFecha(registro.created_at)}
                    </span>
                    <RowActions className="justify-end">
                      <RowActionButton
                        icon={<Pencil className="size-3.5" strokeWidth={1.8} />}
                        label="Editar"
                        onClick={() => {
                          setEnEdicion(registro)
                          setFormAbierto(true)
                        }}
                      />
                      <RowActionButton
                        icon={<Trash2 className="size-3.5" strokeWidth={1.8} />}
                        label="Quitar marca"
                        variant="danger"
                        onClick={() => quitar(registro)}
                      />
                    </RowActions>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <VentaUrgenteFormSheet
        registro={enEdicion}
        open={formAbierto}
        onOpenChange={setFormAbierto}
        onGuardado={cargar}
      />
    </div>
  )
}
