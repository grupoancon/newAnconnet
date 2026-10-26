"use client"

import { useEffect, useState, useTransition } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "@/lib/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { OpcionRevision } from "@/components/shared/opcion-revision"
import { PageHeader } from "@/components/shared/page-header"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { AdvertenciaAgenda } from "../../advertencia-agenda"
import { Textarea } from "@/components/ui/textarea"
import {
  EntregasApiError,
  ITEMS_PRE_ENTREGA,
  guardarPreEntrega,
  obtenerEntrega,
  type ChecklistPreEntrega,
  type EntregaDetalle,
  type EstadoPaso,
  type ItemPreEntrega,
  type RevisionOfrecimiento,
} from "@/lib/api/entregas-api"

type Respuestas = Record<ItemPreEntrega, RevisionOfrecimiento | null>

const ESTADO_VARIANTE: Record<EstadoPaso, { variant: StatusVariant; label: string }> = {
  COMPLETO: { variant: "aprobado", label: "Completo" },
  PENDIENTE: { variant: "pronto", label: "Pendiente" },
  OBSERVACION: { variant: "rechazado", label: "Observación" },
}

function formatearFecha(valor: string | null, hora?: string | null): string {
  if (!valor) return "Sin fecha"
  const [anio, mes, dia] = valor.split("-")
  return `${dia}/${mes}/${anio}${hora ? ` · ${hora}` : ""}`
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[11px] font-semibold uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-semibold break-words">{children || "—"}</dd>
    </div>
  )
}

// Sugerencias (solo informativas) de que explicar en las observaciones: tanque y
// huerto cuando cambian respecto a lo registrado en el proceso, y el resto de puntos en
// NO o PD. El "por que" obligatorio por punto va en la entrega, no en la pre-entrega.
function sugerenciasDeObservacion(
  respuestas: Respuestas,
  detalle: EntregaDetalle | null
): string[] {
  const resultado: string[] = []
  for (const item of ITEMS_PRE_ENTREGA) {
    const valor = respuestas[item.id]
    // Tanque y huerto solo sugieren cuando cambian respecto al proceso; el resto de
    // puntos tambien cuando estan en NO o PD.
    const esTanqueOHuerto = item.id === "tanque" || item.id === "huerto"
    const delProceso =
      detalle && esTanqueOHuerto ? detalle.revision[item.id as "tanque" | "huerto"] : null
    if (valor && delProceso && delProceso !== valor) {
      resultado.push(
        `${item.label}: en el proceso estaba en ${delProceso} y ahora es ${valor}, ¿por qué cambió?`
      )
    } else if (!esTanqueOHuerto && (valor === "NO" || valor === "PD")) {
      resultado.push(
        `${item.label}: ¿por qué está en ${valor === "NO" ? "NO" : "pendiente (PD)"}?`
      )
    }
  }
  return resultado
}

const VACIAS: Respuestas = {
  limpieza: null,
  tanque: null,
  huerto: null,
  linderos: null,
  llave: null,
}

