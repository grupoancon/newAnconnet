"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Pencil, Printer } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { StaticField } from "@/components/shared/select-field"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
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
import { cn } from "@/lib/utils"

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

function formatearMetraje(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return `${new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 }).format(numero)} m²`
}

// Sin aprobación (a diferencia de Financiamiento/Refinanciamiento): "ingresado" ya es
// el estado final — habilita Imprimir directo, sin que nadie más tenga que revisarlo.
function normalizarEstado(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "ingresado") return "ingresado"
  return "pendiente"
}

export function CotizacionReporteContent({ id }: { id: string }) {
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

  const estado = normalizarEstado(cotizacion?.status)

  const valorLote = loteInfo?.pvp ?? null
  const valorLoteNumero =
    typeof valorLote === "string" ? parseFloat(valorLote) : (valorLote ?? 0)
  // "Contado"/"Crédito BIESS" siempre llevan un descuento fijo (5%/3%, misma regla que
  // new/[id]) — si el registro quedó guardado sin el campo "discount", se recalcula
  // igual para mostrarlo.
  const descuentoTipo =
    Number(cotizacion?.discount) ||
    (cotizacion?.financ_type === "Contado"
      ? valorLoteNumero * 0.05
      : cotizacion?.financ_type === "Crédito BIESS"
        ? valorLoteNumero * 0.03
        : 0)
  const descuentoConDescuentoExtra =
    descuentoTipo + (Number(cotizacion?.extra_discount) || 0)

  const entradas = cotizacion?.entradas ?? []
  const cronograma = cotizacion?.detalle ?? []
  const comentarios = (cotizacion?.comentarios ?? []).filter(
    (c) => c && c.trim().length > 0
  )

  const totalesEntrada = useMemo(
    () =>
      entradas.reduce(
        (acc, fila) => ({
          abono: acc.abono + (Number(fila.abono_lote) || 0),
          alicuota: acc.alicuota + (Number(fila.alicuota_comunal) || 0),
          escritura: acc.escritura + (Number(fila.escritura) || 0),
          total: acc.total + (Number(fila.total_cancelar) || 0),
        }),
        { abono: 0, alicuota: 0, escritura: 0, total: 0 }
      ),
    [entradas]
  )

  const totalesCronograma = useMemo(
    () =>
      cronograma.reduce(
        (acc, fila) => ({
          capital: acc.capital + fila.capital,
          interes: acc.interes + fila.interes,
          abono: acc.abono + fila.abono,
          alicuota: acc.alicuota + fila.alicuota,
          escritura: acc.escritura + fila.escritura,
        }),
        { capital: 0, interes: 0, abono: 0, alicuota: 0, escritura: 0 }
      ),
    [cronograma]
  )

  const columnasAlicuotaEntrada = useMemo(() => {
    const conComponentes = entradas.find((fila) => fila.alicuotas?.length)
    if (conComponentes?.alicuotas) return conComponentes.alicuotas.map((c) => c.nombre)
    return entradas.length > 0 ? ["Alícuota"] : []
  }, [entradas])

  function alicuotasDeFilaEntrada(fila: EntradaPago): number[] {
    return fila.alicuotas?.length
      ? fila.alicuotas.map((c) => c.valor)
      : [fila.alicuota_comunal]
  }

  const alicuotaTotalPorColumnaEntrada = useMemo(
    () =>
      columnasAlicuotaEntrada.map((_, indice) =>
        entradas.reduce(
          (acc, fila) => acc + (alicuotasDeFilaEntrada(fila)[indice] ?? 0),
          0
        )
      ),
    [entradas, columnasAlicuotaEntrada]
  )

  const columnasAlicuotaCronograma = useMemo(() => {
    const conComponentes = cronograma.find((fila) => fila.alicuotas?.length)
    if (conComponentes?.alicuotas) return conComponentes.alicuotas.map((c) => c.nombre)
    return cronograma.length > 0 ? ["Alícuota"] : []
  }, [cronograma])

  function alicuotasDeFilaCronograma(fila: CuotaAmortizacion): number[] {
    return fila.alicuotas?.length ? fila.alicuotas.map((c) => c.valor) : [fila.alicuota]
  }

  const alicuotaTotalPorColumnaCronograma = useMemo(
    () =>
      columnasAlicuotaCronograma.map((_, indice) =>
        cronograma.reduce(
          (acc, fila) => acc + (alicuotasDeFilaCronograma(fila)[indice] ?? 0),
          0
        )
      ),
    [cronograma, columnasAlicuotaCronograma]
  )

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="reporte-financiamiento bg-card border-border overflow-hidden rounded-lg border">
          <div className="no-print bg-brand-gradient-banner relative flex items-center justify-between gap-4 overflow-hidden px-8.5 py-6.5">
            <div className="absolute -top-15 -right-10 size-55 rounded-full bg-white/9" />
            <div className="relative">
              <h1 className="text-[23px] font-extrabold text-white">Cotización</h1>
              <p className="text-sm text-white/90">
                Tabla de entrada y cronograma de amortización
              </p>
            </div>
            {cotizacion && (
              <div className="relative">
                <StatusBadge variant={estado} />
              </div>
            )}
          </div>

          <div className="px-8.5 pt-8 pb-7.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !cotizacion ? (
              <EmptyState
                title="No se puede abrir el reporte"
                description={error ?? "No se encontró la cotización."}
                dashed
              />
            ) : (
              <>
                <div className="print-only mb-5 hidden text-center">
                  <div className="text-lg font-extrabold">COTIZACIÓN</div>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StaticField
                    label="Cliente"
                    value={cotizacion.cliente_nombre}
                    emphasis
                  />
                  <StaticField
                    label="Fecha"
                    value={formatearFecha(cotizacion.init_date ?? cotizacion.created_at)}
                    mono
                  />
                </div>
                <div className="mb-7.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <StaticField
                    label="Tipo de financiamiento"
                    value={cotizacion.financ_type ?? "—"}
                  />
                  <StaticField
                    label="Proyecto"
                    value={loteInfo?.proyecto?.nombre ?? "—"}
                  />
                  <StaticField
                    label="Inmueble"
                    value={loteInfo?.codigo ?? cotizacion.codigo_lote ?? "—"}
                    mono
                    emphasis
                  />
                  <StaticField
                    label="Valor del lote"
                    value={formatearMoneda(loteInfo?.pvp)}
                    mono
                  />
                  <StaticField
                    label="Mts"
                    value={formatearMetraje(loteInfo?.areaUtil)}
                    mono
                  />
                  {descuentoConDescuentoExtra > 0 && (
                    <StaticField
                      label="Descuento"
                      value={formatearMoneda(descuentoConDescuentoExtra)}
                      mono
                    />
                  )}
                  {Number(cotizacion.promo_discount) > 0 && (
                    <StaticField
                      label="Descuento promoción"
                      value={formatearMoneda(cotizacion.promo_discount)}
                      mono
                    />
                  )}
                </div>
                {cotizacion.ofrecimientos && (
                  <div className="mb-7.5">
                    <StaticField label="Ofrecimientos" value={cotizacion.ofrecimientos} />
                  </div>
                )}

                <SeccionTitulo texto="Forma de pago" />
                <div className="border-border mb-2.5 overflow-hidden rounded-lg border">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                          <th className="px-4.5 py-2.5 text-left">Forma de pago</th>
                          <th className="px-4.5 py-2.5 text-left">Fecha de pago</th>
                          <th className="px-4.5 py-2.5 text-right">Abono lote</th>
                          {columnasAlicuotaEntrada.map((nombre, indice) => (
                            <th key={indice} className="px-4.5 py-2.5 text-right">
                              {nombre}
                            </th>
                          ))}
                          <th className="px-4.5 py-2.5 text-right">Escritura</th>
                          <th className="px-4.5 py-2.5 text-right">Total a cancelar</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-[12.5px]">
                        {entradas.map((fila, indice) => (
                          <tr
                            key={indice}
                            className={
                              indice < entradas.length - 1
                                ? "border-border border-b"
                                : undefined
                            }
                          >
                            <td className="px-4.5 py-1.75 font-sans">
                              {(cotizacion.financ_type === "Contado" ||
                                cotizacion.financ_type === "Crédito BIESS") &&
                              fila.forma_pago === "Entrada"
                                ? "Cuota"
                                : fila.forma_pago || fila.concepto || "—"}
                            </td>
                            <td className="text-muted-foreground px-4.5 py-1.75">
                              {formatearFecha(fila.fecha_pago || fila.fecha)}
                            </td>
                            <td className="px-4.5 py-1.75 text-right">
                              {formatearMoneda(fila.abono_lote ?? fila.monto)}
                            </td>
                            {alicuotasDeFilaEntrada(fila).map(
                              (valor, indiceComponente) => (
                                <td
                                  key={indiceComponente}
                                  className="text-muted-foreground px-4.5 py-1.75 text-right"
                                >
                                  {valor ? formatearMoneda(valor) : "—"}
                                </td>
                              )
                            )}
                            <td className="text-muted-foreground px-4.5 py-1.75 text-right">
                              {fila.escritura ? formatearMoneda(fila.escritura) : "—"}
                            </td>
                            <td className="px-4.5 py-1.75 text-right font-bold">
                              {formatearMoneda(fila.total_cancelar)}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/60">
                          <td
                            className="px-4.5 py-2.5 font-sans font-extrabold"
                            colSpan={2}
                          >
                            Total
                          </td>
                          <td className="px-4.5 py-2.5 text-right font-extrabold">
                            {formatearMoneda(totalesEntrada.abono)}
                          </td>
                          {alicuotaTotalPorColumnaEntrada.map((total, indice) => (
                            <td
                              key={indice}
                              className="px-4.5 py-2.5 text-right font-extrabold"
                            >
                              {formatearMoneda(total)}
                            </td>
                          ))}
                          <td className="px-4.5 py-2.5 text-right font-extrabold">
                            {formatearMoneda(totalesEntrada.escritura)}
                          </td>
                          <td className="text-accent-foreground px-4.5 py-2.5 text-right font-extrabold">
                            {formatearMoneda(totalesEntrada.total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-foreground text-background mb-7.5 flex items-center justify-between rounded-lg px-4.5 py-3.5">
                  <div className="text-background/60 text-xs font-bold tracking-wide">
                    SALDO A FINANCIAR
                  </div>
                  <div className="font-mono text-lg font-extrabold">
                    {formatearMoneda(
                      totalesCronograma.capital || cotizacion.total_financ
                    )}
                  </div>
                </div>

                {cotizacion.financ_type !== "Contado" &&
                  cotizacion.financ_type !== "Crédito BIESS" && (
                    <>
                      <SeccionTitulo texto="Cronograma de amortización" />
                      <div className="border-border mb-7.5 overflow-hidden rounded-lg border">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                                <th className="px-4.5 py-2.75 text-left">Mes</th>
                                <th className="px-4.5 py-2.75 text-left">
                                  Fecha de pago
                                </th>
                                <th className="px-4.5 py-2.75 text-right">Capital</th>
                                <th className="px-4.5 py-2.75 text-right">Interés</th>
                                <th className="px-4.5 py-2.75 text-right">Abono lote</th>
                                {columnasAlicuotaCronograma.map((nombre, indice) => (
                                  <th key={indice} className="px-4.5 py-2.75 text-right">
                                    {nombre}
                                  </th>
                                ))}
                                <th className="px-4.5 py-2.75 text-right">Escritura</th>
                                <th className="px-4.5 py-2.75 text-right">
                                  Cuota a cancelar
                                </th>
                                <th className="px-4.5 py-2.75 text-right">
                                  Saldo capital
                                </th>
                              </tr>
                            </thead>
                            <tbody className="font-mono text-[12.5px]">
                              {cronograma.map((fila, index) => (
                                <tr
                                  key={fila.mes}
                                  className={cn(
                                    index < cronograma.length - 1 &&
                                      "border-border border-b",
                                    fila.sobrante && "bg-destructive/10 text-destructive"
                                  )}
                                >
                                  <td className="px-4.5 py-1.5 font-bold">{fila.mes}</td>
                                  <td className="text-muted-foreground px-4.5 py-1.5">
                                    {formatearFecha(fila.fecha)}
                                  </td>
                                  <td className="px-4.5 py-1.5 text-right">
                                    {formatearMoneda(fila.capital)}
                                  </td>
                                  <td className="text-muted-foreground px-4.5 py-1.5 text-right">
                                    {formatearMoneda(fila.interes)}
                                  </td>
                                  <td className="px-4.5 py-1.5 text-right">
                                    {formatearMoneda(fila.abono)}
                                  </td>
                                  {alicuotasDeFilaCronograma(fila).map(
                                    (valor, indiceComponente) => (
                                      <td
                                        key={indiceComponente}
                                        className="text-muted-foreground px-4.5 py-1.5 text-right"
                                      >
                                        {valor ? formatearMoneda(valor) : "—"}
                                      </td>
                                    )
                                  )}
                                  <td className="text-muted-foreground px-4.5 py-1.5 text-right">
                                    {fila.escritura
                                      ? formatearMoneda(fila.escritura)
                                      : "—"}
                                  </td>
                                  <td className="px-4.5 py-1.5 text-right">
                                    <span className="bg-status-disponible-bg text-status-disponible-fg inline-flex rounded-md px-2 py-0.5 font-bold">
                                      {formatearMoneda(fila.cuota)}
                                    </span>
                                  </td>
                                  <td className="px-4.5 py-1.5 text-right">
                                    {formatearMoneda(fila.saldo)}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-muted/60">
                                <td className="px-4.5 py-2.75 font-extrabold" colSpan={2}>
                                  Total
                                </td>
                                <td className="px-4.5 py-2.75 text-right font-extrabold">
                                  {formatearMoneda(totalesCronograma.capital)}
                                </td>
                                <td className="px-4.5 py-2.75 text-right font-extrabold">
                                  {formatearMoneda(totalesCronograma.interes)}
                                </td>
                                <td className="px-4.5 py-2.75 text-right font-extrabold">
                                  {formatearMoneda(totalesCronograma.abono)}
                                </td>
                                {alicuotaTotalPorColumnaCronograma.map(
                                  (total, indice) => (
                                    <td
                                      key={indice}
                                      className="px-4.5 py-2.75 text-right font-extrabold"
                                    >
                                      {formatearMoneda(total)}
                                    </td>
                                  )
                                )}
                                <td className="px-4.5 py-2.75 text-right font-extrabold">
                                  {formatearMoneda(totalesCronograma.escritura)}
                                </td>
                                <td colSpan={2} />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                {comentarios.length > 0 && (
                  <>
                    <SeccionTitulo texto="Observaciones" />
                    <ol className="border-border mb-7.5 flex list-decimal flex-col gap-1.5 rounded-lg border p-4.5 pl-8.5 text-sm">
                      {comentarios.map((comentario, indice) => (
                        <li key={indice}>{comentario}</li>
                      ))}
                    </ol>
                  </>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4.5">
                  <div className="border-border rounded-md border p-4">
                    <div className="text-muted-foreground text-xs font-semibold">
                      Cliente
                    </div>
                    <div className="text-sm font-bold">{cotizacion.cliente_nombre}</div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {cotizacion.cliente_correo ?? "Sin correo"}
                    </div>
                  </div>
                  <div className="border-border rounded-md border p-4">
                    <div className="text-muted-foreground text-xs font-semibold">
                      Contacto
                    </div>
                    <div className="text-sm font-bold">
                      {cotizacion.cliente_telefono ?? "—"}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">Teléfono</div>
                  </div>
                </div>

                <div className="no-print border-border mt-6 flex flex-col-reverse gap-3 border-t pt-5 sm:mt-7.5 sm:flex-row sm:items-center sm:justify-between sm:pt-5.5">
                  <div className="flex gap-3 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <Button variant="outline" onClick={() => router.back()}>
                      <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                      Volver
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/gestion/cotizaciones/new/${idNumero}`)}
                    >
                      <Pencil className="size-3.5" strokeWidth={1.8} />
                      Editar cotización
                    </Button>
                  </div>
                  <div className="flex gap-3 [&>button]:flex-1 sm:[&>button]:flex-none">
                    {estado === "ingresado" && (
                      <Button
                        onClick={() =>
                          router.push(
                            `/gestion/cotizaciones/reporte/${idNumero}/imprimir`
                          )
                        }
                      >
                        <Printer className="size-3.5" strokeWidth={1.8} />
                        Imprimir
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .print-only {
          display: none;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
          }
          .reporte-financiamiento {
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

function SeccionTitulo({ texto }: { texto: string }) {
  return (
    <div className="border-border mb-3 border-b pb-2 text-[15px] font-extrabold">
      {texto}
    </div>
  )
}
