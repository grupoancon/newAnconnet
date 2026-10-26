"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Download, ImageOff, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { DepositoBackend } from "@/lib/api/depositos-api"

import { formatearFechaLarga, formatearMoneda } from "./depositos-utils"

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Abre una ventana solo con el comprobante visible (más fecha y lotes) y dispara
// window.print() cuando la imagen termina de cargar.
function imprimirComprobante(deposito: DepositoBackend, url: string) {
  const ventana = window.open("", "_blank")
  if (!ventana) return

  const lotes = deposito.lotes_relacionados?.length
    ? deposito.lotes_relacionados.map((lote) => lote.lote).join(", ")
    : "N/A"

  ventana.document.write(`<html>
  <head>
    <title>Imprimir comprobante</title>
    <style>
      @page { size: auto; margin: 5mm; }
      body { margin: 0; display: flex; flex-direction: column; align-items: center;
        padding: 20px; font-family: system-ui, -apple-system, sans-serif; height: 100vh;
        box-sizing: border-box; }
      .header { margin-bottom: 20px; text-align: center; width: 100%;
        border-bottom: 1px solid #eee; padding-bottom: 15px; }
      .info-row { margin: 5px 0; font-size: 14px; color: #333; }
      img { max-width: 100%; max-height: calc(100vh - 120px); object-fit: contain; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="info-row"><strong>Fecha:</strong> ${escaparHtml(formatearFechaLarga(deposito.createdAt))}</div>
      <div class="info-row"><strong>Lotes:</strong> ${escaparHtml(lotes)}</div>
    </div>
    <img src="${escaparHtml(url)}" onload="window.print();window.close()" />
  </body>
</html>`)
  ventana.document.close()
}

function DatoCard({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="bg-muted border-border rounded-lg border p-3">
      <p className="text-muted-foreground mb-1 text-[11px] font-semibold">{etiqueta}</p>
      <p className="text-[13px] font-bold break-words">{valor}</p>
    </div>
  )
}

export function DepositoDetalleSheet({
  deposito,
  onCerrar,
}: {
  deposito: DepositoBackend | null
  onCerrar: () => void
}) {
  const [indice, setIndice] = useState(0)

  // Al abrir otro depósito se vuelve al primer comprobante.
  useEffect(() => {
    setIndice(0)
  }, [deposito?.id])

  const comprobantes = deposito?.depositosComprobante ?? []
  const actual = comprobantes[indice]

  return (
    <Sheet open={!!deposito} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Comprobantes del depósito</SheetTitle>
          <SheetDescription>
            Revise los comprobantes que subió el cliente antes de aprobar o devolver.
          </SheetDescription>
        </SheetHeader>

        {deposito && (
          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DatoCard etiqueta="Banco origen" valor={deposito.banco_origen || "—"} />
              <DatoCard
                etiqueta="N° transacción"
                valor={deposito.numero_transaccion || "—"}
              />
              <DatoCard
                etiqueta="Monto pagado"
                valor={formatearMoneda(deposito.monto_pagado)}
              />
            </div>

            {actual ? (
              <>
                <div className="bg-muted relative flex h-[55vh] w-full items-center justify-center overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Cloudinary) de tamaño arbitrario */}
                  <img
                    src={actual.url}
                    alt={`Comprobante ${indice + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />

                  {comprobantes.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        className="absolute left-3 rounded-full"
                        aria-label="Comprobante anterior"
                        disabled={indice === 0}
                        onClick={() => setIndice((previo) => Math.max(0, previo - 1))}
                      >
                        <ChevronLeft />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-lg"
                        className="absolute right-3 rounded-full"
                        aria-label="Comprobante siguiente"
                        disabled={indice === comprobantes.length - 1}
                        onClick={() =>
                          setIndice((previo) =>
                            Math.min(comprobantes.length - 1, previo + 1)
                          )
                        }
                      >
                        <ChevronRight />
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-muted-foreground text-[13px] font-semibold">
                    Comprobante {indice + 1} de {comprobantes.length}
                  </p>
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <a
                        href={actual.url}
                        download={`comprobante-${deposito.id}-${indice + 1}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download /> Descargar
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="dark"
                      onClick={() => imprimirComprobante(deposito, actual.url)}
                    >
                      <Printer /> Imprimir
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex h-56 flex-col items-center justify-center gap-3">
                <ImageOff className="size-12" strokeWidth={1.4} />
                <p className="text-sm">No hay comprobantes disponibles</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
