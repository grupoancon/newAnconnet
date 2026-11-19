"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, CalendarClock, ChevronRight, RefreshCw, Send, Users } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
import { StatusBadge } from "@/components/shared/status-badge"
import { TextField } from "@/components/shared/text-field"
import { TimePickerField } from "@/components/shared/time-picker-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/shared/spinner"
import { crearNotificacion, listarNotificaciones } from "@/lib/api/app-notificaciones-api"
import { cn } from "@/lib/utils"

import {
  DESTINOS_APP,
  ESTADO_LABELS,
  TIPO_LABELS,
  type EstadoNotificacion,
  type Notificacion,
  type TipoNotificacion,
} from "./datos"
import { DetalleNotificacionSheet } from "./detalle-notificacion-sheet"
import { formatearFechaHora, VARIANTE_ESTADO } from "./formato"

const MAX_TITULO = 120
const MAX_MENSAJE = 400

const FILTROS_ESTADO: { id: "todos" | EstadoNotificacion; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "programada", label: "Programadas" },
  { id: "enviada", label: "Enviadas" },
  { id: "parcial", label: "Parciales" },
  { id: "fallo", label: "Fallidas" },
  { id: "cancelada", label: "Canceladas" },
]

// El envío (anconAPI) usa un solo criterio por segmento: no se combinan.
type CriterioSegmento = "cedulas" | "lotes" | "proyectos" | "mora"

const CRITERIOS_SEGMENTO: { id: CriterioSegmento; label: string }[] = [
  { id: "cedulas", label: "Cédulas" },
  { id: "lotes", label: "Lotes" },
  { id: "proyectos", label: "Proyecto" },
  { id: "mora", label: "Con mora" },
]

const AYUDA_CRITERIO: Record<
  Exclude<CriterioSegmento, "mora">,
  { label: string; placeholder: string }
> = {
  cedulas: { label: "Cédulas", placeholder: "0102030405, 1712345678" },
  lotes: { label: "Lotes", placeholder: "F-M30-101, G-104" },
  proyectos: { label: "Prefijos de proyecto", placeholder: "F-, G-" },
}

