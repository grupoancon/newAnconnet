"use client"

import { useEffect, useState } from "react"
import { Send, XCircle } from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
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
import {
  cancelarNotificacion,
  enviarNotificacionYa,
  obtenerNotificacion,
} from "@/lib/api/app-notificaciones-api"

import {
  DESTINOS_APP,
  ESTADO_LABELS,
  TIPO_LABELS,
  type EnvioNotificacion,
  type Notificacion,
} from "./datos"
import { formatearFechaHora, VARIANTE_ESTADO } from "./formato"

function mensajeDeError(err: unknown): string {
  return err instanceof Error ? err.message : "Ocurrió un error inesperado."
}

// Texto legible del criterio guardado en una notificación segmentada.
function describirSegmento(segmento: Record<string, unknown> | null): string {
  if (!segmento) return "Segmento"
  const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).join(", ") : "")
  if (Array.isArray(segmento.cedulas)) return `Cédulas: ${lista(segmento.cedulas)}`
  if (Array.isArray(segmento.lotes)) return `Lotes: ${lista(segmento.lotes)}`
  if (Array.isArray(segmento.prefijos_proyecto)) {
    return `Proyecto: ${lista(segmento.prefijos_proyecto)}`
  }
  if (segmento.en_mora || segmento.dias_mora_min !== undefined) {
    return segmento.dias_mora_min
      ? `Con ${String(segmento.dias_mora_min)} días de mora o más`
      : "Con cuotas en mora"
  }
  return "Segmento"
}

export function DetalleNotificacionSheet({
  notificacion,
  onOpenChange,
  onCambio,
}: {
  notificacion: Notificacion | null
  onOpenChange: (open: boolean) => void
  onCambio: () => Promise<void> | void
}) {
  const toast = useToast()
  const [envios, setEnvios] = useState<EnvioNotificacion[]>([])
  const [cargando, setCargando] = useState(false)
  const [accion, setAccion] = useState<"cancelar" | "enviar" | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  useEffect(() => {
    if (!notificacion) return
    setEnvios([])
    if (notificacion.estado === "programada") return
    let cancelado = false
    setCargando(true)
    obtenerNotificacion(notificacion.id)
      .then((r) => !cancelado && setEnvios(r.envios))
      .catch(
        (err) =>
          !cancelado && toast({ variant: "error", description: mensajeDeError(err) })
      )
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [notificacion, toast])

  async function ejecutar(tipo: "cancelar" | "enviar") {
    if (!notificacion) return
    setAccion(tipo)
    try {
      if (tipo === "cancelar") {
        await cancelarNotificacion(notificacion.id)
        toast({ variant: "success", description: "Envío cancelado." })
      } else {
        await enviarNotificacionYa(notificacion.id)
        toast({ variant: "success", description: "Notificación en camino." })
      }
      await onCambio()
      onOpenChange(false)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setAccion(null)
    }
  }

  const destino = DESTINOS_APP.find((d) => d.value === notificacion?.url)?.label
  const destinatarios = notificacion
    ? notificacion.tipo === "individual"
      ? `Cédula ${notificacion.userId ?? "—"}`
      : notificacion.tipo === "segmentada"
        ? describirSegmento(notificacion.segmento)
        : TIPO_LABELS.global
    : ""

  return (
    <Sheet open={notificacion !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {notificacion ? (
          <>
            <SheetHeader className="border-border border-b p-5">
              <div className="mb-1">
                <StatusBadge variant={VARIANTE_ESTADO[notificacion.estado] ?? "pronto"}>
                  {ESTADO_LABELS[notificacion.estado] ?? notificacion.estado}
                </StatusBadge>
              </div>
              <SheetTitle>{notificacion.titulo}</SheetTitle>
              <SheetDescription>{notificacion.contenido}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
                {[
                  ["Destinatarios", destinatarios],
                  ["Programada", formatearFechaHora(notificacion.fechaEnviar)],
                  ["Enviada", formatearFechaHora(notificacion.fechaEnvio)],
                  ["Al tocar, abre", destino ?? "Solo abre la app"],
                  ["Imagen", notificacion.imagen ?? "—"],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="contents">
                    <dt className="text-muted-foreground text-xs font-semibold">
                      {etiqueta}
                    </dt>
                    <dd className="min-w-0 break-words">{valor}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wide uppercase">
                  Enviada a ({cargando ? "…" : envios.length})
                </p>
                {cargando ? (
                  <div className="flex justify-center py-6">
                    <Spinner className="size-6" />
                  </div>
                ) : envios.length === 0 ? (
                  <p className="bg-muted/60 border-border text-muted-foreground rounded-md border px-3 py-4 text-center text-xs">
                    {notificacion.estado === "programada"
                      ? "Se calculan al momento del envío."
                      : "No hay destinatarios registrados."}
                  </p>
                ) : (
                  <ul className="border-border divide-border max-h-80 divide-y overflow-y-auto rounded-md border text-xs">
                    {envios.map((envio) => (
                      <li
                        key={envio.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="font-mono">
                          {envio.userId === "*" ? "Todos" : envio.userId}
                        </span>
                        <span className="text-muted-foreground">
                          {envio.enviadoEn
                            ? formatearFechaHora(envio.enviadoEn)
                            : "Sin enviar"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {notificacion.estado === "programada" ? (
              <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={accion !== null}
                  onClick={() => setConfirmarCancelar(true)}
                >
                  <XCircle className="size-3.5" strokeWidth={1.8} />
                  {accion === "cancelar" ? "Cancelando…" : "Cancelar envío"}
                </Button>
                <Button
                  size="sm"
                  disabled={accion !== null}
                  onClick={() => void ejecutar("enviar")}
                >
                  <Send className="size-3.5" strokeWidth={1.8} />
                  {accion === "enviar" ? "Enviando…" : "Enviar ahora"}
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>

      <ConfirmDialog
        abierto={confirmarCancelar}
        titulo="¿Cancelar este envío?"
        descripcion="La notificación no se enviará. Para mandarla después hay que crearla de nuevo."
        textoConfirmar="Cancelar envío"
        destructivo
        onConfirmar={() => {
          setConfirmarCancelar(false)
          void ejecutar("cancelar")
        }}
        onCancelar={() => setConfirmarCancelar(false)}
      />
    </Sheet>
  )
}
