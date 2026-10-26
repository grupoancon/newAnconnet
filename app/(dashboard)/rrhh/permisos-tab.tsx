"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/lib/navigation"
import {
  CheckCircle2,
  Download,
  Pencil,
  Plus,
  Printer,
  Trash2,
  XCircle,
} from "lucide-react"

import { useCan } from "@/components/shared/can"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { EmptyState } from "@/components/shared/empty-state"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { TIPOS_PERMISO } from "@/components/shared/select-options"
import { MotivoRechazo } from "@/components/shared/motivo-rechazo"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { TimePickerField } from "@/components/shared/time-picker-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
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
  actualizarPermiso,
  aprobarPermiso,
  listarColaboradores,
  type ColaboradorBackend,
  type FuenteDescuentoPermiso,
  eliminarPermiso,
  listarMisPermisos,
  listarTodosPermisos,
  type SolicitudPermisoConCreador,
  rechazarPermiso,
  type SolicitudPermisoBackend,
} from "@/lib/api/rrhh-api"
import {
  buscarMiSolicitante,
  buscarSolicitante,
  descargarReportePermiso,
  type AccionReporte,
} from "@/lib/rrhh-reportes-pdf"
import { cn } from "@/lib/utils"

// Tipos de permiso que se descuentan del saldo al aprobarlos (quien aprueba elige de
// dónde) — mismos que TIPOS_PERMISO_CON_DESCUENTO del backend.
const TIPOS_CON_DESCUENTO = ["PERMISO CARGO A VACACIONES", "PERMISO DEL DIA"]

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

function formatearHora(hora: string | null | undefined): string {
  if (!hora) return "—"
  return hora.slice(0, 5)
}

// Misma regla que RrhhService.assertFechaPosteriorAHoy — ver nuevo-permiso-content.tsx.
function manana(): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

function normalizarEstado(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "aprobado" || clave === "rechazado") return clave
  return "pendiente"
}

