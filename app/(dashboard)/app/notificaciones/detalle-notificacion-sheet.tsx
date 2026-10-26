"use client"

import { Send, XCircle } from "lucide-react"

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
  DESTINOS_APP,
  ENVIOS_EJEMPLO,
  ESTADO_LABELS,
  TIPO_LABELS,
  type Notificacion,
} from "./datos"
import { formatearFechaHora, VARIANTE_ESTADO } from "./formato"

export function DetalleNotificacionSheet({
  notificacion,
  onOpenChange,
}: {
  notificacion: Notificacion | null
  onOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  // PENDIENTE: GET /notifications/history/:id → sends.
  const envios = notificacion && notificacion.estado !== "programada" ? ENVIOS_EJEMPLO : []
  const destino = DESTINOS_APP.find((d) => d.value === notificacion?.url)?.label

  function avisoPendiente() {
    toast({
      variant: "info",
      title: "Aún no disponible",
      description: "Esta acción se conectará próximamente.",
    })
  }

  return (
    <Sheet open={notificacion !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {notificacion ? (
          <>
            <SheetHeader className="border-border border-b p-5">
              <div className="mb-1">
                <StatusBadge variant={VARIANTE_ESTADO[notificacion.estado]}>
                  {ESTADO_LABELS[notificacion.estado]}
                </StatusBadge>
              </div>
              <SheetTitle>{notificacion.titulo}</SheetTitle>
              <SheetDescription>{notificacion.contenido}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2.5 text-[13px]">
                {[
                  ["Destinatarios", TIPO_LABELS[notificacion.tipo]],
                  ["Programada", formatearFechaHora(notificacion.fechaEnviar)],
                  ["Enviada", formatearFechaHora(notificacion.fechaEnvio)],
                  ["Al tocar, abre", destino ?? "Solo abre la app"],
                  ["Imagen", notificacion.imagen ?? "—"],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="contents">
                    <dt className="text-muted-foreground text-xs font-semibold">{etiqueta}</dt>
                    <dd className="min-w-0 truncate">{valor}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wide uppercase">
                  Destinatarios ({envios.length})
                </p>
                {envios.length === 0 ? (
                  <p className="bg-muted/60 border-border text-muted-foreground rounded-md border px-3 py-4 text-center text-xs">
                    {notificacion.estado === "programada"
                      ? "Se calculan al momento del envío."
                      : "No hay destinatarios registrados."}
                  </p>
                ) : (
                  <ul className="border-border divide-border divide-y rounded-md border text-xs">
                    {envios.map((envio) => (
                      <li key={envio.id} className="flex items-center justify-between px-3 py-2">
                        <span className="font-mono">
                          {envio.userId === "*" ? "Todos" : envio.userId}
                        </span>
                        <span className="text-muted-foreground">
                          {envio.enviadoEn ? formatearFechaHora(envio.enviadoEn) : "Sin enviar"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {notificacion.estado === "programada" ? (
              <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
                <Button variant="outline" size="sm" onClick={avisoPendiente}>
                  <XCircle className="size-3.5" strokeWidth={1.8} />
                  Cancelar envío
                </Button>
                <Button size="sm" onClick={avisoPendiente}>
                  <Send className="size-3.5" strokeWidth={1.8} />
                  Enviar ahora
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
