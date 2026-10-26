"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileText } from "lucide-react"
import { useRouter } from "@/lib/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { Pagination } from "@/components/shared/pagination"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listarProyectos, type ProyectoInventario } from "@/lib/api/inventario-api"
import { VentasApiError, obtenerReporteVentas, type MiVenta } from "@/lib/api/ventas-api"
import { cn } from "@/lib/utils"

const VENTAS_POR_PAGINA = 20

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

// Fecha que se muestra y por la que se filtra: el cierre de la venta o, si no lo hay,
// la creación del proceso (YYYY-MM-DD).
const fechaVenta = (v: MiVenta) => (v.ventaNuevaAt ?? v.createdAt ?? "").slice(0, 10)

const claseFecha =
  "border-input bg-card focus:border-primary focus:ring-ring/15 h-9 rounded-md border px-3 text-sm outline-none focus:ring-3"

function formatearMoneda(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

function formatearFecha(fecha: string | null): string {
  return fecha ? fecha.slice(0, 10) : "—"
}

const conDatos = (estado: string | null) =>
  ["ingresado", "aprobado", "rechazado"].includes((estado ?? "").trim().toLowerCase())
const aprobado = (estado: string | null) =>
  (estado ?? "").trim().toLowerCase() === "aprobado"

// Mismas rutas de reporte que la tabla "Procesos del lote" (procesos-content.tsx):
// oferta/financiamiento/pago tienen reporte en cuanto se ingresaron; licitud y convenio
// son documentos generados que solo existen con los tres aprobados.
function reportesDeVenta(venta: MiVenta) {
  const completos =
    aprobado(venta.offertStatus) &&
    aprobado(venta.financStatus) &&
    aprobado(venta.paymentStatus)
  return [
    {
      label: "Oferta",
      ruta: `/ventas/oferta/reporte/${venta.id}`,
      ok: conDatos(venta.offertStatus),
    },
    {
      label: "Financ.",
      ruta: `/ventas/financiamiento/reporte/${venta.id}`,
      ok: conDatos(venta.financStatus),
    },
    {
      label: "Pago",
      ruta: `/ventas/pagos/reporte/${venta.id}`,
      ok: conDatos(venta.paymentStatus),
    },
    { label: "Licitud", ruta: `/ventas/licitud/reporte/${venta.id}`, ok: completos },
    { label: "Convenio", ruta: `/ventas/convenio/reporte/${venta.id}`, ok: completos },
  ]
}

// Listado de ventas ya cerradas. "Nueva Venta" solo muestra lotes LIBRES, así que en
// cuanto un lote se vende desaparece de ahí y no quedaba forma de volver a su proceso
// ni a sus reportes — esta pantalla es ese acceso.
// Solo para quien tiene "ventas:reporte" (ver page.tsx): muestra las de toda la empresa.
export function VentasRealizadasContent() {
  const router = useRouter()

  const [proyectos, setProyectos] = useState<ProyectoInventario[]>([])
  const [proyectoId, setProyectoId] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [anio, setAnio] = useState("")
  const [mes, setMes] = useState("")
  const [pagina, setPagina] = useState(1)

  const [ventas, setVentas] = useState<MiVenta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch(() => setProyectos([]))
  }, [])

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)
    const filtros = { proyectoId: proyectoId ? +proyectoId : undefined }
    obtenerReporteVentas(filtros)
      .then((data) => setVentas(data.procesos))
      .catch((err) => {
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
      .finally(() => setCargando(false))
  }, [proyectoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const vendidas = useMemo(
    () => ventas.filter((v) => v.estadoGeneral === "aprobado"),
    [ventas]
  )

  // Años con ventas, del más reciente al más antiguo, para el selector de año.
  const anios = useMemo(
    () =>
      Array.from(
        new Set(vendidas.map((v) => fechaVenta(v).slice(0, 4)).filter(Boolean))
      ).sort((a, b) => b.localeCompare(a)),
    [vendidas]
  )

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    const lista = vendidas.filter((v) => {
      const fecha = fechaVenta(v)
      if (desde && (!fecha || fecha < desde)) return false
      if (hasta && (!fecha || fecha > hasta)) return false
      if (anio && fecha.slice(0, 4) !== anio) return false
      if (mes && fecha.slice(5, 7) !== mes) return false
      if (
        termino &&
        ![v.cliLote, v.cliName, v.cliAsesor, v.proyectoNombre].some((campo) =>
          campo?.toLowerCase().includes(termino)
        )
      )
        return false
      return true
    })
    // Lo más reciente primero (fecha de cierre de la venta, o de creación del proceso).
    return [...lista].sort((a, b) =>
      (b.ventaNuevaAt ?? b.createdAt ?? "").localeCompare(
        a.ventaNuevaAt ?? a.createdAt ?? ""
      )
    )
  }, [vendidas, busqueda, desde, hasta, anio, mes])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / VENTAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const ventasPagina = filtradas.slice(
    (paginaActual - 1) * VENTAS_POR_PAGINA,
    paginaActual * VENTAS_POR_PAGINA
  )

  const hayFiltros = Boolean(busqueda || proyectoId || desde || hasta || anio || mes)
  function limpiarFiltros() {
    setBusqueda("")
    setProyectoId("")
    setDesde("")
    setHasta("")
    setAnio("")
    setMes("")
    setPagina(1)
  }
  // Cualquier cambio de filtro vuelve a la primera página.
  const conReinicio =
    <T,>(fn: (valor: T) => void) =>
    (valor: T) => {
      fn(valor)
      setPagina(1)
    }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mb-4 flex flex-col gap-3 sm:mb-4.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
              Ventas · Toda la empresa
            </div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-[23px]">
              Ventas realizadas
            </h1>
            <p className="text-muted-foreground mt-1 text-xs">
              Vuelve a ver o descargar los reportes de cualquier venta.
            </p>
          </div>
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <FilterBar>
            <FilterSearchInput
              placeholder="Buscar lote, cliente, asesor…"
              value={busqueda}
              onChange={(valor) => {
                setBusqueda(valor)
                setPagina(1)
              }}
            />
            <Select
              value={proyectoId || "todos"}
              onValueChange={(v) => {
                setProyectoId(v === "todos" ? "" : v)
                setPagina(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los proyectos</SelectItem>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <input
                type="date"
                aria-label="Desde"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => conReinicio(setDesde)(e.target.value)}
                className={claseFecha}
              />
              <span className="text-muted-foreground text-xs">a</span>
              <input
                type="date"
                aria-label="Hasta"
                value={hasta}
                min={desde || undefined}
                onChange={(e) => conReinicio(setHasta)(e.target.value)}
                className={claseFecha}
              />
            </div>
            <Select
              value={anio || "todos"}
              onValueChange={(v) => conReinicio(setAnio)(v === "todos" ? "" : v)}
            >
              <SelectTrigger className="w-[calc(50%-4px)] sm:w-32">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los años</SelectItem>
                {anios.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={mes || "todos"}
              onValueChange={(v) => conReinicio(setMes)(v === "todos" ? "" : v)}
            >
              <SelectTrigger className="w-[calc(50%-4px)] sm:w-36">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los meses</SelectItem>
                {MESES.map((nombre, i) => (
                  <SelectItem key={nombre} value={String(i + 1).padStart(2, "0")}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-primary text-xs font-semibold hover:underline"
              >
                Limpiar filtros
              </button>
            )}
            <span className="text-muted-foreground ml-auto text-xs">
              {cargando
                ? "…"
                : `${filtradas.length} venta${filtradas.length === 1 ? "" : "s"}`}
            </span>
          </FilterBar>

          {cargando ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-4 sm:p-6.5">
              <EmptyState
                title="No se pudieron cargar las ventas"
                description={error}
                dashed
              />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-4 sm:p-6.5">
              <EmptyState
                title={
                  hayFiltros ? "Ninguna venta coincide" : "Todavía no hay ventas aquí"
                }
                description={
                  hayFiltros
                    ? "Prueba con otras fechas, proyecto o búsqueda."
                    : "Cuando un proceso tenga oferta, financiamiento y pago aprobados aparecerá en esta lista."
                }
              />
            </div>
          ) : (
            <div>
              <div className="text-muted-foreground bg-muted/60 border-border hidden grid-cols-[0.8fr_1.6fr_1.1fr_1fr_0.9fr_0.9fr_2.4fr] gap-3 border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide lg:grid">
                <span>LOTE</span>
                <span>CLIENTE</span>
                <span>PROYECTO</span>
                <span>ASESOR</span>
                <span>PRECIO</span>
                <span>FECHA</span>
                <span>REPORTES</span>
              </div>

              {ventasPagina.map((venta, index) => {
                const reportes = reportesDeVenta(venta)
                return (
                  <div
                    key={venta.id}
                    className={cn(
                      "grid items-center gap-3 px-4 py-3.5 text-[13px] transition-colors lg:grid-cols-[0.8fr_1.6fr_1.1fr_1fr_0.9fr_0.9fr_2.4fr] lg:px-6.5",
                      index < ventasPagina.length - 1 && "border-border border-b"
                    )}
                  >
                    {/* Móvil / tablet: tarjeta */}
                    <div className="col-span-full flex flex-col gap-1.5 lg:hidden">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-bold">
                          {venta.cliLote || "—"}
                        </span>
                        <span className="font-mono text-xs font-semibold">
                          {formatearMoneda(venta.lotePrice)}
                        </span>
                      </div>
                      <div className="font-semibold">{venta.cliName || "—"}</div>
                      <div className="text-muted-foreground text-xs">
                        {[
                          venta.proyectoNombre,
                          venta.cliAsesor,
                          formatearFecha(venta.ventaNuevaAt ?? venta.createdAt),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>

                    <span className="hidden font-mono font-bold lg:inline">
                      {venta.cliLote || "—"}
                    </span>
                    <span
                      className="hidden min-w-0 truncate font-semibold lg:inline"
                      title={venta.cliName ?? ""}
                    >
                      {venta.cliName || "—"}
                    </span>
                    <span className="text-muted-foreground hidden min-w-0 truncate lg:inline">
                      {venta.proyectoNombre || "—"}
                    </span>
                    <span
                      className="text-muted-foreground hidden min-w-0 truncate lg:inline"
                      title={venta.cliAsesor ?? ""}
                    >
                      {venta.cliAsesor || "—"}
                    </span>
                    <span className="hidden font-mono font-semibold lg:inline">
                      {formatearMoneda(venta.lotePrice)}
                    </span>
                    <span className="text-muted-foreground hidden font-mono text-xs lg:inline">
                      {formatearFecha(venta.ventaNuevaAt ?? venta.createdAt)}
                    </span>

                    <div className="col-span-full flex flex-wrap gap-1.5 lg:col-span-1">
                      {reportes.map((r) => (
                        <button
                          key={r.label}
                          type="button"
                          disabled={!r.ok}
                          onClick={() => router.push(r.ruta)}
                          title={
                            r.ok
                              ? `Ver reporte de ${r.label.toLowerCase()}`
                              : "Todavía no disponible"
                          }
                          className={cn(
                            "inline-block transition-transform",
                            r.ok
                              ? "cursor-pointer hover:scale-105 active:scale-95"
                              : "cursor-not-allowed opacity-40"
                          )}
                        >
                          <StatusBadge
                            variant={r.ok ? "aprobado" : "pronto"}
                            icon={<FileText className="size-3" strokeWidth={1.9} />}
                          >
                            {r.label}
                          </StatusBadge>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {totalPaginas > 1 && (
                <div className="border-border border-t px-4 py-3 sm:px-6.5">
                  <Pagination
                    page={paginaActual}
                    totalPages={totalPaginas}
                    onPageChange={setPagina}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-muted-foreground mt-3 text-xs">
          Toca un reporte para verlo e imprimirlo de nuevo.
        </p>
      </div>
    </div>
  )
}
