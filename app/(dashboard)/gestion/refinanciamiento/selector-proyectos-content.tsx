"use client"

import { useEffect, useState } from "react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { ProjectCard } from "@/components/shared/project-card"
import { Spinner } from "@/components/shared/spinner"
import {
  InventarioApiError,
  listarProyectos,
  type ProyectoInventario,
} from "@/lib/api/inventario-api"

// Misma foto que la tarjeta de Nueva Venta (la cargada en Gestión de inventario, o la
// vitrina por defecto); la descripción es propia de este flujo.
import { vitrinaDeProyecto } from "@/app/(dashboard)/proyectos/vitrina-proyecto"

// Mismo listado de proyectos que /proyectos (Nueva Venta), pero cada tarjeta lleva a
// /gestion/refinanciamiento/lotes/:id (lotes YA vendidos de ese proyecto) en vez de a
// /ventas/lotes/:id (lotes libres).
export function SelectorProyectosRefinanciamientoContent() {
  const [proyectos, setProyectos] = useState<ProyectoInventario[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch((err) => {
        setError(
          err instanceof InventarioApiError
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
            Refinanciamientos
          </h1>
          <p className="text-muted-foreground text-sm">
            Selecciona el proyecto del lote que quieres refinanciar.
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
                description="Elige un lote ya vendido de este proyecto para refinanciarlo."
                imageSrc={vitrinaDeProyecto(proyecto).imageSrc}
                gradientClassName={vitrinaDeProyecto(proyecto).gradientClassName}
                href={`/gestion/refinanciamiento/lotes/${proyecto.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
