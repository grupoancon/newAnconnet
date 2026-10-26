"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Upload, X } from "lucide-react"

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
import { DepositosApiError, aprobarDeposito, subirRecibos } from "@/lib/api/depositos-api"
import { cn } from "@/lib/utils"

import {
  MAX_RECIBOS_POR_LOTE,
  normalizarNumeroRecibo,
  numeroReciboValido,
} from "./depositos-utils"

export type LoteSeleccionado = { id: number; lote: string }

type ReciboItem = { file: File; numero: string }

const TIPOS_VALIDOS = ["image/jpeg", "image/png", "application/pdf"]

export function RegistrarLoteSheet({
  lote,
  onCerrar,
  onRegistrado,
}: {
  lote: LoteSeleccionado | null
  onCerrar: () => void
  onRegistrado: () => void
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<ReciboItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Cada vez que se abre para otro lote arranca limpio.
  useEffect(() => {
    setItems([])
    setError(null)
    setEnviando(false)
  }, [lote?.id])

  function agregarArchivos(archivos: File[]) {
    if (archivos.length === 0) return

    if (archivos.some((archivo) => !TIPOS_VALIDOS.includes(archivo.type))) {
      setError("Solo se permiten archivos JPG, PNG o PDF")
      return
    }

    // El endpoint de subida acepta hasta 3 archivos por request.
    const combinados = [...items, ...archivos.map((file) => ({ file, numero: "RC-" }))]
    if (combinados.length > MAX_RECIBOS_POR_LOTE) {
      setItems(combinados.slice(0, MAX_RECIBOS_POR_LOTE))
      setError(`Máximo ${MAX_RECIBOS_POR_LOTE} recibos por lote`)
      return
    }
    setItems(combinados)
    setError(null)
  }

  function cambiarNumero(indice: number, crudo: string) {
    const normalizado = normalizarNumeroRecibo(crudo)
    if (normalizado === null) return
    setItems((previo) =>
      previo.map((item, i) => (i === indice ? { ...item, numero: normalizado } : item))
    )
  }

  function quitar(indice: number) {
    setItems((previo) => previo.filter((_, i) => i !== indice))
    setError(null)
  }

  async function registrar() {
    if (!lote || enviando) return
    setEnviando(true)
    try {
      // El orden de la respuesta coincide con el de `items`: de ahí sale el número que
      // corresponde a cada archivo subido.
      const subidos = await subirRecibos(items.map((item) => item.file))
      await aprobarDeposito({
        id: lote.id,
        lote: lote.lote,
        recibos: subidos.map((recibo, i) => ({
          ...recibo,
          numero_recibo: items[i]?.numero ?? "",
          lote: lote.lote,
        })),
      })
      toast({ variant: "success", description: "Depósito aprobado exitosamente" })
      onRegistrado()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof DepositosApiError ? err.message : "Error al aprobar el depósito",
      })
    } finally {
      setEnviando(false)
    }
  }

  const puedeRegistrar =
    items.length > 0 &&
    items.every((item) => numeroReciboValido(item.numero)) &&
    !enviando

  return (
    <Sheet open={!!lote} onOpenChange={(abierto) => !abierto && !enviando && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Registrar lote</SheetTitle>
          <SheetDescription>
            Complete la información del recibo para registrar este lote.
          </SheetDescription>
        </SheetHeader>

        {lote && (
          <div className="flex flex-col gap-4 p-5">
            <div className="bg-muted rounded-lg p-4">
              <p className="font-bold">Lote: {lote.lote}</p>
            </div>

            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                RECIBOS DE CAJA (JPG, PNG O PDF){" "}
                <span className="text-destructive">*</span>
                <span className="font-normal normal-case">
                  {" "}
                  — hasta {MAX_RECIBOS_POR_LOTE}, cada uno con su número
                </span>
              </label>

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={(event) => {
                  agregarArchivos(Array.from(event.target.files ?? []))
                  // Permite volver a elegir el mismo archivo.
                  event.target.value = ""
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={enviando || items.length >= MAX_RECIBOS_POR_LOTE}
                className={cn(
                  "border-input bg-card hover:bg-muted flex h-11 w-full items-center justify-between rounded-md border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  error && "border-destructive"
                )}
              >
                <span className="text-muted-foreground truncate">
                  {items.length > 0
                    ? `${items.length} recibo(s) — agregar más`
                    : "Seleccionar archivos"}
                </span>
                <Upload className="text-muted-foreground size-4" strokeWidth={1.7} />
              </button>

              {items.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {items.map((item, indice) => (
                    <li
                      key={`${item.file.name}-${indice}`}
                      className="bg-muted rounded-md p-2.5"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="text-muted-foreground truncate text-xs">
                          {item.file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => quitar(indice)}
                          disabled={enviando}
                          className="text-status-bloqueado-fg flex shrink-0 items-center gap-1 text-xs font-semibold disabled:opacity-50"
                        >
                          <X className="size-3" /> Quitar
                        </button>
                      </div>
                      <input
                        type="text"
                        value={item.numero}
                        disabled={enviando}
                        onChange={(event) => cambiarNumero(indice, event.target.value)}
                        placeholder="RC-XXXXXX"
                        className={cn(
                          "bg-card focus:ring-ring/15 h-10 w-full rounded-md border px-3 font-mono text-sm outline-none focus:ring-3",
                          numeroReciboValido(item.numero)
                            ? "border-input focus:border-primary"
                            : "border-status-reservado"
                        )}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p className="text-destructive mt-1.5 text-xs font-medium">{error}</p>
              )}
            </div>
          </div>
        )}

        <SheetFooter className="border-border border-t p-5">
          <Button type="button" variant="outline" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" disabled={!puedeRegistrar} onClick={registrar}>
            <CheckCircle2 />
            {enviando ? "Registrando…" : "Registrar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
