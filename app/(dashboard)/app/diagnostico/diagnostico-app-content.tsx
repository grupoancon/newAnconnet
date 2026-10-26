"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Layers,
  RefreshCw,
  Search,
  TriangleAlert,
  UserX,
  Users,
} from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  listarEventos,
  listarGruposError,
  obtenerResumen,
  obtenerTendencias,
  TelemetriaApiError,
} from "@/lib/api/telemetria-api"
import { cn } from "@/lib/utils"

import {
  NIVEL_LABELS,
  type Evento,
  type GrupoError,
  type Nivel,
  type Resumen,
  type Tendencias,
  type Ventana,
} from "./datos"
import {
  DetalleDiagnosticoSheet,
  type SeleccionDiagnostico,
} from "./detalle-diagnostico-sheet"
import { haceCuanto, VARIANTE_NIVEL } from "./formato"
import { GraficoTendencia, LeyendaErrores, ListaBarras } from "./graficos"
import { VistaUsuario } from "./vista-usuario"

const TITULOS_PESTANA: Record<Pestana, string> = {
  errores: "Errores agrupados",
  eventos: "Todos los eventos",
  usuario: "Interacciones por usuario",
}

type Pestana = "errores" | "eventos" | "usuario"

const EVENTOS_POR_PAGINA = 60

function mensajeDeError(err: unknown): string {
  return err instanceof TelemetriaApiError
    ? err.message
    : "No se pudo conectar con el servidor"
}

const COLUMNAS_GRUPOS =
  "md:grid-cols-[minmax(0,2.6fr)_70px_70px_minmax(0,1.2fr)_minmax(0,0.9fr)_90px_20px] md:min-w-[920px]"
const COLUMNAS_EVENTOS =
  "md:grid-cols-[110px_minmax(0,2.4fr)_minmax(0,1fr)_110px_minmax(0,1fr)_90px_20px] md:min-w-[920px]"

