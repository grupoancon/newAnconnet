"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import {
  CheckCircle2,
  FileSpreadsheet,
  Home,
  Layers,
  ListOrdered,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  ShoppingBag,
  Trash2,
} from "lucide-react"

import { Can } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { PillTabs } from "@/components/shared/pill-tabs"
import { RowActionButton, RowActions } from "@/components/shared/row-actions"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InventarioApiError,
  eliminarLote,
  listarInventario,
  listarProyectos,
  type LoteInventario,
  type ProyectoInventario,
} from "@/lib/api/inventario-api"
import { cn } from "@/lib/utils"

import { ImportarLotesSheet } from "./importar-lotes-sheet"
import { LoteEstadoSheet } from "./lote-estado-sheet"
import { LoteFormSheet } from "./lote-form-sheet"
import { OrdenarProyectosSheet } from "./ordenar-proyectos-sheet"
import { ProyectoFormSheet } from "./proyecto-form-sheet"

const LOTES_POR_PAGINA = 10

// El backend devuelve `estado` a veces con espacios de mas (tipo " LIBRE") — se hace
// trim y se mapea a una de las variantes visuales ya definidas en StatusBadge (mismo
// criterio que ventas/lotes/[proyect]/lotes-content.tsx, para no inventar otro mapeo).
// "Convenio" cuenta como vendido para efectos de negocio: un lote en convenio ya esta
// comprometido con un cliente, por eso comparte variante con "Vendido" (ver kpis.vendidos
// mas abajo, que tambien lo suma). "Facturado" no es un valor propio de `estado` — se
// deriva de tener numFac Y anioFac cargados (ver lote-form-sheet.tsx) y pisa cualquier
// `estado` que haya quedado desactualizado; comparte variante con Convenio/Vendido
// porque para el negocio es la misma bolsa ("ya no está disponible para vender").
const ESTADO_VARIANTE: Record<string, StatusVariant> = {
  disponible: "disponible",
  libre: "disponible",
  reservado: "reservado",
  convenio: "hipotecado",
  vendido: "hipotecado",
  hipotecado: "hipotecado",
  bloqueado: "bloqueado",
  inactivo: "bloqueado",
}

function esLoteFacturado(lote: {
  numFac?: string | null
  anioFac?: string | null
}): boolean {
  return Boolean(lote.numFac?.trim()) && Boolean(lote.anioFac?.trim())
}

function normalizarEstado(lote: {
  estado: string | null | undefined
  numFac?: string | null
  anioFac?: string | null
}): {
  label: string
  variant: StatusVariant
} {
  if (esLoteFacturado(lote)) return { label: "Facturado", variant: "hipotecado" }
  const texto = (lote.estado ?? "").trim()
  if (!texto) return { label: "—", variant: "pronto" }
  const clave = texto.toLowerCase()
  return {
    label: texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase(),
    variant: ESTADO_VARIANTE[clave] ?? "pronto",
  }
}

function formatearMetraje(valor: string | number | null): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return `${new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 }).format(numero)} m²`
}

function formatearPrecio(valor: string | number | null): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

// Se arma a mano desde el string "YYYY-MM-DD" en vez de pasar por Date/Intl: un
// Date sobre una fecha-sin-hora se interpreta en UTC y en timezones negativos se ve
// un dia antes del que realmente devuelve el backend.
function formatearFecha(valor: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? "")
  if (!match) return "—"
  const [, anio, mes, dia] = match
  return `${dia}/${mes}/${anio}`
}

const ESTADO_VARIANTE_PROYECTO: Record<string, StatusVariant> = {
  activo: "disponible",
  inactivo: "bloqueado",
}

function normalizarEstadoProyecto(crudo: string | null | undefined): {
  label: string
  variant: StatusVariant
} {
  const texto = (crudo ?? "").trim()
  if (!texto) return { label: "—", variant: "pronto" }
  const clave = texto.toLowerCase()
  return {
    label: texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase(),
    variant: ESTADO_VARIANTE_PROYECTO[clave] ?? "pronto",
  }
}

