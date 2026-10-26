"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  Search,
  XCircle,
} from "lucide-react"

import { useCan } from "@/components/shared/can"
import { usePresencia } from "@/components/shared/presencia-provider"
import { useSession } from "@/components/shared/session-provider"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
import { ANIOS, MESES } from "@/components/shared/select-options"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DepositosApiError,
  listarDepositos,
  type DepositoBackend,
  type DepositoResumen,
  type LoteRelacionado,
} from "@/lib/api/depositos-api"
import { cn } from "@/lib/utils"

import { CambiarEstadoSheet } from "./cambiar-estado-sheet"
import { DepositoCard } from "./deposito-card"
import { DepositoDetalleSheet } from "./deposito-detalle-sheet"
import {
  MESES_NOMBRES,
  calcularEstadoDeposito,
  lotesSoloEnResumen,
  numeroReciboDeposito,
  parsearResumen,
  type EstadoDeposito,
} from "./depositos-utils"
import { DevolverLoteSheet } from "./devolver-lote-sheet"
import { RegistrarLoteSheet } from "./registrar-lote-sheet"
import { ResumenSheet } from "./resumen-sheet"
import { useDepositosSocket } from "./use-depositos-socket"

// Ruta -> nombre legible para la lista de presencia. Lo que no conozca se muestra tal
// cual la ruta, que igual dice dónde está.
function nombreModulo(ruta: string): string {
  if (ruta.startsWith("/tesoreria/depositos")) return "Registro de depósitos"
  if (ruta.startsWith("/tesoreria")) return "Tesorería"
  if (ruta === "/") return "Inicio"
  return ruta
}

type TabId = "pendientes" | "registrados" | "devueltos"

const TAB_A_ESTADO: Record<TabId, EstadoDeposito> = {
  pendientes: "Pendiente",
  registrados: "Aprobado",
  devueltos: "Devuelto",
}

const VACIO: Record<
  TabId,
  { titulo: string; descripcion: string; icono: typeof CheckCircle2; color: string }
> = {
  pendientes: {
    titulo: "No hay depósitos pendientes",
    descripcion: "Todos los depósitos han sido procesados",
    icono: CheckCircle2,
    color: "text-status-disponible-fg",
  },
  registrados: {
    titulo: "No hay depósitos registrados aún",
    descripcion: "Los depósitos aprobados aparecerán aquí",
    icono: Clock,
    color: "text-status-reservado-fg",
  },
  devueltos: {
    titulo: "No hay depósitos devueltos",
    descripcion: "Los depósitos devueltos aparecerán aquí",
    icono: XCircle,
    color: "text-status-bloqueado-fg",
  },
}

