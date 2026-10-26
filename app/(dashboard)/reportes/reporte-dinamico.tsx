"use client"

import { useEffect, useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import {
  ReportesApiError,
  obtenerDatosReporte,
  type BloqueResultado,
  type FormatoValor,
} from "@/lib/api/reportes-api"

function aniosDisponibles(): string[] {
  const actual = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => String(actual - i))
}

export function formatearValor(valor: number, formato: FormatoValor): string {
  if (formato === "moneda") {
    return new Intl.NumberFormat("es-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(valor)
  }
  return valor.toLocaleString("es-EC")
}

function Barras({ bloque }: { bloque: BloqueResultado }) {
  const maximo = Math.max(1, ...bloque.filas.map((f) => f.valor))
  return (
    <ul className="flex flex-col gap-2">
      {bloque.filas.map((fila) => (
        <li key={fila.etiqueta} className="flex items-center gap-3">
          <div className="bg-muted relative h-9 flex-1 overflow-hidden rounded-md">
            <div
              className="bg-accent absolute inset-y-0 left-0 rounded-md"
              style={{ width: `${Math.max(2, (fila.valor / maximo) * 100)}%` }}
            />
            <span className="relative flex h-full items-center px-3 text-[13px] font-semibold uppercase">
              {fila.etiqueta}
            </span>
          </div>
          <span className="w-24 text-right font-mono text-[13px] font-semibold">
            {formatearValor(fila.valor, bloque.formato)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Tabla({ bloque }: { bloque: BloqueResultado }) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead className="text-muted-foreground border-border border-b text-[11px]">
        <tr>
          <th className="py-2 font-bold">DETALLE</th>
          <th className="py-2 text-right font-bold">VALOR</th>
        </tr>
      </thead>
      <tbody>
        {bloque.filas.map((fila) => (
          <tr key={fila.etiqueta} className="border-border border-b last:border-b-0">
            <td className="py-2.5 font-semibold">{fila.etiqueta}</td>
            <td className="py-2.5 text-right font-mono">
              {formatearValor(fila.valor, bloque.formato)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-border border-t">
          <td className="py-2.5 font-bold">Total</td>
          <td className="py-2.5 text-right font-mono font-bold">
            {formatearValor(bloque.total, bloque.formato)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

function Bloque({ bloque }: { bloque: BloqueResultado }) {
  return (
    <section className="bg-card border-border rounded-lg border p-5">
      <h3 className="text-lg font-bold tracking-tight">{bloque.titulo}</h3>

      {bloque.visualizacion === "kpi" ? (
        <p className="mt-3 font-mono text-4xl font-extrabold">
          {formatearValor(bloque.total, bloque.formato)}
        </p>
      ) : (
        <>
          <p className="mt-1 font-mono text-2xl font-extrabold">
            {formatearValor(bloque.total, bloque.formato)}
          </p>
          <div className="mt-4">
            {bloque.filas.length === 0 ? (
              <EmptyState
                dashed={false}
                title="Sin datos"
                description="No hay datos para este año."
              />
            ) : bloque.visualizacion === "tabla" ? (
              <Tabla bloque={bloque} />
            ) : (
              <Barras bloque={bloque} />
            )}
          </div>
        </>
      )}
    </section>
  )
}

// Reporte creado desde el constructor: pide los datos de todos sus bloques al abrirse
// y al cambiar de año. El backend valida `reportes:<slug>` en cada petición.
export function ReporteDinamico({ slug }: { slug: string }) {
  const anios = useMemo(aniosDisponibles, [])
  const [anio, setAnio] = useState(anios[0]!)
  const [bloques, setBloques] = useState<BloqueResultado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    obtenerDatosReporte(slug, Number(anio))
      .then((respuesta) => {
        if (!cancelado) setBloques(respuesta.bloques)
      })
      .catch((err) => {
        if (cancelado) return
        setBloques([])
        setError(
          err instanceof ReportesApiError ? err.message : "No se pudo cargar el reporte."
        )
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [slug, anio])

  return (
    <div className="h-full overflow-y-auto p-6.5">
      <div className="mb-4.5 max-w-60">
        <SelectField
          label="AÑO"
          placeholder={anio}
          options={anios}
          value={anio}
          onValueChange={setAnio}
        />
      </div>

      {cargando ? (
        <div className="flex justify-center py-17.5">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState
          dashed={false}
          title="No se pudo cargar el reporte"
          description={error}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bloques.map((bloque) => (
            <Bloque key={bloque.id} bloque={bloque} />
          ))}
        </div>
      )}
    </div>
  )
}