export function InventarioContent() {
  const router = useRouter()
  const toast = useToast()
  const [vista, setVista] = useState<"lotes" | "proyectos">("lotes")
  const [lotes, setLotes] = useState<LoteInventario[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [filtroProyecto, setFiltroProyecto] = useState("todos")
  const [pagina, setPagina] = useState(1)
  const [loteEnEdicion, setLoteEnEdicion] = useState<LoteInventario | null>(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [loteEstado, setLoteEstado] = useState<LoteInventario | null>(null)
  const [codigosEnAccion, setCodigosEnAccion] = useState<Set<string>>(new Set())

  const [proyectos, setProyectos] = useState<ProyectoInventario[] | null>(null)
  const [errorProyectos, setErrorProyectos] = useState<string | null>(null)
  const [busquedaProyectos, setBusquedaProyectos] = useState("")
  const [paginaProyectos, setPaginaProyectos] = useState(1)
  const [proyectoEnEdicion, setProyectoEnEdicion] = useState<ProyectoInventario | null>(
    null
  )
  const [formularioProyectoAbierto, setFormularioProyectoAbierto] = useState(false)
  const [ordenarAbierto, setOrdenarAbierto] = useState(false)
  const [importarAbierto, setImportarAbierto] = useState(false)

  useEffect(() => {
    cargarInventario()
    cargarProyectos()
  }, [])

  function cargarInventario() {
    setError(null)
    listarInventario()
      .then((data) => {
        // Si el backend devuelve algo que no es un arreglo (p. ej. un objeto paginado
        // {data, total} en vez del arreglo plano que espera esta pantalla), tratarlo
        // como error en vez de dejar que reviente mas abajo el .filter de lotesFiltrados.
        if (!Array.isArray(data)) {
          setError("El servidor devolvió una respuesta inesperada.")
          return
        }
        setLotes(data)
      })
      .catch((err) => {
        setError(
          err instanceof InventarioApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  function cargarProyectos() {
    setErrorProyectos(null)
    listarProyectos()
      .then((data) => {
        if (!Array.isArray(data)) {
          setErrorProyectos("El servidor devolvió una respuesta inesperada.")
          return
        }
        setProyectos(data)
      })
      .catch((err) => {
        setErrorProyectos(
          err instanceof InventarioApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  function actualizarProyectoEnLista(proyectoActualizado: ProyectoInventario) {
    setProyectos((actual) =>
      actual
        ? actual.map((p) => (p.id === proyectoActualizado.id ? proyectoActualizado : p))
        : actual
    )
  }

  function manejarBusquedaProyectos(valor: string) {
    setBusquedaProyectos(valor)
    setPaginaProyectos(1)
  }

  function marcarEnAccion(codigo: string, activo: boolean) {
    setCodigosEnAccion((actual) => {
      const siguiente = new Set(actual)
      if (activo) siguiente.add(codigo)
      else siguiente.delete(codigo)
      return siguiente
    })
  }

  function actualizarEnLista(loteActualizado: LoteInventario) {
    setLotes((actual) =>
      actual
        ? actual.map((l) =>
            l.id === loteActualizado.id
              ? // PATCH /inventarios/:id/estado devuelve el lote sin el objeto `proyecto`
                // anidado (a diferencia de GET /inventarios) — si viene vacio, se
                // conserva el que ya tenamos en la lista para no perder la columna.
                {
                  ...l,
                  ...loteActualizado,
                  proyecto: loteActualizado.proyecto ?? l.proyecto,
                }
              : l
          )
        : actual
    )
  }

  async function eliminar(lote: LoteInventario) {
    if (
      !window.confirm(
        `¿Eliminar el lote ${lote.codigo}? Queda como inactivo, no se borra del historial.`
      )
    ) {
      return
    }
    marcarEnAccion(lote.codigo, true)
    try {
      await eliminarLote(lote.codigo)
      cargarInventario()
      toast({
        variant: "success",
        description: `Lote ${lote.codigo} marcado como inactivo.`,
      })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description:
          err instanceof InventarioApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      marcarEnAccion(lote.codigo, false)
    }
  }

  function manejarBusqueda(valor: string) {
    setBusqueda(valor)
    setPagina(1)
  }

  function manejarFiltroProyecto(valor: string) {
    setFiltroProyecto(valor)
    setPagina(1)
  }

  const lotesFiltrados = useMemo(() => {
    if (!lotes) return []
    const termino = busqueda.trim().toLowerCase()
    return lotes.filter((lote) => {
      const coincideProyecto =
        filtroProyecto === "todos" || String(lote.id_proyecto) === filtroProyecto
      const coincideBusqueda =
        !termino ||
        lote.codigo?.toLowerCase().includes(termino) ||
        lote.proyecto?.nombre?.toLowerCase().includes(termino)
      return coincideProyecto && coincideBusqueda
    })
  }, [lotes, busqueda, filtroProyecto])

  const kpis = useMemo(() => {
    const lista = lotes ?? []
    return {
      total: lista.length,
      disponibles: lista.filter((l) => normalizarEstado(l).variant === "disponible")
        .length,
      reservados: lista.filter((l) => normalizarEstado(l).variant === "reservado").length,
      // "hipotecado" agrupa "Vendido", "Convenio", "Hipotecado" y "Facturado" (ver
      // ESTADO_VARIANTE/esLoteFacturado): todos ya estan comprometidos o cerrados con
      // un cliente, cuentan como vendido.
      vendidos: lista.filter((l) => normalizarEstado(l).variant === "hipotecado").length,
    }
  }, [lotes])

  const totalPaginas = Math.max(1, Math.ceil(lotesFiltrados.length / LOTES_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * LOTES_POR_PAGINA
  const lotesPagina = lotesFiltrados.slice(inicio, inicio + LOTES_POR_PAGINA)

  const proyectosFiltrados = useMemo(() => {
    if (!proyectos) return []
    const termino = busquedaProyectos.trim().toLowerCase()
    if (!termino) return proyectos
    return proyectos.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(termino) ||
        p.nomenclatura?.toLowerCase().includes(termino)
    )
  }, [proyectos, busquedaProyectos])

  const totalPaginasProyectos = Math.max(
    1,
    Math.ceil(proyectosFiltrados.length / LOTES_POR_PAGINA)
  )
  const paginaActualProyectos = Math.min(paginaProyectos, totalPaginasProyectos)
  const inicioProyectos = (paginaActualProyectos - 1) * LOTES_POR_PAGINA
  const proyectosPagina = proyectosFiltrados.slice(
    inicioProyectos,
    inicioProyectos + LOTES_POR_PAGINA
  )

  function accionesLote(lote: LoteInventario) {
    return (
      <RowActions className="justify-end">
        <Can permiso="inventario:gestion">
          <RowActionButton
            icon={<Pencil className="size-3.5" strokeWidth={1.8} />}
            label="Editar lote"
            onClick={() => {
              setLoteEnEdicion(lote)
              setFormularioAbierto(true)
            }}
          />
        </Can>
        <Can permiso="inventario:gestion">
          <RowActionButton
            icon={<CheckCircle2 className="size-3.5" strokeWidth={1.8} />}
            label="Cambiar estado"
            onClick={() => setLoteEstado(lote)}
          />
        </Can>
        <Can permiso="inventario:eliminar">
          <RowActionButton
            variant="danger"
            icon={<Trash2 className="size-3.5" strokeWidth={1.8} />}
            label="Eliminar lote"
            onClick={() => void eliminar(lote)}
          />
        </Can>
      </RowActions>
    )
  }

  function accionesProyecto(proyecto: ProyectoInventario) {
    return (
      <RowActions className="justify-end">
        <Can permiso="proyectos:gestion">
          <RowActionButton
            icon={<MapPin className="size-3.5" strokeWidth={1.8} />}
            label="Mapear lotes en el plano"
            onClick={() => router.push(`/ventas/inventario/plano/${proyecto.id}`)}
          />
          <RowActionButton
            icon={<Pencil className="size-3.5" strokeWidth={1.8} />}
            label="Editar proyecto"
            onClick={() => {
              setProyectoEnEdicion(proyecto)
              setFormularioProyectoAbierto(true)
            }}
          />
        </Can>
      </RowActions>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        {vista === "lotes" ? (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-3.5 lg:grid-cols-4">
            <div className="bg-card border-border border-primary rounded-lg border border-l-[3px] p-4">
              <div className="mb-2 flex items-center gap-2.5">
                <div className="bg-accent flex size-7.5 items-center justify-center rounded-md">
                  <Layers
                    className="text-accent-foreground size-[15px]"
                    strokeWidth={1.6}
                  />
                </div>
                <span className="text-muted-foreground text-[12.5px] font-bold">
                  Total
                </span>
              </div>
              <div className="font-mono text-2xl font-semibold">{kpis.total}</div>
              <div className="text-muted-foreground text-[11.5px]">Lotes</div>
            </div>

            <div className="bg-card border-border border-status-disponible rounded-lg border border-l-[3px] p-4">
              <div className="mb-2 flex items-center gap-2.5">
                <div className="bg-status-disponible-bg flex size-7.5 items-center justify-center rounded-md">
                  <Home
                    className="text-status-disponible-fg size-[15px]"
                    strokeWidth={1.6}
                  />
                </div>
                <span className="text-muted-foreground text-[12.5px] font-bold">
                  Disponibles
                </span>
              </div>
              <div className="font-mono text-2xl font-semibold">{kpis.disponibles}</div>
              <div className="text-muted-foreground text-[11.5px]">Lotes</div>
            </div>

            <div className="bg-card border-border border-status-reservado rounded-lg border border-l-[3px] p-4">
              <div className="mb-2 flex items-center gap-2.5">
                <div className="bg-status-reservado-bg flex size-7.5 items-center justify-center rounded-md">
                  <RefreshCcw
                    className="text-status-reservado-fg size-[15px]"
                    strokeWidth={1.6}
                  />
                </div>
                <span className="text-muted-foreground text-[12.5px] font-bold">
                  Reservados
                </span>
              </div>
              <div className="font-mono text-2xl font-semibold">{kpis.reservados}</div>
              <div className="text-muted-foreground text-[11.5px]">Lotes</div>
            </div>

            <div className="bg-card border-border border-status-hipotecado rounded-lg border border-l-[3px] p-4">
              <div className="mb-2 flex items-center gap-2.5">
                <div className="bg-status-hipotecado-bg flex size-7.5 items-center justify-center rounded-md">
                  <ShoppingBag
                    className="text-status-hipotecado-fg size-[15px]"
                    strokeWidth={1.6}
                  />
                </div>
                <span className="text-muted-foreground text-[12.5px] font-bold">
                  Vendidos
                </span>
              </div>
              <div className="font-mono text-2xl font-semibold">{kpis.vendidos}</div>
              <div className="text-muted-foreground text-[11.5px]">Lotes</div>
            </div>
          </div>
        ) : null}

        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Ventas · Inventario"
            title={vista === "lotes" ? "Gestión de inventario" : "Gestión de proyectos"}
            actions={
              vista === "lotes" ? (
                <div className="flex flex-wrap gap-2">
                  {/* Mismo permiso que exige POST /inventarios/importar en el backend. */}
                  <Can permiso="inventario:gestion">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!proyectos || proyectos.length === 0}
                      onClick={() => setImportarAbierto(true)}
                    >
                      <FileSpreadsheet className="size-3.5" strokeWidth={1.8} />
                      Importar lotes
                    </Button>
                  </Can>
                  <Can permiso="inventario:gestion">
                    <Button
                      size="sm"
                      onClick={() => {
                        setLoteEnEdicion(null)
                        setFormularioAbierto(true)
                      }}
                    >
                      <Plus className="size-3.5" strokeWidth={2} />
                      Nuevo lote
                    </Button>
                  </Can>
                </div>
              ) : (
                <Can permiso="proyectos:gestion">
                  <Button
                    size="sm"
                    onClick={() => {
                      setProyectoEnEdicion(null)
                      setFormularioProyectoAbierto(true)
                    }}
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                    Nuevo proyecto
                  </Button>
                </Can>
              )
            }
          />

          <FilterBar className="flex-wrap">
            <PillTabs
              tabs={[
                { id: "lotes", label: "Lotes" },
                { id: "proyectos", label: "Proyectos" },
              ]}
              value={vista}
              onChange={(id) => setVista(id as "lotes" | "proyectos")}
            />
            {vista === "lotes" ? (
              <>
                <FilterSearchInput
                  placeholder="Buscar lote, proyecto…"
                  value={busqueda}
                  onChange={manejarBusqueda}
                  className="w-full flex-none sm:w-65"
                />
                <Select value={filtroProyecto} onValueChange={manejarFiltroProyecto}>
                  <SelectTrigger className="bg-card w-full sm:w-52">
                    <SelectValue placeholder="Todos los proyectos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los proyectos</SelectItem>
                    {(proyectos ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nombre} ({p.nomenclatura})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground ml-auto text-xs">
                  {lotes ? `${lotesFiltrados.length} lotes` : "…"}
                </span>
              </>
            ) : (
              <>
                <FilterSearchInput
                  placeholder="Buscar proyecto…"
                  value={busquedaProyectos}
                  onChange={manejarBusquedaProyectos}
                  className="w-full flex-none sm:w-65"
                />
                <span className="text-muted-foreground ml-auto text-xs">
                  {proyectos ? `${proyectosFiltrados.length} proyectos` : "…"}
                </span>
                <Can permiso="proyectos:gestion">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!proyectos || proyectos.length < 2}
                    onClick={() => setOrdenarAbierto(true)}
                  >
                    <ListOrdered className="size-3.5" strokeWidth={1.8} />
                    Ordenar
                  </Button>
                </Can>
              </>
            )}
          </FilterBar>

          {vista === "lotes" ? (
            <>
              {!lotes && !error ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner />
                </div>
              ) : error ? (
                <div className="p-4 sm:p-6.5">
                  <EmptyState
                    title="No se pudo cargar el inventario"
                    description={error}
                    dashed
                  />
                </div>
              ) : lotesFiltrados.length === 0 ? (
                <div className="p-4 sm:p-6.5">
                  <EmptyState
                    title="Sin resultados"
                    description="Ningún lote coincide."
                  />
                </div>
              ) : (
                <>
                  {/* Mobile: una tarjeta por lote (la tabla de 6 columnas no entra). */}
                  <div className="flex flex-col md:hidden">
                    {lotesPagina.map((lote, index) => {
                      const enAccion = codigosEnAccion.has(lote.codigo)
                      const estado = normalizarEstado(lote)

                      return (
                        <div
                          key={lote.id}
                          className={cn(
                            "flex flex-col gap-2 px-4 py-3.5 text-[13px]",
                            index < lotesPagina.length - 1 && "border-border border-b",
                            enAccion && "opacity-60"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-sm font-bold">
                              {lote.codigo}
                            </span>
                            <StatusBadge variant={estado.variant}>
                              {estado.label}
                            </StatusBadge>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {lote.proyecto?.nombre || "—"}
                            {lote.proyecto?.etapa
                              ? ` · Etapa ${lote.proyecto.etapa}`
                              : ""}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs">
                              <span className="font-semibold">
                                {formatearMetraje(lote.areaUtil)}
                              </span>
                              <span className="font-mono">
                                {" "}
                                · {formatearPrecio(lote.pvp)}
                              </span>
                            </span>
                            {accionesLote(lote)}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <div className="text-muted-foreground bg-muted/60 border-border grid min-w-[820px] grid-cols-[1fr_1.4fr_1fr_1fr_1fr_140px] border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide">
                      <span>LOTE</span>
                      <span>PROYECTO</span>
                      <span>ÁREA</span>
                      <span>PRECIO</span>
                      <span>ESTADO</span>
                      <span className="text-right">ACCIONES</span>
                    </div>
                    {lotesPagina.map((lote, index) => {
                      const enAccion = codigosEnAccion.has(lote.codigo)
                      const estado = normalizarEstado(lote)

                      return (
                        <div
                          key={lote.id}
                          className={cn(
                            "hover:bg-muted/60 grid min-w-[820px] grid-cols-[1fr_1.4fr_1fr_1fr_1fr_140px] items-center px-6.5 py-3.5 text-[13px] transition-colors",
                            index < lotesPagina.length - 1 && "border-border border-b",
                            enAccion && "opacity-60"
                          )}
                        >
                          <span className="font-mono font-bold">{lote.codigo}</span>
                          <div className="min-w-0">
                            <div className="truncate">{lote.proyecto?.nombre || "—"}</div>
                            {lote.proyecto?.etapa ? (
                              <div className="text-muted-foreground truncate text-[11px]">
                                Etapa {lote.proyecto.etapa}
                              </div>
                            ) : null}
                          </div>
                          <span className="font-semibold">
                            {formatearMetraje(lote.areaUtil)}
                          </span>
                          <span className="font-mono">{formatearPrecio(lote.pvp)}</span>
                          <span>
                            <StatusBadge variant={estado.variant}>
                              {estado.label}
                            </StatusBadge>
                          </span>
                          {accionesLote(lote)}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {lotes && lotesFiltrados.length > 0 ? (
                <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3.5 sm:px-6.5">
                  <span className="text-muted-foreground text-xs">
                    Mostrando {inicio + 1}–
                    {Math.min(inicio + LOTES_POR_PAGINA, lotesFiltrados.length)} de{" "}
                    {lotesFiltrados.length}
                  </span>
                  <Pagination
                    page={paginaActual}
                    totalPages={totalPaginas}
                    onPageChange={setPagina}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {!proyectos && !errorProyectos ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner />
                </div>
              ) : errorProyectos ? (
                <div className="p-4 sm:p-6.5">
                  <EmptyState
                    title="No se pudo cargar los proyectos"
                    description={errorProyectos}
                    dashed
                  />
                </div>
              ) : proyectosFiltrados.length === 0 ? (
                <div className="p-4 sm:p-6.5">
                  <EmptyState
                    title="Sin resultados"
                    description="Ningún proyecto coincide."
                  />
                </div>
              ) : (
                <>
                  {/* Mobile: una tarjeta por proyecto. */}
                  <div className="flex flex-col md:hidden">
                    {proyectosPagina.map((proyecto, index) => {
                      const estado = normalizarEstadoProyecto(proyecto.estado)

                      return (
                        <div
                          key={proyecto.id}
                          className={cn(
                            "flex flex-col gap-2 px-4 py-3.5 text-[13px]",
                            index < proyectosPagina.length - 1 && "border-border border-b"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 font-semibold">
                              {proyecto.nombre}
                            </span>
                            <StatusBadge variant={estado.variant}>
                              {estado.label}
                            </StatusBadge>
                          </div>
                          <div className="text-muted-foreground text-xs">
                            <span className="font-mono">{proyecto.nomenclatura}</span>
                            {proyecto.etapa ? ` · Etapa ${proyecto.etapa}` : ""} · Stock{" "}
                            <span className="font-mono">{proyecto.stock}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground text-xs">
                              Entrega: {formatearFecha(proyecto.fecha_entrega)}
                            </span>
                            {accionesProyecto(proyecto)}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <div className="text-muted-foreground bg-muted/60 border-border grid min-w-[820px] grid-cols-[1.4fr_0.8fr_0.6fr_0.6fr_1fr_1fr_110px] border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide">
                      <span>PROYECTO</span>
                      <span>NOMENCLATURA</span>
                      <span>ETAPA</span>
                      <span>STOCK</span>
                      <span>ENTREGA</span>
                      <span>ESTADO</span>
                      <span className="text-right">ACCIONES</span>
                    </div>
                    {proyectosPagina.map((proyecto, index) => {
                      const estado = normalizarEstadoProyecto(proyecto.estado)

                      return (
                        <div
                          key={proyecto.id}
                          className={cn(
                            "hover:bg-muted/60 grid min-w-[820px] grid-cols-[1.4fr_0.8fr_0.6fr_0.6fr_1fr_1fr_110px] items-center px-6.5 py-3.5 text-[13px] transition-colors",
                            index < proyectosPagina.length - 1 && "border-border border-b"
                          )}
                        >
                          <span className="truncate font-semibold">
                            {proyecto.nombre}
                          </span>
                          <span className="text-muted-foreground font-mono">
                            {proyecto.nomenclatura}
                          </span>
                          <span>{proyecto.etapa}</span>
                          <span className="font-mono">{proyecto.stock}</span>
                          <span>{formatearFecha(proyecto.fecha_entrega)}</span>
                          <span>
                            <StatusBadge variant={estado.variant}>
                              {estado.label}
                            </StatusBadge>
                          </span>
                          {accionesProyecto(proyecto)}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {proyectos && proyectosFiltrados.length > 0 ? (
                <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3.5 sm:px-6.5">
                  <span className="text-muted-foreground text-xs">
                    Mostrando {inicioProyectos + 1}–
                    {Math.min(
                      inicioProyectos + LOTES_POR_PAGINA,
                      proyectosFiltrados.length
                    )}{" "}
                    de {proyectosFiltrados.length}
                  </span>
                  <Pagination
                    page={paginaActualProyectos}
                    totalPages={totalPaginasProyectos}
                    onPageChange={setPaginaProyectos}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <LoteFormSheet
        lote={loteEnEdicion}
        open={formularioAbierto}
        onOpenChange={setFormularioAbierto}
        onGuardado={(lote) => {
          if (loteEnEdicion) {
            actualizarEnLista(lote)
          } else {
            setLotes((actual) => (actual ? [lote, ...actual] : [lote]))
          }
        }}
      />

      <LoteEstadoSheet
        lote={loteEstado}
        onOpenChange={(open) => {
          if (!open) setLoteEstado(null)
        }}
        onGuardado={(lote) => {
          actualizarEnLista(lote)
          setLoteEstado(null)
        }}
      />

      <ProyectoFormSheet
        proyecto={proyectoEnEdicion}
        open={formularioProyectoAbierto}
        onOpenChange={setFormularioProyectoAbierto}
        onGuardado={(proyecto) => {
          if (proyectoEnEdicion) {
            actualizarProyectoEnLista(proyecto)
          } else {
            // Al final: un proyecto nuevo no tiene orden asignado y el backend lo lista
            // después de los ordenados (ver "Ordenar").
            setProyectos((actual) => (actual ? [...actual, proyecto] : [proyecto]))
          }
        }}
      />

      <ImportarLotesSheet
        open={importarAbierto}
        onOpenChange={setImportarAbierto}
        proyectos={proyectos ?? []}
        onImportado={() => {
          // Lotes nuevos y stock de los proyectos cambian: se recarga todo.
          cargarInventario()
          cargarProyectos()
        }}
      />

      <OrdenarProyectosSheet
        open={ordenarAbierto}
        onOpenChange={setOrdenarAbierto}
        proyectos={proyectos ?? []}
        onGuardado={setProyectos}
      />
    </div>
  )
}
