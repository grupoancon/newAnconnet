"use client"

import { useEffect, useState } from "react"
import { CalendarClock, CircleCheckBig, ClipboardCheck, PackageCheck } from "lucide-react"
import Link from "next/link"

import { useCan } from "@/components/shared/can"
import { EmptyState } from "@/components/shared/empty-state"
import { useSession } from "@/components/shared/session-provider"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  EntregasApiError,
  ITEMS_PRE_ENTREGA,
  obtenerEntrega,
  ITEMS_ENTREGA,
  type EntregaDetalle,
} from "@/lib/api/entregas-api"
import { cn } from "@/lib/utils"

import {
  ChecklistLista,
  Dato,
  ESTADO_VARIANTE,
  Seccion,
  SinRegistrar,
  formatearFecha,
} from "./detalle-comun"
import { ReagendarForm } from "./reagendar-form"

// Panel lateral con todo el proceso: datos, pre-entrega, entrega y cierre. Lo que aun no
// se registro sale como pendiente.
export function EntregaDetalleSheet({
  id,
  onClose,
  onCambio,
}: {
  id: number | null
  onClose: () => void
  // Se llama cuando el proceso cambia desde el panel (ej. re-agendamiento), para que
  // el listado se actualice.
  onCambio: () => void
}) {
  const puedePreEntrega = useCan("entregas:pre_entrega", true)
  const puedeReagendar = useCan("entregas:reagendar", true)
  const puedeEntregar = useCan("entregas:entregar", true)
  const puedeCerrar = useCan("entregas:cerrar", true)
  const puedeVerCierre = useCan("entregas:ver", true) || puedeCerrar
  const usuario = useSession()
  const [reagendando, setReagendando] = useState(false)
  const [detalle, setDetalle] = useState<EntregaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  function cargar(procesoId: number) {
    setError(null)
    obtenerEntrega(procesoId)
      .then(setDetalle)
      .catch((err) =>
        setError(
          err instanceof EntregasApiError ? err.message : "No se pudo cargar el proceso"
        )
      )
  }

  useEffect(() => {
    if (id === null) return
    setDetalle(null)
    setReagendando(false)
    cargar(id)
  }, [id])

  const pre = detalle?.preEntrega
  const preRegistrada = Boolean(pre?.items)
  const entregaRealizada = Boolean(detalle && detalle.entrega.estado === "COMPLETO")
  const entregaRegistrada = Boolean(
    detalle && (detalle.entrega.fecha || entregaRealizada)
  )
  const puedeEditarPre =
    puedePreEntrega && detalle && !detalle.cerrada && !entregaRealizada
  // Solo el asesor asignado, con la pre-entrega guardada y la entrega aun no realizada.
  const puedeRegistrarEntrega =
    puedeEntregar &&
    detalle &&
    detalle.asesorId === usuario.id &&
    preRegistrada &&
    !detalle.cerrada &&
    !entregaRealizada
  const puedeReagendarAhora =
    puedeReagendar && detalle && !detalle.cerrada && !entregaRealizada

  return (
    <Sheet open={id !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>
            {detalle
              ? `Proceso #${detalle.id} · ${detalle.lote ?? "—"}`
              : `Proceso #${id ?? ""}`}
          </SheetTitle>
          <SheetDescription>
            {detalle?.cliente ?? "Detalle del proceso de entrega"}
          </SheetDescription>
        </SheetHeader>

        {detalle === null && !error ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error || !detalle || !pre ? (
          <div className="p-5">
            <EmptyState
              title="No se pudo cargar"
              description={error ?? undefined}
              dashed
            />
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <Seccion titulo="Información del proceso">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <Dato label="Cliente">{detalle.cliente}</Dato>
                <Dato label="Lote">
                  <span className="font-mono">{detalle.lote}</span>
                </Dato>
                <Dato label="Proyecto">{detalle.proyecto}</Dato>
                <Dato label="Asesor asignado">{detalle.asesor}</Dato>
                <Dato label="Fecha planificada de entrega">
                  {formatearFecha(detalle.fechaPlanificada, detalle.hora)}
                  {detalle.reagendamientos > 0
                    ? ` (re-agendada ×${detalle.reagendamientos})`
                    : ""}
                  <span
                    className={cn(
                      "block text-[11px] font-semibold",
                      detalle.fechaConfirmada
                        ? "text-status-disponible-fg"
                        : "text-muted-foreground"
                    )}
                  >
                    {detalle.fechaConfirmada
                      ? "Confirmada en la pre-entrega"
                      : "Pendiente de confirmar en la pre-entrega"}
                  </span>
                  {puedeReagendarAhora && !reagendando ? (
                    <Button
                      size="xs"
                      variant="outline"
                      className="mt-1.5"
                      onClick={() => setReagendando(true)}
                    >
                      <CalendarClock className="size-3" strokeWidth={2} />
                      Re-agendar
                    </Button>
                  ) : null}
                </Dato>
                {reagendando ? (
                  <div className="sm:col-span-2">
                    <ReagendarForm
                      id={detalle.id}
                      asesorId={detalle.asesorId}
                      onCancelar={() => setReagendando(false)}
                      onGuardado={() => {
                        setReagendando(false)
                        cargar(detalle.id)
                        onCambio()
                      }}
                    />
                  </div>
                ) : null}
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
                {detalle.historialReagendamientos.length > 0 ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-[11px] font-semibold uppercase">
                      Re-agendamientos
                    </dt>
                    <dd className="mt-1 space-y-1.5">
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
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Seccion>

            <div className="space-y-4">
              <Seccion
                titulo="Pre-entrega"
                estado={
                  <StatusBadge variant={ESTADO_VARIANTE[pre.estado].variant}>
                    {ESTADO_VARIANTE[pre.estado].label}
                  </StatusBadge>
                }
                acciones={
                  puedeEditarPre ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/entregas/${detalle.id}/pre-entrega`}>
                        <ClipboardCheck className="size-3.5" strokeWidth={2} />
                        {preRegistrada ? "Editar" : "Registrar"}
                      </Link>
                    </Button>
                  ) : null
                }
              >
                {pre.items ? (
                  <div className="space-y-4">
                    <ChecklistLista puntos={ITEMS_PRE_ENTREGA} items={pre.items} />
                    <dl className="grid grid-cols-1 gap-4">
                      <Dato label="Observaciones">{pre.observacion}</Dato>
                      <Dato label="Registrada">
                        {formatearFecha(pre.fecha)}
                        {pre.registradoPor ? ` por ${pre.registradoPor}` : ""}
                      </Dato>
                    </dl>
                  </div>
                ) : (
                  <SinRegistrar texto="Pendiente: aún no se ha registrado la pre-entrega." />
                )}
              </Seccion>

              <div className="space-y-4">
                <Seccion
                  titulo="Entrega"
                  estado={
                    <StatusBadge
                      variant={ESTADO_VARIANTE[detalle.entrega.estado].variant}
                    >
                      {ESTADO_VARIANTE[detalle.entrega.estado].label}
                    </StatusBadge>
                  }
                  acciones={
                    puedeRegistrarEntrega ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/entregas/${detalle.id}/entrega`}>
                          <PackageCheck className="size-3.5" strokeWidth={2} />
                          {entregaRegistrada ? "Editar" : "Registrar"}
                        </Link>
                      </Button>
                    ) : null
                  }
                >
                  {entregaRegistrada ? (
                    <div className="space-y-4">
                      {detalle.entrega.items ? (
                        <ChecklistLista
                          puntos={ITEMS_ENTREGA}
                          items={detalle.entrega.items}
                          motivos={detalle.entrega.motivos}
                        />
                      ) : null}
                      <dl className="grid grid-cols-1 gap-4">
                        <Dato label="Fecha de entrega">
                          {formatearFecha(detalle.entrega.fecha)}
                        </Dato>
                        <Dato label="Realizada por">{detalle.entrega.registradoPor}</Dato>
                        <Dato label="Observaciones">{detalle.entrega.observacion}</Dato>
                      </dl>
                    </div>
                  ) : (
                    <SinRegistrar texto="Pendiente: la entrega aún no se ha realizado." />
                  )}
                </Seccion>

                {puedeVerCierre ? (
                  <Seccion
                    titulo="Cierre"
                    acciones={
                      puedeCerrar ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/entregas/${detalle.id}/cierre`}>
                            <CircleCheckBig className="size-3.5" strokeWidth={2} />
                            {detalle.cerrada ? "Ver cierre" : "Ir al cierre"}
                          </Link>
                        </Button>
                      ) : null
                    }
                    estado={
                      <StatusBadge
                        variant={detalle.cierre.cerrada ? "aprobado" : "pronto"}
                      >
                        {detalle.cierre.cerrada ? "Cerrada" : "Pendiente"}
                      </StatusBadge>
                    }
                  >
                    {detalle.cierre.cerrada ? (
                      <dl className="grid grid-cols-1 gap-4">
                        <Dato label="Fecha de cierre">
                          {formatearFecha(detalle.cierre.fecha)}
                        </Dato>
                        <Dato label="Cerrada por">{detalle.cierre.cerradoPor}</Dato>
                        <Dato label="Observaciones">{detalle.cierre.observacion}</Dato>
                      </dl>
                    ) : (
                      <SinRegistrar texto="Pendiente: el proceso aún no se ha cerrado." />
                    )}
                  </Seccion>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
