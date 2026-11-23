"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Archive,
  BarChart3,
  CalendarClock,
  Copy,
  Pencil,
  Send,
  Upload,
  XCircle,
} from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { PillTabs } from "@/components/shared/pill-tabs"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { TimePickerField } from "@/components/shared/time-picker-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  asignarEncuestaApp,
  cancelarAsignacionApp,
  duplicarEncuestaApp,
  editarEncuestaApp,
  listarAsignacionesApp,
  listarDestinatariosApp,
  obtenerEncuestaApp,
} from "@/lib/api/app-encuestas-api"

import {
  ESTADO_ASIGNACION_LABELS,
  ESTADO_ENCUESTA_LABELS,
  TIPO_PREGUNTA_LABELS,
  VARIANTE_ESTADO_ASIGNACION,
  VARIANTE_ESTADO_ENCUESTA,
  esSeleccion,
  formatearFechaHora,
  type Asignacion,
  type Destinatario,
  type EncuestaDetalle,
  type EstadoAsignacion,
} from "./datos"
import { SelectorDestinatarios } from "./selector-destinatarios"
import { VistaPreviaApp } from "./vista-previa-app"

type Pestana = "preguntas" | "vista-previa" | "asignar" | "seguimiento"

function mensajeDeError(err: unknown): string {
  return err instanceof Error ? err.message : "Ocurrió un error inesperado."
}