export function DiagnosticoAppContent() {
  const toast = useToast()
  const [ventana, setVentana] = useState<Ventana>("24h")
  const [pestana, setPestana] = useState<Pestana>("errores")
  const [busqueda, setBusqueda] = useState("")
  const [nivelGrupos, setNivelGrupos] = useState<"todos" | "error" | "warn">("todos")
  const [nivelEventos, setNivelEventos] = useState<"todos" | Nivel>("todos")
  const [seleccion, setSeleccion] = useState<SeleccionDiagnostico | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  // Desde el detalle de cualquier evento: "ver todas las interacciones de este usuario".
  function verUsuario(id: string) {
    setSeleccion(null)
    setUsuarioId(id)
    setPestana("usuario")
  }

  // Se incrementa con el botón "Actualizar" para volver a pedir todo.
  const [recarga, setRecarga] = useState(0)

  const [resumenCompleto, setResumenCompleto] = useState<Resumen | null>(null)
  const [tendencias, setTendencias] = useState<Tendencias | null>(null)
  const [errorPanel, setErrorPanel] = useState<string | null>(null)

  const [grupos, setGrupos] = useState<GrupoError[] | null>(null)
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [hayMasEventos, setHayMasEventos] = useState(false)
  const [paginaEventos, setPaginaEventos] = useState(1)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorLista, setErrorLista] = useState<string | null>(null)

  // La búsqueda va al backend (LIKE sobre el mensaje): se espera a que el usuario deje
  // de escribir para no disparar una consulta por tecla.
  const [termino, setTermino] = useState("")
  useEffect(() => {
    const id = setTimeout(() => setTermino(busqueda.trim()), 350)
    return () => clearTimeout(id)
  }, [busqueda])

  useEffect(() => {
    let vigente = true
    setErrorPanel(null)
    Promise.all([obtenerResumen(), obtenerTendencias(ventana)])
      .then(([r, t]) => {
        if (!vigente) return
        setResumenCompleto(r)
        setTendencias(t)
      })
      .catch((err) => vigente && setErrorPanel(mensajeDeError(err)))
    return () => {
      vigente = false
    }
  }, [ventana, recarga])

  useEffect(() => {
    if (pestana === "usuario") return
    let vigente = true
    setErrorLista(null)
    if (pestana === "errores") {
      setGrupos(null)
      listarGruposError({
        ventana,
        busqueda: termino,
        nivel: nivelGrupos === "todos" ? undefined : nivelGrupos,
      })
        .then((filas) => vigente && setGrupos(filas))
        .catch((err) => vigente && setErrorLista(mensajeDeError(err)))
    } else {
      setEventos(null)
      setPaginaEventos(1)
      listarEventos({
        ventana,
        busqueda: termino,
        nivel: nivelEventos === "todos" ? undefined : nivelEventos,
        limite: EVENTOS_POR_PAGINA,
      })
        .then(({ eventos: filas, hayMas }) => {
          if (!vigente) return
          setEventos(filas)
          setHayMasEventos(hayMas)
        })
        .catch((err) => vigente && setErrorLista(mensajeDeError(err)))
    }
    return () => {
      vigente = false
    }
  }, [pestana, ventana, termino, nivelGrupos, nivelEventos, recarga])

  async function cargarMasEventos() {
    const siguiente = paginaEventos + 1
    setCargandoMas(true)
    try {
      const { eventos: filas, hayMas } = await listarEventos({
        ventana,
        busqueda: termino,
        nivel: nivelEventos === "todos" ? undefined : nivelEventos,
        limite: EVENTOS_POR_PAGINA,
        pagina: siguiente,
      })
      setEventos((actuales) => [...(actuales ?? []), ...filas])
      setHayMasEventos(hayMas)
      setPaginaEventos(siguiente)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setCargandoMas(false)
    }
  }

  const resumen = resumenCompleto
    ? ventana === "24h"
      ? resumenCompleto.last24h
      : resumenCompleto.last7d
    : null

  const totalErroresSerie = (tendencias?.series ?? []).reduce(
    (acc, p) => acc + p.errores,
    0
  )
  const totalAdvertenciasSerie = (tendencias?.series ?? []).reduce(
    (acc, p) => acc + p.advertencias,
    0
  )

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 space-y-4.5 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
              App · Diagnóstico
            </div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-[23px]">
              Diagnóstico de la app
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <PillTabs
              tabs={[
                { id: "24h", label: "Últimas 24 h" },
                { id: "7d", label: "Últimos 7 días" },
              ]}
              value={ventana}
              onChange={(id) => setVentana(id as Ventana)}
            />
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Actualizar"
              onClick={() => setRecarga((n) => n + 1)}
            >
              <RefreshCw className="size-3.5" strokeWidth={1.8} />
            </Button>
          </div>
        </div>

        {errorPanel ? (
          <EmptyState
            title="No se pudo cargar la telemetría"
            description={errorPanel}
            dashed
          />
        ) : null}

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi
            titulo="Errores"
            valor={resumen?.error ?? null}
            icono={<AlertTriangle className="size-[15px]" strokeWidth={1.6} />}
            tono="error"
          />
          <Kpi
            titulo="Advertencias"
            valor={resumen?.warn ?? null}
            icono={<TriangleAlert className="size-[15px]" strokeWidth={1.6} />}
            tono="warn"
          />
          <Kpi
            titulo="Sesiones con error"
            valor={resumen?.errorSessions ?? null}
            icono={<Layers className="size-[15px]" strokeWidth={1.6} />}
            tono="error"
          />
          <Kpi
            titulo="Usuarios afectados"
            valor={resumen?.errorUsers ?? null}
            icono={<UserX className="size-[15px]" strokeWidth={1.6} />}
            tono="error"
          />
          <Kpi
            titulo="Eventos"
            valor={resumen?.event ?? null}
            icono={<Activity className="size-[15px]" strokeWidth={1.6} />}
            tono="neutro"
          />
          <Kpi
            titulo="Total registros"
            valor={resumen?.total ?? null}
            icono={<Users className="size-[15px]" strokeWidth={1.6} />}
            tono="neutro"
          />
        </div>

        {/* Gráficos */}
        <div className="bg-card border-border rounded-lg border p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold">Errores y advertencias en el tiempo</h2>
              <p className="text-muted-foreground text-xs">
                {tendencias?.granularity === "day" ? "Por día" : "Por hora"}
              </p>
            </div>
            <LeyendaErrores
              errores={totalErroresSerie}
              advertencias={totalAdvertenciasSerie}
            />
          </div>
          {tendencias ? <GraficoTendencia tendencias={tendencias} /> : <Cargando />}
        </div>

        <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-3">
          <TarjetaGrafico titulo="Pantallas con más errores">
            {tendencias ? <ListaBarras datos={tendencias.byScreen} /> : <Cargando />}
          </TarjetaGrafico>
          <TarjetaGrafico titulo="Errores por plataforma">
            {tendencias ? <ListaBarras datos={tendencias.byPlatform} /> : <Cargando />}
          </TarjetaGrafico>
          <TarjetaGrafico titulo="Errores por versión de la app">
            {tendencias ? <ListaBarras datos={tendencias.byVersion} /> : <Cargando />}
          </TarjetaGrafico>
        </div>

        {/* Errores agrupados / Todos los eventos / Por usuario */}
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            title={TITULOS_PESTANA[pestana]}
            actions={
              <PillTabs
                tabs={[
                  { id: "errores", label: "Errores agrupados" },
                  { id: "eventos", label: "Todos los eventos" },
                  { id: "usuario", label: "Por usuario" },
                ]}
                value={pestana}
                onChange={(id) => setPestana(id as Pestana)}
              />
            }
          />

          {pestana === "usuario" ? (
            <VistaUsuario
              usuarioId={usuarioId}
              onCambiarUsuario={setUsuarioId}
              onAbrirEvento={(evento) => setSeleccion({ tipo: "evento", evento })}
            />
          ) : (
            <>
              <FilterBar className="flex-wrap">
                <div className="border-input bg-card focus-within:border-primary focus-within:ring-ring/15 flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-md border px-3 focus-within:ring-3 sm:w-72 sm:flex-none">
                  <Search
                    className="text-muted-foreground size-[15px] shrink-0"
                    strokeWidth={1.7}
                  />
                  <input
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder={
                      pestana === "errores"
                        ? "Buscar en el mensaje del error…"
                        : "Buscar en el mensaje del evento…"
                    }
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
                  />
                </div>
                <div className="w-full sm:w-56">
                  {pestana === "errores" ? (
                    <SelectField
                      placeholder="Nivel"
                      opciones={[
                        { value: "todos", label: "Errores y advertencias" },
                        { value: "error", label: "Solo errores" },
                        { value: "warn", label: "Solo advertencias" },
                      ]}
                      value={nivelGrupos}
                      onValueChange={(v) =>
                        setNivelGrupos(v as "todos" | "error" | "warn")
                      }
                    />
                  ) : (
                    <SelectField
                      placeholder="Nivel"
                      opciones={[
                        { value: "todos", label: "Todos los niveles" },
                        { value: "event", label: "Eventos (analítica)" },
                        { value: "error", label: "Errores" },
                        { value: "warn", label: "Advertencias" },
                        { value: "info", label: "Info" },
                        { value: "debug", label: "Debug" },
                      ]}
                      value={nivelEventos}
                      onValueChange={(v) => setNivelEventos(v as "todos" | Nivel)}
                    />
                  )}
                </div>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {pestana === "errores"
                    ? grupos
                      ? `${grupos.length} grupos`
                      : "…"
                    : eventos
                      ? `${eventos.length}${hayMasEventos ? "+" : ""} eventos`
                      : "…"}
                </span>
              </FilterBar>

              {errorLista ? (
                <div className="p-4 sm:p-6.5">
                  <EmptyState title="No se pudo cargar" description={errorLista} dashed />
                </div>
              ) : pestana === "errores" ? (
                !grupos ? (
                  <Cargando />
                ) : grupos.length === 0 ? (
                  <div className="p-4 sm:p-6.5">
                    <EmptyState
                      title="Sin errores"
                      description="No hay errores en el periodo seleccionado."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Encabezado columnas={COLUMNAS_GRUPOS}>
                      <span>MENSAJE</span>
                      <span className="text-right">OCURR.</span>
                      <span className="text-right">USUARIOS</span>
                      <span>PANTALLAS</span>
                      <span>VERSIÓN</span>
                      <span>ÚLTIMA VEZ</span>
                      <span />
                    </Encabezado>
                    {grupos.map((g, i) => (
                      <FilaClicable
                        key={g.message}
                        columnas={COLUMNAS_GRUPOS}
                        ultima={i === grupos.length - 1}
                        onClick={() => setSeleccion({ tipo: "grupo", grupo: g })}
                      >
                        <span className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
                          <StatusBadge variant={g.errors > 0 ? "bloqueado" : "pendiente"}>
                            {g.errors > 0 ? "Error" : "Advertencia"}
                          </StatusBadge>
                          <span className="truncate font-medium">{g.message}</span>
                        </span>
                        <span className="font-mono text-xs md:text-right md:text-[13px]">
                          <span className="text-muted-foreground font-sans md:hidden">
                            Ocurr.:{" "}
                          </span>
                          {g.count}
                        </span>
                        <span className="font-mono text-xs md:text-right md:text-[13px]">
                          <span className="text-muted-foreground font-sans md:hidden">
                            Usuarios:{" "}
                          </span>
                          {g.users}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {g.screens.join(", ") || "—"}
                        </span>
                        <span className="text-muted-foreground truncate font-mono text-xs">
                          {g.versions.join(", ") || "—"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {haceCuanto(g.lastSeen)}
                        </span>
                        <Flecha />
                      </FilaClicable>
                    ))}
                  </div>
                )
              ) : !eventos ? (
                <Cargando />
              ) : eventos.length === 0 ? (
                <div className="p-4 sm:p-6.5">
                  <EmptyState
                    title="Sin eventos"
                    description="No hay eventos en el periodo seleccionado."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Encabezado columnas={COLUMNAS_EVENTOS}>
                    <span>NIVEL</span>
                    <span>MENSAJE</span>
                    <span>PANTALLA</span>
                    <span>USUARIO</span>
                    <span>ORIGEN</span>
                    <span>HORA</span>
                    <span />
                  </Encabezado>
                  {eventos.map((e, i) => (
                    <FilaClicable
                      key={e.id}
                      columnas={COLUMNAS_EVENTOS}
                      ultima={i === eventos.length - 1}
                      onClick={() => setSeleccion({ tipo: "evento", evento: e })}
                    >
                      <span>
                        <StatusBadge variant={VARIANTE_NIVEL[e.level]}>
                          {NIVEL_LABELS[e.level]}
                        </StatusBadge>
                      </span>
                      <span className="col-span-2 truncate font-medium md:col-span-1">
                        {e.message}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {e.screen ?? "—"}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {e.userId ?? "anónimo"}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {[e.platform, e.appVersion].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {haceCuanto(e.receivedAt)}
                      </span>
                      <Flecha />
                    </FilaClicable>
                  ))}
                  {hayMasEventos ? (
                    <div className="border-border border-t p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cargandoMas}
                        onClick={cargarMasEventos}
                      >
                        {cargandoMas ? "Cargando…" : "Cargar más"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <DetalleDiagnosticoSheet
        seleccion={seleccion}
        onOpenChange={(abierto) => !abierto && setSeleccion(null)}
        onVerUsuario={verUsuario}
      />
    </div>
  )
}

const TONOS = {
  error: {
    fondo: "bg-status-bloqueado-bg",
    texto: "text-status-bloqueado-fg",
    borde: "border-l-status-bloqueado",
  },
  warn: {
    fondo: "bg-status-reservado-bg",
    texto: "text-status-reservado-fg",
    borde: "border-l-status-reservado",
  },
  neutro: {
    fondo: "bg-accent",
    texto: "text-accent-foreground",
    borde: "border-l-primary",
  },
}

function Kpi({
  titulo,
  valor,
  icono,
  tono,
}: {
  titulo: string
  valor: number | null
  icono: React.ReactNode
  tono: keyof typeof TONOS
}) {
  const t = TONOS[tono]
  return (
    <div
      className={cn(
        "bg-card border-border rounded-lg border border-l-[3px] p-4",
        t.borde
      )}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-7.5 items-center justify-center rounded-md",
            t.fondo,
            t.texto
          )}
        >
          {icono}
        </div>
        <span className="text-muted-foreground text-[12.5px] leading-tight font-bold">
          {titulo}
        </span>
      </div>
      <div className="font-mono text-2xl font-semibold">
        {valor == null ? "—" : new Intl.NumberFormat("es-EC").format(valor)}
      </div>
    </div>
  )
}

function Cargando() {
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner />
    </div>
  )
}

function TarjetaGrafico({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border-border rounded-lg border p-4 shadow-sm sm:p-5">
      <h2 className="mb-3.5 text-sm font-bold">{titulo}</h2>
      {children}
    </div>
  )
}

function Encabezado({
  columnas,
  children,
}: {
  columnas: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground bg-muted/60 border-border hidden gap-x-3 border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide md:grid",
        columnas
      )}
    >
      {children}
    </div>
  )
}

function FilaClicable({
  columnas,
  ultima,
  onClick,
  children,
}: {
  columnas: string
  ultima: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover:bg-muted/60 group grid w-full grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left text-[13px] transition-colors md:gap-y-0 md:px-6.5",
        columnas,
        !ultima && "border-border border-b"
      )}
    >
      {children}
    </button>
  )
}

function Flecha() {
  return (
    <ChevronRight
      className="text-muted-foreground group-hover:text-primary hidden size-4 transition-colors md:block"
      strokeWidth={1.8}
    />
  )
}
