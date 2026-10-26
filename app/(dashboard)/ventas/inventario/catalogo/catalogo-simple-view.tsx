"use client"

import { useMemo } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import type { LoteInventario } from "@/lib/api/inventario-api"
import { formatearPrecio, normalizarEstado } from "./catalogo-helpers"

const TILE_CLASSES =
  "border-status-disponible bg-status-disponible-bg/60 text-status-disponible-fg"

// Vista "Simple": grilla visual por proyecto, solo lotes libres — click en un lote abre
// su ficha (CatalogoLoteDetalleSheet en el padre) en vez de mandar directo a crear la
// oferta.
export function CatalogoSimpleView({
  lotes,
  onSeleccionarLote,
}: {
  lotes: LoteInventario[]
  onSeleccionarLote: (lote: LoteInventario) => void
}) {
  const lotesDisponibles = useMemo(
    () => lotes.filter((lote) => normalizarEstado(lote).variant === "disponible"),
    [lotes]
  )

  // Agrupados en el orden en que aparece cada proyecto en `lotes` (ya viene ordenado
  // del backend) — mismo patrón que el reporte general de ventas.
  const gruposPorProyecto = useMemo(() => {
    const mapa = new Map<string, LoteInventario[]>()
    for (const lote of lotesDisponibles) {
      const clave = lote.proyecto?.nombre || "Sin proyecto"
      const lista = mapa.get(clave) ?? []
      lista.push(lote)
      mapa.set(clave, lista)
    }
    return Array.from(mapa.entries())
  }, [lotesDisponibles])

  if (lotesDisponibles.length === 0) {
    return (
      <EmptyState
        title="No hay lotes libres con estos filtros"
        description="Probá cambiando el proyecto o la búsqueda."
      />
    )
  }

  return (
    <div className="space-y-7">
      {gruposPorProyecto.map(([proyecto, lotesProyecto]) => (
        <div key={proyecto}>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">{proyecto}</h2>
            <span className="text-muted-foreground text-[11px] font-semibold">
              {lotesProyecto.length} {lotesProyecto.length === 1 ? "lote" : "lotes"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {lotesProyecto.map((lote) => (
              <button
                key={lote.id}
                type="button"
                onClick={() => onSeleccionarLote(lote)}
                title={`Ver detalle de ${lote.codigo}`}
                className={`flex cursor-pointer flex-col items-start gap-0.5 rounded-md border p-2 text-left transition-transform hover:scale-105 active:scale-95 ${TILE_CLASSES}`}
              >
                <span className="w-full truncate font-mono text-[11px] font-bold">
                  {lote.codigo}
                </span>
                <span className="text-[10px] font-semibold">
                  {normalizarEstado(lote).label}
                </span>
                <span className="font-mono text-[10px]">{formatearPrecio(lote.pvp)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
