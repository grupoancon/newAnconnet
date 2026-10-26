"use client"

import { useState, useEffect } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Printer } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import type { LoteInventario } from "@/lib/api/inventario-api"
import {
  VentasApiError,
  obtenerCotizacion,
  obtenerLoteCotizacion,
  type CotizacionBackend,
  type CuotaAmortizacion,
  type EntradaPago,
} from "@/lib/api/ventas-api"

// Mismo formato que el anexo de financiamiento: numero con separador de miles y 2
// decimales, SIN simbolo de moneda.
function formatearNumero(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
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

// A diferencia del anexo de financiamiento, no hay firmas: una cotización no es un
// compromiso firmado, es solo una propuesta para el cliente — se imprime en cuanto
// queda "ingresado" (sin aprobación de nadie más, ver CotizacionesService). Antes de
// eso sale marcado BORRADOR, mismo criterio visual que financiamiento/refinanciamiento.
export function CotizacionImprimirContent({ id }: { id: string }) {
  const router = useRouter()
  const idNumero = Number(id)

  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [cotizacion, setCotizacion] = useState<CotizacionBackend | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!idNumero || Number.isNaN(idNumero)) {
      setCargando(false)
      setError("Cotización inválida.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const cotizacionData = await obtenerCotizacion(idNumero)
        if (cancelado) return
        if (!cotizacionData) {
          setError("No se encontró la cotización.")
          return
        }
        setCotizacion(cotizacionData)

        const lote = await obtenerLoteCotizacion(cotizacionData.codigo_lote)
        if (cancelado) return
        setLoteInfo(lote)
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof VentasApiError
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

  const valorLote = loteInfo?.pvp ?? null
  const valorLoteNumero =
    typeof valorLote === "string" ? parseFloat(valorLote) : (valorLote ?? 0)
  const entradas = cotizacion?.entradas ?? []
  const cronograma = cotizacion?.detalle ?? []
  const comentarios = (cotizacion?.comentarios ?? []).filter(
    (c) => c && c.trim().length > 0
  )

  const totalesEntrada = entradas.reduce(
    (acc, fila) => ({
      abono: acc.abono + (Number(fila.abono_lote ?? fila.monto) || 0),
      alicuota: acc.alicuota + (Number(fila.alicuota_comunal) || 0),
      escritura: acc.escritura + (Number(fila.escritura) || 0),
      total: acc.total + (Number(fila.total_cancelar) || 0),
    }),
    { abono: 0, alicuota: 0, escritura: 0, total: 0 }
  )

  const totalesCronograma = cronograma.reduce(
    (acc, fila) => ({
      capital: acc.capital + fila.capital,
      interes: acc.interes + fila.interes,
      abono: acc.abono + fila.abono,
      alicuota: acc.alicuota + fila.alicuota,
      escritura: acc.escritura + fila.escritura,
    }),
    { capital: 0, interes: 0, abono: 0, alicuota: 0, escritura: 0 }
  )

  const columnasAlicuotaEntrada = (() => {
    const conComponentes = entradas.find((fila) => fila.alicuotas?.length)
    if (conComponentes?.alicuotas) return conComponentes.alicuotas.map((c) => c.nombre)
    return entradas.length > 0 ? ["Alicuota"] : []
  })()

  function alicuotasDeFilaEntrada(fila: EntradaPago): number[] {
    return fila.alicuotas?.length
      ? fila.alicuotas.map((c) => c.valor)
      : [fila.alicuota_comunal]
  }

  const alicuotaTotalPorColumnaEntrada = columnasAlicuotaEntrada.map((_, indice) =>
    entradas.reduce((acc, fila) => acc + (alicuotasDeFilaEntrada(fila)[indice] ?? 0), 0)
  )

  const columnasAlicuotaCronograma = (() => {
    const conComponentes = cronograma.find((fila) => fila.alicuotas?.length)
    if (conComponentes?.alicuotas) return conComponentes.alicuotas.map((c) => c.nombre)
    return cronograma.length > 0 ? ["Alicuota"] : []
  })()

  function alicuotasDeFilaCronograma(fila: CuotaAmortizacion): number[] {
    return fila.alicuotas?.length ? fila.alicuotas.map((c) => c.valor) : [fila.alicuota]
  }

  const alicuotaTotalPorColumnaCronograma = columnasAlicuotaCronograma.map((_, indice) =>
    cronograma.reduce(
      (acc, fila) => acc + (alicuotasDeFilaCronograma(fila)[indice] ?? 0),
      0
    )
  )

  const saldoAFinanciar =
    totalesCronograma.capital || Number(cotizacion?.total_financ ?? 0)
  const descuentoTipo =
    Number(cotizacion?.discount) ||
    (cotizacion?.financ_type === "Contado"
      ? valorLoteNumero * 0.05
      : cotizacion?.financ_type === "Crédito BIESS"
        ? valorLoteNumero * 0.03
        : 0)
  const descuentoConDescuentoExtra =
    descuentoTipo + (Number(cotizacion?.extra_discount) || 0)

  const ingresado = (cotizacion?.status ?? "").trim().toLowerCase() === "ingresado"

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <div className="no-print border-border bg-card sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
          Volver
        </Button>
        {cotizacion && (
          <Button onClick={() => window.print()}>
            <Printer className="size-3.5" strokeWidth={1.8} />
            Imprimir
          </Button>
        )}
      </div>

      {cargando ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner />
        </div>
      ) : error || !cotizacion ? (
        <div className="p-8">
          <EmptyState
            title="No se puede abrir el reporte"
            description={error ?? "No se encontró la cotización."}
            dashed
          />
        </div>
      ) : (
        <div className="anexo-imprimible relative mx-auto my-6 w-full max-w-[860px] bg-white p-10 text-black">
          {!ingresado && (
            <>
              <div
                aria-hidden
                className="borrador-watermark pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
              >
                <span className="-rotate-[35deg] text-[48px] font-black tracking-widest text-red-600/20 select-none">
                  BORRADOR
                </span>
              </div>
              <div className="mb-5 rounded-md border-2 border-red-500 bg-red-50 p-3 text-center text-[11px] font-bold text-red-700">
                BORRADOR — esta cotización todavía no se guardó como ingresada.
              </div>
            </>
          )}
          <div className="mb-5 text-center">
            <div className="text-base font-bold">ANEXO</div>
            <div className="text-base font-bold">COTIZACIÓN</div>
          </div>

          <div className="mb-5 rounded-md border border-gray-400 p-3 text-[11px]">
            <div className="mb-2">
              <span className="font-bold">CLIENTE: </span>
              {cotizacion.cliente_nombre}
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              <Campo label="FECHA" valor={cotizacion.created_at?.slice(0, 10) ?? "—"} />
              <Campo
                label="TIPO DE FINANCIAMIENTO"
                valor={cotizacion.financ_type ?? "—"}
              />
              <Campo label="PROYECTO" valor={loteInfo?.proyecto?.nombre ?? "—"} />
              <Campo
                label="INMUEBLE"
                valor={loteInfo?.codigo ?? cotizacion.codigo_lote ?? "—"}
              />
              <Campo label="VALOR DEL LOTE" valor={formatearNumero(loteInfo?.pvp)} />
              <Campo label="MTS" valor={formatearNumero(loteInfo?.areaUtil)} />
              <Campo label="TOTAL A FINANCIAR" valor={formatearNumero(saldoAFinanciar)} />
              {descuentoConDescuentoExtra > 0 && (
                <Campo
                  label="DESCUENTO"
                  valor={formatearNumero(descuentoConDescuentoExtra)}
                />
              )}
              {Number(cotizacion.promo_discount) > 0 && (
                <Campo
                  label="DESCUENTO PROMOCIÓN"
                  valor={formatearNumero(cotizacion.promo_discount)}
                />
              )}
              <Campo label="OFRECIMIENTOS" valor={cotizacion.ofrecimientos || "—"} />
              {cotizacion.cliente_correo && (
                <Campo label="CORREO" valor={cotizacion.cliente_correo} />
              )}
              {cotizacion.cliente_telefono && (
                <Campo label="TELÉFONO" valor={cotizacion.cliente_telefono} />
              )}
            </div>
          </div>

          <table className="mb-2 w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <Th ancho="18%">Forma de Pago</Th>
                <Th ancho="14%">Fecha de Pago</Th>
                <Th ancho="14%">Abono Lote</Th>
                {columnasAlicuotaEntrada.map((nombre, indice) => (
                  <Th key={indice}>{nombre}</Th>
                ))}
                <Th ancho="14%">Escritura</Th>
                <Th ancho="14%">Total a Cancelar</Th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((fila, indice) => (
                <tr key={indice}>
                  <Td>
                    {(cotizacion.financ_type === "Contado" ||
                      cotizacion.financ_type === "Crédito BIESS") &&
                    fila.forma_pago === "Entrada"
                      ? "Cuota"
                      : fila.forma_pago || fila.concepto || "—"}
                  </Td>
                  <Td>{formatearFecha(fila.fecha_pago || fila.fecha)}</Td>
                  <Td alinear="right">
                    {formatearNumero(fila.abono_lote ?? fila.monto)}
                  </Td>
                  {alicuotasDeFilaEntrada(fila).map((valor, indiceComponente) => (
                    <Td key={indiceComponente} alinear="right">
                      {valor ? formatearNumero(valor) : "-"}
                    </Td>
                  ))}
                  <Td alinear="right">
                    {fila.escritura ? formatearNumero(fila.escritura) : "-"}
                  </Td>
                  <Td alinear="right">{formatearNumero(fila.total_cancelar)}</Td>
                </tr>
              ))}
              <tr className="font-bold">
                <Td colSpan={2} alinear="center">
                  Total
                </Td>
                <Td alinear="right">{formatearNumero(totalesEntrada.abono)}</Td>
                {alicuotaTotalPorColumnaEntrada.map((total, indice) => (
                  <Td key={indice} alinear="right">
                    {formatearNumero(total)}
                  </Td>
                ))}
                <Td alinear="right">{formatearNumero(totalesEntrada.escritura)}</Td>
                <Td alinear="right">{formatearNumero(totalesEntrada.total)}</Td>
              </tr>
            </tbody>
          </table>

          {cotizacion.financ_type !== "Contado" &&
            cotizacion.financ_type !== "Crédito BIESS" && (
              <>
                <div className="mb-4 text-[11px] font-bold">
                  Saldo a financiar: ${formatearNumero(saldoAFinanciar)}
                </div>

                <table className="amortizacion-tabla mb-4 w-full border-collapse text-[10.5px]">
                  <thead>
                    <tr>
                      <Th ancho="5%">Mes</Th>
                      <Th ancho="11%">Fecha de Pago</Th>
                      <Th ancho="10%">Capital</Th>
                      <Th ancho="10%">Interés</Th>
                      <Th ancho="10%">Abono Lote</Th>
                      {columnasAlicuotaCronograma.map((nombre, indice) => (
                        <Th key={indice}>{nombre}</Th>
                      ))}
                      <Th ancho="10%">Escritura</Th>
                      <Th ancho="12%">Cuota a Cancelar</Th>
                      <Th ancho="12%">Saldo Capital</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {cronograma.map((fila) => (
                      <tr key={fila.mes}>
                        <Td alinear="center">{fila.mes}</Td>
                        <Td alinear="center">{formatearFecha(fila.fecha)}</Td>
                        <Td alinear="center">{formatearNumero(fila.capital)}</Td>
                        <Td alinear="center">{formatearNumero(fila.interes)}</Td>
                        <Td alinear="center">{formatearNumero(fila.abono)}</Td>
                        {alicuotasDeFilaCronograma(fila).map(
                          (valor, indiceComponente) => (
                            <Td key={indiceComponente} alinear="center">
                              {valor ? formatearNumero(valor) : "-"}
                            </Td>
                          )
                        )}
                        <Td alinear="center">
                          {fila.escritura ? formatearNumero(fila.escritura) : "-"}
                        </Td>
                        <Td alinear="center" resaltar>
                          {formatearNumero(fila.cuota)}
                        </Td>
                        <Td alinear="center">{formatearNumero(fila.saldo)}</Td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <Td />
                      <Td />
                      <Td alinear="center">
                        {formatearNumero(totalesCronograma.capital)}
                      </Td>
                      <Td alinear="center">
                        {formatearNumero(totalesCronograma.interes)}
                      </Td>
                      <Td alinear="center">{formatearNumero(totalesCronograma.abono)}</Td>
                      {alicuotaTotalPorColumnaCronograma.map((total, indice) => (
                        <Td key={indice} alinear="center">
                          {formatearNumero(total)}
                        </Td>
                      ))}
                      <Td alinear="center">
                        {formatearNumero(totalesCronograma.escritura)}
                      </Td>
                      <Td />
                      <Td />
                    </tr>
                  </tbody>
                </table>
              </>
            )}

          {comentarios.length > 0 && (
            <div className="mb-10 text-[11px]">
              <div className="mb-1 font-bold">OBSERVACIONES</div>
              <div className="flex flex-col gap-1 pl-6">
                {comentarios.map((comentario, indice) => (
                  <div key={indice}>- {comentario}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .anexo-imprimible {
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
          text-transform: uppercase;
        }
        .borrador-watermark {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          color-adjust: exact;
        }
        .amortizacion-tabla thead {
          display: table-header-group;
        }
        .amortizacion-tabla tr {
          break-inside: avoid;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          @page {
            margin: 1.8cm 1.5cm;
          }
          .anexo-imprimible {
            margin: 0 !important;
            max-width: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <span className="font-bold">{label}: </span>
      {valor}
    </div>
  )
}

function Th({ children, ancho }: { children: React.ReactNode; ancho?: string }) {
  return (
    <th
      className="border border-black bg-[#d9d9d9] px-1.5 py-1 text-center text-[10.5px] font-bold"
      style={ancho ? { width: ancho } : undefined}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  colSpan,
  alinear = "left",
  resaltar,
}: {
  children?: React.ReactNode
  colSpan?: number
  alinear?: "left" | "right" | "center"
  resaltar?: boolean
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-black px-1.5 py-1 ${
        alinear === "right"
          ? "text-right"
          : alinear === "center"
            ? "text-center"
            : "text-left"
      }`}
      style={resaltar ? { backgroundColor: "#BDE9C4" } : undefined}
    >
      {children}
    </td>
  )
}
