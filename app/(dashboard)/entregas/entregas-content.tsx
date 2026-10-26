"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Plus,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "@/lib/navigation"

import { Can, useCan } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { useSession } from "@/components/shared/session-provider"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  EntregasApiError,
  listarEntregas,
  type EntregaListado,
  type EntregasResumen,
  type EstadoPaso,
  type RevisionOfrecimiento,
} from "@/lib/api/entregas-api"
import { cn } from "@/lib/utils"

import {
  descargarReporteEntregasExcel,
  descargarReporteEntregasPdf,
} from "@/lib/entregas-reporte"

import { EntregaDetalleSheet } from "./entrega-detalle-sheet"

const POR_PAGINA = 15
const TODOS = "todos"

const TAB_ETIQUETA: Record<string, string> = {
  sinActividad: "Sin actividad",
  agendadas: "Agendadas",
  observacion: "Con observación",
  entregadas: "Entregadas",
  todas: "Todas",
}

function aISO(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

// Lunes a domingo de la semana actual (YYYY-MM-DD).
function semanaActual(): { desde: string; hasta: string } {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)
  return { desde: aISO(lunes), hasta: aISO(domingo) }
}

function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split("-")
  return `${dia}/${mes}/${anio}`
}

type TabId = "sinActividad" | "agendadas" | "observacion" | "entregadas" | "todas"

function conObservacion(e: EntregaListado): boolean {
  return !e.cerrada && (e.preEntrega === "OBSERVACION" || e.entrega === "OBSERVACION")
}

// Agendadas = fecha/hora confirmada en la pre-entrega y entrega aún sin realizar.
// Mismas reglas que el resumen de las pestañas: una entrega puede caer en más de una
// (ej. agendada y con observación), cada pestaña es un filtro, no una partición.
const FILTROS_TAB: Record<TabId, (e: EntregaListado) => boolean> = {
  // Sin actividad: nadie ha tocado el proceso todavia. Guardar una pre-entrega siempre
  // confirma la fecha, asi que "fecha sin confirmar" equivale a "sin pre-entrega".
  sinActividad: (e) =>
    !e.cerrada &&
    !e.fechaConfirmada &&
    e.entrega === "PENDIENTE" &&
    e.reagendamientos === 0,
  agendadas: (e) => e.fechaConfirmada && !e.cerrada && e.entrega !== "COMPLETO",
  observacion: (e) => conObservacion(e),
  entregadas: (e) => e.entrega === "COMPLETO",
  todas: () => true,
}

const PASO_VARIANTE: Record<EstadoPaso, { variant: StatusVariant; label: string }> = {
  COMPLETO: { variant: "aprobado", label: "Completo" },
  PENDIENTE: { variant: "pronto", label: "Pendiente" },
  OBSERVACION: { variant: "rechazado", label: "Observación" },
}

function formatearFecha(valor: string | null, hora: string | null): string {
  if (!valor) return "Sin fecha"
  const [anio, mes, dia] = valor.split("-")
  return `${dia}/${mes}/${anio}${hora ? ` · ${hora}` : ""}`
}

function SiNo({ valor }: { valor: RevisionOfrecimiento | null }) {
  if (valor === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn("font-semibold", valor !== "SI" && "text-muted-foreground")}>
      {valor}
    </span>
  )
}

// Columnas segun permisos: "Pre entrega" solo con entregas:pre_entrega y "Cierre" solo con
// entregas:ver (el asesor que solo entrega no la ve). Clases literales para Tailwind.
const COLUMNAS_POR_VISTA = {
  "pre-cierre": "grid-cols-[48px_1.6fr_1fr_1.1fr_1.5fr_70px_70px_120px_120px_110px]",
  pre: "grid-cols-[48px_1.6fr_1fr_1.1fr_1.5fr_70px_70px_120px_120px]",
  cierre: "grid-cols-[48px_1.6fr_1fr_1.1fr_1.5fr_70px_70px_120px_110px]",
  base: "grid-cols-[48px_1.6fr_1fr_1.1fr_1.5fr_70px_70px_120px]",
} as const