export function DepositosContent() {
  const toast = useToast()
  // Aprobar/devolver/cambiar estado mueve dinero registrado: se oculta a quien solo
  // tiene "depositos:ver" (la verificación real es del backend; esto es UX).
  const puedeGestionar = useCan("depositos:gestionar")
  const usuario = useSession()

  const [depositos, setDepositos] = useState<DepositoBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<TabId>("pendientes")
  const [anio, setAnio] = useState("Todos")
  const [mes, setMes] = useState("Todos")
  const [busqueda, setBusqueda] = useState("")
  const [dosColumnas, setDosColumnas] = useState(true)

  const [detalle, setDetalle] = useState<DepositoBackend | null>(null)
  const [resumen, setResumen] = useState<DepositoResumen | null>(null)
  const [paraRegistrar, setParaRegistrar] = useState<LoteRelacionado | null>(null)
  const [paraDevolver, setParaDevolver] = useState<LoteRelacionado | null>(null)
  const [paraCambiarEstado, setParaCambiarEstado] = useState<LoteRelacionado | null>(null)

  const cargar = useCallback(async () => {
    try {
      const data = await listarDepositos()
      setDepositos(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      setError(
        err instanceof DepositosApiError
          ? err.message
          : "No se pudo cargar la información."
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const { enLinea } = usePresencia()
  const { conectado, marcarEnRevision } = useDepositosSocket({
    onNuevoDeposito: () => {
      void cargar()
      toast({
        variant: "info",
        description: "Nuevo depósito recibido: se registró un nuevo comprobante.",
      })
    },
  })

  const conEstado = useMemo(
    () =>
      depositos.map((deposito) => ({
        deposito,
        estado: calcularEstadoDeposito(deposito.lotes_relacionados),
      })),
    [depositos]
  )

  const conteo = useMemo(
    () => ({
      pendientes: conEstado.filter((item) => item.estado === "Pendiente").length,
      registrados: conEstado.filter((item) => item.estado === "Aprobado").length,
      devueltos: conEstado.filter((item) => item.estado === "Devuelto").length,
    }),
    [conEstado]
  )

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return conEstado
      .filter(({ deposito, estado }) => {
        if (estado !== TAB_A_ESTADO[tab]) return false

        if (termino) {
          const coincide =
            deposito.lotes_relacionados.some((lote) =>
              lote.lote?.toLowerCase().includes(termino)
            ) ||
            lotesSoloEnResumen(deposito).some((codigo) =>
              codigo.toLowerCase().includes(termino)
            ) ||
            numeroReciboDeposito(deposito).toLowerCase().includes(termino) ||
            (deposito.cliente_nombre ?? "").toLowerCase().includes(termino)
          if (!coincide) return false
        }

        // Filtro de fecha sobre createdAt (cuándo el cliente subió el depósito).
        const fecha = deposito.createdAt ? new Date(deposito.createdAt) : null
        if (anio !== "Todos" && fecha?.getFullYear().toString() !== anio) return false
        if (mes !== "Todos" && (fecha ? MESES_NOMBRES[fecha.getMonth()] : null) !== mes) {
          return false
        }
        return true
      })
      .map((item) => item.deposito)
  }, [conEstado, tab, busqueda, anio, mes])

  function abrirDetalle(deposito: DepositoBackend) {
    setDetalle(deposito)
    // Avisa al backend que alguien está revisando: pasa el depósito de "Pendiente" a
    // "En Revision" y se lo notifica al cliente en la app.
    marcarEnRevision(deposito.id, calcularEstadoDeposito(deposito.lotes_relacionados))
  }

  async function recargarTrasAccion() {
    setParaRegistrar(null)
    setParaDevolver(null)
    setParaCambiarEstado(null)
    await cargar()
  }

  const resumenCards = [
    {
      label: "Pendientes",
      valor: conteo.pendientes,
      icon: AlertCircle,
      tint: "bg-status-reservado-bg",
      color: "text-status-reservado-fg",
    },
    {
      label: "Registrados",
      valor: conteo.registrados,
      icon: CheckCircle2,
      tint: "bg-status-disponible-bg",
      color: "text-status-disponible-fg",
    },
    {
      label: "Devueltos",
      valor: conteo.devueltos,
      icon: XCircle,
      tint: "bg-status-bloqueado-bg",
      color: "text-status-bloqueado-fg",
    },
  ]

  const vacio = VACIO[tab]
  const IconoVacio = vacio.icono

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:items-center">
          <div className="min-w-0">
            <h1 className="mb-1 text-xl font-extrabold tracking-tight sm:text-2xl">
              Registro de depósitos
            </h1>
            <p className="text-muted-foreground text-[13.5px]">
              {puedeGestionar
                ? "Apruebe o rechace los depósitos pendientes"
                : "Consulte los depósitos registrados por los clientes"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="border-border bg-card hover:bg-muted flex h-9.5 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold whitespace-nowrap transition-colors"
                  title={
                    conectado
                      ? "Usuarios conectados a la intranet"
                      : "Sin conexión en tiempo real: recargue para ver depósitos nuevos"
                  }
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      conectado ? "bg-status-disponible" : "bg-status-reservado"
                    )}
                  />
                  {conectado ? (
                    `En vivo · ${enLinea.length}`
                  ) : (
                    <>
                      Sin conexión<span className="hidden sm:inline"> en vivo</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="border-border border-b px-4 py-3 text-xs font-bold">
                  En la intranet ahora
                </div>
                {enLinea.length === 0 ? (
                  <p className="text-muted-foreground px-4 py-4 text-[12.5px]">
                    {conectado
                      ? "No hay nadie conectado."
                      : "Sin conexión con el servidor."}
                  </p>
                ) : (
                  <ul className="max-h-72 divide-y overflow-y-auto">
                    {enLinea.map((persona) => (
                      <li
                        key={persona.usuarioId}
                        className="flex items-center gap-2.5 px-4 py-2.5"
                      >
                        <span className="bg-status-disponible size-2 shrink-0 rounded-full" />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold">
                            {persona.nombre}
                            {persona.usuarioId === usuario.id && (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                (tú)
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground truncate text-[11px]">
                            {nombreModulo(persona.modulo)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label={dosColumnas ? "Vista de lista" : "Vista de cuadrícula"}
              title={dosColumnas ? "Vista de lista" : "Vista de cuadrícula"}
              onClick={() => setDosColumnas((previo) => !previo)}
            >
              {dosColumnas ? <List /> : <LayoutGrid />}
            </Button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <SelectField
            label="AÑO"
            placeholder="Todos"
            options={ANIOS}
            value={anio}
            onValueChange={setAnio}
          />
          <SelectField
            label="MES"
            placeholder="Todos"
            options={MESES}
            value={mes}
            onValueChange={setMes}
          />
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              BUSCAR POR LOTE, RECIBO O CLIENTE
            </label>
            <div className="border-input bg-card focus-within:border-primary focus-within:ring-ring/15 flex h-11 items-center gap-2 rounded-md border px-3.5 focus-within:ring-3">
              <Search
                className="text-muted-foreground size-[15px] shrink-0"
                strokeWidth={1.7}
              />
              <input
                type="text"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="EJ-21, N° de recibo o cliente"
                className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mb-4.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {resumenCards.map((item) => (
            <div
              key={item.label}
              className="bg-card border-border flex items-center justify-between rounded-lg border px-4.5 py-4"
            >
              <div>
                <div className="text-muted-foreground mb-1.5 text-xs font-semibold">
                  {item.label}
                </div>
                <div className="font-mono text-[26px] font-semibold">{item.valor}</div>
              </div>
              <div
                className={cn(
                  "flex size-9.5 items-center justify-center rounded-md",
                  item.tint
                )}
              >
                <item.icon className={cn("size-[18px]", item.color)} strokeWidth={1.7} />
              </div>
            </div>
          ))}
        </div>

        <PillTabs
          className="mb-4"
          value={tab}
          onChange={(id) => setTab(id as TabId)}
          tabs={[
            { id: "pendientes", label: `Pendientes (${conteo.pendientes})` },
            { id: "registrados", label: `Registrados (${conteo.registrados})` },
            { id: "devueltos", label: `Devueltos (${conteo.devueltos})` },
          ]}
        />

        {cargando ? (
          <div className="flex justify-center py-17.5">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            dashed={false}
            className="py-17.5"
            icon={
              <AlertCircle
                className="text-status-bloqueado-fg size-[26px]"
                strokeWidth={2}
              />
            }
            title="No se pudieron cargar los depósitos"
            description={error}
          />
        ) : filtrados.length === 0 ? (
          <EmptyState
            dashed={false}
            className="py-17.5"
            icon={
              <IconoVacio className={cn("size-[26px]", vacio.color)} strokeWidth={2.2} />
            }
            title={vacio.titulo}
            description={vacio.descripcion}
          />
        ) : (
          <div
            className={cn(
              "grid gap-4",
              dosColumnas ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
            )}
          >
            {filtrados.map((deposito) => (
              <DepositoCard
                key={deposito.id}
                deposito={deposito}
                puedeGestionar={puedeGestionar}
                onVerComprobantes={abrirDetalle}
                onVerResumen={(item) => setResumen(parsearResumen(item.resumen))}
                onAprobar={setParaRegistrar}
                onDevolver={setParaDevolver}
                onCambiarEstado={setParaCambiarEstado}
              />
            ))}
          </div>
        )}
      </div>

      <DepositoDetalleSheet deposito={detalle} onCerrar={() => setDetalle(null)} />
      <ResumenSheet resumen={resumen} onCerrar={() => setResumen(null)} />
      <RegistrarLoteSheet
        lote={paraRegistrar}
        onCerrar={() => setParaRegistrar(null)}
        onRegistrado={recargarTrasAccion}
      />
      <DevolverLoteSheet
        lote={paraDevolver}
        onCerrar={() => setParaDevolver(null)}
        onDevuelto={recargarTrasAccion}
      />
      <CambiarEstadoSheet
        lote={paraCambiarEstado}
        onCerrar={() => setParaCambiarEstado(null)}
        onActualizado={recargarTrasAccion}
      />
    </div>
  )
}
