"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AuditoriaApiError,
  obtenerEventoAuditoria,
  type EventoAuditoriaDetalle,
} from "@/lib/api/auditoria-api"

function Campo({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground mb-0.5 text-[11px] font-semibold">{etiqueta}</p>
      <p className="text-[12.5px] font-semibold break-words">{valor || "—"}</p>
    </div>
  )
}

function Json({ titulo, valor }: { titulo: string; valor: unknown }) {
  if (valor === null || valor === undefined) return null
  if (typeof valor === "object" && Object.keys(valor as object).length === 0) return null
  return (
    <div>
      <h4 className="mb-1.5 text-[12px] font-bold">{titulo}</h4>
      <pre className="bg-muted border-border max-h-72 overflow-auto rounded-md border p-3 font-mono text-[11.5px] leading-relaxed">
        {JSON.stringify(valor, null, 2)}
      </pre>
    </div>
  )
}

export function EventoDetalleSheet({
  id,
  onCerrar,
}: {
  id: string | null
  onCerrar: () => void
}) {
  const [evento, setEvento] = useState<EventoAuditoriaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEvento(null)
    setError(null)
    if (!id) return

    let cancelado = false
    obtenerEventoAuditoria(id)
      .then((data) => {
        if (!cancelado) setEvento(data)
      })
      .catch((err) => {
        if (!cancelado) {
          setError(
            err instanceof AuditoriaApiError
              ? err.message
              : "No se pudo cargar el evento."
          )
        }
      })
    return () => {
      cancelado = true
    }
  }, [id])

  // metadata de la API: { requestBody, query, params, statusCode, durationMs }.
  // metadata de la web: { ruta, etiqueta, elemento, detalle }. Se muestra tal cual.
  const meta = (evento?.metadata ?? {}) as Record<string, unknown>
  const {
    requestBody,
    query,
    params,
    statusCode,
    durationMs,
    errorMessage,
    ...restoMeta
  } = meta

  return (
    <Sheet open={!!id} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Detalle del evento</SheetTitle>
          <SheetDescription>
            {evento?.description ?? "Petición, respuesta y contexto del evento."}
          </SheetDescription>
        </SheetHeader>

        {!evento && !error && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}
        {error && <p className="text-destructive p-5 text-sm">{error}</p>}

        {evento && (
          <div className="flex flex-col gap-5 p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Campo
                etiqueta="Fecha"
                valor={new Date(evento.occurred_at).toLocaleString("es-EC")}
              />
              <Campo
                etiqueta="Usuario"
                valor={evento.actor_name_snapshot ?? evento.actor_email_snapshot}
              />
              <Campo etiqueta="Rol" valor={evento.actor_role_snapshot} />
              <Campo etiqueta="Acción" valor={evento.accion} />
              <Campo etiqueta="Entidad" valor={evento.entidad} />
              <Campo etiqueta="ID de entidad" valor={evento.entity_id} />
              <Campo etiqueta="Origen" valor={evento.source} />
              <Campo etiqueta="IP" valor={evento.ip_address} />
              <Campo
                etiqueta="Estado"
                valor={
                  <StatusBadge
                    variant={evento.status === "success" ? "aprobado" : "rechazado"}
                  >
                    {evento.status === "success" ? "Exitoso" : "Fallido"}
                  </StatusBadge>
                }
              />
              <Campo
                etiqueta="Código HTTP"
                valor={statusCode !== undefined ? String(statusCode) : null}
              />
              <Campo
                etiqueta="Duración"
                valor={durationMs !== undefined ? `${durationMs} ms` : null}
              />
              <Campo etiqueta="Severidad" valor={evento.severity} />
            </div>

            <Campo etiqueta="Request ID" valor={evento.request_id} />
            <Campo etiqueta="Navegador" valor={evento.user_agent} />
            {typeof errorMessage === "string" && (
              <Campo etiqueta="Error" valor={errorMessage} />
            )}

            <Json titulo="Petición · cuerpo" valor={requestBody} />
            <Json titulo="Petición · query" valor={query} />
            <Json titulo="Petición · parámetros" valor={params} />
            <Json titulo="Respuesta de la API" valor={evento.after_data} />
            <Json titulo="Antes" valor={evento.before_data} />
            <Json titulo="Contexto" valor={restoMeta} />

            {evento.cambios.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-[12px] font-bold">Cambios por campo</h4>
                <ul className="border-border divide-y rounded-md border text-[12px]">
                  {evento.cambios.map((cambio) => (
                    <li key={cambio.id} className="grid grid-cols-3 gap-2 px-3 py-2">
                      <span className="font-semibold">{cambio.field_name}</span>
                      <span className="text-muted-foreground break-words">
                        {cambio.old_value ?? "—"}
                      </span>
                      <span className="break-words">{cambio.new_value ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