export function PreEntregaContent({ id }: { id: number }) {
  const router = useRouter()
  const toast = useToast()
  const [guardando, startGuardando] = useTransition()

  const [detalle, setDetalle] = useState<EntregaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [respuestas, setRespuestas] = useState<Respuestas>(VACIAS)
  const [observacion, setObservacion] = useState("")
  // Confirmacion de la fecha/hora de entrega: la del proceso o una nueva (con motivo).
  const [agenda, setAgenda] = useState<"confirmar" | "otra" | null>(null)
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [nuevaHora, setNuevaHora] = useState("")
  const [motivo, setMotivo] = useState("")

  useEffect(() => {
    obtenerEntrega(id)
      .then((d) => {
        setDetalle(d)
        // Si ya habia una pre-entrega guardada, se puede corregir.
        setRespuestas(d.preEntrega.items ?? VACIAS)
        setObservacion(d.preEntrega.observacion ?? "")
        setAgenda(d.fechaConfirmada ? "confirmar" : null)
      })
      .catch((err) =>
        setError(
          err instanceof EntregasApiError ? err.message : "No se pudo cargar el proceso"
        )
      )
  }, [id])

  const completo = Object.values(respuestas).every((r) => r !== null)
  const sugerencias = sugerenciasDeObservacion(respuestas, detalle)
  // Con algún "NO" hay que explicar el motivo en las observaciones.
  // Excepto tanque/huerto en NO cuando el proceso ya los tenia en NO (no hay cambio).
  const observacionObligatoria = ITEMS_PRE_ENTREGA.some(
    (item) =>
      respuestas[item.id] === "NO" &&
      !(
        (item.id === "tanque" || item.id === "huerto") &&
        detalle?.revision[item.id] === "NO"
      )
  )
  const agendaCompleta =
    agenda === "confirmar" ||
    (agenda === "otra" && Boolean(nuevaFecha && nuevaHora && motivo.trim()))
  const faltaObservacion = observacionObligatoria && !observacion.trim()
  const bloqueada = Boolean(
    detalle && (detalle.cerrada || detalle.entrega.estado === "COMPLETO")
  )

  function guardar() {
    if (!completo || faltaObservacion || !agendaCompleta) return
    startGuardando(async () => {
      try {
        const { estado } = await guardarPreEntrega(id, {
          items: respuestas as ChecklistPreEntrega,
          observacion: observacion.trim() || undefined,
          agenda:
            agenda === "confirmar"
              ? { confirmar: true }
              : {
                  confirmar: false,
                  fecha: nuevaFecha,
                  hora: nuevaHora,
                  motivo: motivo.trim(),
                },
        })
        toast({
          variant: "success",
          description: `Pre-entrega registrada (${ESTADO_VARIANTE[estado].label.toLowerCase()}).`,
        })
        router.push("/entregas")
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo guardar la pre-entrega",
          description:
            err instanceof EntregasApiError ? err.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow={`Entregas · Proceso #${id}`}
            title="Pre-entrega"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/entregas">
                  <ArrowLeft className="size-3.5" strokeWidth={2} />
                  Volver
                </Link>
              </Button>
            }
          />

          {detalle === null && !error ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : error || !detalle ? (
            <div className="p-6">
              <EmptyState
                title="No se pudo cargar"
                description={error ?? undefined}
                dashed
              />
            </div>
          ) : (
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
              <div className="space-y-5">
                {bloqueada ? (
                  <div className="bg-status-reservado-bg text-status-reservado-fg rounded-md px-4 py-3 text-[13px] font-semibold">
                    La entrega ya fue realizada: la pre-entrega solo se puede consultar.
                  </div>
                ) : null}

                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Fecha y hora de entrega *
                  </label>
                  <fieldset
                    disabled={bloqueada}
                    className="border-border space-y-3 rounded-md border p-4 disabled:opacity-60"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={agenda === "confirmar"}
                      onClick={() => setAgenda("confirmar")}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                        agenda === "confirmar"
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span>
                        <span className="block font-semibold">
                          Confirmar la fecha del proceso
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatearFecha(detalle.fechaPlanificada, detalle.hora)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={agenda === "otra"}
                      onClick={() => setAgenda("otra")}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                        agenda === "otra"
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="font-semibold">Elegir otra fecha y hora</span>
                    </button>
                    {agenda ? (
                      <AdvertenciaAgenda
                        asesorId={detalle.asesorId}
                        fecha={
                          agenda === "otra"
                            ? nuevaFecha
                            : (detalle.fechaPlanificada ?? "")
                        }
                        hora={agenda === "otra" ? nuevaHora : (detalle.hora ?? "")}
                        excluirId={detalle.id}
                        onSugerir={(sugerida) => {
                          setAgenda("otra")
                          setNuevaFecha(sugerida.fecha)
                          setNuevaHora(sugerida.hora)
                        }}
                      />
                    ) : null}
                    {agenda === "otra" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField
                          type="date"
                          label="Nueva fecha *"
                          value={nuevaFecha}
                          onChange={setNuevaFecha}
                        />
                        <TextField
                          type="time"
                          label="Nueva hora *"
                          value={nuevaHora}
                          onChange={setNuevaHora}
                        />
                        <div className="sm:col-span-2">
                          <TextField
                            label="Motivo del cambio *"
                            placeholder="Por qué se cambia la fecha o la hora"
                            value={motivo}
                            onChange={setMotivo}
                          />
                        </div>
                      </div>
                    ) : null}
                  </fieldset>
                </div>

                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Checklist de pre-entrega
                  </label>
                  <div className="border-border space-y-3 rounded-md border p-4">
                    {ITEMS_PRE_ENTREGA.map((item) => (
                      <fieldset
                        key={item.id}
                        disabled={bloqueada}
                        className="disabled:opacity-60"
                      >
                        <OpcionRevision
                          label={item.label}
                          value={respuestas[item.id]}
                          onChange={(valor) =>
                            setRespuestas((prev) => ({ ...prev, [item.id]: valor }))
                          }
                        />
                      </fieldset>
                    ))}
                    <p className="text-muted-foreground text-[11px]">
                      SI · NO · PD (pendiente) · NA (no aplica). Todos los puntos son
                      obligatorios para guardar. Los puntos en NO o PD, y el tanque o
                      huerto que cambien respecto al proceso, piden el motivo. Con algún
                      PD la pre-entrega queda pendiente y con algún NO queda con
                      observación.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Observaciones{observacionObligatoria ? " *" : ""}
                  </label>
                  <Textarea
                    rows={4}
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    disabled={bloqueada}
                    placeholder="Escriba las observaciones de la pre-entrega…"
                    className="border-input bg-card focus-visible:border-primary focus-visible:ring-ring/15 w-full rounded-md border px-3.5 py-2.5 text-sm shadow-none focus-visible:ring-3"
                  />
                </div>

                {sugerencias.length > 0 ? (
                  <div className="text-muted-foreground -mt-3 space-y-0.5 text-[11px]">
                    <p className="font-semibold">
                      Sugerencia: explica en las observaciones
                    </p>
                    <ul className="list-disc pl-4">
                      {sugerencias.map((texto) => (
                        <li key={texto}>{texto}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {faltaObservacion ? (
                  <p className="text-destructive -mt-3 text-xs font-medium">
                    Hay puntos en NO sin explicar: escribe la observación para poder
                    guardar.
                  </p>
                ) : null}

                {detalle.preEntrega.registradoPor ? (
                  <p className="text-muted-foreground text-xs">
                    Última actualización de {detalle.preEntrega.registradoPor} el{" "}
                    {formatearFecha(detalle.preEntrega.fecha)}.
                  </p>
                ) : null}

                {!bloqueada ? (
                  <Button
                    size="lg"
                    onClick={guardar}
                    disabled={
                      guardando || !completo || faltaObservacion || !agendaCompleta
                    }
                  >
                    {guardando ? "Guardando…" : "Guardar pre-entrega"}
                  </Button>
                ) : null}
              </div>

              <aside className="border-border bg-muted/30 h-fit rounded-lg border p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-extrabold">Información del proceso</h2>
                  <StatusBadge
                    variant={ESTADO_VARIANTE[detalle.preEntrega.estado].variant}
                  >
                    {ESTADO_VARIANTE[detalle.preEntrega.estado].label}
                  </StatusBadge>
                </div>
                <dl className="space-y-3.5">
                  <Dato label="Cliente">{detalle.cliente}</Dato>
                  <div className="grid grid-cols-2 gap-3.5">
                    <Dato label="Lote">
                      <span className="font-mono">{detalle.lote}</span>
                    </Dato>
                    <Dato label="Proyecto">{detalle.proyecto}</Dato>
                  </div>
                  <Dato label="Asesor asignado">{detalle.asesor}</Dato>
                  <Dato label="Fecha planificada de entrega">
                    {formatearFecha(detalle.fechaPlanificada, detalle.hora)}
                    {detalle.reagendamientos > 0
                      ? ` (re-agendada ×${detalle.reagendamientos})`
                      : ""}
                  </Dato>
                  <Dato label="Tipo de financiamiento">{detalle.tipoFinanciamiento}</Dato>
                  <Dato label="Ofrecimientos (oferta)">
                    {detalle.ofrecimientos.length ? (
                      <ul className="list-disc pl-4">
                        {detalle.ofrecimientos.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    ) : null}
                  </Dato>
                  <Dato label="Revisión de ofrecimientos">
                    Huerto {detalle.revision.huerto ?? "—"} · Tanque{" "}
                    {detalle.revision.tanque ?? "—"} · Tag {detalle.revision.tag ?? "—"}
                  </Dato>
                  <Dato label="Trabajos extra">{detalle.trabajosExtra}</Dato>
                  <Dato label="Comentario">{detalle.comentario}</Dato>
                  <Dato label="Creado">
                    {formatearFecha(detalle.creadoEn)}
                    {detalle.creadoPor ? ` por ${detalle.creadoPor}` : ""}
                  </Dato>
                </dl>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
