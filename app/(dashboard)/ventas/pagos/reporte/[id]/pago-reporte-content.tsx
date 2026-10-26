"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, CheckCircle2, Pencil, Printer, XCircle } from "lucide-react"

import { Can } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { StaticField } from "@/components/shared/select-field"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
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
import { Textarea } from "@/components/ui/textarea"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  aprobarPago,
  devolverPago,
  obtenerPago,
  obtenerProceso,
  type PagoBackend,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"

function formatearMoneda(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

// El estado que gobierna esta pantalla es proceso.payment_status (pendiente / ingresado
// / aprobado / rechazado), igual que finan_status/offert_status en las otras dos
// pantallas de reporte.
function normalizarEstado(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "aprobado" || clave === "ingresado" || clave === "rechazado") return clave
  return "pendiente"
}

export function PagoReporteContent({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const idNumero = Number(id)

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [pago, setPago] = useState<PagoBackend | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [confirmacionAprobar, setConfirmacionAprobar] = useState(false)
  const [confirmacionDevolver, setConfirmacionDevolver] = useState(false)
  const [motivoDevolucion, setMotivoDevolucion] = useState("")
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!idNumero || Number.isNaN(idNumero)) {
      setCargando(false)
      setError("Proceso inválido.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const procesoData = await obtenerProceso(idNumero)
        if (cancelado) return
        if (!procesoData) {
          setError("No se encontró el proceso.")
          return
        }
        setProceso(procesoData)

        const [lote, pagoData] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          obtenerPago(idNumero),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setPago(pagoData)

        if (!pagoData) {
          setError("Este proceso todavía no tiene un pago ingresado.")
        }
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof VentasApiError || err instanceof InventarioApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [idNumero])

  async function manejarAprobar() {
    setProcesando(true)
    try {
      await aprobarPago(idNumero)
      toast({ variant: "success", description: "Pago aprobado." })
      router.push(`/ventas/procesos?lote=${encodeURIComponent(proceso?.cli_lote ?? "")}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo aprobar el pago",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setProcesando(false)
      setConfirmacionAprobar(false)
    }
  }

  async function manejarDevolver() {
    if (!motivoDevolucion.trim()) return
    setProcesando(true)
    try {
      await devolverPago(idNumero, motivoDevolucion.trim())
      toast({ variant: "success", description: "Pago devuelto al asesor." })
      router.push(`/ventas/procesos?lote=${encodeURIComponent(proceso?.cli_lote ?? "")}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo devolver el pago",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setProcesando(false)
      setConfirmacionDevolver(false)
    }
  }

  const titular = proceso?.titular ?? null
  const estado = normalizarEstado(proceso?.payment_status)
  const puedeAprobar = estado === "ingresado"
  // Un pago aprobado también se puede devolver (ej. se aprobó por error, o hace falta
  // corregir la institución financiera) — el backend revierte el lote a "libre" y
  // desmarca la venta como completada (ver revertirVentaCompletada en pago.service.ts).
  const puedeDevolver = estado === "ingresado" || estado === "aprobado"

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="bg-brand-gradient-banner relative flex items-center justify-between gap-4 overflow-hidden px-5 py-5 sm:px-8.5 sm:py-6.5">
            <div className="absolute -top-15 -right-10 size-55 rounded-full bg-white/9" />
            <div className="relative">
              <h1 className="text-xl font-extrabold text-white sm:text-[23px]">
                Reporte de pago
              </h1>
              <p className="text-sm text-white/90">
                Confirma la información antes de aprobar o devolver el pago
              </p>
            </div>
            {pago && (
              <div className="relative">
                <StatusBadge variant={estado} />
              </div>
            )}
          </div>

          <div className="px-4 pt-6 pb-6 sm:px-8.5 sm:pt-8 sm:pb-7.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !pago ? (
              <EmptyState
                title="No se puede abrir el reporte"
                description={error ?? "No se encontró el pago."}
                dashed
              />
            ) : (
              <>
                <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StaticField label="Cliente" value={titular?.nombre ?? "—"} emphasis />
                  <StaticField
                    label="Inmueble"
                    value={loteInfo?.codigo ?? proceso?.cli_lote ?? "—"}
                    mono
                  />
                </div>

                <div className="mb-7.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <StaticField label="N.º de recibo" value={pago.no_recibo ?? "—"} mono />
                  <StaticField label="Tipo de pago" value={pago.tipo_pago ?? "—"} />
                  <StaticField
                    label="Fecha de pago"
                    value={formatearFecha(pago.fec_pago)}
                    mono
                  />
                  <StaticField
                    label="Valor total"
                    value={formatearMoneda(pago.valor_esperado)}
                    mono
                  />
                  <StaticField
                    label="N.º de comprobante"
                    value={pago.ref_pago ?? "—"}
                    mono
                  />
                  {Number(pago.valor_total) !== Number(pago.valor_esperado) && (
                    <StaticField
                      label="Monto pagado (otro monto)"
                      value={formatearMoneda(pago.valor_total)}
                      mono
                      emphasis
                    />
                  )}
                </div>

                {pago.comentario && (
                  <div className="mb-7.5">
                    <StaticField label="Comentarios" value={pago.comentario} />
                  </div>
                )}

                {pago.motivo_rechazo && (
                  <div className="mb-7.5">
                    <StaticField
                      label="Motivo de devolución"
                      value={pago.motivo_rechazo}
                    />
                  </div>
                )}

                <div className="border-border flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-5.5">
                  <div className="flex flex-wrap gap-3 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                      Volver
                    </Button>
                    <Can permiso="pago:editar">
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/ventas/pagos/new/${idNumero}`)}
                      >
                        <Pencil className="size-3.5" strokeWidth={1.8} />
                        Editar pago
                      </Button>
                    </Can>
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/ventas/pagos/reporte/${idNumero}/imprimir`)
                      }
                    >
                      <Printer className="size-3.5" strokeWidth={1.8} />
                      Imprimir
                    </Button>
                  </div>
                  {(puedeAprobar || puedeDevolver) && (
                    <Can permiso="pago:aprobar">
                      <div className="flex flex-col gap-3 sm:flex-row [&>button]:w-full sm:[&>button]:w-auto">
                        {puedeDevolver && (
                          <Button
                            variant="outline"
                            onClick={() => setConfirmacionDevolver(true)}
                          >
                            <XCircle className="size-3.5" strokeWidth={1.8} />
                            Devolver
                          </Button>
                        )}
                        {puedeAprobar && (
                          <Button onClick={() => setConfirmacionAprobar(true)}>
                            <CheckCircle2 className="size-3.5" strokeWidth={1.8} />
                            Aprobar pago
                          </Button>
                        )}
                      </div>
                    </Can>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Sheet
        open={confirmacionAprobar}
        onOpenChange={(valor) => !valor && setConfirmacionAprobar(false)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Aprobar pago</SheetTitle>
            <SheetDescription>
              ¿Estás seguro de aprobar este pago? Esta acción queda registrada en el
              proceso.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={procesando}
              onClick={() => setConfirmacionAprobar(false)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={procesando} onClick={manejarAprobar}>
              {procesando ? "Aprobando…" : "Aprobar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={confirmacionDevolver}
        onOpenChange={(valor) => !valor && setConfirmacionDevolver(false)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Devolver pago</SheetTitle>
            <SheetDescription>
              Indica el motivo para que el asesor sepa qué corregir.
            </SheetDescription>
          </SheetHeader>
          <div className="p-5">
            <Textarea
              value={motivoDevolucion}
              onChange={(event) => setMotivoDevolucion(event.target.value)}
              placeholder="Ej. El comprobante no coincide con el valor ingresado"
            />
          </div>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={procesando}
              onClick={() => setConfirmacionDevolver(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={procesando || !motivoDevolucion.trim()}
              onClick={manejarDevolver}
            >
              {procesando ? "Devolviendo…" : "Devolver"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