export function DetalleEncuestaSheet({
  encuestaId,
  onOpenChange,
  onEditar,
  onCambio,
  onDuplicada,
}: {
  encuestaId: number | null
  onOpenChange: (open: boolean) => void
  onEditar: (encuesta: EncuestaDetalle) => void
  onCambio: () => Promise<void> | void
  onDuplicada: (id: number) => void
}) {
  const toast = useToast()
  const [encuesta, setEncuesta] = useState<EncuestaDetalle | null>(null)
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [cargando, setCargando] = useState(false)
  const [pestana, setPestana] = useState<Pestana>("preguntas")
  const [accion, setAccion] = useState<string | null>(null)

  // Asignar
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [cargandoDestinatarios, setCargandoDestinatarios] = useState(false)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [cuando, setCuando] = useState<"ahora" | "programar">("ahora")
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")

  // Seguimiento
  const [filtro, setFiltro] = useState<"todas" | EstadoAsignacion>("todas")
  const [aCancelar, setACancelar] = useState<Asignacion | null>(null)
  const [confirmarArchivar, setConfirmarArchivar] = useState(false)

  const cargar = useCallback(async (id: number) => {
    const [detalle, lista] = await Promise.all([
      obtenerEncuestaApp(id),
      listarAsignacionesApp(id),
    ])
    setEncuesta(detalle)
    setAsignaciones(lista)
  }, [])

  useEffect(() => {
    if (encuestaId === null) return
    let cancelado = false
    setEncuesta(null)
    setAsignaciones([])
    setPestana("preguntas")
    setSeleccion([])
    setCuando("ahora")
    setFecha("")
    setHora("")
    setFiltro("todas")
    setCargando(true)
    cargar(encuestaId)
      .catch(
        (err) =>
          !cancelado && toast({ variant: "error", description: mensajeDeError(err) })
      )
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [encuestaId, cargar, toast])

  // Los usuarios de la app se cargan una vez, al abrir "Asignar".
  useEffect(() => {
    if (pestana !== "asignar" || destinatarios.length > 0 || cargandoDestinatarios) return
    setCargandoDestinatarios(true)
    listarDestinatariosApp()
      .then(setDestinatarios)
      .catch((err) => toast({ variant: "error", description: mensajeDeError(err) }))
      .finally(() => setCargandoDestinatarios(false))
  }, [pestana, destinatarios.length, cargandoDestinatarios, toast])

  const pendientes = useMemo(
    () =>
      new Set(asignaciones.filter((a) => a.estado === "pending").map((a) => a.cedula)),
    [asignaciones]
  )
  const conteo = useMemo(() => {
    const c = { pending: 0, answered: 0, cancelled: 0 }
    for (const a of asignaciones) c[a.estado] += 1
    return c
  }, [asignaciones])
  const asignacionesVisibles =
    filtro === "todas" ? asignaciones : asignaciones.filter((a) => a.estado === filtro)

  const fechaProgramada =
    cuando === "programar" && fecha && hora ? new Date(`${fecha}T${hora}:00`) : null
  const fechaPasada = fechaProgramada !== null && fechaProgramada.getTime() < Date.now()
  const puedeAsignar =
    accion === null &&
    seleccion.length > 0 &&
    encuesta?.estado !== "archived" &&
    (cuando === "ahora" || (fechaProgramada !== null && !fechaPasada))

  async function ejecutar(nombre: string, tarea: () => Promise<void>) {
    setAccion(nombre)
    try {
      await tarea()
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setAccion(null)
    }
  }

  function asignar() {
    if (!encuesta) return
    void ejecutar("asignar", async () => {
      const r = await asignarEncuestaApp(encuesta.id, {
        cedulas: seleccion,
        scheduled_for: fechaProgramada ? fechaProgramada.toISOString() : undefined,
      })
      const omitidas = r.omitidas.length
      toast({
        variant: r.asignadas === 0 ? "info" : "success",
        description:
          r.asignadas === 0
            ? "Todos ya la tenían pendiente; no se volvió a enviar."
            : `${r.asignadas === 1 ? "Asignada a 1 usuario" : `Asignada a ${r.asignadas} usuarios`}${
                r.programada
                  ? "; el aviso saldrá en la fecha programada"
                  : " y avisados en la app"
              }${omitidas > 0 ? ` (${omitidas} ya la tenían pendiente)` : ""}.`,
      })
      setSeleccion([])
      setFecha("")
      setHora("")
      await cargar(encuesta.id)
      await onCambio()
      setPestana("seguimiento")
    })
  }

  function cambiarEstado(estado: "published" | "archived") {
    if (!encuesta) return
    void ejecutar(estado, async () => {
      const actualizada = await editarEncuestaApp(encuesta.id, { status: estado })
      setEncuesta(actualizada)
      toast({
        variant: "success",
        description:
          estado === "archived" ? "Encuesta archivada." : "Encuesta publicada.",
      })
      await onCambio()
    })
  }

  function duplicar() {
    if (!encuesta) return
    void ejecutar("duplicar", async () => {
      const copia = await duplicarEncuestaApp(encuesta.id)
      toast({ variant: "success", description: "Se creó una copia en borrador." })
      await onCambio()
      onDuplicada(copia.id)
    })
  }

  function cancelarAsignacion(a: Asignacion) {
    if (!encuesta) return
    void ejecutar(`cancelar-${a.id}`, async () => {
      await cancelarAsignacionApp(a.id)
      toast({ variant: "success", description: "Asignación cancelada." })
      await cargar(encuesta.id)
      await onCambio()
    })
  }

  return (
    <Sheet open={encuestaId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {cargando || !encuesta ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Encuesta</SheetTitle>
              <SheetDescription>Cargando encuesta</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 items-center justify-center py-24">
              <Spinner />
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="border-border border-b p-5">
              <div className="mb-1 flex items-center gap-2">
                <StatusBadge variant={VARIANTE_ESTADO_ENCUESTA[encuesta.estado]}>
                  {ESTADO_ENCUESTA_LABELS[encuesta.estado]}
                </StatusBadge>
                {encuesta.etiquetaInterna ? (
                  <span className="text-primary truncate text-xs font-semibold">
                    {encuesta.etiquetaInterna}
                  </span>
                ) : null}
              </div>
              <SheetTitle>{encuesta.titulo}</SheetTitle>
              <SheetDescription>
                {encuesta.descripcion || "Sin mensaje para el usuario."}
              </SheetDescription>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild size="sm">
                  <Link href={`/app/encuestas/${encuesta.id}/reporte`}>
                    <BarChart3 className="size-3.5" strokeWidth={1.8} />
                    Ver reporte
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEditar(encuesta)}>
                  <Pencil className="size-3.5" strokeWidth={1.8} />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={accion !== null}
                  onClick={duplicar}
                >
                  <Copy className="size-3.5" strokeWidth={1.8} />
                  {accion === "duplicar" ? "Duplicando…" : "Duplicar"}
                </Button>
                {encuesta.estado === "archived" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={accion !== null}
                    onClick={() => cambiarEstado("published")}
                  >
                    <Upload className="size-3.5" strokeWidth={1.8} />
                    Volver a publicar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={accion !== null}
                    onClick={() => setConfirmarArchivar(true)}
                  >
                    <Archive className="size-3.5" strokeWidth={1.8} />
                    Archivar
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="bg-muted/60 border-border border-b px-5 py-3">
              <PillTabs
                tabs={[
                  { id: "preguntas", label: "Preguntas" },
                  { id: "vista-previa", label: "Vista previa" },
                  { id: "asignar", label: "Asignar" },
                  { id: "seguimiento", label: "Seguimiento" },
                ]}
                value={pestana}
                onChange={(id) => setPestana(id as Pestana)}
                // Mismo estilo que el resto de pestañas; si el panel es angosto pasan a
                // una segunda fila en vez de cortarse. Los conteos están dentro de cada
                // pestaña (ej. los filtros de Seguimiento), no en la etiqueta.
                className="flex-wrap"
              />
            </div>

            <div className="p-5">
              {pestana === "preguntas" ? (
                <ol className="space-y-2">
                  {encuesta.preguntas.map((p, i) => (
                    <li
                      key={p.id}
                      className="border-border rounded-md border px-3.5 py-2.5"
                    >
                      <p className="text-[13px] font-semibold">
                        {i + 1}. {p.text}
                        {p.required ? <span className="text-primary"> *</span> : null}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {TIPO_PREGUNTA_LABELS[p.type]}
                        {esSeleccion(p.type)
                          ? `: ${p.options.map((o) => o.label).join(" · ")}${
                              p.config?.allow_other ? " · Otro" : ""
                            }`
                          : ""}
                      </p>
                    </li>
                  ))}
                  <p className="text-muted-foreground pt-1 text-[11px]">
                    * Obligatoria en la app.
                  </p>
                </ol>
              ) : null}

              {pestana === "vista-previa" ? (
                <VistaPreviaApp
                  titulo={encuesta.titulo}
                  descripcion={encuesta.descripcion ?? ""}
                  preguntas={encuesta.preguntas}
                />
              ) : null}

              {pestana === "asignar" ? (
                encuesta.estado === "archived" ? (
                  <p className="bg-muted/60 border-border text-muted-foreground rounded-md border px-3 py-6 text-center text-xs">
                    La encuesta está archivada. Vuelve a publicarla para asignarla.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {encuesta.estado === "draft" ? (
                      <p className="bg-status-reservado-bg text-status-reservado-fg rounded-md px-3 py-2.5 text-xs">
                        Está en borrador: al asignarla se publicará automáticamente.
                      </p>
                    ) : null}
                    <SelectorDestinatarios
                      destinatarios={destinatarios}
                      cargando={cargandoDestinatarios}
                      seleccion={seleccion}
                      onCambio={setSeleccion}
                      excluir={pendientes}
                    />
                    <div className="border-border space-y-3 border-t pt-4">
                      <p className="text-muted-foreground text-xs font-semibold">
                        Cuándo avisar en la app
                      </p>
                      <PillTabs
                        tabs={[
                          { id: "ahora", label: "Ahora" },
                          { id: "programar", label: "Programar" },
                        ]}
                        value={cuando}
                        onChange={(id) => setCuando(id as "ahora" | "programar")}
                      />
                      {cuando === "programar" ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <DatePickerField
                            label="Fecha"
                            value={fecha}
                            onChange={setFecha}
                          />
                          <TimePickerField label="Hora" value={hora} onChange={setHora} />
                        </div>
                      ) : null}
                      {fechaPasada ? (
                        <p className="text-destructive text-xs">
                          Esa fecha y hora ya pasaron.
                        </p>
                      ) : null}
                      <p className="text-muted-foreground text-[11px]">
                        {cuando === "programar"
                          ? "La encuesta no aparecerá en la app hasta esa fecha; ahí también llega el aviso."
                          : "La encuesta aparece de inmediato en la app y le llega un aviso."}
                      </p>
                    </div>
                    <Button className="w-full" disabled={!puedeAsignar} onClick={asignar}>
                      {accion === "asignar" ? (
                        "Asignando…"
                      ) : cuando === "programar" ? (
                        <>
                          <CalendarClock className="size-4" strokeWidth={1.8} />
                          Programar para {seleccion.length || ""}{" "}
                          {seleccion.length === 1 ? "usuario" : "usuarios"}
                        </>
                      ) : (
                        <>
                          <Send className="size-4" strokeWidth={1.8} />
                          Asignar a {seleccion.length || ""}{" "}
                          {seleccion.length === 1 ? "usuario" : "usuarios"}
                        </>
                      )}
                    </Button>
                  </div>
                )
              ) : null}

              {pestana === "seguimiento" ? (
                <div className="space-y-3">
                  <PillTabs
                    tabs={[
                      { id: "todas", label: `Todas (${asignaciones.length})` },
                      { id: "pending", label: `Pendientes (${conteo.pending})` },
                      { id: "answered", label: `Respondidas (${conteo.answered})` },
                      { id: "cancelled", label: `Canceladas (${conteo.cancelled})` },
                    ]}
                    value={filtro}
                    onChange={(id) => setFiltro(id as "todas" | EstadoAsignacion)}
                  />
                  {asignacionesVisibles.length === 0 ? (
                    <p className="bg-muted/60 border-border text-muted-foreground rounded-md border px-3 py-6 text-center text-xs">
                      {asignaciones.length === 0
                        ? "Todavía no se ha asignado a nadie."
                        : "No hay asignaciones en este estado."}
                    </p>
                  ) : (
                    <ul className="border-border divide-border divide-y rounded-md border">
                      {asignacionesVisibles.map((a) => (
                        <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">
                              {a.nombre || "Usuario sin nombre"}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              <span className="font-mono">{a.cedula}</span> ·{" "}
                              {a.estado === "answered"
                                ? `Respondió ${formatearFechaHora(a.respondidaEn)}`
                                : a.programadaPara &&
                                    new Date(a.programadaPara).getTime() > Date.now()
                                  ? `Programada ${formatearFechaHora(a.programadaPara)}`
                                  : `Asignada ${formatearFechaHora(a.asignadaEn)}`}
                            </p>
                          </div>
                          <StatusBadge variant={VARIANTE_ESTADO_ASIGNACION[a.estado]}>
                            {ESTADO_ASIGNACION_LABELS[a.estado]}
                          </StatusBadge>
                          {a.estado === "pending" ? (
                            <button
                              type="button"
                              aria-label="Cancelar asignación"
                              title="Cancelar asignación"
                              disabled={accion !== null}
                              onClick={() => setACancelar(a)}
                              className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                            >
                              <XCircle className="size-4" strokeWidth={1.8} />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>

      <ConfirmDialog
        abierto={aCancelar !== null}
        titulo="¿Cancelar esta asignación?"
        descripcion={
          aCancelar
            ? `${aCancelar.nombre || aCancelar.cedula} ya no verá la encuesta en la app. Si el aviso todavía no salió, tampoco se enviará.`
            : undefined
        }
        textoConfirmar="Cancelar asignación"
        destructivo
        onConfirmar={() => {
          const a = aCancelar
          setACancelar(null)
          if (a) cancelarAsignacion(a)
        }}
        onCancelar={() => setACancelar(null)}
      />
      <ConfirmDialog
        abierto={confirmarArchivar}
        titulo="¿Archivar esta encuesta?"
        descripcion="No se podrá asignar a más usuarios. Las respuestas y el reporte se conservan, y quienes ya la tienen pendiente todavía pueden responderla."
        textoConfirmar="Archivar"
        onConfirmar={() => {
          setConfirmarArchivar(false)
          cambiarEstado("archived")
        }}
        onCancelar={() => setConfirmarArchivar(false)}
      />
    </Sheet>
  )
}
