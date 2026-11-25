"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Info } from "lucide-react"

import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  corregirDeposito,
  DepositosApiError,
  type DepositoBackend,
} from "@/lib/api/depositos-api"
import { cn } from "@/lib/utils"

import { calcularEstadoDeposito, parsearResumen, repartirMontos } from "./depositos-utils"

type CampoLote = "monto" | "principal" | "alicuota" | "mora"
type LoteForm = { id: string } & Record<CampoLote, string>

const CAMPOS_LOTE: Array<{ campo: CampoLote; etiqueta: string }> = [
  { campo: "monto", etiqueta: "Monto a pagar" },
  { campo: "principal", etiqueta: "Cuota" },
  { campo: "alicuota", etiqueta: "Alícuota" },
  { campo: "mora", etiqueta: "Valor atrasado" },
]

// Mismo criterio que el backend (corregir-deposito.util.ts): número, 2 decimales máx.
function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  const n = Number(limpio)
  return n > 1_000_000 ? null : n
}

const texto = (valor: unknown) =>
  valor == null || valor === "" ? "0" : String(valor).replace(",", ".")

const dinero = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`

function lotesIniciales(deposito: DepositoBackend): LoteForm[] {
  const resumen = parsearResumen(deposito.resumen)
  return (resumen.lotesDetails ?? []).map((lote) => ({
    id: String(lote.id),
    monto: texto(
      resumen.customAmountsMulti?.[lote.id] ?? resumen.customAmount ?? lote.principal
    ),
    principal: texto(lote.principal),
    alicuota: texto(lote.alicuota),
    mora: texto(lote.mora),
  }))
}

function CampoDinero({
  id,
  etiqueta,
  valor,
  invalido,
  disabled,
  onChange,
}: {
  id: string
  etiqueta: string
  valor: string
  invalido: boolean
  disabled: boolean
  onChange: (valor: string) => void
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="text-muted-foreground mb-1 block text-[11px] font-semibold"
      >
        {etiqueta}
      </label>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          value={valor}
          disabled={disabled}
          aria-invalid={invalido || undefined}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ""))}
          className="pl-6 font-mono"
        />
      </div>
    </div>
  )
}

// Corrige los datos que el cliente ingresó mal en la app: monto pagado, banco de
// origen, n° de transacción y los valores del resumen por lote. Los lotes del resumen
// no se agregan ni quitan. El backend valida todo de nuevo y lo aplica a todas las
// filas del mismo pago.
export function CorregirPagoSheet({
  deposito,
  onCerrar,
  onCorregido,
}: {
  deposito: DepositoBackend | null
  onCerrar: () => void
  onCorregido: () => void
}) {
  const toast = useToast()
  const [monto, setMonto] = useState("")
  const [banco, setBanco] = useState("")
  const [numero, setNumero] = useState("")
  const [lotes, setLotes] = useState<LoteForm[]>([])
  const [iniciales, setIniciales] = useState<LoteForm[]>([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!deposito) return
    setMonto(texto(deposito.monto_pagado ?? deposito.valor))
    setBanco(deposito.banco_origen ?? "")
    setNumero(deposito.numero_transaccion ?? "")
    const base = lotesIniciales(deposito)
    setLotes(base)
    setIniciales(base)
    setEnviando(false)
  }, [deposito])

  const montoNum = leerMonto(monto)
  const montoValido = montoNum !== null && montoNum > 0
  const numeroValido = /^[A-Za-z0-9-]*$/.test(numero.trim())

  const calculo = useMemo(() => {
    let total = 0
    let valido = true
    const filas = lotes.map((lote) => {
      const n = Object.fromEntries(
        CAMPOS_LOTE.map(({ campo }) => [campo, leerMonto(lote[campo])])
      ) as Record<CampoLote, number | null>
      const ok = CAMPOS_LOTE.every(({ campo }) => n[campo] !== null)
      if (!ok) valido = false
      const enContra = ok ? n.monto! - (n.principal! + n.alicuota! + n.mora!) : 0
      total += n.monto ?? 0
      return { n, ok, enContra }
    })
    return { filas, valido, total: Math.round(total * 100) / 100 }
  }, [lotes])

  const resumenCambio = lotes.some((lote, i) =>
    CAMPOS_LOTE.some(({ campo }) => {
      const a = leerMonto(lote[campo])
      const b = leerMonto(iniciales[i]?.[campo] ?? "")
      return a !== b
    })
  )
  const pagoCambio =
    !!deposito &&
    (leerMonto(monto) !== leerMonto(texto(deposito.monto_pagado ?? deposito.valor)) ||
      banco.trim() !== (deposito.banco_origen ?? "").trim() ||
      numero.trim() !== (deposito.numero_transaccion ?? "").trim())

  const descuadre =
    lotes.length > 0 && montoValido && calculo.valido && calculo.total !== montoNum
  const yaAprobado =
    !!deposito && calcularEstadoDeposito(deposito.lotes_relacionados) === "Aprobado"
  const puedeGuardar =
    montoValido &&
    numeroValido &&
    (lotes.length === 0 || calculo.valido) &&
    (pagoCambio || resumenCambio) &&
    !enviando

  function cambiarLote(indice: number, campo: CampoLote, valor: string) {
    setLotes((previo) => {
      const siguiente = previo.map((lote, i) =>
        i === indice ? { ...lote, [campo]: valor } : lote
      )
      // Con varios lotes, cambiar el "monto a pagar" de uno reparte la diferencia en
      // los demás para que el total siga siendo lo que pagó el cliente.
      return campo === "monto" ? repartir(siguiente, indice) : siguiente
    })
  }

  function repartir(lista: LoteForm[], fijo?: number): LoteForm[] {
    if (montoNum === null || lista.length === 0) return lista
    if (fijo !== undefined && lista.length < 2) return lista
    const montos = lista.map((lote) => leerMonto(lote.monto))
    if (montos.some((m) => m === null)) return lista
    const repartidos = repartirMontos(montos as number[], montoNum, fijo)
    return lista.map((lote, i) =>
      i === fijo || repartidos[i] === montos[i]
        ? lote
        : { ...lote, monto: String(repartidos[i]) }
    )
  }

  // Ajusta los montos del resumen para que sumen el monto pagado.
  function igualarResumen() {
    setLotes((previo) => repartir(previo))
  }

  async function guardar() {
    if (!deposito || !puedeGuardar || montoNum === null) return
    setEnviando(true)
    try {
      await corregirDeposito({
        id: deposito.id,
        montoPagado: montoNum,
        bancoOrigen: banco,
        numeroTransaccion: numero,
        lotes: resumenCambio
          ? lotes.map((lote, i) => ({
              id: lote.id,
              monto: calculo.filas[i].n.monto!,
              principal: calculo.filas[i].n.principal!,
              alicuota: calculo.filas[i].n.alicuota!,
              mora: calculo.filas[i].n.mora!,
            }))
          : undefined,
      })
      toast({ variant: "success", description: "Datos del pago corregidos" })
      onCorregido()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof DepositosApiError ? err.message : "No se pudo corregir el pago",
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Sheet
      open={!!deposito}
      onOpenChange={(abierto) => !abierto && !enviando && onCerrar()}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Corregir pago</SheetTitle>
          <SheetDescription>
            Ajuste los datos que el cliente ingresó mal. Revise el comprobante antes de
            cambiarlos.
          </SheetDescription>
        </SheetHeader>

        {deposito && (
          <div className="flex flex-col gap-6 p-5">
            <section className="flex flex-col gap-3">
              <h4 className="text-[13px] font-bold">Datos del pago</h4>
              <CampoDinero
                id="corregir-monto"
                etiqueta="Monto pagado *"
                valor={monto}
                invalido={!montoValido}
                disabled={enviando}
                onChange={setMonto}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="corregir-banco"
                    className="text-muted-foreground mb-1 block text-[11px] font-semibold"
                  >
                    Banco de origen
                  </label>
                  <Input
                    id="corregir-banco"
                    value={banco}
                    maxLength={100}
                    disabled={enviando}
                    onChange={(event) => setBanco(event.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="corregir-numero"
                    className="text-muted-foreground mb-1 block text-[11px] font-semibold"
                  >
                    N° de transacción
                  </label>
                  <Input
                    id="corregir-numero"
                    value={numero}
                    maxLength={50}
                    disabled={enviando}
                    aria-invalid={!numeroValido || undefined}
                    onChange={(event) => setNumero(event.target.value)}
                    className="font-mono"
                  />
                  {!numeroValido && (
                    <p className="text-destructive mt-1 text-xs">
                      Solo letras, números y guiones.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h4 className="text-[13px] font-bold">Resumen por lote</h4>
              {lotes.length > 1 && (
                <p className="text-muted-foreground -mt-1 text-xs">
                  Al cambiar el monto a pagar de un lote, la diferencia se descuenta o se
                  suma a los otros lotes para que el total siga siendo el monto pagado.
                </p>
              )}
              {lotes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Este depósito no trae resumen por lote.
                </p>
              ) : (
                lotes.map((lote, indice) => {
                  const fila = calculo.filas[indice]
                  return (
                    <div
                      key={lote.id}
                      className="border-border flex flex-col gap-3 rounded-lg border p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">Lote {lote.id}</span>
                        {fila?.ok && (
                          <span
                            className={cn(
                              "font-mono text-xs font-semibold",
                              fila.enContra < 0
                                ? "text-status-bloqueado-fg"
                                : "text-muted-foreground"
                            )}
                          >
                            En contra: {dinero(fila.enContra)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {CAMPOS_LOTE.map(({ campo, etiqueta }) => (
                          <CampoDinero
                            key={campo}
                            id={`corregir-${lote.id}-${campo}`}
                            etiqueta={etiqueta}
                            valor={lote[campo]}
                            invalido={leerMonto(lote[campo]) === null}
                            disabled={enviando}
                            onChange={(valor) => cambiarLote(indice, campo, valor)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })
              )}

              {lotes.length > 0 && (
                <div className="border-border flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-bold">Total del resumen</span>
                  <span className="font-mono font-bold">
                    {calculo.valido ? dinero(calculo.total) : "—"}
                  </span>
                </div>
              )}

              {descuadre && (
                <div className="bg-status-reservado-bg border-status-reservado-border flex gap-3 rounded-md border p-3.5">
                  <AlertTriangle
                    className="text-status-reservado-fg mt-0.5 size-4 shrink-0"
                    strokeWidth={1.8}
                  />
                  <div className="text-status-reservado-fg flex flex-col gap-2 text-[13px] leading-snug">
                    <p>
                      El total del resumen ({dinero(calculo.total)}) no coincide con el
                      monto pagado ({dinero(montoNum ?? 0)}).
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="self-start"
                      disabled={enviando}
                      onClick={igualarResumen}
                    >
                      Ajustar el resumen al monto pagado
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {yaAprobado && (
              <div className="bg-muted flex gap-3 rounded-md p-3.5">
                <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <p className="text-muted-foreground text-[13px] leading-snug">
                  Este pago ya está aprobado. La corrección no le envía un nuevo aviso al
                  cliente.
                </p>
              </div>
            )}
          </div>
        )}

        <SheetFooter className="border-border border-t p-5">
          <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" disabled={!puedeGuardar} onClick={guardar}>
            {enviando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