function separarLista(valor: string): string[] {
  return Array.from(
    new Set(
      valor
        .split(/[\s,]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  )
}

function mensajeDeError(err: unknown): string {
  return err instanceof Error ? err.message : "Ocurrió un error inesperado."
}

export function NotificacionesAppContent() {
  const toast = useToast()

  // ── Formulario ──
  const [titulo, setTitulo] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [imagen, setImagen] = useState("")
  const [destino, setDestino] = useState("ninguno")
  const [tipo, setTipo] = useState<TipoNotificacion>("individual")
  const [cedula, setCedula] = useState("")
  const [cuando, setCuando] = useState<"ahora" | "programar">("ahora")
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")

  // Segmento: un solo criterio (ver CRITERIOS_SEGMENTO).
  const [criterio, setCriterio] = useState<CriterioSegmento>("cedulas")
  const [valoresSegmento, setValoresSegmento] = useState("")
  const [diasMora, setDiasMora] = useState("")
  const [enviando, setEnviando] = useState(false)

  // ── Historial ──
  const [historial, setHistorial] = useState<Notificacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoNotificacion>("todos")
  const [seleccionada, setSeleccionada] = useState<Notificacion | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setHistorial(
        await listarNotificaciones(filtroEstado === "todos" ? undefined : filtroEstado)
      )
      setError(null)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }, [filtroEstado])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const valores = separarLista(valoresSegmento)
  const diasMoraValidos =
    !diasMora.trim() || (Number.isInteger(Number(diasMora)) && Number(diasMora) > 0)

  function armarSegmento(): Record<string, unknown> {
    if (criterio === "mora") {
      return diasMora.trim()
        ? { en_mora: true, dias_mora_min: Number(diasMora) }
        : { en_mora: true }
    }
    if (criterio === "cedulas") return { cedulas: valores }
    if (criterio === "lotes") return { lotes: valores.map((v) => v.toUpperCase()) }
    return { prefijos_proyecto: valores.map((v) => v.toUpperCase()) }
  }

  const resumenSegmento =
    criterio === "mora"
      ? diasMora.trim()
        ? `con ${diasMora} días de mora o más`
        : "con cuotas en mora"
      : valores.length === 0
        ? null
        : criterio === "cedulas"
          ? `con ${valores.length === 1 ? "la cédula" : `estas ${valores.length} cédulas`}`
          : criterio === "lotes"
            ? `dueños de ${valores.length === 1 ? "el lote" : "los lotes"} ${valores.join(", ")}`
            : `con lotes de ${valores.join(", ")}`

  const imagenInvalida =
    imagen.trim().length > 0 && !/^https:\/\/\S+$/i.test(imagen.trim())
  const fechaProgramada =
    cuando === "programar" && fecha && hora ? new Date(`${fecha}T${hora}:00`) : null
  const fechaPasada = fechaProgramada !== null && fechaProgramada.getTime() < Date.now()

  const puedeEnviar =
    !enviando &&
    titulo.trim().length > 0 &&
    mensaje.trim().length > 0 &&
    !imagenInvalida &&
    (tipo !== "individual" || cedula.trim().length > 0) &&
    (tipo !== "segmentada" ||
      (criterio === "mora" ? diasMoraValidos : valores.length > 0)) &&
    (cuando === "ahora" || (fechaProgramada !== null && !fechaPasada))

  function limpiarFormulario() {
    setTitulo("")
    setMensaje("")
    setImagen("")
    setCedula("")
    setValoresSegmento("")
    setDiasMora("")
    setFecha("")
    setHora("")
  }

  async function enviar() {
    setEnviando(true)
    try {
      await crearNotificacion({
        titulo: titulo.trim(),
        contenido: mensaje.trim(),
        tipo,
        imagen: imagen.trim() || undefined,
        url: destino === "ninguno" ? undefined : destino,
        user_id: tipo === "individual" ? cedula.trim() : undefined,
        segmento: tipo === "segmentada" ? armarSegmento() : undefined,
        fecha_enviar: fechaProgramada ? fechaProgramada.toISOString() : undefined,
      })
      toast({
        variant: "success",
        description:
          cuando === "ahora"
            ? "Notificación en camino. Aparecerá como enviada en unos segundos."
            : "Notificación programada.",
      })
      limpiarFormulario()
      await cargar()
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="grid grid-cols-1 gap-4.5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* ── Nueva notificación ── */}
          <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
            <PageHeader eyebrow="App · Notificaciones" title="Nueva notificación" />

            <div className="space-y-4 p-4 sm:p-6">
              <VistaPrevia titulo={titulo} mensaje={mensaje} imagen={imagen} />

              <div>
                <TextField
                  label="Título"
                  value={titulo}
                  onChange={(v) => setTitulo(v.slice(0, MAX_TITULO))}
                  placeholder="Pago confirmado"
                />
                <Contador actual={titulo.length} maximo={MAX_TITULO} />
              </div>

              <div>
                <label
                  htmlFor="mensaje-notificacion"
                  className="text-muted-foreground mb-1.5 block text-xs font-semibold"
                >
                  Mensaje
                </label>
                <Textarea
                  id="mensaje-notificacion"
                  value={mensaje}
                  onChange={(event) =>
                    setMensaje(event.target.value.slice(0, MAX_MENSAJE))
                  }
                  placeholder="Tu cuota de octubre fue registrada."
                  className="bg-card focus-visible:border-primary min-h-[92px] rounded-md px-3.5 py-2.5 shadow-none"
                />
                <Contador actual={mensaje.length} maximo={MAX_MENSAJE} />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <TextField
                    label="Imagen (URL, opcional)"
                    value={imagen}
                    onChange={setImagen}
                    placeholder="https://…"
                  />
                  {imagenInvalida ? (
                    <p className="text-destructive mt-1 text-xs">
                      Debe empezar con https://
                    </p>
                  ) : null}
                </div>
                <SelectField
                  label="Al tocarla, abrir"
                  placeholder="Pantalla de la app"
                  opciones={DESTINOS_APP}
                  value={destino}
                  onValueChange={setDestino}
                />
              </div>

              <div className="border-border space-y-3 border-t pt-4">
                <p className="text-muted-foreground text-xs font-semibold">
                  Destinatarios
                </p>
                <PillTabs
                  tabs={[
                    { id: "individual", label: "Un usuario" },
                    { id: "global", label: "Todos" },
                    { id: "segmentada", label: "Segmento" },
                  ]}
                  value={tipo}
                  onChange={(id) => setTipo(id as TipoNotificacion)}
                />

                {tipo === "individual" ? (
                  <TextField
                    value={cedula}
                    onChange={setCedula}
                    placeholder="Cédula del cliente: 0102030405"
                  />
                ) : null}

                {tipo === "global" ? (
                  <p className="bg-status-reservado-bg text-status-reservado-fg flex items-center gap-2 rounded-md px-3 py-2.5 text-xs">
                    <Users className="size-3.5 shrink-0" strokeWidth={1.8} />
                    Le llegará a todos los usuarios de la app.
                  </p>
                ) : null}

                {tipo === "segmentada" ? (
                  <div className="bg-muted/60 border-border space-y-3 rounded-md border p-3.5">
                    <PillTabs
                      tabs={CRITERIOS_SEGMENTO}
                      value={criterio}
                      onChange={(id) => {
                        setCriterio(id as CriterioSegmento)
                        setValoresSegmento("")
                      }}
                    />
                    {criterio === "mora" ? (
                      <div>
                        <TextField
                          type="number"
                          label="Días de mora mínimos (opcional)"
                          value={diasMora}
                          onChange={setDiasMora}
                          placeholder="Ej. 30"
                        />
                        {!diasMoraValidos ? (
                          <p className="text-destructive mt-1 text-xs">
                            Debe ser un número entero mayor a 0.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <TextField
                        label={AYUDA_CRITERIO[criterio].label}
                        value={valoresSegmento}
                        onChange={setValoresSegmento}
                        placeholder={AYUDA_CRITERIO[criterio].placeholder}
                      />
                    )}
                    <p className="text-muted-foreground text-xs">
                      {resumenSegmento ? (
                        <>
                          Se enviará a los usuarios{" "}
                          <span className="text-foreground font-semibold">
                            {resumenSegmento}
                          </span>
                          .
                        </>
                      ) : (
                        "Escribe al menos un valor, separados por coma."
                      )}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="border-border space-y-3 border-t pt-4">
                <p className="text-muted-foreground text-xs font-semibold">Cuándo</p>
                <PillTabs
                  tabs={[
                    { id: "ahora", label: "Enviar ahora" },
                    { id: "programar", label: "Programar" },
                  ]}
                  value={cuando}
                  onChange={(id) => setCuando(id as "ahora" | "programar")}
                />
                {cuando === "programar" ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DatePickerField label="Fecha" value={fecha} onChange={setFecha} />
                    <TimePickerField label="Hora" value={hora} onChange={setHora} />
                  </div>
                ) : null}
                {fechaPasada ? (
                  <p className="text-destructive text-xs">Esa fecha y hora ya pasaron.</p>
                ) : null}
              </div>
            </div>

            <div className="border-border flex justify-end border-t p-4">
              <Button disabled={!puedeEnviar} onClick={() => void enviar()}>
                {enviando ? (
                  "Enviando…"
                ) : cuando === "ahora" ? (
                  <>
                    <Send className="size-4" strokeWidth={1.8} />
                    Enviar notificación
                  </>
                ) : (
                  <>
                    <CalendarClock className="size-4" strokeWidth={1.8} />
                    Programar notificación
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Historial ── */}
          <div className="bg-card border-border flex min-h-0 flex-col overflow-hidden rounded-lg border shadow-sm xl:self-start">
            <PageHeader
              eyebrow="Últimas 50"
              title="Historial"
              actions={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Actualizar historial"
                  disabled={cargando}
                  onClick={() => void cargar()}
                >
                  <RefreshCw className="size-3.5" strokeWidth={1.8} />
                </Button>
              }
            />
            <div className="bg-muted/60 border-border border-b px-4 py-3 sm:px-6">
              <PillTabs
                tabs={FILTROS_ESTADO}
                value={filtroEstado}
                onChange={(id) => setFiltroEstado(id as "todos" | EstadoNotificacion)}
              />
            </div>

            {cargando && historial.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : error ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  title="No se pudo cargar el historial"
                  description={error}
                  dashed
                />
              </div>
            ) : historial.length === 0 ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  title="Sin notificaciones"
                  description="No hay notificaciones en este estado."
                />
              </div>
            ) : (
              <ul className="divide-border divide-y">
                {historial.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setSeleccionada(n)}
                      className="hover:bg-muted/60 group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors sm:px-6"
                    >
                      <div className="bg-accent mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                        <Bell
                          className="text-accent-foreground size-4"
                          strokeWidth={1.7}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{n.titulo}</p>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {n.tipo === "individual" && n.userId
                            ? n.userId
                            : TIPO_LABELS[n.tipo]}
                          {n.destinatarios > 0
                            ? ` · ${n.destinatarios} destinatarios`
                            : ""}{" "}
                          · {formatearFechaHora(n.fechaEnvio ?? n.fechaEnviar)}
                        </p>
                      </div>
                      <StatusBadge variant={VARIANTE_ESTADO[n.estado] ?? "pronto"}>
                        {ESTADO_LABELS[n.estado] ?? n.estado}
                      </StatusBadge>
                      <ChevronRight
                        className="text-muted-foreground group-hover:text-primary mt-1.5 size-4 shrink-0 transition-colors"
                        strokeWidth={1.8}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <DetalleNotificacionSheet
        notificacion={seleccionada}
        onOpenChange={(abierto) => !abierto && setSeleccionada(null)}
        onCambio={cargar}
      />
    </div>
  )
}

function Contador({ actual, maximo }: { actual: number; maximo: number }) {
  return (
    <p
      className={cn(
        "mt-1 text-right text-[11px]",
        actual >= maximo ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {actual}/{maximo}
    </p>
  )
}

// Cómo se vería la notificación en la pantalla bloqueada del celular.
function VistaPrevia({
  titulo,
  mensaje,
  imagen,
}: {
  titulo: string
  mensaje: string
  imagen: string
}) {
  return (
    <div className="bg-muted border-border rounded-lg border px-4 py-5">
      <p className="text-muted-foreground mb-2.5 text-center text-[10.5px] font-bold tracking-wide uppercase">
        Vista previa
      </p>
      <div className="bg-card mx-auto max-w-sm rounded-2xl p-3 shadow-md">
        <div className="flex items-start gap-2.5">
          <div className="bg-brand-gradient flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Bell className="size-4 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold uppercase">
                Ancon
              </span>
              <span className="text-muted-foreground text-[11px]">ahora</span>
            </div>
            <p
              className={cn(
                "truncate text-[13px] font-semibold",
                !titulo && "text-muted-foreground"
              )}
            >
              {titulo || "Título de la notificación"}
            </p>
            <p
              className={cn(
                "line-clamp-2 text-[12.5px] leading-snug",
                mensaje ? "text-foreground/80" : "text-muted-foreground"
              )}
            >
              {mensaje || "El mensaje aparecerá aquí."}
            </p>
          </div>
          {imagen.trim() ? (
            <div className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold">
              IMG
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