export function EntregasContent() {
  // /entregas?proceso=ID (ej. desde las tareas pendientes del inicio) abre ese proceso.
  const procesoEnUrl = Number(useSearchParams().get("proceso"))
  const [seleccionada, setSeleccionada] = useState<number | null>(
    Number.isInteger(procesoEnUrl) && procesoEnUrl > 0 ? procesoEnUrl : null
  )
  const router = useRouter()
  const puedePreEntrega = useCan("entregas:pre_entrega", true)
  const puedeEntregar = useCan("entregas:entregar", true)
  const usuario = useSession()
  const resaltar = (e: EntregaListado) =>
    e.vencida && (puedePreEntrega || e.encargado === usuario.id)
  const puedeCerrar = useCan("entregas:cerrar", true)
  // El boton de descargar reporte es solo de quien tiene este permiso asignado.
  const puedeReporte = useCan("entregas:reporte", true)
  // La columna Cierre es de quien ve todo o cierra (no del asesor que solo entrega).
  const puedeVerCierre = useCan("entregas:ver", true) || puedeCerrar
  const COLUMNAS =
    COLUMNAS_POR_VISTA[
      puedePreEntrega
        ? puedeVerCierre
          ? "pre-cierre"
          : "pre"
        : puedeVerCierre
          ? "cierre"
          : "base"
    ]
  const [datos, setDatos] = useState<{
    items: EntregaListado[]
    resumen: EntregasResumen
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>("sinActividad")
  const [busqueda, setBusqueda] = useState("")
  const [proyecto, setProyecto] = useState(TODOS)
  const [asesor, setAsesor] = useState(TODOS)
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [pagina, setPagina] = useState(1)

  function recargar() {
    setError(null)
    listarEntregas()
      .then(setDatos)
      .catch((err) => {
        setDatos({ items: [], resumen: RESUMEN_VACIO })
        setError(
          err instanceof EntregasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  useEffect(recargar, [])

  const items = datos?.items

  const proyectos = useMemo(
    () =>
      Array.from(
        new Set((items ?? []).map((i) => i.proyecto).filter(Boolean) as string[])
      ).sort(),
    [items]
  )
  // cli_asesor puede traer varios asesores separados por coma (ventas compartidas).
  const asesores = useMemo(
    () =>
      Array.from(
        new Set(
          (items ?? [])
            .flatMap((i) => (i.asesor ?? "").split(",").map((a) => a.trim()))
            .filter(Boolean)
        )
      ).sort(),
    [items]
  )

  const filtradosSinTab = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return (items ?? []).filter((e) => {
      if (proyecto !== TODOS && e.proyecto !== proyecto) return false
      if (
        asesor !== TODOS &&
        !(e.asesor ?? "").split(",").some((a) => a.trim() === asesor)
      )
        return false
      if (desde && (!e.fechaPlanificada || e.fechaPlanificada < desde)) return false
      if (hasta && (!e.fechaPlanificada || e.fechaPlanificada > hasta)) return false
      if (!termino) return true
      return (
        (e.cliente ?? "").toLowerCase().includes(termino) ||
        (e.lote ?? "").toLowerCase().includes(termino) ||
        (e.asesor ?? "").toLowerCase().includes(termino) ||
        String(e.id) === termino
      )
    })
  }, [items, busqueda, proyecto, asesor, desde, hasta])

  const conteos = useMemo(() => {
    const resultado = {} as Record<TabId, number>
    for (const id of Object.keys(FILTROS_TAB) as TabId[]) {
      resultado[id] = filtradosSinTab.filter((e) => FILTROS_TAB[id](e)).length
    }
    return resultado
  }, [filtradosSinTab])

  const filtrados = useMemo(
    () => filtradosSinTab.filter((e) => FILTROS_TAB[tab](e)),
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

  const resumen = datos?.resumen
  const hayFiltros = busqueda || proyecto !== TODOS || asesor !== TODOS || desde || hasta

  // Reporte con exactamente lo que se ve: pestaña + filtros (todas las paginas).
  function opcionesReporte() {
    const filtros = [`Pestaña: ${TAB_ETIQUETA[tab]}`]
    if (busqueda.trim()) filtros.push(`Búsqueda: "${busqueda.trim()}"`)
    if (proyecto !== TODOS) filtros.push(`Proyecto: ${proyecto}`)
    if (asesor !== TODOS) filtros.push(`Asesor: ${asesor}`)
    if (desde) filtros.push(`Desde: ${fechaCorta(desde)}`)
    if (hasta) filtros.push(`Hasta: ${fechaCorta(hasta)}`)
    return {
      filas: filtrados,
      filtros,
      incluirPreEntrega: puedePreEntrega,
      incluirCierre: puedeVerCierre,
    }
  }

  function renderPreEntrega(e: EntregaListado) {
    return puedePreEntrega ? (
      <>
        {puedePreEntrega && !e.cerrada && e.entrega !== "COMPLETO" ? (
          <button
            type="button"
            title="Registrar pre-entrega"
            onClick={(ev) => {
              ev.stopPropagation()
              router.push(`/entregas/${e.id}/pre-entrega`)
            }}
            className="focus-visible:ring-primary/50 w-fit cursor-pointer rounded-full transition hover:brightness-95 focus-visible:ring-2 focus-visible:outline-none"
          >
            <StatusBadge variant={PASO_VARIANTE[e.preEntrega].variant}>
              {PASO_VARIANTE[e.preEntrega].label}
            </StatusBadge>
          </button>
        ) : (
          <StatusBadge variant={PASO_VARIANTE[e.preEntrega].variant}>
            {PASO_VARIANTE[e.preEntrega].label}
          </StatusBadge>
        )}
      </>
    ) : null
  }

  function renderEntrega(e: EntregaListado) {
    return puedeEntregar &&
      e.encargado === usuario.id &&
      e.preRegistrada &&
      !e.cerrada &&
      e.entrega !== "COMPLETO" ? (
      <button
        type="button"
        title="Registrar entrega"
        onClick={(ev) => {
          ev.stopPropagation()
          router.push(`/entregas/${e.id}/entrega`)
        }}
        className="focus-visible:ring-primary/50 w-fit cursor-pointer rounded-full transition hover:brightness-95 focus-visible:ring-2 focus-visible:outline-none"
      >
        <StatusBadge variant={PASO_VARIANTE[e.entrega].variant}>
          {PASO_VARIANTE[e.entrega].label}
        </StatusBadge>
      </button>
    ) : (
      <StatusBadge variant={PASO_VARIANTE[e.entrega].variant}>
        {PASO_VARIANTE[e.entrega].label}
      </StatusBadge>
    )
  }

  function renderCierre(e: EntregaListado) {
    return puedeVerCierre ? (
      <>
        {(() => {
          const badge = e.cerrada ? (
            <StatusBadge
              variant="aprobado"
              icon={<Check className="size-3" strokeWidth={2.5} />}
            >
              Cerrada
            </StatusBadge>
          ) : (
            <StatusBadge variant="pronto">Abierta</StatusBadge>
          )
          // Con permiso de cierre, la etiqueta abre la pagina de cierre.
          return puedeCerrar ? (
            <button
              type="button"
              title="Ir al cierre"
              onClick={(ev) => {
                ev.stopPropagation()
                router.push(`/entregas/${e.id}/cierre`)
              }}
              className="focus-visible:ring-primary/50 w-fit cursor-pointer rounded-full transition hover:brightness-95 focus-visible:ring-2 focus-visible:outline-none"
            >
              {badge}
            </button>
          ) : (
            badge
          )
        })()}
      </>
    ) : null
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="grid grid-cols-2 gap-3 pb-4 sm:gap-3.5 sm:pb-5 lg:grid-cols-4">
          <KpiCard
            label="Sin fecha programada"
            value={resumen?.sinFechaProgramada ?? "—"}
            trendLabel="Iniciados sin programar"
            icon={
              <AlertTriangle
                className="text-status-bloqueado-fg size-[17px]"
                strokeWidth={1.8}
              />
            }
          />
          <KpiCard
            label="Re-agendamientos"
            value={resumen?.reagendamientos ?? "—"}
            trendLabel="Total"
            icon={
              <RefreshCw
                className="text-status-hipotecado-fg size-[17px]"
                strokeWidth={1.8}
              />
            }
          />
          <KpiCard
            label="Promedio de días"
            value={resumen ? (resumen.promedioDias ?? "—") : "—"}
            trendLabel="Creación a entrega"
            icon={
              <CalendarClock
                className="text-status-disponible-fg size-[17px]"
                strokeWidth={1.8}
              />
            }
          />
          <KpiCard
            label="Pendientes"
            value={resumen?.ofrecimientosPendientes ?? "—"}
            trendLabel="Ofrecimientos"
            icon={
              <Clock className="text-status-reservado-fg size-[17px]" strokeWidth={1.8} />
            }
          />
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            stackOnMobile
            eyebrow="Entregas"
            title="Gestión de entregas"
            actions={
              <>
                <PillTabs
                  value={tab}
                  onChange={cambiar((id: string) => setTab(id as TabId))}
                  tabs={[
                    {
                      id: "sinActividad",
                      label: `Sin actividad (${conteos.sinActividad})`,
                    },
                    { id: "agendadas", label: `Agendadas (${conteos.agendadas})` },
                    {
                      id: "observacion",
                      label: `Con observación (${conteos.observacion})`,
                    },
                    { id: "entregadas", label: `Entregadas (${conteos.entregadas})` },
                    { id: "todas", label: `Todas (${conteos.todas})` },
                  ]}
                />
                <Can permiso="entregas:crear" explicito>
                  <Button asChild size="sm">
                    <Link href="/entregas/nuevo">
                      <Plus className="size-3.5" strokeWidth={2} />
                      Nuevo proceso
                    </Link>
                  </Button>
                </Can>
              </>
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
            <div className="w-full sm:w-64">
              <SelectField
                placeholder="Asesor"
                value={asesor}
                onValueChange={cambiar(setAsesor)}
                opciones={[
                  { value: TODOS, label: "Todos los asesores" },
                  ...asesores.map((a) => ({ value: a, label: a })),
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
            {hayFiltros ? (
              <button
                type="button"
                onClick={() => {
                  setBusqueda("")
                  setProyecto(TODOS)
                  setAsesor(TODOS)
                  setDesde("")
                  setHasta("")
                  setPagina(1)
                }}
                className="text-primary text-xs font-bold hover:underline"
              >
                Limpiar filtros
              </button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const semana = semanaActual()
                setDesde(semana.desde)
                setHasta(semana.hasta)
                setPagina(1)
              }}
            >
              Esta semana
            </Button>
            {puedeReporte ? (
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Download className="size-3.5" strokeWidth={2} />
                      Descargar reporte
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => descargarReporteEntregasPdf(opcionesReporte())}
                    >
                      <FileText className="size-3.5" strokeWidth={1.8} />
                      PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => descargarReporteEntregasExcel(opcionesReporte())}
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
              <EmptyState title="No se pudo cargar" description={error} dashed />
            ) : visibles.length === 0 ? (
              <EmptyState
                title={
                  hayFiltros || tab !== "todas"
                    ? "Sin resultados"
                    : "Aún no hay procesos de entrega"
                }
                description={
                  hayFiltros
                    ? "Prueba con otros filtros o revisa otra pestaña."
                    : tab !== "todas"
                      ? "No hay entregas en esta pestaña."
                      : "Cuando se cree un proceso de entrega aparecerá aquí."
                }
                dashed
              />
            ) : (
              <>
                {/* Mobile: una tarjeta por proceso (la tabla de ~10 columnas no entra). */}
                <div className="flex flex-col gap-2.5 md:hidden">
                  {visibles.map((e) => (
                    <div
                      key={e.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => setSeleccionada(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") setSeleccionada(e.id)
                      }}
                      className={cn(
                        "border-border flex cursor-pointer flex-col gap-2.5 rounded-lg border p-3.5 text-[13px] outline-none",
                        resaltar(e) ? "bg-status-reservado-bg" : "bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 font-semibold uppercase">
                          {e.cliente ?? "—"}
                        </span>
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          #{e.id}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="font-mono font-bold">{e.lote ?? "—"}</span>
                        {e.proyecto ? (
                          <span className="text-muted-foreground"> · {e.proyecto}</span>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span
                          className={cn(
                            !e.fechaPlanificada &&
                              "text-status-bloqueado-fg font-semibold"
                          )}
                        >
                          {formatearFecha(e.fechaPlanificada, e.hora)}
                        </span>
                        {resaltar(e) ? (
                          <span className="text-status-reservado-fg flex items-center gap-1 text-[11px] font-bold">
                            <TriangleAlert className="size-3" strokeWidth={2.2} />
                            Entrega sin completar
                          </span>
                        ) : null}
                        {e.fechaConfirmada ? (
                          <span className="text-status-disponible-fg flex items-center gap-1 text-[11px] font-semibold">
                            <Check className="size-3" strokeWidth={2.5} />
                            Confirmada
                          </span>
                        ) : null}
                        {e.reagendamientos > 0 ? (
                          <span className="text-status-hipotecado-fg flex items-center gap-1 text-[11px] font-semibold">
                            <RefreshCw className="size-3" strokeWidth={2} />
                            Re-agendado ×{e.reagendamientos}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-[11.5px] uppercase">
                        {(e.asesor ?? "—").split(",").join(" · ")}
                      </div>
                      <div className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-2.5 text-xs">
                        <span className="text-muted-foreground">
                          Tanque <SiNo valor={e.tanque} />
                        </span>
                        <span className="text-muted-foreground">
                          Huerto <SiNo valor={e.huerto} />
                        </span>
                        {puedePreEntrega ? (
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            Pre {renderPreEntrega(e)}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          Entrega {renderEntrega(e)}
                        </span>
                        {puedeVerCierre ? (
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            Cierre {renderCierre(e)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-border hidden overflow-x-auto rounded-lg border md:block">
                  <div
                    className={cn(
                      "bg-muted/40 text-muted-foreground grid min-w-[1050px] items-center gap-3 px-6 py-2.5 text-[11px] font-semibold uppercase",
                      COLUMNAS
                    )}
                  >
                    <span>#</span>
                    <span>Cliente</span>
                    <span>Lote</span>
                    <span>Fecha planificada</span>
                    <span>Asesor</span>
                    <span>Tanque</span>
                    <span>Huerto</span>
                    {puedePreEntrega ? <span>Pre entrega</span> : null}
                    <span>Entrega</span>
                    {puedeVerCierre ? <span>Cierre</span> : null}
                  </div>
                  {visibles.map((e, index) => (
                    <div
                      key={e.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => setSeleccionada(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") setSeleccionada(e.id)
                      }}
                      className={cn(
                        "grid min-w-[1050px] cursor-pointer items-center gap-3 px-6 py-3.5 text-[12.5px] transition-colors outline-none",
                        COLUMNAS,
                        index < visibles.length - 1 && "border-border border-b",
                        // Amarillo: pasaron 2 dias de la fecha y no hay entrega. Lo ve el
                        // asesor asignado y quien gestiona la pre-entrega.
                        resaltar(e)
                          ? "bg-status-reservado-bg hover:brightness-[0.97] focus-visible:brightness-[0.97]"
                          : "hover:bg-muted/40 focus-visible:bg-muted/40"
                      )}
                    >
                      <span className="text-muted-foreground font-mono">{e.id}</span>
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
                      <span className="flex flex-col">
                        <span
                          className={cn(
                            !e.fechaPlanificada &&
                              "text-status-bloqueado-fg font-semibold"
                          )}
                        >
                          {formatearFecha(e.fechaPlanificada, e.hora)}
                        </span>
                        {resaltar(e) ? (
                          <span className="text-status-reservado-fg flex items-center gap-1 text-[11px] font-bold">
                            <TriangleAlert className="size-3" strokeWidth={2.2} />
                            Entrega sin completar
                          </span>
                        ) : null}
                        {e.fechaConfirmada ? (
                          <span className="text-status-disponible-fg flex items-center gap-1 text-[11px] font-semibold">
                            <Check className="size-3" strokeWidth={2.5} />
                            Confirmada
                          </span>
                        ) : null}
                        {e.reagendamientos > 0 ? (
                          <span className="text-status-hipotecado-fg flex items-center gap-1 text-[11px] font-semibold">
                            <RefreshCw className="size-3" strokeWidth={2} />
                            Re-agendado ×{e.reagendamientos}
                          </span>
                        ) : null}
                      </span>
                      <span className="pr-2 text-[12px] uppercase">
                        {(e.asesor ?? "—").split(",").join(" · ")}
                      </span>
                      <SiNo valor={e.tanque} />
                      <SiNo valor={e.huerto} />
                      {renderPreEntrega(e)}
                      {renderEntrega(e)}
                      {renderCierre(e)}
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

      <EntregaDetalleSheet
        id={seleccionada}
        onClose={() => setSeleccionada(null)}
        onCambio={recargar}
      />
    </div>
  )
}

const RESUMEN_VACIO: EntregasResumen = {
  sinFechaProgramada: 0,
  reagendamientos: 0,
  promedioDias: null,
  ofrecimientosPendientes: 0,
}
