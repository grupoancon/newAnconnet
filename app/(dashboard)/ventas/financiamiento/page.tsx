"use client"

import { ArrowLeft } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { SelectField, StaticField } from "@/components/shared/select-field"
import { TIPOS_FINANCIAMIENTO } from "@/components/shared/select-options"
import { Button } from "@/components/ui/button"

const RESUMEN_ENTRADAS = [
  {
    concepto: "Abono inicial",
    fecha: "02/07/2026",
    abono: "2,000.00",
    total: "2,000.00",
  },
  { concepto: "Entrada", fecha: "05/07/2026", abono: "1,350.58", total: "1,398.58" },
  { concepto: "Entrada", fecha: "05/08/2026", abono: "1,350.58", total: "1,398.58" },
]

const CRONOGRAMA = [
  {
    mes: 1,
    fecha: "05/10/2026",
    capital: "436.17",
    interes: "213.83",
    abono: "650.00",
    alicuota: "48.00",
    escritura: "0.00",
    cuota: "698.00",
    saldo: "23,770.84",
  },
  {
    mes: 2,
    fecha: "05/11/2026",
    capital: "440.02",
    interes: "209.98",
    abono: "650.00",
    alicuota: "48.00",
    escritura: "0.00",
    cuota: "698.00",
    saldo: "23,330.81",
  },
  {
    mes: 3,
    fecha: "05/12/2026",
    capital: "443.91",
    interes: "206.09",
    abono: "650.00",
    alicuota: "48.00",
    escritura: "0.00",
    cuota: "698.00",
    saldo: "22,886.90",
  },
  {
    mes: 4,
    fecha: "05/01/2027",
    capital: "447.83",
    interes: "202.17",
    abono: "650.00",
    alicuota: "48.00",
    escritura: "0.00",
    cuota: "698.00",
    saldo: "22,439.07",
  },
]

export default function TablaPagosPage() {
  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="border-border flex items-center gap-3.5 border-b px-7.5 py-5">
            <button
              type="button"
              className="border-border flex size-8 items-center justify-center rounded-md border"
              aria-label="Volver"
            >
              <ArrowLeft className="text-muted-foreground size-3.5" strokeWidth={1.8} />
            </button>
            <h1 className="text-xl font-extrabold tracking-tight">Tabla de pagos</h1>
          </div>

          <div className="flex flex-col gap-5.5 px-7.5 py-6.5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1.8fr_1fr]">
              <StaticField label="CLIENTE" value="Paucar Loya Genny Marlene" emphasis />
              <StaticField label="FECHA" value="02/07/2026" mono />
            </div>
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              <StaticField label="PROYECTO" value="Puerto Quito Garden" />
              <StaticField label="INMUEBLE" value="G-M1-02" mono emphasis />
              <StaticField label="VALOR DEL LOTE" value="$30,258.76" mono />
              <StaticField label="MTS. LOTE" value="636.06" mono />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.6fr]">
              <div className="border-border flex flex-col gap-3.5 rounded-lg border p-5">
                <div className="text-muted-foreground text-xs font-bold tracking-wide">
                  CONFIGURACIÓN DE FINANCIAMIENTO
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Tipo financiamiento"
                    placeholder="Crédito directo"
                    options={TIPOS_FINANCIAMIENTO}
                    defaultValue="Crédito directo"
                  />
                  <StaticField label="Descuento" value="0" mono />
                  <StaticField label="Entrada" value="6,051.75" mono />
                  <StaticField
                    label="Total a financiar"
                    value="24,207.01"
                    mono
                    emphasis
                  />
                  <StaticField label="N.º de meses" value="48" mono />
                  <StaticField label="Cuota a aplicar" value="650" mono />
                </div>
                <div className="mt-1 flex gap-2.5">
                  <Button size="sm" className="flex-1">
                    + Crear tabla personalizada
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Generar tabla
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="bg-status-disponible-bg text-status-disponible-fg border-none shadow-none hover:brightness-95"
                >
                  Guardar financiamiento
                </Button>
              </div>

              <div className="border-border overflow-hidden rounded-lg border">
                <div className="border-border text-muted-foreground border-b px-4.5 py-3.5 text-xs font-bold tracking-wide">
                  RESUMEN DE ENTRADAS
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                      <th className="px-4.5 py-2.5 text-left">FORMA DE PAGO</th>
                      <th className="px-4.5 py-2.5 text-left">FECHA</th>
                      <th className="px-4.5 py-2.5 text-right">ABONO LOTE</th>
                      <th className="px-4.5 py-2.5 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESUMEN_ENTRADAS.map((fila) => (
                      <tr
                        key={fila.concepto + fila.fecha}
                        className="border-border border-b"
                      >
                        <td className="px-4.5 py-2.75 font-semibold">{fila.concepto}</td>
                        <td className="text-muted-foreground px-4.5 py-2.75 font-mono text-xs">
                          {fila.fecha}
                        </td>
                        <td className="px-4.5 py-2.75 text-right font-mono">
                          {fila.abono}
                        </td>
                        <td className="px-4.5 py-2.75 text-right font-mono font-bold">
                          {fila.total}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/60">
                      <td className="px-4.5 py-2.75 font-extrabold">Total</td>
                      <td />
                      <td className="px-4.5 py-2.75 text-right font-mono font-extrabold">
                        6,051.75
                      </td>
                      <td className="text-accent-foreground px-4.5 py-2.75 text-right font-mono font-extrabold">
                        6,195.75
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-border overflow-hidden rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                    <th className="px-4.5 py-2.75 text-left">MES</th>
                    <th className="px-4.5 py-2.75 text-left">FECHA</th>
                    <th className="px-4.5 py-2.75 text-left">CAPITAL</th>
                    <th className="px-4.5 py-2.75 text-left">INTERÉS</th>
                    <th className="px-4.5 py-2.75 text-left">ABONO LOTE</th>
                    <th className="px-4.5 py-2.75 text-left">ALÍCUOTA</th>
                    <th className="px-4.5 py-2.75 text-left">ESCRIT.</th>
                    <th className="px-4.5 py-2.75 text-left">CUOTA</th>
                    <th className="px-4.5 py-2.75 text-left">SALDO</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[12.5px]">
                  {CRONOGRAMA.map((fila, index) => (
                    <tr
                      key={fila.mes}
                      className={
                        index < CRONOGRAMA.length - 1
                          ? "border-border border-b"
                          : undefined
                      }
                    >
                      <td className="px-4.5 py-2.75 font-bold">{fila.mes}</td>
                      <td className="text-muted-foreground px-4.5 py-2.75">
                        {fila.fecha}
                      </td>
                      <td className="px-4.5 py-2.75">{fila.capital}</td>
                      <td className="px-4.5 py-2.75">{fila.interes}</td>
                      <td className="px-4.5 py-2.75">{fila.abono}</td>
                      <td className="px-4.5 py-2.75">{fila.alicuota}</td>
                      <td className="px-4.5 py-2.75">{fila.escritura}</td>
                      <td className="px-4.5 py-2.75 font-bold">{fila.cuota}</td>
                      <td className="px-4.5 py-2.75">{fila.saldo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
