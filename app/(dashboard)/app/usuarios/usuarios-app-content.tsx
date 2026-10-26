"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  LogOut,
  MoreVertical,
  PackageCheck,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { PillTabs } from "@/components/shared/pill-tabs"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { CerrarSesionSheet, LoteEntregadoSheet } from "./acciones-usuario-app-sheets"
import { AgregarUsuarioAppSheet } from "./agregar-usuario-app-sheet"
import {
  ESTADO_LABELS,
  USUARIOS_ELIMINADOS_EJEMPLO,
  USUARIOS_EJEMPLO,
  type EstadoUsuarioApp,
  type UsuarioApp,
} from "./datos"
import { EditarUsuarioAppSheet } from "./editar-usuario-app-sheet"
import { formatearFecha, iniciales } from "./formato"

const POR_PAGINA = 8

type Pestana = "todos" | "activo" | "eliminados"
type FiltroReservas = "todos" | "si" | "faltantes"

const VARIANTE_ESTADO: Record<EstadoUsuarioApp, StatusVariant> = {
  activo: "disponible",
  inactivo: "pronto",
  archivado: "pendiente",
  eliminado: "bloqueado",
}

const COLUMNAS =
  "md:grid-cols-[2fr_1.1fr_1.2fr_1fr_1fr_1fr_0.9fr_44px] md:min-w-[1040px]"

