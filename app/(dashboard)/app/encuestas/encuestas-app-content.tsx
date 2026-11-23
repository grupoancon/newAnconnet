"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
} from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { PageHeader } from "@/components/shared/page-header"
import { PillTabs } from "@/components/shared/pill-tabs"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listarEncuestasApp, obtenerEncuestaApp } from "@/lib/api/app-encuestas-api"

import {
  ESTADO_ENCUESTA_LABELS,
  VARIANTE_ESTADO_ENCUESTA,
  formatearFecha,
  porcentaje,
  type EncuestaDetalle,
  type EncuestaResumen,
  type EstadoEncuesta,
} from "./datos"
import { DetalleEncuestaSheet } from "./detalle-encuesta-sheet"
import { EditorEncuestaSheet } from "./editor-encuesta-sheet"

const FILTROS: { id: "todas" | EstadoEncuesta; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "published", label: "Publicadas" },
  { id: "draft", label: "Borradores" },
  { id: "archived", label: "Archivadas" },
]

function mensajeDeError(err: unknown): string {
  return err instanceof Error ? err.message : "Ocurrió un error inesperado."
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export function EncuestasAppContent() {
  const toast = useToast()
  const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<"todas" | EstadoEncuesta>("todas")
  const [busqueda, setBusqueda] = useState("")

  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<EncuestaDetalle | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setEncuestas(await listarEncuestasApp())
      setError(null)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const totales = useMemo(() => {
    const asignadas = encuestas.reduce((a, e) => a + e.asignadas, 0)
    const respondidas = encuestas.reduce((a, e) => a + e.respondidas, 0)
    return {
      publicadas: encuestas.filter((e) => e.estado === "published").length,
      asignadas,
      respondidas,
      pendientes: encuestas.reduce((a, e) => a + e.pendientes, 0),
      tasa: asignadas ? respondidas / asignadas : 0,
    }
  }, [encuestas])

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    return encuestas.filter(
      (e) =>
        (filtro === "todas" || e.estado === filtro) &&
        (!termino ||
          normalizar(`${e.titulo} ${e.etiquetaInterna ?? ""}`).includes(termino))
    )
  }, [encuestas, filtro, busqueda])

  const conteoPorEstado = useMemo(() => {
    const c: Record<string, number> = { todas: encuestas.length }
    for (const e of encuestas) c[e.estado] = (c[e.estado] ?? 0) + 1
    return c
  }, [encuestas])

  function abrirNueva() {
    setEnEdicion(null)
    setEditorAbierto(true)
  }

  async function abrirEdicion(encuesta: EncuestaDetalle) {
    // Releer: puede haber recibido asignaciones desde que se abrió el detalle.
    try {
      setEnEdicion(await obtenerEncuestaApp(encuesta.id))
      setDetalleId(null)
      setEditorAbierto(true)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="space-y-4.5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Encuestas publicadas"
              value={totales.publicadas}
              icon={<ClipboardList className="text-accent-foreground size-4" strokeWidth={1.7} />}
            />
            <KpiCard
              label="Asignaciones"
              value={totales.asignadas}
              trendLabel={`${totales.pendientes} pendientes`}
              icon={<Send className="text-accent-foreground size-4" strokeWidth={1.7} />}
            />
            <KpiCard
              label="Respondidas"
              value={totales.respondidas}
              icon={
                <CheckCircle2 className="text-accent-foreground size-4" strokeWidth={1.7} />
              }
            />
            <KpiCard
              label="Tasa de respuesta"
              value={porcentaje(totales.tasa)}
              icon={<TrendingUp className="text-accent-foreground size-4" strokeWidth={1.7} />}
            />
          </div>

          <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
            <PageHeader
              eyebrow="App · Encuestas"
              title="Encuestas para usuarios de la app"
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label="Actualizar"
                    disabled={cargando}
                    onClick={() => void cargar()}
                  >
                    <RefreshCw className="size-3.5" strokeWidth={1.8} />
                  </Button>
                  <Button size="sm" onClick={abrirNueva}>
                    <Plus className="size-4" strokeWidth={1.8} />
                    Nueva encuesta
                  </Button>
                </div>
              }
            />

            <div className="bg-muted/60 border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <PillTabs
                tabs={FILTROS.map((f) => ({
                  id: f.id,
                  label: `${f.label} (${conteoPorEstado[f.id] ?? 0})`,
                }))}
                value={filtro}
                onChange={(id) => setFiltro(id as "todas" | EstadoEncuesta)}
              />
              <div className="relative sm:w-64">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
                  strokeWidth={1.8}
                />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar encuesta"
                  className="bg-card pl-8"
                />
              </div>
            </div>

            {cargando && encuestas.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  title="No se pudieron cargar las encuestas"
                  description={error}
                  dashed
                />
              </div>
            ) : visibles.length === 0 ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  title={encuestas.length === 0 ? "Todavía no hay encuestas" : "Sin resultados"}
                  description={
                    encuestas.length === 0
                      ? "Crea la primera con “Nueva encuesta”."
                      : "No hay encuestas con ese filtro o búsqueda."
                  }
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {visibles.map((e) => {
                  const tasa = e.asignadas ? e.respondidas / e.asignadas : 0
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setDetalleId(e.id)}
                        className="hover:bg-muted/60 group grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_200px_auto_auto] sm:px-6"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold">{e.titulo}</p>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {e.etiquetaInterna ? (
                              <span className="text-primary font-semibold">
                                {e.etiquetaInterna} ·{" "}
                              </span>
                            ) : null}
                            {e.totalPreguntas}{" "}
                            {e.totalPreguntas === 1 ? "pregunta" : "preguntas"} · creada{" "}
                            {formatearFecha(e.creadaEn)}
                          </p>
                        </div>

                        <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                          <div className="text-muted-foreground mb-1 flex justify-between text-[11px]">
                            <span>
                              {e.respondidas}/{e.asignadas} respondidas
                            </span>
                            <span className="font-semibold">
                              {e.asignadas ? porcentaje(tasa) : "—"}
                            </span>
                          </div>
                          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <div
                              className="bg-status-disponible h-full rounded-full"
                              style={{ width: `${Math.round(tasa * 100)}%` }}
                            />
                          </div>
                        </div>

                        <StatusBadge variant={VARIANTE_ESTADO_ENCUESTA[e.estado]}>
                          {ESTADO_ENCUESTA_LABELS[e.estado]}
                        </StatusBadge>
                        <ChevronRight
                          className="text-muted-foreground group-hover:text-primary hidden size-4 shrink-0 transition-colors sm:block"
                          strokeWidth={1.8}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <DetalleEncuestaSheet
        encuestaId={detalleId}
        onOpenChange={(abierto) => !abierto && setDetalleId(null)}
        onEditar={(encuesta) => void abrirEdicion(encuesta)}
        onCambio={cargar}
        onDuplicada={(id) => setDetalleId(id)}
      />
      <EditorEncuestaSheet
        abierto={editorAbierto}
        encuesta={enEdicion}
        onOpenChange={setEditorAbierto}
        onGuardada={(guardada) => {
          void cargar()
          setDetalleId(guardada.id)
        }}
      />
    </div>
  )
}
