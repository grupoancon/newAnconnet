"use client"

import { useEffect, useState, useTransition } from "react"
import { ArrowLeft, Check, CircleDashed } from "lucide-react"
import Link from "next/link"
import { useRouter } from "@/lib/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  EntregasApiError,
  ITEMS_ENTREGA,
  ITEMS_PRE_ENTREGA,
  cerrarProceso,
  completarPaso,
  obtenerEntrega,
  type EntregaDetalle,
  type ResolucionPaso,
} from "@/lib/api/entregas-api"
import { cn } from "@/lib/utils"

import {
  ChecklistLista,
  Dato,
  EstadoBadge,
  Seccion,
  SinRegistrar,
  formatearFecha,
} from "../../detalle-comun"

const textareaClase =
  "border-input bg-card focus-visible:border-primary focus-visible:ring-ring/15 w-full rounded-md border px-3.5 py-2.5 text-sm shadow-none focus-visible:ring-3"

function Resolucion({ resolucion }: { resolucion: ResolucionPaso }) {
  return (
    <div className="bg-status-disponible-bg text-status-disponible-fg rounded-md px-3.5 py-2.5 text-[12.5px]">
      <p className="font-bold">
        Marcada como completada el {formatearFecha(resolucion.fecha)}
        {resolucion.por ? ` por ${resolucion.por}` : ""}
      </p>
      {resolucion.nota ? <p className="mt-0.5">{resolucion.nota}</p> : null}
    </div>
  )
}

// Marca un paso con observaciones/PD como completado (con una nota opcional).
function CompletarPaso({
  titulo,
  ocupado,
  onCompletar,
}: {
  titulo: string
  ocupado: boolean
  onCompletar: (nota: string) => void
}) {
  const [nota, setNota] = useState("")
  return (
    <div className="border-border space-y-2.5 rounded-md border border-dashed p-4">
      <p className="text-[13px] font-semibold">{titulo}</p>
      <Textarea
        rows={2}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota de resolución (opcional): qué se resolvió o por qué se da por completada"
        className={textareaClase}
      />
      <Button size="sm" disabled={ocupado} onClick={() => onCompletar(nota.trim())}>
        <Check className="size-3.5" strokeWidth={2.5} />
        Marcar como completada
      </Button>
    </div>
  )
}

function Requisito({ cumplido, texto }: { cumplido: boolean; texto: string }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      {cumplido ? (
        <Check className="text-status-disponible-fg size-4" strokeWidth={2.5} />
      ) : (
        <CircleDashed className="text-muted-foreground size-4" strokeWidth={2} />
      )}
      <span className={cn(!cumplido && "text-muted-foreground")}>{texto}</span>
    </li>
  )
}

