"use client"

import { useCallback, useEffect, useState } from "react"
import { Banknote, ClipboardList, PackageCheck, PackageSearch } from "lucide-react"
import Link from "next/link"

import { useCan } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { KpiCard } from "@/components/shared/kpi-card"
import { useSession } from "@/components/shared/session-provider"
import { MiniCalendar, type CalendarDay } from "@/components/shared/mini-calendar"
import { SalesBarChart, type SalesBarDatum } from "@/components/shared/sales-bar-chart"
import { StatusBadge } from "@/components/shared/status-badge"
import { TaskChecklist, type ChecklistTask } from "@/components/shared/task-checklist"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WelcomeBanner } from "@/components/shared/welcome-banner"
import { CrearTareaSheet } from "./crear-tarea-sheet"
import { CrearEventoSheet } from "./crear-evento-sheet"
import { dashboardApi, type ResumenDashboard } from "@/lib/api/dashboard-api"
import { tareasApi, type Tarea } from "@/lib/api/tareas-api"
import { eventosApi, type Evento } from "@/lib/api/eventos-api"
import { listarEntregas, type EntregaListado } from "@/lib/api/entregas-api"

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

function claveMes(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`
}

function formatoMiles(n: number) {
  return n.toLocaleString("es-EC")
}

// "2026-12-08" -> "08/12"
function fechaCorta(fecha: string | null): string {
  if (!fecha) return "Sin fecha"
  const [, mes, dia] = fecha.split("-")
  return `${dia}/${mes}`
}

export default function DashboardHomePage() {
  const hoy = new Date()
  const puedeGestionarEventos = useCan("eventos:gestionar")
  const usuario = useSession()
  // Solo quien tiene algun permiso de entregas consulta el modulo (los demas recibirian 403).
  const puedeVerEntregas = useCan("entregas:ver", true)
  const puedeEntregar = useCan("entregas:entregar", true)
  const puedeCerrarEntregas = useCan("entregas:cerrar", true)
  const tieneEntregas = puedeVerEntregas || puedeEntregar || puedeCerrarEntregas

  // ── Resumen (KPIs + gráfico de ventas) ──
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null)
  const [cargandoResumen, setCargandoResumen] = useState(true)
  const [errorResumen, setErrorResumen] = useState(false)

  const cargarResumen = useCallback(() => {
    setCargandoResumen(true)
    setErrorResumen(false)
    dashboardApi
      .resumen()
      .then(setResumen)
      .catch(() => setErrorResumen(true))
      .finally(() => setCargandoResumen(false))
  }, [])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  // ── Tareas ──
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [cargandoTareas, setCargandoTareas] = useState(true)
  const [errorTareas, setErrorTareas] = useState(false)
  const [sheetTareaAbierto, setSheetTareaAbierto] = useState(false)

  const cargarTareas = useCallback(() => {
    setCargandoTareas(true)
    setErrorTareas(false)
    tareasApi
      .listar()
      .then(setTareas)
      .catch(() => setErrorTareas(true))
      .finally(() => setCargandoTareas(false))
  }, [])

  useEffect(() => {
    cargarTareas()
  }, [cargarTareas])

  function alternarTarea(id: number) {
    tareasApi.alternar(id).catch(() => cargarTareas())
  }

  // ── Entregas asignadas al usuario (se muestran como tareas pendientes) ──
  const [entregas, setEntregas] = useState<EntregaListado[]>([])
  useEffect(() => {
    if (!tieneEntregas) return
    listarEntregas()
      .then(({ items }) => setEntregas(items))
      .catch(() => setEntregas([]))
  }, [tieneEntregas])

  // Mis entregas abiertas (asesor asignado = yo), las mas proximas primero.
  const misEntregas = entregas
    .filter((e) => e.encargado === usuario.id && !e.cerrada && e.entrega !== "COMPLETO")
    .sort((a, b) =>
      `${a.fechaPlanificada ?? "9999"} ${a.hora ?? ""}`.localeCompare(
        `${b.fechaPlanificada ?? "9999"} ${b.hora ?? ""}`
      )
    )

  // ── Calendario / eventos ──
  const [mesActual, setMesActual] = useState(
    () => new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  )
  const [eventos, setEventos] = useState<Evento[]>([])
  const [cargandoEventos, setCargandoEventos] = useState(true)
  const [errorEventos, setErrorEventos] = useState(false)
  const [sheetEventoAbierto, setSheetEventoAbierto] = useState(false)

  // Día clickeado en el mini calendario (para resaltarlo y precargar la fecha al crear
  // una tarea desde ahí) — se limpia al cambiar de mes, un día de agosto no debería
  // seguir resaltado al navegar a septiembre.
  const [diaClickeado, setDiaClickeado] = useState<number | null>(null)
  const [fechaTareaSugerida, setFechaTareaSugerida] = useState<string | undefined>(
    undefined
  )
  useEffect(() => {
    setDiaClickeado(null)
  }, [mesActual])

  function crearTareaParaDia(day: number) {
    setDiaClickeado(day)
    setFechaTareaSugerida(`${claveMes(mesActual)}-${String(day).padStart(2, "0")}`)
    setSheetTareaAbierto(true)
  }

  const cargarEventos = useCallback(() => {
    setCargandoEventos(true)
    setErrorEventos(false)
    eventosApi
      .listarPorMes(claveMes(mesActual))
      .then(setEventos)
      .catch(() => setErrorEventos(true))
      .finally(() => setCargandoEventos(false))
  }, [mesActual])

  useEffect(() => {
    cargarEventos()
  }, [cargarEventos])

  // ── Derivados ──

  const tareasChecklist: ChecklistTask[] = tareas.map((t) => ({
    id: t.id,
    label: t.titulo,
    done: Boolean(t.completada),
    tag: t.etiqueta ?? undefined,
  }))

  const ventasPorMes = resumen?.ventasPorMes ?? []
  const maxVentas = Math.max(1, ...ventasPorMes.map((v) => v.cantidad))
  const ventasChart: SalesBarDatum[] = ventasPorMes.map((v, i) => ({
    label: v.mes.charAt(0).toUpperCase() + v.mes.slice(1),
    heightPct: (v.cantidad / maxVentas) * 100,
    value: v.cantidad,
    highlighted: i === ventasPorMes.length - 1,
  }))

  const primerDiaSemana = mesActual.getDay() // 0 = domingo, matches MiniCalendar's DIAS
  const diasEnMes = new Date(
    mesActual.getFullYear(),
    mesActual.getMonth() + 1,
    0
  ).getDate()
  const diasConEvento = new Set(eventos.map((e) => Number(e.fecha.slice(8, 10))))
  // Las entregas del mes tambien marcan su dia en el calendario.
  for (const e of misEntregas) {
    if (e.fechaPlanificada?.startsWith(claveMes(mesActual))) {
      diasConEvento.add(Number(e.fechaPlanificada.slice(8, 10)))
    }
  }
  const diasCalendario: CalendarDay[] = Array.from({ length: diasEnMes }, (_, i) => ({
    day: i + 1,
    hasEvent: diasConEvento.has(i + 1),
  }))
  const esMesActualReal =
    mesActual.getFullYear() === hoy.getFullYear() &&
    mesActual.getMonth() === hoy.getMonth()

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4 sm:p-5 lg:gap-4.5 lg:p-6.5">
        <WelcomeBanner
          eyebrow="INTRANET · APLICATIVOS DE GRUPO ANCON"
          title="Bienvenido a ANCONnet"
        />

        <div className="grid shrink-0 grid-cols-2 gap-3.5 lg:grid-cols-3">
          <KpiCard
            label="Ventas este mes"
            value={
              cargandoResumen
                ? "—"
                : errorResumen
                  ? "—"
                  : formatoMiles(resumen!.totalVentas)
            }
            trend={
              errorResumen || cargandoResumen
                ? undefined
                : resumen!.tendenciaVentasPct > 0
                  ? "up"
                  : resumen!.tendenciaVentasPct < 0
                    ? "down"
                    : "neutral"
            }
            trendLabel={
              errorResumen
                ? "No se pudo cargar"
                : cargandoResumen
                  ? undefined
                  : `${resumen!.tendenciaVentasPct > 0 ? "+" : ""}${resumen!.tendenciaVentasPct}% vs. mes anterior`
            }
            icon={<Banknote className="text-primary size-[18px]" strokeWidth={1.7} />}
          />
          <KpiCard
            label="Lotes disponibles"
            value={
              cargandoResumen
                ? "—"
                : errorResumen
                  ? "—"
                  : formatoMiles(resumen!.lotesDisponibles)
            }
            trendLabel={errorResumen ? "No se pudo cargar" : undefined}
            icon={
              <PackageSearch className="text-primary size-[18px]" strokeWidth={1.7} />
            }
          />
          <KpiCard
            className="col-span-2 lg:col-span-1"
            label="Reservas activas"
            value={<Badge variant="outline">Próximamente</Badge>}
            icon={
              <ClipboardList
                className="text-muted-foreground size-[18px]"
                strokeWidth={1.7}
              />
            }
          />
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-3.5 lg:min-h-0 lg:flex-1 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-1.5 lg:min-h-0">
            <MiniCalendar
              className="flex-1"
              monthLabel={`${MESES[mesActual.getMonth()]} ${mesActual.getFullYear()}`}
              leadingBlanks={primerDiaSemana}
              days={diasCalendario}
              selectedDay={diaClickeado ?? (esMesActualReal ? hoy.getDate() : undefined)}
              onSelectDay={crearTareaParaDia}
              onPrevMonth={() =>
                setMesActual((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              }
              onNextMonth={() =>
                setMesActual((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              }
              footer={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setFechaTareaSugerida(undefined)
                      setSheetTareaAbierto(true)
                    }}
                  >
                    Crear tarea
                  </Button>
                  {puedeGestionarEventos ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-accent text-accent-foreground flex-1"
                      onClick={() => setSheetEventoAbierto(true)}
                    >
                      Crear evento
                    </Button>
                  ) : null}
                </>
              }
            />
            {errorEventos ? (
              <p className="text-status-bloqueado-fg px-1 text-[11px]">
                No se pudieron cargar los eventos de este mes.
              </p>
            ) : cargandoEventos ? (
              <p className="text-muted-foreground px-1 text-[11px]">Cargando eventos…</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3.5 lg:min-h-0">
            <div className="bg-card border-border flex shrink-0 flex-col overflow-hidden rounded-lg border p-4 lg:min-h-0 lg:flex-1 lg:p-4.5">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <div className="text-sm font-bold">Tareas pendientes</div>
                <StatusBadge variant="pendiente">
                  {cargandoTareas
                    ? "—"
                    : tareasChecklist.filter((t) => !t.done).length + misEntregas.length}
                </StatusBadge>
              </div>
              <div className="max-h-72 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
                {misEntregas.length > 0 ? (
                  <div className="mb-2 flex flex-col gap-2">
                    {misEntregas.map((e) => (
                      <Link
                        key={e.id}
                        href={`/entregas?proceso=${e.id}`}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors",
                          // Amarillo: pasaron 2 dias de la fecha y la entrega sigue sin registrar.
                          e.vencida
                            ? "bg-status-reservado-bg border-status-reservado-border hover:brightness-[0.97]"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <span className="bg-accent flex size-[18px] shrink-0 items-center justify-center rounded-[6px]">
                          <PackageCheck
                            className="text-accent-foreground size-3"
                            strokeWidth={2}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            Entrega · {e.cliente ?? "—"}
                            {e.lote ? ` · ${e.lote}` : ""}
                          </span>
                          {e.vencida ? (
                            <span className="text-status-reservado-fg block text-[11px] font-bold">
                              Entrega sin completar
                            </span>
                          ) : null}
                          {!e.preRegistrada ? (
                            <span className="text-muted-foreground block text-[11px]">
                              Pre-entrega pendiente
                            </span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[10.5px] font-bold">
                          {fechaCorta(e.fechaPlanificada)}
                          {e.hora ? ` · ${e.hora}` : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                {errorTareas ? (
                  <p className="text-muted-foreground text-xs">
                    No se pudieron cargar tus tareas.
                  </p>
                ) : cargandoTareas ? (
                  <p className="text-muted-foreground text-xs">Cargando…</p>
                ) : tareasChecklist.length === 0 ? (
                  misEntregas.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No tienes tareas pendientes.
                    </p>
                  ) : null
                ) : (
                  <TaskChecklist tasks={tareasChecklist} onToggle={alternarTarea} />
                )}
              </div>
            </div>

            <div className="bg-card border-border flex shrink-0 flex-col rounded-lg border p-4 lg:flex-1 lg:p-4.5">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="text-sm font-bold">Actividad de ventas</div>
                <span className="text-muted-foreground text-[11px]">últimos 7 meses</span>
              </div>
              {errorResumen ? (
                <p className="text-muted-foreground text-xs">
                  No se pudo cargar el gráfico.
                </p>
              ) : cargandoResumen ? (
                <p className="text-muted-foreground text-xs">Cargando…</p>
              ) : (
                <SalesBarChart data={ventasChart} />
              )}
            </div>
          </div>
        </div>
      </div>

      <CrearTareaSheet
        open={sheetTareaAbierto}
        onOpenChange={setSheetTareaAbierto}
        fechaSugerida={fechaTareaSugerida}
        onCreada={cargarTareas}
      />
      <CrearEventoSheet
        open={sheetEventoAbierto}
        onOpenChange={setSheetEventoAbierto}
        fechaSugerida={`${claveMes(mesActual)}-01`}
        onCreado={cargarEventos}
      />
    </div>
  )
}
