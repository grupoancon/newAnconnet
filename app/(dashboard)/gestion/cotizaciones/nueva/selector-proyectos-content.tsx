"use client"

import { useEffect, useState } from "react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { ProjectCard } from "@/components/shared/project-card"
import { Spinner } from "@/components/shared/spinner"
import type { ProyectoInventario } from "@/lib/api/inventario-api"
import { VentasApiError, listarProyectosCotizacion } from "@/lib/api/ventas-api"

// Misma foto que la tarjeta de Nueva Venta (la cargada en Gestión de inventario, o la
// vitrina por defecto); la descripción es propia de este flujo.
import { vitrinaDeProyecto } from "@/app/(dashboard)/proyectos/vitrina-proyecto"

// Primer paso de "Nueva cotización" — elegir el proyecto del lote a cotizar. Lleva a
// /gestion/cotizaciones/nueva/:id (lotes LIBRES de ese proyecto, igual que Nueva
// Venta) — a diferencia de Refinanciamiento, que elige entre lotes ya VENDIDOS.
export function SelectorProyectosCotizacionContent() {
  const [proyectos, setProyectos] = useState<ProyectoInventario[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarProyectosCotizacion()
      .then(setProyectos)
      .catch((err) => {
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }, [])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="mb-5.5">
          <h1 className="mb-1.5 text-xl font-extrabold tracking-tight">
            Nueva cotización
          </h1>
          <p className="text-muted-foreground text-sm">
            Selecciona el proyecto del lote que quieres cotizar.
          </p>
        </div>

        {!proyectos && !error ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="No se pudieron cargar los proyectos"
            description={error}
            dashed
          />
        ) : proyectos && proyectos.length === 0 ? (
          <EmptyState
            title="Sin proyectos"
            description="Todavía no hay proyectos activos."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
            {(proyectos ?? []).map((proyecto) => (
              <ProjectCard
                key={proyecto.id}
                name={proyecto.nombre}
                description="Elige un lote disponible de este proyecto para cotizarlo."
                imageSrc={vitrinaDeProyecto(proyecto).imageSrc}
                gradientClassName={vitrinaDeProyecto(proyecto).gradientClassName}
                href={`/gestion/cotizaciones/nueva/${proyecto.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
