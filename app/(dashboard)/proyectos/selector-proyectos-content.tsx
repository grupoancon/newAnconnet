"use client"

import { useEffect, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { ProjectCard } from "@/components/shared/project-card"
import { Spinner } from "@/components/shared/spinner"
import {
  InventarioApiError,
  listarProyectos,
  type ProyectoInventario,
} from "@/lib/api/inventario-api"

import { vitrinaDeProyecto } from "./vitrina-proyecto"

export function SelectorProyectosContent() {
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

  if (!proyectos && !error) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="No se pudieron cargar los proyectos"
        description={error}
        dashed
      />
    )
  }

  if (proyectos && proyectos.length === 0) {
    return (
      <EmptyState title="Sin proyectos" description="Todavía no hay proyectos activos." />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
      {(proyectos ?? []).map((proyecto) => {
        const vitrina = vitrinaDeProyecto(proyecto)
        return (
          <ProjectCard
            key={proyecto.id}
            name={proyecto.nombre}
            description={vitrina.description}
            imageSrc={vitrina.imageSrc}
            gradientClassName={vitrina.gradientClassName}
            badge={vitrina.badge}
            badgeTone={vitrina.badgeTone}
            href={`/ventas/lotes/${proyecto.id}`}
          />
        )
      })}
    </div>
  )
}
