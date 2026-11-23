"use client"

import { useEffect, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { listarEncuestasApp } from "@/lib/api/app-encuestas-api"

import { ReporteEncuestaAppContent } from "../app/encuestas/[id]/reporte/reporte-encuesta-app-content"

// Reporte "Encuestas de la app" de la página /reportes (permiso reportes:encuestas-app):
// los mismos resultados que App → Encuestas → Ver reporte, pero de solo lectura y para
// gente que no administra encuestas (no puede crear, editar ni asignar). El backend
// (/app-encuestas, listado y resultados) acepta este permiso o app:encuestas.
export function ReporteEncuestasApp() {
  const [encuestaId, setEncuestaId] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    listarEncuestasApp()
      .then((lista) => {
        if (cancelado) return
        // Arranca en la más reciente que ya tenga respuestas (si no, la más reciente).
        const inicial = lista.find((e) => e.respondidas > 0) ?? lista[0]
        setEncuestaId(inicial?.id ?? null)
      })
      .catch(
        (err) =>
          !cancelado &&
          setError(err instanceof Error ? err.message : "No se pudo cargar el reporte.")
      )
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    )
  }
  if (error || encuestaId === null) {
    return (
      <div className="p-6.5">
        <EmptyState
          title={error ? "No se pudo cargar el reporte" : "Todavía no hay encuestas"}
          description={
            error ??
            "Cuando se creen encuestas para la app, sus resultados aparecerán aquí."
          }
          dashed
        />
      </div>
    )
  }
  return (
    <ReporteEncuestaAppContent
      key={encuestaId}
      id={encuestaId}
      embebido
      onCambiarEncuesta={setEncuestaId}
    />
  )
}
