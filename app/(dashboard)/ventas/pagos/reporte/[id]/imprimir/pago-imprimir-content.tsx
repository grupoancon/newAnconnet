"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  obtenerFinanciamiento,
  obtenerPago,
  obtenerProceso,
  type FinanciamientoBackend,
  type PagoBackend,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"

function formatearMoneda(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

// "16 sept 2026" — mismo formato que usa el recibo impreso.
function formatearFechaLarga(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const fechaObj = new Date(`${fecha.slice(0, 10)}T00:00:00`)
  if (isNaN(fechaObj.getTime())) return fecha
  return fechaObj
    .toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" })
    .replace(".", "")
}

function formatearFechaCorta(fecha: string | null | undefined): string {
  return fecha ? fecha.slice(0, 10) : "—"
}

// Misma fila de la tabla de entrada que usa el financiamiento para mostrar el abono
// inicial (ver resolverAbonoInicial en pago-content.tsx) — acá se usa su fecha_pago
// como "Fecha Pago Programado" del recibo, ya que el pago no guarda esa fecha aparte.
function resolverFechaProgramada(
  financiamiento: FinanciamientoBackend | null
): string | null {
  const entradas = financiamiento?.entradas ?? []
  const fila = entradas.find((f) => f.forma_pago === "Abono inicial") ?? entradas[0]
  return fila?.fecha_pago ?? null
}

function LogoInmoconstrucciones({ className }: { className?: string }) {
  return (
    <Image
      src="/images/Inmoconstrucciones.png"
      alt="Inmoconstrucciones"
      width={64}
      height={64}
      className={className}
      priority
      unoptimized
    />
  )
}

function CampoRecibo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="font-semibold whitespace-nowrap">{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function PagoImprimirContent({ id }: { id: string }) {
  const router = useRouter()
  const idNumero = Number(id)

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [financiamiento, setFinanciamiento] = useState<FinanciamientoBackend | null>(null)
  const [pago, setPago] = useState<PagoBackend | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        const [lote, financiamientoData, pagoData] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          obtenerFinanciamiento(idNumero),
          obtenerPago(idNumero),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setFinanciamiento(financiamientoData)
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

  const titular = proceso?.titular ?? null
  const proyecto = loteInfo?.proyecto?.nombre ?? "—"
  const fechaProgramada = resolverFechaProgramada(financiamiento)

  return (
    <div className="bg-muted/30 min-h-screen">
      <div className="no-print border-border bg-card sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
          Volver
        </Button>
        {pago && (
          <Button onClick={() => window.print()}>
            <Printer className="size-3.5" strokeWidth={1.8} />
            Imprimir
          </Button>
        )}
      </div>

      <div className="recibo-pago mx-auto my-6 w-full max-w-[820px]">
        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error || !pago ? (
          <div className="p-6">
            <EmptyState
              title="No se puede abrir el recibo"
              description={error ?? "No se encontró el pago."}
              dashed
            />
          </div>
        ) : (
          <div className="text-black">
            <div className="mb-4 flex items-center justify-between gap-4 rounded-lg bg-gray-200 pr-1 pl-1">
              <div className="flex items-center justify-center gap-4">
                <LogoInmoconstrucciones className="size-20" />
                <div className="text-[15px] leading-tight font-extrabold uppercase">
                  <div>Inmobiliaria y Construcciones</div>
                  <div>Inmoconstrucciones Cia.Ltda.</div>
                </div>
              </div>
              <div className="flex flex-col items-end justify-center pr-2 text-[11px] leading-snug">
                <div className="font-bold">RUC 1791714881001</div>
                <div>Eloy Alfaro N32-330 y Francisco Andrade Marín</div>
                <div>(02) 252 8289</div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 rounded-lg bg-gray-200 p-5 text-[12px]">
                <CampoRecibo label="Recibo:" value={pago.no_recibo} />
                <CampoRecibo
                  label="Fecha:"
                  value={formatearFechaLarga(pago.created_at ?? pago.fec_pago)}
                />
                <CampoRecibo label="Nombre:" value={titular?.nombre ?? "—"} />
                <CampoRecibo label="Proyecto:" value={proyecto} />
                <CampoRecibo
                  label="Inmueble:"
                  value={loteInfo?.codigo ?? proceso?.cli_lote ?? "—"}
                />
              </div>
              <div className="flex flex-col gap-1.5 rounded-lg bg-gray-200 p-5 text-[12px]">
                <div className="text-[11px] font-bold tracking-wide uppercase">
                  Forma de pago
                </div>
                <div className="mb-1">{pago.tipo_pago}</div>
                <CampoRecibo label="N° Comprobante" value={pago.ref_pago || "-"} />
                <CampoRecibo label="N° Cuenta" value="-" />
              </div>
            </div>

            <div className="rounded-lg bg-white">
              <div className="overflow-hidden rounded-lg">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-gray-200 text-left">
                      <th className="px-4 py-2.5 text-center font-bold sm:px-6">
                        Detalle
                      </th>
                      <th className="px-2 py-2.5 text-center font-bold sm:px-6">
                        Fecha Pago Programado
                      </th>
                      <th className="px-4 py-2.5 text-center font-bold sm:px-6">
                        Fecha Pago
                      </th>
                      <th className="px-4 py-2.5 text-right font-bold sm:px-6">
                        Abono Inicial
                      </th>
                      <th className="px-4 py-2.5 text-right font-bold sm:px-6">
                        Total Pagado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 sm:px-6">
                        COMPRA DE LOTE PROY {proyecto.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        {formatearFechaCorta(fechaProgramada)}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap sm:px-8">
                        {formatearFechaCorta(pago.fec_pago)}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        {formatearMoneda(pago.valor_esperado)}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        {formatearMoneda(pago.valor_total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  {pago.comentario && (
                    <div className="max-w-[45%] rounded-md border border-gray-200 px-4 py-2 text-[10px] text-gray-500">
                      {pago.comentario}
                    </div>
                  )}
                  <div className="shrink-0 text-right text-[13px] font-extrabold">
                    TOTAL: {formatearMoneda(pago.valor_total)}
                  </div>
                </div>

                <div className="mt-16 grid grid-cols-2 gap-10 text-center text-[11px]">
                  <div className="border-t border-black pt-1.5">Elaborado por</div>
                  <div className="border-t border-black pt-1.5">
                    Recibí Conforme
                    <div className="font-bold">{titular?.nombre ?? "—"}</div>
                  </div>
                </div>

                <div className="text-muted-foreground mt-10 space-y-3 text-[9.5px] leading-snug">
                  <p>
                    <strong className="text-foreground">NOTA DE PRIVACIDAD:</strong> Sus
                    datos personales han sido tratados exclusivamente para la gestión de
                    cobro, emisión del comprobante y registro contable de su pago. Para
                    mayor información sobre el tratamiento de sus datos y el ejercicio de
                    sus derechos ARCO, consulte nuestra política de privacidad en el sitio
                    web www.grupoancon.com
                  </p>
                  <p>
                    *Este es un recibo provisional. El pago realizado será validado en
                    nuestras oficinas a la brevedad, dentro del próximo día laborable. Tan
                    pronto se complete la validación, emitiremos el recibo definitivo.
                    Agradecemos su comprensión.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .recibo-pago {
          font-family: var(--font-plus-jakarta-sans), Arial, Helvetica, sans-serif;
        }
        /* Chrome/Safari por default no imprimen background-color (lo pisan a blanco) —
           sin esto, el gris del letterhead y de las cajas de datos desaparece al
           imprimir aunque se vea bien en pantalla. */
        .recibo-pago,
        .recibo-pago * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .recibo-pago {
            margin: 0 !important;
            max-width: none !important;
          }
          @page {
            margin: 1.2cm;
          }
        }
      `}</style>
    </div>
  )
}
