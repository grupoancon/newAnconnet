"use client"

import { useEffect, useState } from "react"
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Download,
  Hourglass,
  Palmtree,
  XCircle,
} from "lucide-react"

import { useCan } from "@/components/shared/can"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { MotivoRechazo } from "@/components/shared/motivo-rechazo"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  RrhhApiError,
  aprobarSolicitudVacacion,
  asignarVacacionesColectivas,
  crearPeriodoVacacional,
  crearSolicitudVacacion,
  desactivarPeriodoVacacional,
  listarMisSolicitudesVacaciones,
  obtenerMiSaldoVacaciones,
  type MiSaldoVacaciones,
  listarPeriodosDisponibles,
  listarTodasSolicitudesVacaciones,
  listarTodosPeriodos,
  marcarReporteVacacionDescargado,
  marcarVacacionColectivaNoAplica,
  rechazarSolicitudVacacion,
  type PeriodoVacacionalBackend,
  type SolicitudVacacionBackend,
  type SolicitudVacacionConCreador,
} from "@/lib/api/rrhh-api"
import {
  buscarMiSolicitante,
  buscarSolicitante,
  descargarReporteVacaciones,
} from "@/lib/rrhh-reportes-pdf"
import { cn } from "@/lib/utils"

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function manana(): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

// Días de calendario entre hoy y una fecha futura (YYYY-MM-DD) — para "faltan N días".
function diasHasta(fecha: string): number {
  const diffMs =
    new Date(`${fecha}T00:00:00Z`).getTime() - new Date(`${hoy()}T00:00:00Z`).getTime()
  return Math.max(0, Math.round(diffMs / 86_400_000))
}

// Fin de las vacaciones de diciembre = inicio + 8 días (misma regla que el backend,
// VacacionesService.DIAS_VACACIONES_COLECTIVAS) — solo para mostrar la vista previa.
const DIAS_VACACIONES_COLECTIVAS = 8