export function UsuariosAppContent() {
  const toast = useToast()
  // PENDIENTE: reemplazar por la carga real (ver encabezado de ./datos.ts).
  const usuarios = USUARIOS_EJEMPLO
  const eliminados = USUARIOS_ELIMINADOS_EJEMPLO

  const [pestana, setPestana] = useState<Pestana>("todos")
  const [busqueda, setBusqueda] = useState("")
  const [pagina, setPagina] = useState(1)
  const [proyectos, setProyectos] = useState<string[]>([])
  const [reservas, setReservas] = useState<FiltroReservas>("todos")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")

  const [agregarAbierto, setAgregarAbierto] = useState(false)
  const [enEdicion, setEnEdicion] = useState<UsuarioApp | null>(null)
  const [enEntrega, setEnEntrega] = useState<UsuarioApp | null>(null)
  const [enCierre, setEnCierre] = useState<UsuarioApp | null>(null)
  const [aEliminar, setAEliminar] = useState<UsuarioApp | null>(null)

  const proyectosDisponibles = useMemo(
    () => Array.from(new Set(usuarios.map((u) => u.proyecto).filter(Boolean))).sort(),
    [usuarios]
  )

  const filtrosActivos =
    proyectos.length + (reservas !== "todos" ? 1 : 0) + (desde || hasta ? 1 : 0)

  const esEliminados = pestana === "eliminados"
  const fuente = esEliminados ? eliminados : usuarios

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return fuente.filter((u) => {
      if (pestana === "activo" && u.estado !== "activo") return false
      if (
        termino &&
        ![u.nombre, u.cedula, ...u.lotes].some((campo) =>
          campo.toLowerCase().includes(termino)
        )
      ) {
        return false
      }
      if (proyectos.length > 0 && !proyectos.includes(u.proyecto)) return false
      if (reservas === "si" && u.enReservas !== true) return false
      if (reservas === "faltantes" && !(u.requiereReservas && u.enReservas === false)) {
        return false
      }
      const registro = new Date(u.fechaCreacion)
      if (desde && registro < new Date(desde)) return false
      if (hasta && registro > new Date(`${hasta}T23:59:59`)) return false
      return true
    })
  }, [fuente, pestana, busqueda, proyectos, reservas, desde, hasta])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)

  const kpis = {
    total: usuarios.length,
    activos: usuarios.filter((u) => u.estado === "activo").length,
    faltanReservas: usuarios.filter((u) => u.requiereReservas && u.enReservas === false)
      .length,
    eliminados: eliminados.length,
  }

  function cambiarFiltro(aplicar: () => void) {
    aplicar()
    setPagina(1)
  }

  function alternarProyecto(proyecto: string) {
    cambiarFiltro(() =>
      setProyectos((actual) =>
        actual.includes(proyecto)
          ? actual.filter((p) => p !== proyecto)
          : [...actual, proyecto]
      )
    )
  }

  function limpiarFiltros() {
    cambiarFiltro(() => {
      setProyectos([])
      setReservas("todos")
      setDesde("")
      setHasta("")
    })
  }

  function avisoPendiente() {
    toast({
      variant: "info",
      title: "Aún no disponible",
      description: "Esta acción se conectará próximamente.",
    })
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 space-y-4.5 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Kpi
            icono={<Smartphone className="text-accent-foreground size-[15px]" strokeWidth={1.6} />}
            fondoIcono="bg-accent"
            borde="border-l-primary"
            titulo="Usuarios"
            valor={kpis.total}
            detalle="Con cuenta en la app"
          />
          <Kpi
            icono={
              <CheckCircle2 className="text-status-disponible-fg size-[15px]" strokeWidth={1.6} />
            }
            fondoIcono="bg-status-disponible-bg"
            borde="border-l-status-disponible"
            titulo="Activos"
            valor={kpis.activos}
            detalle="Pueden iniciar sesión"
          />
          <Kpi
            icono={
              <AlertTriangle className="text-status-reservado-fg size-[15px]" strokeWidth={1.6} />
            }
            fondoIcono="bg-status-reservado-bg"
            borde="border-l-status-reservado"
            titulo="Faltan en reservas"
            valor={kpis.faltanReservas}
            detalle="Lotes G-/F- sin registrar"
          />
          <Kpi
            icono={<Trash2 className="text-status-bloqueado-fg size-[15px]" strokeWidth={1.6} />}
            fondoIcono="bg-status-bloqueado-bg"
            borde="border-l-status-bloqueado"
            titulo="Eliminados"
            valor={kpis.eliminados}
            detalle="Se pueden reactivar"
          />
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="App · Gestión de usuarios"
            title="Usuarios de la app"
            actions={
              <Button size="sm" onClick={() => setAgregarAbierto(true)}>
                <UserPlus className="size-3.5" strokeWidth={2} />
                Agregar usuario
              </Button>
            }
          />

          <FilterBar className="flex-wrap">
            <PillTabs
              tabs={[
                { id: "todos", label: "Todos" },
                { id: "activo", label: "Activos" },
                { id: "eliminados", label: "Eliminados" },
              ]}
              value={pestana}
              onChange={(id) => cambiarFiltro(() => setPestana(id as Pestana))}
            />

            <div className="border-input bg-card focus-within:border-primary focus-within:ring-ring/15 flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-md border px-3 focus-within:ring-3 sm:w-65 sm:flex-none">
              <Search className="text-muted-foreground size-[15px] shrink-0" strokeWidth={1.7} />
              <input
                value={busqueda}
                onChange={(event) => cambiarFiltro(() => setBusqueda(event.target.value))}
                placeholder="Buscar por nombre, cédula o lote…"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative h-[38px]">
                  <SlidersHorizontal className="size-3.5" strokeWidth={1.8} />
                  Filtros
                  {filtrosActivos > 0 ? (
                    <span className="bg-brand-gradient absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold text-white">
                      {filtrosActivos}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4 p-4">
                <div>
                  <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wide uppercase">
                    Proyecto
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {proyectosDisponibles.map((proyecto) => {
                      const activo = proyectos.includes(proyecto)
                      return (
                        <button
                          key={proyecto}
                          type="button"
                          onClick={() => alternarProyecto(proyecto)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                            activo
                              ? "bg-brand-gradient border-transparent text-white"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {proyecto}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wide uppercase">
                    Fecha de registro
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={desde}
                      onChange={(event) => cambiarFiltro(() => setDesde(event.target.value))}
                      aria-label="Desde"
                      className="border-input bg-card focus:border-primary h-9 w-full rounded-md border px-2 text-xs outline-none"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input
                      type="date"
                      value={hasta}
                      onChange={(event) => cambiarFiltro(() => setHasta(event.target.value))}
                      aria-label="Hasta"
                      className="border-input bg-card focus:border-primary h-9 w-full rounded-md border px-2 text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wide uppercase">
                    En reservas (lotes G-/F-)
                  </p>
                  <PillTabs
                    className="w-full"
                    tabs={[
                      { id: "todos", label: "Todos" },
                      { id: "si", label: "Sí" },
                      { id: "faltantes", label: "Faltantes" },
                    ]}
                    value={reservas}
                    onChange={(id) => cambiarFiltro(() => setReservas(id as FiltroReservas))}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={filtrosActivos === 0}
                  onClick={limpiarFiltros}
                >
                  Limpiar filtros
                </Button>
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {filtrados.length} usuarios
            </span>
          </FilterBar>

          {filtrosActivos > 0 ? (
            <div className="bg-accent/40 border-border flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-6">
              {proyectos.map((proyecto) => (
                <ChipFiltro key={proyecto} onQuitar={() => alternarProyecto(proyecto)}>
                  {proyecto}
                </ChipFiltro>
              ))}
              {reservas !== "todos" ? (
                <ChipFiltro onQuitar={() => cambiarFiltro(() => setReservas("todos"))}>
                  En reservas: {reservas === "si" ? "Sí" : "Faltantes"}
                </ChipFiltro>
              ) : null}
              {desde || hasta ? (
                <ChipFiltro
                  onQuitar={() =>
                    cambiarFiltro(() => {
                      setDesde("")
                      setHasta("")
                    })
                  }
                >
                  Registro: {desde ? formatearFecha(`${desde}T00:00:00`) : "…"} –{" "}
                  {hasta ? formatearFecha(`${hasta}T00:00:00`) : "…"}
                </ChipFiltro>
              ) : null}
              <button
                type="button"
                onClick={limpiarFiltros}
                className="text-muted-foreground hover:text-foreground ml-1 text-[11.5px] font-bold"
              >
                Limpiar todo
              </button>
            </div>
          ) : null}

          {visibles.length === 0 ? (
            <div className="p-4 sm:p-6.5">
              <EmptyState
                title="Sin resultados"
                description="Ningún usuario coincide con la búsqueda o los filtros."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div
                className={cn(
                  "text-muted-foreground bg-muted/60 border-border hidden border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide md:grid",
                  COLUMNAS
                )}
              >
                <span>USUARIO</span>
                <span>LOTES</span>
                <span>PROYECTO</span>
                <span>DOCUMENTO</span>
                <span>REGISTRO</span>
                <span>{esEliminados ? "ELIMINADO" : "ÚLT. CONEXIÓN"}</span>
                <span>ESTADO</span>
                <span />
              </div>

              {visibles.map((usuario, index) => {
                const faltaEnReservas = usuario.requiereReservas && usuario.enReservas === false
                return (
                  <div
                    key={usuario.id}
                    className={cn(
                      "hover:bg-muted/60 grid grid-cols-2 items-center gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] transition-colors md:gap-y-0 md:px-6.5",
                      COLUMNAS,
                      index < visibles.length - 1 && "border-border border-b"
                    )}
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                      <Avatar className="size-8.5">
                        <AvatarFallback className="bg-accent text-accent-foreground text-[11px] font-bold">
                          {iniciales(usuario.nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{usuario.nombre}</p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {usuario.cedula}
                          {usuario.rol === "admin" ? (
                            <span className="text-accent-foreground ml-1.5 font-sans font-semibold">
                              · Admin
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-muted-foreground font-sans text-[11px] md:hidden">
                        Lotes:
                      </span>
                      {usuario.lotes.join(", ") || "—"}
                      {faltaEnReservas ? (
                        <span
                          title="Requiere reservas pero no está registrado ahí"
                          aria-label="Requiere reservas pero no está registrado ahí"
                          role="img"
                        >
                          <AlertTriangle
                            className="text-status-bloqueado-fg size-3.5 shrink-0"
                            strokeWidth={2}
                          />
                        </span>
                      ) : null}
                    </div>

                    <span className="text-muted-foreground truncate text-xs md:text-[13px] md:text-inherit">
                      {usuario.proyecto || "—"}
                    </span>
                    <span className="hidden font-mono text-xs md:block">
                      {usuario.documentNumber || "—"}
                    </span>
                    <span className="hidden text-xs md:block">
                      {formatearFecha(usuario.fechaCreacion)}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs md:text-inherit">
                      <CalendarClock className="size-3.5 md:hidden" strokeWidth={1.7} />
                      {formatearFecha(
                        esEliminados ? usuario.fechaEliminacion : usuario.ultimaConexion
                      )}
                    </span>
                    <span>
                      <StatusBadge variant={VARIANTE_ESTADO[usuario.estado]}>
                        {ESTADO_LABELS[usuario.estado]}
                      </StatusBadge>
                    </span>

                    <div className="justify-self-end">
                      {esEliminados ? (
                        <Button variant="outline" size="sm" onClick={avisoPendiente}>
                          <RotateCcw className="size-3.5" strokeWidth={1.8} />
                          Reactivar
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Acciones de ${usuario.nombre}`}
                            >
                              <MoreVertical className="size-4" strokeWidth={1.8} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => setEnEdicion(usuario)}>
                              <Pencil strokeWidth={1.8} />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEnEntrega(usuario)}>
                              <PackageCheck strokeWidth={1.8} />
                              Lote entregado
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEnCierre(usuario)}>
                              <LogOut strokeWidth={1.8} />
                              Cerrar sesión
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setAEliminar(usuario)}
                            >
                              <Trash2 strokeWidth={1.8} />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {totalPaginas > 1 ? (
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
              <span className="text-muted-foreground text-xs">
                Página {paginaActual} de {totalPaginas}
              </span>
              <Pagination
                page={paginaActual}
                totalPages={totalPaginas}
                onPageChange={setPagina}
              />
            </div>
          ) : null}
        </div>
      </div>

      <AgregarUsuarioAppSheet
        open={agregarAbierto}
        onOpenChange={setAgregarAbierto}
        usuarios={usuarios}
      />
      <EditarUsuarioAppSheet
        usuario={enEdicion}
        onOpenChange={(abierto) => !abierto && setEnEdicion(null)}
      />
      <LoteEntregadoSheet
        usuario={enEntrega}
        onOpenChange={(abierto) => !abierto && setEnEntrega(null)}
      />
      <CerrarSesionSheet
        usuario={enCierre}
        onOpenChange={(abierto) => !abierto && setEnCierre(null)}
      />
      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo={`¿Eliminar a ${aEliminar?.nombre ?? ""}?`}
        descripcion='Pasará a la pestaña "Eliminados" y no podrá volver a iniciar sesión en la app. Se puede reactivar después.'
        textoConfirmar="Eliminar"
        destructivo
        onConfirmar={() => {
          setAEliminar(null)
          avisoPendiente()
        }}
        onCancelar={() => setAEliminar(null)}
      />
    </div>
  )
}

function Kpi({
  icono,
  fondoIcono,
  borde,
  titulo,
  valor,
  detalle,
}: {
  icono: React.ReactNode
  fondoIcono: string
  borde: string
  titulo: string
  valor: number
  detalle: string
}) {
  return (
    <div className={cn("bg-card border-border rounded-lg border border-l-[3px] p-4", borde)}>
      <div className="mb-2 flex items-center gap-2.5">
        <div className={cn("flex size-7.5 items-center justify-center rounded-md", fondoIcono)}>
          {icono}
        </div>
        <span className="text-muted-foreground text-[12.5px] font-bold">{titulo}</span>
      </div>
      <div className="font-mono text-2xl font-semibold">{valor}</div>
      <div className="text-muted-foreground text-[11.5px]">{detalle}</div>
    </div>
  )
}

function ChipFiltro({
  children,
  onQuitar,
}: {
  children: React.ReactNode
  onQuitar: () => void
}) {
  return (
    <span className="bg-card border-border text-accent-foreground inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-2.5 text-[11.5px] font-semibold">
      {children}
      <button
        type="button"
        onClick={onQuitar}
        aria-label="Quitar filtro"
        className="hover:bg-muted rounded-full p-0.5"
      >
        <X className="size-3" strokeWidth={2} />
      </button>
    </span>
  )
}
