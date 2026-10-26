"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { DepositoResumen } from "@/lib/api/depositos-api"
import { cn } from "@/lib/utils"

function aNumero(valor: number | string | null | undefined): number {
  const numero = typeof valor === "string" ? parseFloat(valor) : (valor ?? 0)
  return Number.isNaN(numero) ? 0 : numero
}

function Fila({
  etiqueta,
  valor,
  destacado,
  peligro,
}: {
  etiqueta: string
  valor: string
  destacado?: boolean
  peligro?: boolean
}) {
  return (
    <div className={cn("flex justify-between text-sm", destacado && "font-semibold")}>
      <span className={peligro ? "text-status-bloqueado-fg" : "text-muted-foreground"}>
        {etiqueta}
      </span>
      <span
        className={cn(
          "font-mono",
          peligro ? "text-status-bloqueado-fg" : "text-foreground"
        )}
      >
        {valor}
      </span>
    </div>
  )
}

// Snapshot del cálculo de pago que armó el cliente en la app (lo que va a pagar vs. lo
// que le correspondía por lote). `enContra` negativo = pagó de menos.
export function ResumenSheet({
  resumen,
  onCerrar,
}: {
  resumen: DepositoResumen | null
  onCerrar: () => void
}) {
  const lotes = resumen?.lotesDetails ?? []
  const total = aNumero(
    resumen?.totalPayment || resumen?.multiCustomTotal || resumen?.customAmount
  )

  return (
    <Sheet open={!!resumen} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Resumen</SheetTitle>
          <SheetDescription>
            Cálculo del pago tal como lo armó el cliente en la aplicación.
          </SheetDescription>
        </SheetHeader>

        {resumen && (
          <div className="flex flex-col gap-5 p-5">
            {lotes.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Este depósito no trae detalle por lote.
              </p>
            )}

            {lotes.map((lote, indice) => {
              const montoAPagar = aNumero(
                resumen.customAmountsMulti?.[lote.id] ??
                  resumen.customAmount ??
                  lote.principal
              )
              const montoCuota = lote.principal ?? 0
              const alicuota = lote.alicuota ?? 0
              const atrasado = lote.mora ?? 0
              const enContra = montoAPagar - (montoCuota + alicuota + atrasado)

              return (
                <div
                  key={lote.id}
                  className={cn(
                    "flex flex-col gap-2",
                    indice > 0 && "border-border border-t border-dashed pt-5"
                  )}
                >
                  <h4 className="text-[13px] font-bold">Lote {lote.id}</h4>
                  <Fila etiqueta="Monto a pagar" valor={`$${montoAPagar.toFixed(2)}`} />
                  <Fila etiqueta="Monto de cuota" valor={`$${montoCuota.toFixed(2)}`} />
                  <Fila etiqueta="Monto de alícuota" valor={`$${alicuota.toFixed(2)}`} />
                  <Fila
                    etiqueta="Valor atrasado"
                    valor={`$${atrasado.toFixed(2)}`}
                    destacado
                    peligro
                  />
                  <Fila
                    etiqueta="En contra"
                    valor={
                      enContra < 0
                        ? `-$${Math.abs(enContra).toFixed(2)}`
                        : `$${enContra.toFixed(2)}`
                    }
                    destacado
                    peligro={enContra < 0}
                  />
                </div>
              )
            })}

            <div className="border-border flex items-center justify-between border-t pt-4">
              <span className="text-base font-bold">Total a pagar</span>
              <span className="font-mono text-lg font-bold">${total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
