"use client"

import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  MapPin,
  RefreshCw,
  XCircle,
} from "lucide-react"

import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { DepositoBackend, LoteRelacionado } from "@/lib/api/depositos-api"

import {
  calcularEstadoDeposito,
  formatearFechaLarga,
  formatearMoneda,
  lotesSoloEnResumen,
  numeroReciboDeposito,
  recibosDeCaja,
} from "./depositos-utils"

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase">
        {etiqueta}
      </p>
      <p className="text-[13px] font-semibold break-words">{valor}</p>
    </div>
  )
}

function BadgeLote({ lote }: { lote: LoteRelacionado }) {
  if (lote.estado === "Aprobado") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant="aprobado">Aprobado</StatusBadge>
        {lote.rec_asociado && (
          <span className="text-muted-foreground text-xs">
            Asociado a:{" "}
            <span className="text-foreground font-bold">{lote.rec_asociado}</span>
          </span>
        )}
      </div>
    )
  }
  if (lote.estado === "Devuelto") {
    return <StatusBadge variant="rechazado">Devuelto</StatusBadge>
  }
  if (lote.estado === "En Revision") {
    return <StatusBadge variant="hipotecado">En revisión</StatusBadge>
  }
  return <StatusBadge variant="pendiente">Pendiente</StatusBadge>
}

const ESTADO_A_VARIANTE: Record<
  ReturnType<typeof calcularEstadoDeposito>,
  { variante: StatusVariant; etiqueta: string }
> = {
  Pendiente: { variante: "pendiente", etiqueta: "Pendiente" },
  Aprobado: { variante: "aprobado", etiqueta: "Aprobado" },
  Devuelto: { variante: "rechazado", etiqueta: "Devuelto" },
}

export function DepositoCard({
  deposito,
  puedeGestionar,
  onVerComprobantes,
  onVerResumen,
  onAprobar,
  onDevolver,
  onCambiarEstado,
}: {
  deposito: DepositoBackend
  puedeGestionar: boolean
  onVerComprobantes: (deposito: DepositoBackend) => void
  onVerResumen: (deposito: DepositoBackend) => void
  onAprobar: (lote: LoteRelacionado) => void
  onDevolver: (lote: LoteRelacionado) => void
  onCambiarEstado: (lote: LoteRelacionado) => void
}) {
  const estado = calcularEstadoDeposito(deposito.lotes_relacionados)
  const { variante, etiqueta } = ESTADO_A_VARIANTE[estado]
  const recibos = recibosDeCaja(deposito)
  const tieneResumen = !!deposito.resumen
  // Lotes del resumen sin fila propia: se muestran junto al lote principal ("A, B"),
  // porque se aprueban o devuelven junto con ese depósito.
  const lotesDelResumen = lotesSoloEnResumen(deposito)
  const anclaId = (
    deposito.lotes_relacionados.find((l) => l.lote === deposito.lote) ??
    deposito.lotes_relacionados[0]
  )?.id

  return (
    <article className="bg-card border-border flex h-full flex-col rounded-lg border p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="bg-status-reservado-bg text-status-reservado-fg flex size-11 shrink-0 items-center justify-center rounded-lg">
            <FileText className="size-5" strokeWidth={1.7} />
          </div>
          <div>
            <h3 className="text-base font-bold">{deposito.recibo}</h3>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[12.5px]">
              <CalendarDays className="size-3.5" strokeWidth={1.7} />
              {formatearFechaLarga(deposito.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge variant={variante}>{etiqueta}</StatusBadge>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Dato
          etiqueta="Cliente"
          valor={deposito.cliente_nombre || deposito.idUser || "—"}
        />
        <Dato
          etiqueta="Archivos cargados"
          valor={deposito.depositosComprobante?.length ?? 0}
        />
        <Dato etiqueta="Valor pagado" valor={formatearMoneda(deposito.monto_pagado)} />
        <Dato etiqueta="N° de recibo" valor={numeroReciboDeposito(deposito)} />
      </div>

      <div className="mb-5 flex flex-col gap-2.5">
        {deposito.lotes_relacionados.map((lote) => {
          const porResolver = lote.estado === "Pendiente" || lote.estado === "En Revision"
          return (
            <div
              key={lote.id}
              className="border-border flex flex-wrap items-center justify-between gap-x-3 gap-y-3 rounded-lg border p-3.5"
            >
              <div className="flex items-center gap-2">
                <MapPin className="text-status-reservado-fg size-4" strokeWidth={1.8} />
                <span className="font-bold">
                  {[lote.lote, ...(lote.id === anclaId ? lotesDelResumen : [])].join(
                    ", "
                  )}
                </span>
              </div>

              {/* Mobile: `contents` deja la etiqueta junto al lote y baja los botones a su propia linea. */}
              <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                <BadgeLote lote={lote} />

                {puedeGestionar && porResolver && (
                  <div className="flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                    <Button type="button" size="sm" onClick={() => onAprobar(lote)}>
                      <CheckCircle2 /> Aprobar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => onDevolver(lote)}
                    >
                      <XCircle /> Devolver
                    </Button>
                  </div>
                )}

                {puedeGestionar && lote.estado === "Devuelto" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => onCambiarEstado(lote)}
                  >
                    <RefreshCw /> Cambiar estado
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onVerComprobantes(deposito)}
        >
          <Eye /> Ver depósitos
        </Button>

        {recibos.map((recibo, indice) => (
          <Button key={recibo.id ?? recibo.url} asChild variant="outline">
            <a href={recibo.url} target="_blank" rel="noopener noreferrer">
              <FileText />
              {recibos.length > 1
                ? `Ver recibo ${recibo.numero_recibo || indice + 1}`
                : "Ver recibo"}
            </a>
          </Button>
        ))}

        <Button
          type="button"
          variant={tieneResumen ? "dark" : "outline"}
          disabled={!tieneResumen}
          onClick={() => onVerResumen(deposito)}
        >
          <Info /> Ver resumen{!tieneResumen && " (sin datos)"}
        </Button>
      </div>
    </article>
  )
}