export function CierreContent({ id }: { id: number }) {
  const router = useRouter()
  const toast = useToast()
  const [ocupado, startAccion] = useTransition()

  const [detalle, setDetalle] = useState<EntregaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [observacion, setObservacion] = useState("")

  function cargar() {
    obtenerEntrega(id)
      .then(setDetalle)
      .catch((err) =>
        setError(
          err instanceof EntregasApiError ? err.message : "No se pudo cargar el proceso"
        )
      )
  }

  useEffect(cargar, [id])

  function ejecutar(accion: () => Promise<unknown>, exito: string, titulo: string) {
    startAccion(async () => {
      try {
        await accion()
        toast({ variant: "success", description: exito })
        cargar()
      } catch (err) {
        toast({
          variant: "error",
          title: titulo,
          description:
            err instanceof EntregasApiError ? err.message : "Intenta de nuevo.",
        })
      }
    })
  }

  const pre = detalle?.preEntrega
  const entrega = detalle?.entrega
  const preRegistrada = Boolean(pre?.items)
  const entregaRegistrada = Boolean(entrega?.items)
  const preCompleta = pre?.estado === "COMPLETO" && preRegistrada
  const entregaCompleta = entrega?.estado === "COMPLETO" && entregaRegistrada
  const puedeCerrar = Boolean(
    preCompleta && entregaCompleta && detalle && !detalle.cerrada
  )

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow={`Entregas · Proceso #${id}`}
            title="Cierre del proceso"
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
          ) : error || !detalle || !pre || !entrega ? (
            <div className="p-6">
              <EmptyState
                title="No se pudo cargar"
                description={error ?? undefined}
                dashed
              />
            </div>
          ) : (
            <div className="space-y-5 p-6">
              {detalle.cerrada ? (
                <div className="bg-status-disponible-bg text-status-disponible-fg rounded-md px-4 py-3 text-[13px] font-semibold">
                  Proceso cerrado el {formatearFecha(detalle.cierre.fecha)}
                  {detalle.cierre.cerradoPor ? ` por ${detalle.cierre.cerradoPor}` : ""}.
                </div>
              ) : null}

              <Seccion titulo="Información del proceso">
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Dato label="Cliente">{detalle.cliente}</Dato>
                  <Dato label="Lote">
                    <span className="font-mono">{detalle.lote}</span>
                  </Dato>
                  <Dato label="Proyecto">{detalle.proyecto}</Dato>
                  <Dato label="Asesor asignado">{detalle.asesor}</Dato>
                  <Dato label="Fecha de entrega planificada">
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
                {detalle.historialReagendamientos.length > 0 ? (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-muted-foreground text-[11px] font-semibold uppercase">
                      Re-agendamientos
                    </p>
                    {detalle.historialReagendamientos.map((h, i) => (
                      <div
                        key={i}
                        className="bg-muted/50 rounded-md px-3 py-2 text-[12px]"
                      >
                        <span className="font-semibold">
                          {formatearFecha(h.fechaAnterior, h.horaAnterior)} →{" "}
                          {formatearFecha(h.fecha, h.hora)}
                        </span>
                        <span className="text-muted-foreground block">
                          {h.motivo}
                          {h.por ? ` — ${h.por}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Seccion>

              <div className="grid gap-5 lg:grid-cols-2">
                <Seccion
                  titulo="Pre-entrega"
                  estado={<EstadoBadge estado={pre.estado} />}
                >
                  {pre.items ? (
                    <div className="space-y-4">
                      <ChecklistLista puntos={ITEMS_PRE_ENTREGA} items={pre.items} />
                      <dl className="grid gap-4">
                        <Dato label="Observaciones">{pre.observacion}</Dato>
                        <Dato label="Registrada">
                          {formatearFecha(pre.fecha)}
                          {pre.registradoPor ? ` por ${pre.registradoPor}` : ""}
                        </Dato>
                      </dl>
                      {pre.resolucion ? <Resolucion resolucion={pre.resolucion} /> : null}
                      {pre.estado !== "COMPLETO" && !detalle.cerrada ? (
                        <CompletarPaso
                          titulo="Esta pre-entrega quedó con observaciones o pendientes."
                          ocupado={ocupado}
                          onCompletar={(nota) =>
                            ejecutar(
                              () => completarPaso(id, "pre-entrega", nota || undefined),
                              "Pre-entrega marcada como completada.",
                              "No se pudo completar la pre-entrega"
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ) : (
                    <SinRegistrar texto="Pendiente: aún no se ha registrado la pre-entrega." />
                  )}
                </Seccion>

                <Seccion
                  titulo="Entrega"
                  estado={<EstadoBadge estado={entrega.estado} />}
                >
                  {entrega.items ? (
                    <div className="space-y-4">
                      {entrega.fotoUrl ? (
                        <a href={entrega.fotoUrl} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={entrega.fotoUrl}
                            alt="Foto de la entrega"
                            className="border-border max-h-80 w-full rounded-md border object-contain"
                          />
                        </a>
                      ) : null}
                      <ChecklistLista
                        puntos={ITEMS_ENTREGA}
                        items={entrega.items}
                        motivos={entrega.motivos}
                      />
                      <dl className="grid gap-4">
                        <Dato label="Observaciones">{entrega.observacion}</Dato>
                        <Dato label="Realizada">
                          {formatearFecha(entrega.fecha)}
                          {entrega.registradoPor ? ` por ${entrega.registradoPor}` : ""}
                        </Dato>
                      </dl>
                      {entrega.resolucion ? (
                        <Resolucion resolucion={entrega.resolucion} />
                      ) : null}
                      {entrega.estado !== "COMPLETO" && !detalle.cerrada ? (
                        <CompletarPaso
                          titulo="Esta entrega quedó con observaciones o pendientes."
                          ocupado={ocupado}
                          onCompletar={(nota) =>
                            ejecutar(
                              () => completarPaso(id, "entrega", nota || undefined),
                              "Entrega marcada como completada.",
                              "No se pudo completar la entrega"
                            )
                          }
                        />
                      ) : null}
                    </div>
                  ) : (
                    <SinRegistrar texto="Pendiente: la entrega aún no se ha realizado." />
                  )}
                </Seccion>
              </div>

              <Seccion
                titulo="Cierre"
                estado={
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      detalle.cerrada
                        ? "bg-status-disponible-bg text-status-disponible-fg"
                        : "bg-muted text-muted-foreground border-border border"
                    )}
                  >
                    {detalle.cerrada ? "Cerrada" : "Pendiente"}
                  </span>
                }
              >
                {detalle.cerrada ? (
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <Dato label="Fecha de cierre">
                      {formatearFecha(detalle.cierre.fecha)}
                    </Dato>
                    <Dato label="Cerrada por">{detalle.cierre.cerradoPor}</Dato>
                    <Dato label="Observaciones">{detalle.cierre.observacion}</Dato>
                  </dl>
                ) : (
                  <div className="space-y-4">
                    <ul className="space-y-1.5">
                      <Requisito
                        cumplido={Boolean(preCompleta)}
                        texto="Pre-entrega registrada y completa"
                      />
                      <Requisito
                        cumplido={Boolean(entregaCompleta)}
                        texto="Entrega registrada y completa"
                      />
                    </ul>
                    <div>
                      <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                        Observaciones del cierre
                      </label>
                      <Textarea
                        rows={3}
                        value={observacion}
                        onChange={(e) => setObservacion(e.target.value)}
                        disabled={!puedeCerrar}
                        placeholder="Observaciones finales del proceso (opcional)…"
                        className={textareaClase}
                      />
                    </div>
                    <Button
                      size="lg"
                      disabled={!puedeCerrar || ocupado}
                      onClick={() => {
                        startAccion(async () => {
                          try {
                            await cerrarProceso(id, observacion.trim() || undefined)
                            toast({ variant: "success", description: "Proceso cerrado." })
                            router.push("/entregas")
                          } catch (err) {
                            toast({
                              variant: "error",
                              title: "No se pudo cerrar el proceso",
                              description:
                                err instanceof EntregasApiError
                                  ? err.message
                                  : "Intenta de nuevo.",
                            })
                          }
                        })
                      }}
                    >
                      {ocupado ? "Cerrando…" : "Cerrar proceso"}
                    </Button>
                  </div>
                )}
              </Seccion>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