export function PermisosTab() {
  const router = useRouter()
  const toast = useToast()
  const puedeGestionar = useCan("rrhh:gestionar")

  const [solicitudes, setSolicitudes] = useState<SolicitudPermisoConCreador[] | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  const [edicion, setEdicion] = useState<SolicitudPermisoBackend | null>(null)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [eliminando, setEliminando] = useState<SolicitudPermisoBackend | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [aprobando, setAprobando] = useState<SolicitudPermisoBackend | null>(null)
  const [procesandoAprobacion, setProcesandoAprobacion] = useState(false)
  // Solo para los permisos con descuento (cargo a vacaciones / del día): de dónde se descuenta + saldo del solicitante.
  const [fuenteDescuento, setFuenteDescuento] = useState<FuenteDescuentoPermiso | "">("")
  const [saldoSolicitante, setSaldoSolicitante] = useState<ColaboradorBackend | null>(
    null
  )
  const cargoAVacaciones = TIPOS_CON_DESCUENTO.includes(aprobando?.typePermissions ?? "")
  const [rechazando, setRechazando] = useState<SolicitudPermisoBackend | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState("")
  const [procesandoRechazo, setProcesandoRechazo] = useState(false)
  const [descargandoId, setDescargandoId] = useState<number | null>(null)

  // Al abrir "Aprobar" sobre un permiso con cargo a vacaciones, se trae el saldo del
  // solicitante (el id de usuario viaja en `soliciter`) para mostrar con qué cuenta.
  useEffect(() => {
    setFuenteDescuento("")
    setSaldoSolicitante(null)
    if (!aprobando || !TIPOS_CON_DESCUENTO.includes(aprobando.typePermissions ?? ""))
      return
    let vigente = true
    listarColaboradores()
      .then((lista) => {
        if (vigente)
          setSaldoSolicitante(lista.find((c) => c.id === aprobando.soliciter) ?? null)
      })
      .catch(() => {
        // Silencioso: sin saldo igual se puede elegir la fuente (el backend valida).
      })
    return () => {
      vigente = false
    }
  }, [aprobando])

  function cargar() {
    setError(null)
    // Quien gestiona revisa las solicitudes de TODOS; el resto, solo las suyas.
    const carga: Promise<SolicitudPermisoConCreador[]> = puedeGestionar
      ? listarTodosPermisos()
      : listarMisPermisos().then((lista) =>
          lista.map((s) => ({ ...s, creador_nombre: null }))
        )
    carga.then(setSolicitudes).catch((err) => {
      setError(
        err instanceof RrhhApiError ? err.message : "No se pudo conectar con el servidor"
      )
    })
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeGestionar])

  async function manejarGuardarEdicion() {
    if (!edicion) return
    setGuardandoEdicion(true)
    try {
      await actualizarPermiso(edicion.id, {
        fechaPermiso: edicion.dateS ?? undefined,
        horaInicial: edicion.startTime ?? undefined,
        horaFinal: edicion.finalTime ?? undefined,
        tipoPermiso: edicion.typePermissions ?? undefined,
        detalle: edicion.details ?? undefined,
      })
      toast({ variant: "success", description: "Solicitud actualizada." })
      setEdicion(null)
      cargar()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo actualizar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function manejarDescargar(
    fila: SolicitudPermisoConCreador,
    accion: AccionReporte = "descargar"
  ) {
    setDescargandoId(fila.id)
    try {
      await descargarReportePermiso(
        fila,
        await (puedeGestionar
          ? buscarSolicitante(fila.soliciter, fila.creador_nombre).then((datos) => ({
              ...datos,
              nombre: datos.nombre ?? fila.creador_nombre,
            }))
          : buscarMiSolicitante()),
        accion
      )
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

  async function manejarEliminar() {
    if (!eliminando) return
    setBorrando(true)
    try {
      await eliminarPermiso(eliminando.id)
      toast({ variant: "success", description: "Solicitud eliminada." })
      setEliminando(null)
      cargar()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setBorrando(false)
    }
  }

  async function manejarAprobar() {
    if (!aprobando) return
    if (cargoAVacaciones && !fuenteDescuento) {
      toast({
        variant: "error",
        title: "Falta elegir de dónde se descuenta",
        description: "Elige días normales, días aumentados u horas a favor.",
      })
      return
    }
    setProcesandoAprobacion(true)
    try {
      await aprobarPermiso(aprobando.id, fuenteDescuento || undefined)
      toast({ variant: "success", description: "Solicitud aprobada." })
      setAprobando(null)
      cargar()
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
      await rechazarPermiso(rechazando.id, motivoRechazo.trim())
      toast({ variant: "success", description: "Solicitud rechazada." })
      setRechazando(null)
      setMotivoRechazo("")
      cargar()
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

  return (
    <>
      <div className="mb-3.5 flex justify-end">
        <Button onClick={() => router.push("/rrhh/permisos/nueva")}>
          <Plus className="size-3.5" strokeWidth={1.8} />
          Nueva solicitud
        </Button>
      </div>

      <div className="bg-card border-border overflow-hidden rounded-lg border">
        {!solicitudes && !error ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-4 sm:p-6.5">
            <EmptyState
              title="No se pudieron cargar las solicitudes"
              description={error}
              dashed
            />
          </div>
        ) : solicitudes!.length === 0 ? (
          <div className="p-4 sm:p-6.5">
            <EmptyState
              title="Todavía no tienes solicitudes de permiso"
              description="Usa el botón «Nueva solicitud» para crear la primera."
            />
          </div>
        ) : (
          <table className="tabla-apilada w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                <th className="px-5 py-2.75 text-left">ACCIONES</th>
                {puedeGestionar && (
                  <th className="px-5 py-2.75 text-left">COLABORADOR</th>
                )}
                <th className="px-5 py-2.75 text-left">FECHA</th>
                <th className="px-5 py-2.75 text-left">TIPO</th>
                <th className="px-5 py-2.75 text-left">HORARIO</th>
                <th className="px-5 py-2.75 text-left">HORAS SOLICITADAS</th>
                <th className="px-5 py-2.75 text-left">DETALLE</th>
                <th className="px-5 py-2.75 text-left">ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes!.map((fila, index) => (
                <tr
                  key={fila.id}
                  className={cn(
                    "hover:bg-muted/60 transition-colors",
                    index < solicitudes!.length - 1 && "border-border border-b"
                  )}
                >
                  <td data-label="Acciones" className="px-5 py-3.5">
                    <div className="flex gap-2">
                      {puedeGestionar && fila.state === "pendiente" && (
                        <>
                          <button
                            type="button"
                            aria-label="Aprobar"
                            className="text-status-disponible-fg"
                            onClick={() => setAprobando(fila)}
                          >
                            <CheckCircle2 className="size-4" strokeWidth={1.7} />
                          </button>
                          <button
                            type="button"
                            aria-label="Rechazar"
                            className="text-status-bloqueado-fg"
                            onClick={() => setRechazando(fila)}
                          >
                            <XCircle className="size-4" strokeWidth={1.7} />
                          </button>
                        </>
                      )}
                      {normalizarEstado(fila.state) === "aprobado" && (
                        <>
                          <button
                            type="button"
                            aria-label="Descargar reporte"
                            title="Descargar reporte"
                            className="text-primary disabled:opacity-40"
                            disabled={descargandoId === fila.id}
                            onClick={() => manejarDescargar(fila)}
                          >
                            <Download className="size-4" strokeWidth={1.7} />
                          </button>
                          <button
                            type="button"
                            aria-label="Imprimir reporte"
                            title="Imprimir reporte"
                            className="text-primary disabled:opacity-40"
                            disabled={descargandoId === fila.id}
                            onClick={() => manejarDescargar(fila, "imprimir")}
                          >
                            <Printer className="size-4" strokeWidth={1.7} />
                          </button>
                        </>
                      )}
                      {puedeGestionar && (
                        <>
                          <button
                            type="button"
                            aria-label="Editar"
                            className="text-primary"
                            onClick={() => setEdicion(fila)}
                          >
                            <Pencil className="size-4" strokeWidth={1.7} />
                          </button>
                          <button
                            type="button"
                            aria-label="Eliminar"
                            className="text-status-bloqueado-fg"
                            onClick={() => setEliminando(fila)}
                          >
                            <Trash2 className="size-4" strokeWidth={1.7} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  {puedeGestionar && (
                    <td
                      data-label="Colaborador"
                      className="px-5 py-3.5 font-bold whitespace-nowrap"
                    >
                      {fila.creador_nombre ?? "—"}
                    </td>
                  )}
                  <td
                    data-label="Fecha"
                    className="text-muted-foreground px-5 py-3.5 font-mono text-[11.5px]"
                  >
                    {formatearFecha(fila.dateS)}
                  </td>
                  <td
                    data-label="Tipo"
                    className="px-5 py-3.5 font-semibold whitespace-nowrap"
                  >
                    {fila.typePermissions ?? "—"}
                  </td>
                  <td
                    data-label="Horario"
                    className="text-muted-foreground px-5 py-3.5 font-mono text-[11.5px]"
                  >
                    {formatearHora(fila.startTime)} – {formatearHora(fila.finalTime)}
                  </td>
                  <td
                    data-label="Horas solicitadas"
                    className="px-5 py-3.5 font-mono font-semibold"
                  >
                    {fila.requestedHour ?? "—"}
                  </td>
                  <td
                    data-label="Detalle"
                    className="text-muted-foreground max-w-60 truncate px-5 py-3.5 text-[12.5px]"
                  >
                    {fila.details || "—"}
                  </td>
                  <td data-label="Estado" className="px-5 py-3.5">
                    <StatusBadge variant={normalizarEstado(fila.state)} />
                    <MotivoRechazo estado={fila.state} motivo={fila.motivoRechazo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={!!edicion} onOpenChange={(valor) => !valor && setEdicion(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Editar solicitud de permiso</SheetTitle>
            <SheetDescription>
              Requiere el permiso rrhh:gestionar — este cambio queda registrado.
            </SheetDescription>
          </SheetHeader>
          {edicion && (
            <div className="flex flex-col gap-3.5 p-5">
              <DatePickerField
                label="Fecha de permiso"
                value={edicion.dateS ?? ""}
                onChange={(valor) => setEdicion({ ...edicion, dateS: valor })}
                fechaMinima={manana()}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TimePickerField
                  label="Hora inicial"
                  value={(edicion.startTime ?? "").slice(0, 5)}
                  onChange={(valor) => setEdicion({ ...edicion, startTime: valor })}
                />
                <TimePickerField
                  label="Hora final"
                  value={(edicion.finalTime ?? "").slice(0, 5)}
                  onChange={(valor) => setEdicion({ ...edicion, finalTime: valor })}
                />
              </div>
              <SelectField
                label="Tipo de permiso"
                placeholder="Seleccione un tipo"
                options={TIPOS_PERMISO}
                value={edicion.typePermissions ?? ""}
                onValueChange={(valor) =>
                  setEdicion({ ...edicion, typePermissions: valor })
                }
              />
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                  Detalle
                </label>
                <Textarea
                  value={edicion.details ?? ""}
                  onChange={(event) =>
                    setEdicion({ ...edicion, details: event.target.value })
                  }
                />
              </div>
            </div>
          )}
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={guardandoEdicion}
              onClick={() => setEdicion(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={guardandoEdicion}
              onClick={manejarGuardarEdicion}
            >
              {guardandoEdicion ? "Guardando…" : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!eliminando} onOpenChange={(valor) => !valor && setEliminando(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Eliminar solicitud</SheetTitle>
            <SheetDescription>
              ¿Estás seguro de eliminar esta solicitud de permiso? Esta acción no se puede
              deshacer.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={borrando}
              onClick={() => setEliminando(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={borrando}
              onClick={manejarEliminar}
            >
              {borrando ? "Eliminando…" : "Eliminar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!aprobando} onOpenChange={(valor) => !valor && setAprobando(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Aprobar solicitud de permiso</SheetTitle>
            <SheetDescription>
              ¿Estás seguro de aprobar esta solicitud de permiso?
            </SheetDescription>
          </SheetHeader>
          {cargoAVacaciones && (
            <div className="flex flex-col gap-2 p-5">
              <SelectField
                label="¿De dónde se descuenta?"
                placeholder="Seleccione de dónde descontar"
                opciones={[
                  {
                    value: "dias",
                    label: `Días normales${
                      saldoSolicitante
                        ? ` (disponibles: ${saldoSolicitante.diasVacaciones - saldoSolicitante.diasDescontados})`
                        : ""
                    }`,
                  },
                  {
                    value: "aumentados",
                    label: `Días aumentados${
                      saldoSolicitante
                        ? ` (disponibles: ${saldoSolicitante.diasAumentados})`
                        : ""
                    }`,
                  },
                  {
                    value: "horas",
                    label: `Horas a favor${
                      saldoSolicitante
                        ? ` (disponibles: ${saldoSolicitante.horasFavor} h)`
                        : ""
                    }`,
                  },
                ]}
                value={fuenteDescuento}
                onValueChange={(valor) =>
                  setFuenteDescuento(valor as FuenteDescuentoPermiso)
                }
              />
              <p className="text-muted-foreground text-[12px]">
                Días normales o aumentados: se descuenta 1 día. Horas a favor: se
                descuentan las horas de este permiso ({aprobando?.requestedHour ?? "—"}).
              </p>
            </div>
          )}
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
              disabled={procesandoAprobacion || (cargoAVacaciones && !fuenteDescuento)}
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
            <SheetTitle>Rechazar solicitud de permiso</SheetTitle>
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
    </>
  )
}
