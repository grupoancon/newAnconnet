"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CalendarCheck,
  CircleCheckBig,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Percent,
} from "lucide-react"

import { useCan } from "@/components/shared/can"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  EncuestasApiError,
  etiquetaMedioContacto,
  listarEncuestas,
  type EncuestaListado,
  type EncuestasResumen,
} from "@/lib/api/encuestas-api"
import {
  descargarReporteEncuestasExcel,
  descargarReporteEncuestasPdf,
} from "@/lib/encuestas-reporte"
import { cn } from "@/lib/utils"

import { EncuestaSheet } from "./encuesta-sheet"
import { formatearFecha } from "./formato"

const POR_PAGINA = 15
const TODOS = "todos"

type TabId = "pendientes" | "realizadas" | "todas"

const TAB_ETIQUETA: Record<TabId, string> = {
  pendientes: "Pendientes",
  realizadas: "Realizadas",
  todas: "Todas",
}

// "Este mes": del 1 al último día del mes actual, en YYYY-MM-DD.
function mesActual(): { desde: string; hasta: string } {
  const hoy = new Date()
  const dos = (n: number) => String(n).padStart(2, "0")
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const base = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}`
  return { desde: `${base}-01`, hasta: `${base}-${dos(ultimo)}` }
}

const FILTROS_TAB: Record<TabId, (e: EncuestaListado) => boolean> = {
  pendientes: (e) => !e.realizada,
  realizadas: (e) => e.realizada,
  todas: () => true,
}

const COLUMNAS = "grid-cols-[64px_1.6fr_1fr_1.4fr_110px_1.3fr]"

function Estado({ encuesta }: { encuesta: EncuestaListado }) {
  if (!encuesta.realizada) return <StatusBadge variant="pronto">Pendiente</StatusBadge>
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <StatusBadge variant="aprobado" className="w-fit">
        Realizada
      </StatusBadge>
      <span className="text-muted-foreground truncate text-[11px]">
        {etiquetaMedioContacto(encuesta.medioContacto)}
      </span>
    </span>
  )
}

// Encuesta de satisfacción del proceso de venta. Aparecen solo los procesos con oferta,
// financiamiento y pago aprobados (el filtro lo hace el backend); la pestaña por
// defecto es "Pendientes", lo que falta por encuestar.
export function EncuestasContent() {
  const [datos, setDatos] = useState<{
    items: EncuestaListado[]
    resumen: EncuestasResumen
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>("pendientes")
  const [busqueda, setBusqueda] = useState("")
  const [proyecto, setProyecto] = useState(TODOS)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [pagina, setPagina] = useState(1)
  const puedeReporte = useCan("encuestas:reporte", true)
  const [seleccionada, setSeleccionada] = useState<number | null>(null)

  function recargar() {
    setError(null)
    listarEncuestas()
      .then(setDatos)
      .catch((err) => {
        setDatos({
          items: [],
          resumen: { pendientes: 0, realizadas: 0, realizadasMes: 0 },
        })
        setError(
          err instanceof EncuestasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  useEffect(recargar, [])

  const items = datos?.items
  const resumen = datos?.resumen

  const proyectos = useMemo(
    () =>
      Array.from(
        new Set((items ?? []).map((i) => i.proyecto).filter(Boolean) as string[])
      ).sort(),
    [items]
  )

  const filtradosSinTab = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (items ?? []).filter((e) => {
      if (proyecto !== TODOS && e.proyecto !== proyecto) return false
      // El rango de fechas es sobre la fecha del proceso (las pendientes no tienen
      // fecha de encuesta).
      if (desde && (!e.fechaProceso || e.fechaProceso < desde)) return false
      if (hasta && (!e.fechaProceso || e.fechaProceso > hasta)) return false
      if (!termino) return true
      return (
        (e.cliente ?? "").toLowerCase().includes(termino) ||
        (e.lote ?? "").toLowerCase().includes(termino) ||
        (e.asesor ?? "").toLowerCase().includes(termino) ||
        String(e.processId) === termino
      )
    })
  }, [items, busqueda, proyecto, desde, hasta])

  const conteos = useMemo(() => {
    const resultado = {} as Record<TabId, number>
    for (const id of Object.keys(FILTROS_TAB) as TabId[]) {
      resultado[id] = filtradosSinTab.filter(FILTROS_TAB[id]).length
    }
    return resultado
  }, [filtradosSinTab])

  const filtrados = useMemo(
    () => filtradosSinTab.filter(FILTROS_TAB[tab]),
    [filtradosSinTab, tab]
  )
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA
  )

  function cambiar<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor)
      setPagina(1)
    }
  }

  const total = resumen ? resumen.pendientes + resumen.realizadas : 0
  const cobertura =
    resumen && total > 0 ? Math.round((resumen.realizadas / total) * 100) : null
  const hayFiltros =
    busqueda.trim() !== "" || proyecto !== TODOS || desde !== "" || hasta !== ""

  function opcionesReporte() {
    const filtros = [`Pestaña: ${TAB_ETIQUETA[tab]}`]
    if (busqueda.trim()) filtros.push(`Búsqueda: "${busqueda.trim()}"`)
    if (proyecto !== TODOS) filtros.push(`Proyecto: ${proyecto}`)
    if (desde) filtros.push(`Procesos desde: ${formatearFecha(desde)}`)
    if (hasta) filtros.push(`Procesos hasta: ${formatearFecha(hasta)}`)
    return { filas: filtrados, filtros }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="grid grid-cols-2 gap-3 pb-4 sm:gap-3.5 sm:pb-5 lg:grid-cols-4">
          <KpiCard
            label="Pendientes"
            value={resumen?.pendientes ?? "—"}
            trendLabel="Por encuestar"
            icon={
              <ClipboardList
                className="text-status-reservado-fg size-[17px]"
                strokeWidth={1.8}
              />
            }
          />
          <KpiCard
            label="Realizadas"
            value={resumen?.realizadas ?? "—"}
            trendLabel="Total"
            icon={
              <CircleCheckBig
                className="text-status-disponible-fg size-[17px]"
                strokeWidth={1.8}
              />
            }
          />
          <KpiCard
            label="Este mes"
            value={resumen?.realizadasMes ?? "—"}
            trendLabel="Encuestas registradas"
            icon={
              <CalendarCheck
                className="text-status-hipotecado-fg size-[17px]"
                strokeWidth={1.8}
              />
            }
          />
          <KpiCard
            label="Cobertura"
            value={cobertura === null ? "—" : `${cobertura}%`}
            trendLabel="Procesos aprobados encuestados"
            icon={<Percent className="text-primary size-[17px]" strokeWidth={1.8} />}
          />
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            stackOnMobile
            eyebrow="Encuestas"
            title="Encuestas de satisfacción"
            actions={
              <PillTabs
                value={tab}
                onChange={cambiar((id: string) => setTab(id as TabId))}
                tabs={[
                  { id: "pendientes", label: `Pendientes (${conteos.pendientes})` },
                  { id: "realizadas", label: `Realizadas (${conteos.realizadas})` },
                  { id: "todas", label: `Todas (${conteos.todas})` },
                ]}
              />
            }
          />

          <FilterBar className="flex-wrap">
            <FilterSearchInput
              value={busqueda}
              onChange={cambiar(setBusqueda)}
              placeholder="Buscar por cliente, lote o asesor…"
              className="w-full flex-none sm:w-65"
            />
            <div className="w-full sm:w-48">
              <SelectField
                placeholder="Proyecto"
                value={proyecto}
                onValueChange={cambiar(setProyecto)}
                opciones={[
                  { value: TODOS, label: "Todos los proyectos" },
                  ...proyectos.map((p) => ({ value: p, label: p })),
                ]}
                className="h-[38px]! text-[12.5px]!"
              />
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:contents">
              <label className="text-muted-foreground flex min-w-0 flex-col gap-1 text-xs font-semibold sm:flex-row sm:items-center sm:gap-2">
                Desde
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => cambiar(setDesde)(e.target.value)}
                  className="border-input bg-card text-foreground h-[38px] w-full min-w-0 rounded-md border px-2.5 text-[12.5px] font-normal"
                />
              </label>
              <label className="text-muted-foreground flex min-w-0 flex-col gap-1 text-xs font-semibold sm:flex-row sm:items-center sm:gap-2">
                Hasta
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => cambiar(setHasta)(e.target.value)}
                  className="border-input bg-card text-foreground h-[38px] w-full min-w-0 rounded-md border px-2.5 text-[12.5px] font-normal"
                />
              </label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const mes = mesActual()
                setDesde(mes.desde)
                setHasta(mes.hasta)
                setPagina(1)
              }}
            >
              Este mes
            </Button>
            {hayFiltros ? (
              <button
                type="button"
                onClick={() => {
                  setBusqueda("")
                  setProyecto(TODOS)
                  setDesde("")
                  setHasta("")
                  setPagina(1)
                }}
                className="text-primary text-xs font-bold hover:underline"
              >
                Limpiar filtros
              </button>
            ) : null}
            {puedeReporte ? (
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" disabled={!datos}>
                      <Download className="size-3.5" strokeWidth={2} />
                      Descargar reporte
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => descargarReporteEncuestasPdf(opcionesReporte())}
                    >
                      <FileText className="size-3.5" strokeWidth={1.8} />
                      PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => descargarReporteEncuestasExcel(opcionesReporte())}
                    >
                      <FileSpreadsheet className="size-3.5" strokeWidth={1.8} />
                      Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </FilterBar>

          <div className="p-3 sm:p-5">
            {datos === null ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error ? (
              <EmptyState title="No se pudo cargar" description={error} />
            ) : visibles.length === 0 ? (
              <EmptyState
                title={
                  hayFiltros
                    ? "Sin resultados"
                    : tab === "pendientes"
                      ? "No hay encuestas pendientes"
                      : "Aún no hay encuestas"
                }
                description={
                  hayFiltros
                    ? "Prueba con otros filtros o revisa otra pestaña."
                    : tab === "pendientes"
                      ? "Todos los procesos aprobados ya tienen su encuesta."
                      : "Aparecen aquí los procesos con oferta, financiamiento y pago aprobados."
                }
              />
            ) : (
              <>
                {/* Mobile: una tarjeta por proceso. */}
                <div className="flex flex-col gap-2.5 md:hidden">
                  {visibles.map((e) => (
                    <button
                      key={e.processId}
                      type="button"
                      onClick={() => setSeleccionada(e.processId)}
                      className="border-border bg-card flex flex-col gap-2 rounded-lg border p-3.5 text-left text-[13px]"
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <span className="min-w-0 font-semibold uppercase">
                          {e.cliente ?? "—"}
                        </span>
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          #{e.processId}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="font-mono font-bold">{e.lote ?? "—"}</span>
                        {e.proyecto ? (
                          <span className="text-muted-foreground"> · {e.proyecto}</span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-[11.5px] uppercase">
                        {e.asesor ?? "—"}
                      </div>
                      <div className="border-border flex w-full items-center justify-between gap-2 border-t pt-2">
                        <span className="text-muted-foreground text-xs">
                          {formatearFecha(e.fechaProceso)}
                        </span>
                        <Estado encuesta={e} />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="border-border hidden overflow-x-auto rounded-lg border md:block">
                  <div
                    className={cn(
                      "bg-muted/40 text-muted-foreground grid min-w-[860px] items-center gap-3 px-6 py-2.5 text-[11px] font-semibold uppercase",
                      COLUMNAS
                    )}
                  >
                    <span>Proceso</span>
                    <span>Cliente</span>
                    <span>Lote</span>
                    <span>Asesor</span>
                    <span>Fecha</span>
                    <span>Encuesta</span>
                  </div>
                  {visibles.map((e, index) => (
                    <div
                      key={e.processId}
                      role="link"
                      tabIndex={0}
                      onClick={() => setSeleccionada(e.processId)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") setSeleccionada(e.processId)
                      }}
                      className={cn(
                        "hover:bg-muted/40 focus-visible:bg-muted/40 grid min-w-[860px] cursor-pointer items-center gap-3 px-6 py-3.5 text-[12.5px] transition-colors outline-none",
                        COLUMNAS,
                        index < visibles.length - 1 && "border-border border-b"
                      )}
                    >
                      <span className="text-muted-foreground font-mono">
                        #{e.processId}
                      </span>
                      <span className="pr-2 font-semibold uppercase">
                        {e.cliente ?? "—"}
                      </span>
                      <span className="flex flex-col font-mono font-bold">
                        {e.lote ?? "—"}
                        {e.proyecto ? (
                          <span className="text-muted-foreground font-sans text-[11px] font-normal">
                            {e.proyecto}
                          </span>
                        ) : null}
                      </span>
                      <span className="pr-2 text-[12px] uppercase">
                        {e.asesor ?? "—"}
                      </span>
                      <span>{formatearFecha(e.fechaProceso)}</span>
                      <Estado encuesta={e} />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {filtrados.length} {filtrados.length === 1 ? "proceso" : "procesos"}
                  </span>
                  {totalPaginas > 1 ? (
                    <Pagination
                      page={paginaActual}
                      totalPages={totalPaginas}
                      onPageChange={setPagina}
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <EncuestaSheet
        processId={seleccionada}
        onClose={() => setSeleccionada(null)}
        onGuardada={recargar}
      />
    </div>
  )
}
