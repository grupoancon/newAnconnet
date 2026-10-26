"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Clock, History, ListTree, Smartphone, User } from "lucide-react"

import { SelectField } from "@/components/shared/select-field"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/shared/spinner"
import {
  listarEventos,
  obtenerDetalleEvento,
  obtenerSesion,
  TelemetriaApiError,
} from "@/lib/api/telemetria-api"
import { cn } from "@/lib/utils"

import {
  NIVEL_LABELS,
  type DetalleEvento,
  type Evento,
  type GrupoError,
  type SesionTelemetria,
} from "./datos"
import { formatearFechaHora, formatearHora, VARIANTE_NIVEL } from "./formato"

// Lo que se abre: un grupo de errores (con sus ocurrencias) o un evento suelto.
export type SeleccionDiagnostico =
  { tipo: "grupo"; grupo: GrupoError } | { tipo: "evento"; evento: Evento }

export function DetalleDiagnosticoSheet({
  seleccion,
  onOpenChange,
  onVerUsuario,
}: {
  seleccion: SeleccionDiagnostico | null
  onOpenChange: (open: boolean) => void
  // Abre la vista "Por usuario" con todas las interacciones de ese cliente.
  onVerUsuario: (usuarioId: string) => void
}) {
  const [ocurrencias, setOcurrencias] = useState<Evento[]>([])
  const [detalle, setDetalle] = useState<DetalleEvento | null>(null)
  const [verSesion, setVerSesion] = useState(false)
  const [sesion, setSesion] = useState<SesionTelemetria | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setVerSesion(false)
    setSesion(null)
    setError(null)
    setDetalle(null)
    setOcurrencias([])
    if (!seleccion) return
    setCargando(true)
    const carga =
      seleccion.tipo === "grupo"
        ? // Últimas 25 ocurrencias del mensaje (los grupos son de 7 días como máximo);
          // se abre el detalle de la más reciente.
          listarEventos({
            ventana: "7d",
            mensaje: seleccion.grupo.message,
            limite: 25,
          }).then(async ({ eventos }) => {
            if (!vigente) return
            setOcurrencias(eventos)
            const id = eventos[0]?.id ?? seleccion.grupo.sampleId
            const d = id ? await obtenerDetalleEvento(id) : null
            if (vigente) setDetalle(d)
          })
        : obtenerDetalleEvento(seleccion.evento.id).then((d) => vigente && setDetalle(d))
    carga
      .catch((err) => vigente && setError(mensajeDeError(err)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [seleccion])

  useEffect(() => {
    if (!verSesion || !detalle) return
    let vigente = true
    setSesion(null)
    obtenerSesion(detalle.session)
      .then((s) => vigente && setSesion(s))
      .catch((err) => {
        if (!vigente) return
        setError(mensajeDeError(err))
        setVerSesion(false)
      })
    return () => {
      vigente = false
    }
  }, [verSesion, detalle])

  async function elegirOcurrencia(id: string) {
    setVerSesion(false)
    setCargando(true)
    setError(null)
    try {
      setDetalle(await obtenerDetalleEvento(id))
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  const grupo = seleccion?.tipo === "grupo" ? seleccion.grupo : null

  return (
    <Sheet open={seleccion !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-border border-b p-5">
          {detalle ? (
            <div className="mb-1">
              <StatusBadge variant={VARIANTE_NIVEL[detalle.level]}>
                {NIVEL_LABELS[detalle.level]}
              </StatusBadge>
            </div>
          ) : null}
          <SheetTitle className="break-words">
            {grupo ? grupo.message : (detalle?.message ?? "Evento")}
          </SheetTitle>
          <SheetDescription>
            {grupo
              ? `${grupo.count} ocurrencias · ${grupo.users} usuarios · ${grupo.sessions} sesiones · desde ${formatearFechaHora(grupo.firstSeen)}`
              : detalle
                ? `${formatearFechaHora(detalle.receivedAt)} · ${detalle.userId ?? "anónimo"}`
                : ""}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <p className="text-status-bloqueado-fg p-6 text-center text-sm">{error}</p>
        ) : cargando || (verSesion && !sesion) ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : verSesion && sesion ? (
          <div className="space-y-3 p-5">
            <button
              type="button"
              onClick={() => setVerSesion(false)}
              className="text-accent-foreground hover:text-primary inline-flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.8} />
              Volver al evento
            </button>
            <p className="text-muted-foreground text-xs">
              Sesión <span className="font-mono">{sesion.session.slice(0, 8)}</span> ·{" "}
              {sesion.count} eventos · {sesion.user.id ?? "anónimo"}
              {sesion.appVersion ? ` · v${sesion.appVersion}` : ""}
            </p>
            <ol className="border-border ml-1 space-y-1 border-l-2">
              {sesion.events.map((evento) => (
                <li key={evento.id} className="relative pl-3">
                  <PuntoNivel nivel={evento.level} />
                  <button
                    type="button"
                    onClick={() => elegirOcurrencia(evento.id)}
                    className="hover:bg-muted/60 w-full rounded-md px-1.5 py-1 text-left"
                  >
                    <span className="text-[12.5px]">{evento.message}</span>
                    <span className="text-muted-foreground block text-[11px]">
                      {NIVEL_LABELS[evento.level]} · {formatearHora(evento.receivedAt)}
                      {evento.screen ? ` · ${evento.screen}` : ""}
                      {evento.statusCode != null ? ` · HTTP ${evento.statusCode}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : detalle ? (
          <div className="space-y-5 p-5">
            {ocurrencias.length > 1 ? (
              <SelectField
                label="Ocurrencia"
                placeholder="Elige una ocurrencia"
                opciones={ocurrencias.map((o) => ({
                  value: o.id,
                  label: `${formatearFechaHora(o.receivedAt)} · ${o.platform ?? ""} ${o.appVersion ?? ""} · ${o.userId ?? "anónimo"}`,
                }))}
                value={detalle.id}
                onValueChange={elegirOcurrencia}
              />
            ) : null}

            <div className="flex flex-wrap gap-1.5 text-xs">
              {detalle.screen ? <Etiqueta>{detalle.screen}</Etiqueta> : null}
              {detalle.statusCode != null ? (
                <Etiqueta>HTTP {detalle.statusCode}</Etiqueta>
              ) : null}
              <Etiqueta>
                <Clock className="size-3" strokeWidth={1.8} />
                {formatearFechaHora(detalle.receivedAt)}
              </Etiqueta>
            </div>

            <Fila
              etiqueta="Dispositivo"
              icono={<Smartphone className="size-3.5" strokeWidth={1.8} />}
            >
              {[
                detalle.platform,
                detalle.deviceModel,
                detalle.osVersion && `SO ${detalle.osVersion}`,
                detalle.appVersion && `v${detalle.appVersion} (${detalle.build})`,
                detalle.release,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
              <span className="text-muted-foreground block font-mono text-[11px]">
                device_id: {detalle.deviceId ?? "—"}
              </span>
            </Fila>

            <Fila
              etiqueta="Usuario"
              icono={<User className="size-3.5" strokeWidth={1.8} />}
            >
              {detalle.userId ?? "anónimo"}
              {detalle.userEmail ? ` · ${detalle.userEmail}` : ""}
              <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => setVerSesion(true)}
                  className="text-accent-foreground hover:text-primary inline-flex items-center gap-1 text-xs font-semibold"
                >
                  <History className="size-3.5" strokeWidth={1.8} />
                  Ver sesión completa
                </button>
                {detalle.userId ? (
                  <button
                    type="button"
                    onClick={() => onVerUsuario(detalle.userId!)}
                    className="text-accent-foreground hover:text-primary inline-flex items-center gap-1 text-xs font-semibold"
                  >
                    <ListTree className="size-3.5" strokeWidth={1.8} />
                    Ver todas sus interacciones
                  </button>
                ) : null}
              </span>
            </Fila>

            {detalle.error ? (
              <Bloque titulo="Error">
                <div className="bg-status-bloqueado-bg border-status-bloqueado-border rounded-md border p-3 text-xs">
                  <p className="text-status-bloqueado-fg font-semibold">
                    {detalle.error.name}: {detalle.error.message}
                  </p>
                  {detalle.error.stack ? (
                    <pre className="text-foreground/80 mt-2 max-h-52 overflow-x-auto font-mono text-[11px] whitespace-pre-wrap">
                      {detalle.error.stack}
                    </pre>
                  ) : null}
                </div>
              </Bloque>
            ) : null}

            {detalle.meta && Object.keys(detalle.meta).length > 0 ? (
              <Bloque titulo="Metadata">
                <pre className="bg-muted/60 border-border max-h-52 overflow-x-auto rounded-md border p-3 font-mono text-[11px] whitespace-pre-wrap">
                  {JSON.stringify(detalle.meta, null, 2)}
                </pre>
              </Bloque>
            ) : null}

            {detalle.breadcrumbs && detalle.breadcrumbs.length > 0 ? (
              <Bloque titulo={`Antes del evento (${detalle.breadcrumbs.length})`}>
                <ol className="border-border ml-1 space-y-2 border-l-2">
                  {detalle.breadcrumbs
                    .slice()
                    .reverse()
                    .map((miga, i) => (
                      <li key={i} className="relative pl-3">
                        <span className="bg-muted-foreground/40 absolute top-1.5 -left-[5px] size-2 rounded-full" />
                        <p className="text-xs">
                          <span className="text-muted-foreground mr-1">
                            [{miga.category}]
                          </span>
                          {miga.message}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {formatearHora(miga.ts)}
                          {miga.data ? ` · ${JSON.stringify(miga.data)}` : ""}
                        </p>
                      </li>
                    ))}
                </ol>
              </Bloque>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No hay ocurrencias para mostrar.
          </p>
        )}
      </SheetContent>
    </Sheet>
  )
}

function mensajeDeError(err: unknown): string {
  return err instanceof TelemetriaApiError
    ? err.message
    : "No se pudo conectar con el servidor"
}

function PuntoNivel({ nivel }: { nivel: Evento["level"] }) {
  return (
    <span
      className={cn(
        "absolute top-2.5 -left-[5px] size-2 rounded-full",
        nivel === "error"
          ? "bg-chart-error"
          : nivel === "warn"
            ? "bg-chart-warn"
            : nivel === "event"
              ? "bg-status-hipotecado"
              : "bg-muted-foreground/40"
      )}
      aria-hidden
    />
  )
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5">
      {children}
    </span>
  )
}

function Fila({
  etiqueta,
  icono,
  children,
}: {
  etiqueta: string
  icono: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase">
        {icono}
        {etiqueta}
      </p>
      <div className="text-[13px]">{children}</div>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
        {titulo}
      </p>
      {children}
    </div>
  )
}