function fechaFinColectivas(fechaInicio: string): string {
  const fecha = new Date(`${fechaInicio}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + DIAS_VACACIONES_COLECTIVAS)
  return fecha.toISOString().slice(0, 10)
}

function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return ""
  const f = new Date(valor)
  if (isNaN(f.getTime())) return ""
  return `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`
}

function normalizarEstado(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "aprobado" || clave === "rechazado") return clave
  return "pendiente"
}

// La solicitud propia que todavía "cuenta" — pendiente de revisión, o aprobada y
// vigente (no terminó) — mismo criterio que RrhhService/VacacionesService.crearSolicitud
// del lado del backend (ahí es lo que bloquea pedir otro periodo).
function solicitudVacacionActiva(
  solicitudes: SolicitudVacacionBackend[] | null
): SolicitudVacacionBackend | null {
  if (!solicitudes) return null
  const fechaHoy = hoy()
  return (
    solicitudes.find(
      (s) =>
        !s.colectiva &&
        (s.state === "pendiente" ||
          (s.state === "aprobado" && (s.dateE ?? "") >= fechaHoy))
    ) ?? null
  )
}

export function VacacionesTab() {
  const toast = useToast()
  const puedeGestionar = useCan("rrhh:gestionar")

  // --- Periodos disponibles (para elegir) + mis solicitudes ---
  const [periodosDisponibles, setPeriodosDisponibles] = useState<
    PeriodoVacacionalBackend[] | null
  >(null)
  const [misSolicitudes, setMisSolicitudes] = useState<SolicitudVacacionBackend[] | null>(
    null
  )
  const solicitudActiva = solicitudVacacionActiva(misSolicitudes)
  const [error, setError] = useState<string | null>(null)
  const [miSaldo, setMiSaldo] = useState<MiSaldoVacaciones | null>(null)

  const [eligiendo, setEligiendo] = useState<PeriodoVacacionalBackend | null>(null)
  const [detalleSolicitud, setDetalleSolicitud] = useState("")
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)

  // --- Administración del calendario (solo rrhh:gestionar) ---
  const [todosPeriodos, setTodosPeriodos] = useState<PeriodoVacacionalBackend[] | null>(
    null
  )
  const [etiquetaNueva, setEtiquetaNueva] = useState("")
  const [fechaInicioNueva, setFechaInicioNueva] = useState("")
  const [fechaFinNueva, setFechaFinNueva] = useState("")
  const [publicando, setPublicando] = useState(false)

  // --- Revisión de todas las solicitudes (solo rrhh:gestionar) ---
  const [todasSolicitudes, setTodasSolicitudes] = useState<
    SolicitudVacacionConCreador[] | null
  >(null)
  const [aprobando, setAprobando] = useState<SolicitudVacacionBackend | null>(null)
  const [procesandoAprobacion, setProcesandoAprobacion] = useState(false)
  const [rechazando, setRechazando] = useState<SolicitudVacacionBackend | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [procesandoRechazo, setProcesandoRechazo] = useState(false)
  const [descargandoId, setDescargandoId] = useState<number | null>(null)

  // --- Vacaciones de diciembre (asignación colectiva, solo rrhh:gestionar) ---
  const [fechaDiciembre, setFechaDiciembre] = useState("")
  const [asignando, setAsignando] = useState(false)
  const [soloSinDescargar, setSoloSinDescargar] = useState(false)
  const [seguimientoAbierto, setSeguimientoAbierto] = useState(false)
  const [cambiandoAplicaId, setCambiandoAplicaId] = useState<number | null>(null)

  // `propia`: la solicitud es del usuario logeado (su perfil alcanza); si no, es una ajena
  // vista por RRHH y el solicitante se busca en la lista de colaboradores.
  async function manejarDescargar(
    solicitud: SolicitudVacacionBackend & { creador_nombre?: string | null },
    propia: boolean
  ) {
    setDescargandoId(solicitud.id)
    try {
      const datos = propia
        ? await buscarMiSolicitante()
        : await buscarSolicitante(solicitud.soliciter, solicitud.creador_nombre)
      await descargarReporteVacaciones(solicitud, {
        nombre: datos.nombre ?? solicitud.creador_nombre ?? null,
        cargo: datos.cargo,
      })
      // Solo la persona dueña de la solicitud cuenta como "descargó su reporte".
      if (propia && !solicitud.reporte_descargado_at) {
        await marcarReporteVacacionDescargado(solicitud.id).catch(() => {})
        cargarPropias()
        cargarAdmin()
      }
    } catch {
      toast({
        variant: "error",
        title: "No se pudo generar el reporte",
        description: "Intenta de nuevo.",
      })
    } finally {
      setDescargandoId(null)
    }
  }

  function cargarPropias() {
    setError(null)
    obtenerMiSaldoVacaciones()
      .then(setMiSaldo)
      .catch(() => {
        // Silencioso: el resumen de días no debe romper la pantalla si falla.
      })
    Promise.all([listarPeriodosDisponibles(), listarMisSolicitudesVacaciones()])
      .then(([periodos, solicitudes]) => {
        setPeriodosDisponibles(periodos)
        setMisSolicitudes(solicitudes)
      })
      .catch((err) => {
        setError(
          err instanceof RrhhApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  function cargarAdmin() {
    if (!puedeGestionar) return
    listarTodosPeriodos()
      .then(setTodosPeriodos)
      .catch(() => {
        // Silencioso: la sección de admin no debe romper lo de arriba si falla.
      })
    listarTodasSolicitudesVacaciones()
      .then(setTodasSolicitudes)
      .catch(() => {
        // Silencioso — mismo criterio.
      })
  }

  useEffect(() => {
    cargarPropias()
    cargarAdmin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeGestionar])

  async function manejarPublicarPeriodo() {
    if (!etiquetaNueva.trim() || !fechaInicioNueva || !fechaFinNueva) {
      toast({
        variant: "error",
        title: "Faltan datos",
        description: "Ingresa la etiqueta, la fecha de inicio y la fecha fin.",
      })
      return
    }
    setPublicando(true)
    try {
      await crearPeriodoVacacional({
        etiqueta: etiquetaNueva.trim(),
        fechaInicio: fechaInicioNueva,
        fechaFin: fechaFinNueva,
      })
      toast({
        variant: "success",
        description: "Periodo publicado — se notificó a todos los colaboradores.",
      })
      setEtiquetaNueva("")
      setFechaInicioNueva("")
      setFechaFinNueva("")
      cargarPropias()
      cargarAdmin()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo publicar el periodo",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setPublicando(false)
    }
  }

  async function manejarAsignarDiciembre() {
    if (!fechaDiciembre) {
      toast({
        variant: "error",
        title: "Falta la fecha",
        description: "Elige la fecha de inicio de las vacaciones de diciembre.",
      })
      return
    }
    setAsignando(true)
    try {
      const resultado = await asignarVacacionesColectivas(fechaDiciembre)
      toast({
        variant: "success",
        description: `Vacaciones asignadas a ${resultado.asignados} colaboradores (${formatearFecha(resultado.fechaInicio)} – ${formatearFecha(resultado.fechaFin)}) — se les notificó.`,
      })
      setFechaDiciembre("")
      cargarPropias()
      cargarAdmin()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudieron asignar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setAsignando(false)
    }
  }

  async function manejarCambiarAplica(solicitud: SolicitudVacacionConCreador) {
    const noAplica = solicitud.state !== "no_aplica"
    const cambiarEstado = (estado: string | null) =>
      setTodasSolicitudes((actuales) =>
        actuales
          ? actuales.map((s) => (s.id === solicitud.id ? { ...s, state: estado } : s))
          : actuales
      )

    // Se refleja de una en la tabla (sin esperar la respuesta ni recargar); si el backend
    // falla, se revierte.
    cambiarEstado(noAplica ? "no_aplica" : "aprobado")
    setCambiandoAplicaId(solicitud.id)
    try {
      await marcarVacacionColectivaNoAplica(solicitud.id, noAplica)
      toast({
        variant: "success",
        description: noAplica
          ? `${solicitud.creador_nombre ?? "El colaborador"} ya no aplica a estas vacaciones.`
          : `${solicitud.creador_nombre ?? "El colaborador"} vuelve a aplicar.`,
      })
    } catch (err) {
      cambiarEstado(solicitud.state)
      toast({
        variant: "error",
        title: "No se pudo actualizar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setCambiandoAplicaId(null)
    }
  }

  async function manejarDesactivarPeriodo(id: number) {
    try {
      await desactivarPeriodoVacacional(id)
      toast({ variant: "success", description: "Periodo desactivado." })
      cargarPropias()
      cargarAdmin()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo desactivar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    }
  }

  async function manejarElegirPeriodo() {
    if (!eligiendo) return
    setEnviandoSolicitud(true)
    try {
      await crearSolicitudVacacion({
        periodoId: eligiendo.id,
        detalle: detalleSolicitud.trim() || undefined,
      })
      toast({ variant: "success", description: "Solicitud de vacaciones enviada." })
      setEligiendo(null)
      setDetalleSolicitud("")
      cargarPropias()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo enviar la solicitud",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setEnviandoSolicitud(false)
    }
  }

  async function manejarAprobar() {
    if (!aprobando) return
    setProcesandoAprobacion(true)
    try {
      await aprobarSolicitudVacacion(aprobando.id)
      toast({ variant: "success", description: "Solicitud aprobada." })
      setAprobando(null)
      cargarAdmin()
      cargarPropias()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo aprobar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setProcesandoAprobacion(false)
    }
  }

  async function manejarRechazar() {
    if (!rechazando) return
    if (!motivoRechazo.trim()) {
      toast({
        variant: "error",
        title: "Falta el motivo",
        description: "Ingresa el motivo del rechazo.",
      })
      return
    }
    setProcesandoRechazo(true)
    try {
      await rechazarSolicitudVacacion(rechazando.id, motivoRechazo.trim())
      toast({ variant: "success", description: "Solicitud rechazada." })
      setRechazando(null)
      setMotivoRechazo("")
      cargarAdmin()
      cargarPropias()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo rechazar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setProcesandoRechazo(false)
    }
  }

  // Los "no aplica" quedan al final y no cuentan entre los que faltan por descargar.
  const colectivas = (todasSolicitudes ?? [])
    .filter((s) => s.colectiva && (s.state === "aprobado" || s.state === "no_aplica"))
    .sort(
      (a, b) =>
        Number(a.state === "no_aplica") - Number(b.state === "no_aplica") ||
        Number(!!a.reporte_descargado_at) - Number(!!b.reporte_descargado_at) ||
        (a.creador_nombre ?? "").localeCompare(b.creador_nombre ?? "")
    )
  const colectivasAplican = colectivas.filter((s) => s.state === "aprobado")
  const colectivasNoAplican = colectivas.length - colectivasAplican.length
  const colectivasSinDescargar = colectivasAplican.filter((s) => !s.reporte_descargado_at)
  const colectivasVisibles = soloSinDescargar ? colectivasSinDescargar : colectivas
  const todasSinColectivas = (todasSolicitudes ?? []).filter((s) => !s.colectiva)
  const miColectivaPendiente =
    (misSolicitudes ?? []).find(
      (s) =>
        s.colectiva &&
        normalizarEstado(s.state) === "aprobado" &&
        !s.reporte_descargado_at
    ) ?? null

  return (
    <div className="flex flex-col gap-6">
      {puedeGestionar && (
        <div className="bg-card border-border rounded-lg border">
          <div className="border-border text-muted-foreground border-b px-5 py-3.5 text-xs font-bold tracking-wide">
            CALENDARIO DE VACACIONES
          </div>
          <div className="flex flex-col gap-3.5 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField
                label="Etiqueta"
                placeholder='Ej. "Semana 1 — Noviembre"'
                value={etiquetaNueva}
                onChange={setEtiquetaNueva}
              />
              <DatePickerField
                label="Fecha de inicio"
                value={fechaInicioNueva}
                onChange={setFechaInicioNueva}
                fechaMinima={manana()}
              />
              <DatePickerField
                label="Fecha fin"
                value={fechaFinNueva}
                onChange={setFechaFinNueva}
                fechaMinima={fechaInicioNueva || manana()}
              />
            </div>
            <Button
              disabled={publicando}
              onClick={manejarPublicarPeriodo}
              className="self-start"
            >
              <CalendarPlus className="size-3.5" strokeWidth={1.8} />
              {publicando ? "Publicando…" : "Publicar periodo"}
            </Button>

            {todosPeriodos && todosPeriodos.length > 0 && (
              <div className="border-border mt-2 overflow-hidden rounded-lg border">
                <div className="text-muted-foreground bg-muted/60 border-border hidden grid-cols-[1.4fr_1fr_1fr_90px] border-b px-4.5 py-2.5 text-[10.5px] font-bold tracking-wide sm:grid">
                  <span>ETIQUETA</span>
                  <span>DESDE</span>
                  <span>HASTA</span>
                  <span>ESTADO</span>
                </div>
                {todosPeriodos.map((periodo, index) => (
                  <div
                    key={periodo.id}
                    className={cn(
                      "grid grid-cols-2 items-center gap-y-1 px-4.5 py-3 text-[13px] sm:grid-cols-[1.4fr_1fr_1fr_90px]",
                      index < todosPeriodos.length - 1 && "border-border border-b"
                    )}
                  >
                    <span className="font-semibold">{periodo.etiqueta}</span>
                    <span className="text-muted-foreground font-mono text-[11.5px]">
                      {formatearFecha(periodo.fecha_inicio)}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11.5px]">
                      {formatearFecha(periodo.fecha_fin)}
                    </span>
                    <span>
                      {periodo.activo ? (
                        <button
                          type="button"
                          className="text-status-bloqueado-fg text-xs font-semibold"
                          onClick={() => manejarDesactivarPeriodo(periodo.id)}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">Inactivo</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {miSaldo && (
        <div className="bg-card border-border rounded-lg border">
          <div className="border-border text-muted-foreground border-b px-5 py-3.5 text-xs font-bold tracking-wide">
            MIS DÍAS DE VACACIONES {miSaldo.periodo}
          </div>
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <div>
              <div className="text-muted-foreground text-[11px] font-semibold">
                DISPONIBLES
              </div>
              <div className="font-mono text-xl font-extrabold">
                {miSaldo.diasVacaciones}
              </div>
              <div className="text-muted-foreground text-[11px]">
                15 + 1 por cada 5 años ({miSaldo.anosTrabajados} año
                {miSaldo.anosTrabajados === 1 ? "" : "s"})
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] font-semibold">
                ARRASTRADOS
              </div>
              <div className="text-status-disponible-fg font-mono text-xl font-extrabold">
                {miSaldo.diasAumentados >= 0 ? "+" : ""}
                {miSaldo.diasAumentados}
              </div>
              <div className="text-muted-foreground text-[11px]">
                del periodo anterior
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] font-semibold">
                TOMADOS
              </div>
              <div className="text-status-bloqueado-fg font-mono text-xl font-extrabold">
                -{miSaldo.diasDescontados}
              </div>
              <div className="text-muted-foreground text-[11px]">
                vacaciones aprobadas
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] font-semibold">SALDO</div>
              <div className="font-mono text-xl font-extrabold">{miSaldo.saldoTotal}</div>
              <div className="text-muted-foreground text-[11px]">días por tomar</div>
            </div>
          </div>
        </div>
      )}

      {miColectivaPendiente && (
        <div className="bg-status-reservado-bg text-status-reservado-fg flex items-center gap-4 rounded-lg p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/50">
            <Download className="size-5" strokeWidth={1.8} />
          </div>
          <div>
            <div className="text-[15px] font-extrabold">
              Descarga tu reporte de vacaciones de diciembre
            </div>
            <p className="mt-0.5 text-[13px]">
              Tus vacaciones son del {formatearFecha(miColectivaPendiente.dateS)} al{" "}
              {formatearFecha(miColectivaPendiente.dateE)}. Descarga el reporte desde «Mis
              solicitudes», fírmalo y entrégalo físico a Recursos Humanos.
            </p>
          </div>
        </div>
      )}

      {puedeGestionar && (
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="border-border text-muted-foreground border-b px-5 py-3.5 text-xs font-bold tracking-wide">
            VACACIONES DE DICIEMBRE (TODOS LOS COLABORADORES)
          </div>
          <div className="flex flex-col gap-3.5 p-5">
            <p className="text-muted-foreground text-[13px]">
              Elige la fecha de inicio: las vacaciones terminan{" "}
              {DIAS_VACACIONES_COLECTIVAS} días después. Se asignan a todos los
              colaboradores activos, ya aprobadas, y cada uno descarga su reporte, lo
              firma y lo entrega físico.
            </p>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
              <DatePickerField
                label="Fecha de inicio"
                value={fechaDiciembre}
                onChange={setFechaDiciembre}
                fechaMinima={manana()}
              />
              <div>
                <div className="text-muted-foreground mb-1.5 text-xs font-semibold">
                  Fecha de fin
                </div>
                <div className="border-border bg-muted/60 text-muted-foreground flex h-9 items-center rounded-md border px-3 font-mono text-[13px]">
                  {fechaDiciembre
                    ? formatearFecha(fechaFinColectivas(fechaDiciembre))
                    : "—"}
                </div>
              </div>
              <Button disabled={asignando} onClick={manejarAsignarDiciembre}>
                {asignando ? "Asignando…" : "Asignar a todos"}
              </Button>
            </div>
          </div>

          {colectivas.length > 0 && (
            <>
              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-y px-5 py-3">
                <button
                  type="button"
                  aria-expanded={seguimientoAbierto}
                  className="flex items-center gap-2 text-[13px] font-semibold"
                  onClick={() => setSeguimientoAbierto((abierto) => !abierto)}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      !seguimientoAbierto && "-rotate-90"
                    )}
                    strokeWidth={2}
                  />
                  {colectivasSinDescargar.length === 0
                    ? "Todos descargaron su reporte"
                    : `${colectivasSinDescargar.length} de ${colectivasAplican.length} sin descargar el reporte`}
                  {colectivasNoAplican > 0 && (
                    <span className="text-muted-foreground font-normal">
                      · {colectivasNoAplican} no aplica
                      {colectivasNoAplican === 1 ? "" : "n"}
                    </span>
                  )}
                </button>
                {seguimientoAbierto && (
                  <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs font-semibold">
                    <Checkbox
                      checked={soloSinDescargar}
                      onCheckedChange={setSoloSinDescargar}
                      aria-label="Ver solo los que no han descargado"
                    />
                    Ver solo los que no han descargado
                  </label>
                )}
              </div>
              {seguimientoAbierto && (
                <table className="tabla-apilada w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                      <th className="px-5 py-2.75 text-left">COLABORADOR</th>
                      <th className="px-5 py-2.75 text-left">DEPARTAMENTO</th>
                      <th className="px-5 py-2.75 text-left">FECHAS</th>
                      <th className="px-5 py-2.75 text-left">REPORTE</th>
                      <th className="px-5 py-2.75 text-left">PDF</th>
                      <th className="px-5 py-2.75 text-left">APLICA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colectivasVisibles.map((solicitud, index) => (
                      <tr
                        key={solicitud.id}
                        className={cn(
                          "hover:bg-muted/60 transition-colors",
                          solicitud.state === "no_aplica" && "opacity-60",
                          index < colectivasVisibles.length - 1 &&
                            "border-border border-b"
                        )}
                      >
                        <td
                          data-label="Colaborador"
                          className="px-5 py-3 font-bold whitespace-nowrap"
                        >
                          {solicitud.creador_nombre ?? "—"}
                        </td>
                        <td
                          data-label="Departamento"
                          className="text-muted-foreground px-5 py-3"
                        >
                          {solicitud.departmentSoliciter ?? "—"}
                        </td>
                        <td
                          data-label="Fechas"
                          className="text-muted-foreground px-5 py-3 font-mono text-[11.5px]"
                        >
                          {formatearFecha(solicitud.dateS)} –{" "}
                          {formatearFecha(solicitud.dateE)}
                        </td>
                        <td data-label="Reporte" className="px-5 py-3">
                          {solicitud.state === "no_aplica" ? (
                            <span className="text-muted-foreground text-xs font-semibold">
                              No aplica
                            </span>
                          ) : solicitud.reporte_descargado_at ? (
                            <span className="text-status-disponible-fg text-xs font-semibold">
                              Descargado{" "}
                              {formatearFechaHora(solicitud.reporte_descargado_at)}
                            </span>
                          ) : (
                            <span className="bg-status-reservado-bg text-status-reservado-fg rounded px-2 py-0.5 text-xs font-semibold">
                              Sin descargar
                            </span>
                          )}
                        </td>
                        <td data-label="Pdf" className="px-5 py-3">
                          {solicitud.state !== "no_aplica" && (
                            <button
                              type="button"
                              aria-label="Descargar reporte"
                              title="Descargar reporte"
                              className="text-primary disabled:opacity-40"
                              disabled={descargandoId === solicitud.id}
                              onClick={() => manejarDescargar(solicitud, false)}
                            >
                              <Download className="size-4" strokeWidth={1.7} />
                            </button>
                          )}
                        </td>
                        <td data-label="Aplica" className="px-5 py-3">
                          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                            <Checkbox
                              checked={solicitud.state !== "no_aplica"}
                              disabled={cambiandoAplicaId === solicitud.id}
                              onCheckedChange={() => manejarCambiarAplica(solicitud)}
                              aria-label={`Aplica: ${solicitud.creador_nombre ?? "colaborador"}`}
                            />
                            {solicitud.state === "no_aplica" ? "No aplica" : "Aplica"}
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {solicitudActiva ? (
        <EstadoVacacionActiva solicitud={solicitudActiva} />
      ) : (
        <div className="bg-card border-border rounded-lg border">
          <div className="border-border text-muted-foreground border-b px-5 py-3.5 text-xs font-bold tracking-wide">
            ELIGE TUS VACACIONES
          </div>
          <div className="p-5">
            {!periodosDisponibles && !error ? (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            ) : error ? (
              <EmptyState title="No se pudo cargar" description={error} dashed />
            ) : periodosDisponibles!.length === 0 ? (
              <EmptyState
                title="Todavía no hay periodos disponibles"
                description="Cuando RRHH habilite fechas para elegir vacaciones, van a aparecer acá."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {periodosDisponibles!.map((periodo) => (
                  <div
                    key={periodo.id}
                    className="border-border flex flex-col gap-2.5 rounded-lg border p-4"
                  >
                    <div className="font-bold">{periodo.etiqueta}</div>
                    <div className="text-muted-foreground font-mono text-[12.5px]">
                      {formatearFecha(periodo.fecha_inicio)} –{" "}
                      {formatearFecha(periodo.fecha_fin)}
                    </div>
                    <Button size="sm" onClick={() => setEligiendo(periodo)}>
                      Elegir este periodo
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-card border-border overflow-hidden rounded-lg border">
        <div className="border-border text-muted-foreground border-b px-5 py-3.5 text-xs font-bold tracking-wide">
          MIS SOLICITUDES DE VACACIONES
        </div>
        {!misSolicitudes || misSolicitudes.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Todavía no has solicitado vacaciones"
              description="Elegí un periodo disponible arriba para crear tu primera solicitud."
            />
          </div>
        ) : (
          <table className="tabla-apilada w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                <th className="px-5 py-2.75 text-left">PERIODO</th>
                <th className="px-5 py-2.75 text-left">FECHAS</th>
                <th className="px-5 py-2.75 text-left">DÍAS</th>
                <th className="px-5 py-2.75 text-left">ESTADO</th>
                <th className="px-5 py-2.75 text-left">REPORTE</th>
              </tr>
            </thead>
            <tbody>
              {misSolicitudes.map((solicitud, index) => (
                <tr
                  key={solicitud.id}
                  className={cn(
                    "transition-colors",
                    index < misSolicitudes.length - 1 && "border-border border-b"
                  )}
                >
                  <td data-label="Periodo" className="px-5 py-3.5 font-semibold">
                    {solicitud.holidaysPeriod ?? "—"}
                  </td>
                  <td
                    data-label="Fechas"
                    className="text-muted-foreground px-5 py-3.5 font-mono text-[11.5px]"
                  >
                    {formatearFecha(solicitud.dateS)} – {formatearFecha(solicitud.dateE)}
                  </td>
                  <td data-label="Días" className="px-5 py-3.5 font-mono font-semibold">
                    {solicitud.approvedDays ?? solicitud.requestedDays ?? "—"}
                  </td>
                  <td data-label="Estado" className="px-5 py-3.5">
                    <StatusBadge variant={normalizarEstado(solicitud.state)} />
                    <MotivoRechazo
                      estado={solicitud.state}
                      motivo={solicitud.observation}
                    />
                  </td>
                  <td data-label="Reporte" className="px-5 py-3.5">
                    {normalizarEstado(solicitud.state) === "aprobado" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Descargar reporte"
                          title="Descargar reporte"
                          className="text-primary disabled:opacity-40"
                          disabled={descargandoId === solicitud.id}
                          onClick={() => manejarDescargar(solicitud, true)}
                        >
                          <Download className="size-4" strokeWidth={1.7} />
                        </button>
                        {solicitud.colectiva && (
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              solicitud.reporte_descargado_at
                                ? "text-status-disponible-fg"
                                : "text-status-reservado-fg"
                            )}
                          >
                            {solicitud.reporte_descargado_at
                              ? "Descargado"
                              : "Pendiente de descargar"}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {puedeGestionar && (
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="border-border text-muted-foreground border-b px-5 py-3.5 text-xs font-bold tracking-wide">
            TODAS LAS SOLICITUDES
          </div>
          {!todasSolicitudes || todasSinColectivas.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Todavía no hay solicitudes de vacaciones"
                description="Van a aparecer acá apenas algún colaborador elija un periodo."
              />
            </div>
          ) : (
            <table className="tabla-apilada w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                  <th className="px-5 py-2.75 text-left">ACCIONES</th>
                  <th className="px-5 py-2.75 text-left">COLABORADOR</th>
                  <th className="px-5 py-2.75 text-left">PERIODO</th>
                  <th className="px-5 py-2.75 text-left">DÍAS</th>
                  <th className="px-5 py-2.75 text-left">ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {todasSinColectivas.map((solicitud, index) => (
                  <tr
                    key={solicitud.id}
                    className={cn(
                      "hover:bg-muted/60 transition-colors",
                      index < todasSinColectivas.length - 1 && "border-border border-b"
                    )}
                  >
                    <td data-label="Acciones" className="px-5 py-3.5">
                      {normalizarEstado(solicitud.state) === "aprobado" && (
                        <button
                          type="button"
                          aria-label="Descargar reporte"
                          title="Descargar reporte"
                          className="text-primary disabled:opacity-40"
                          disabled={descargandoId === solicitud.id}
                          onClick={() => manejarDescargar(solicitud, false)}
                        >
                          <Download className="size-4" strokeWidth={1.7} />
                        </button>
                      )}
                      {solicitud.state === "pendiente" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            aria-label="Aprobar"
                            className="text-status-disponible-fg"
                            onClick={() => setAprobando(solicitud)}
                          >
                            <CheckCircle2 className="size-4" strokeWidth={1.7} />
                          </button>
                          <button
                            type="button"
                            aria-label="Rechazar"
                            className="text-status-bloqueado-fg"
                            onClick={() => setRechazando(solicitud)}
                          >
                            <XCircle className="size-4" strokeWidth={1.7} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td
                      data-label="Colaborador"
                      className="px-5 py-3.5 font-bold whitespace-nowrap"
                    >
                      {solicitud.creador_nombre ?? "—"}
                    </td>
                    <td data-label="Periodo" className="px-5 py-3.5">
                      {solicitud.holidaysPeriod ?? "—"}
                    </td>
                    <td data-label="Días" className="px-5 py-3.5 font-mono font-semibold">
                      {solicitud.requestedDays ?? "—"}
                    </td>
                    <td data-label="Estado" className="px-5 py-3.5">
                      <StatusBadge variant={normalizarEstado(solicitud.state)} />
                      <MotivoRechazo
                        estado={solicitud.state}
                        motivo={solicitud.observation}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Sheet open={!!eligiendo} onOpenChange={(valor) => !valor && setEligiendo(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Solicitar vacaciones</SheetTitle>
            <SheetDescription>
              {eligiendo?.etiqueta} ({formatearFecha(eligiendo?.fecha_inicio)} –{" "}
              {formatearFecha(eligiendo?.fecha_fin)})
            </SheetDescription>
          </SheetHeader>
          <div className="p-5">
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
              Comentario (opcional)
            </label>
            <Textarea
              placeholder="Escriba aquí algún comentario…"
              value={detalleSolicitud}
              onChange={(event) => setDetalleSolicitud(event.target.value)}
            />
          </div>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={enviandoSolicitud}
              onClick={() => setEligiendo(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={enviandoSolicitud}
              onClick={manejarElegirPeriodo}
            >
              {enviandoSolicitud ? "Enviando…" : "Confirmar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!aprobando} onOpenChange={(valor) => !valor && setAprobando(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Aprobar solicitud de vacaciones</SheetTitle>
            <SheetDescription>
              ¿Estás seguro de aprobar esta solicitud de vacaciones?
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={procesandoAprobacion}
              onClick={() => setAprobando(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={procesandoAprobacion}
              onClick={manejarAprobar}
            >
              {procesandoAprobacion ? "Aprobando…" : "Aprobar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!rechazando}
        onOpenChange={(valor) => {
          if (!valor) {
            setRechazando(null)
            setMotivoRechazo("")
          }
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Rechazar solicitud de vacaciones</SheetTitle>
            <SheetDescription>Ingresa el motivo del rechazo.</SheetDescription>
          </SheetHeader>
          <div className="p-5">
            <Textarea
              placeholder="Motivo del rechazo…"
              value={motivoRechazo}
              onChange={(event) => setMotivoRechazo(event.target.value)}
            />
          </div>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={procesandoRechazo}
              onClick={() => {
                setRechazando(null)
                setMotivoRechazo("")
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={procesandoRechazo}
              onClick={manejarRechazar}
            >
              {procesandoRechazo ? "Rechazando…" : "Rechazar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Reemplaza "ELIGE TUS VACACIONES" mientras el colaborador ya tiene una solicitud
// activa (pendiente o aprobada y vigente) — evita que vuelva a elegir el mismo
// periodo (o cualquier otro) que ya pidió, con el aviso puntual de cada caso: en
// espera de revisión, cuántos días faltan, o que ya está en curso.
function EstadoVacacionActiva({ solicitud }: { solicitud: SolicitudVacacionBackend }) {
  const pendiente = solicitud.state === "pendiente"
  const fechaHoy = hoy()
  const enCurso =
    !pendiente &&
    (solicitud.dateS ?? "") <= fechaHoy &&
    (solicitud.dateE ?? "") >= fechaHoy
  const faltan = solicitud.dateS ? diasHasta(solicitud.dateS) : 0

  const titulo = pendiente
    ? "Tu solicitud está pendiente de aprobación"
    : enCurso
      ? "¡Disfruta tus vacaciones!"
      : "¡Ya tienes vacaciones programadas!"

  const descripcion = pendiente
    ? `Pediste "${solicitud.holidaysPeriod ?? "este periodo"}" (${formatearFecha(solicitud.dateS)} – ${formatearFecha(solicitud.dateE)}) — en espera de que RRHH la revise.`
    : enCurso
      ? `Estás en tu periodo de vacaciones (${formatearFecha(solicitud.dateS)} – ${formatearFecha(solicitud.dateE)}). Vuelves el ${formatearFecha(solicitud.dateE)}.`
      : `"${solicitud.holidaysPeriod ?? "Tu periodo"}" (${formatearFecha(solicitud.dateS)} – ${formatearFecha(solicitud.dateE)}) ya está aprobado — faltan ${faltan} día${faltan === 1 ? "" : "s"}.`

  return (
    <div className="bg-brand-gradient flex items-center gap-4 rounded-lg p-5 text-white">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
        {pendiente ? (
          <Hourglass className="size-5" strokeWidth={1.8} />
        ) : (
          <Palmtree className="size-5" strokeWidth={1.8} />
        )}
      </div>
      <div>
        <div className="text-[15px] font-extrabold">{titulo}</div>
        <p className="mt-0.5 text-[13px] text-white/90">{descripcion}</p>
      </div>
    </div>
  )
}
