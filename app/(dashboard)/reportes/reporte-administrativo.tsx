"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import {
  ReportesApiError,
  obtenerVentasPorProyecto,
  type VentasPorProyecto,
} from "@/lib/api/reportes-api"

// Últimos 5 años, del actual hacia atrás.
function aniosDisponibles(): string[] {
  const actual = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => String(actual - i))
}

type Barra = { nombre: string; valor: number }

// Lista de barras horizontales: el ancho es proporcional al mayor valor.
function BarList({ datos }: { datos: Barra[] }) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <ul className="flex flex-col gap-2">
      {datos.map((dato) => (
        <li key={dato.nombre} className="flex items-center gap-3">
          <div className="bg-muted relative h-9 flex-1 overflow-hidden rounded-md">
            <div
              className="bg-accent absolute inset-y-0 left-0 rounded-md"
              style={{ width: `${Math.max(2, (dato.valor / maximo) * 100)}%` }}
            />
            <span className="relative flex h-full items-center px-3 text-[13px] font-semibold uppercase">
              {dato.nombre}
            </span>
          </div>
          <span className="w-12 text-right font-mono text-[13px] font-semibold">
            {dato.valor}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Tarjeta({
  titulo,
  insignia,
  total,
  children,
}: {
  titulo: string
  insignia?: string
  total?: number
  children: React.ReactNode
}) {
  return (
    <section className="bg-card border-border rounded-lg border p-5">
      <div className="flex items-center gap-2.5">
        <h3 className="text-lg font-bold tracking-tight">{titulo}</h3>
        {insignia && (
          <span className="bg-status-disponible-bg text-status-disponible-fg border-status-disponible-border rounded-md border px-1.5 py-0.5 text-[11px] font-semibold">
            {insignia}
          </span>
        )}
      </div>
      {total !== undefined && (
        <p className="mt-1 font-mono text-2xl font-extrabold">{total}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function ReporteAdministrativo() {
  const anios = useMemo(aniosDisponibles, [])
  const [anio, setAnio] = useState(anios[0]!)
  const [datos, setDatos] = useState<VentasPorProyecto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Se pide al abrir el reporte y cada vez que cambia el año. El backend ya devuelve
  // agrupado y ordenado: con el permiso reportes:administrativo basta para verlo.
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    obtenerVentasPorProyecto(Number(anio))
      .then((respuesta) => {
        if (!cancelado) setDatos(respuesta)
      })
      .catch((err) => {
        if (cancelado) return
        setDatos(null)
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
  }, [anio])

  const barras: Barra[] = useMemo(
    () => (datos?.proyectos ?? []).map((p) => ({ nombre: p.nombre, valor: p.ventas })),
    [datos]
  )

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Tarjeta
          titulo={`Ventas por proyecto • ${anio}`}
          total={cargando || error ? undefined : (datos?.total ?? 0)}
        >
          <div className="text-muted-foreground mb-2 flex justify-between text-[13px]">
            <span>Proyecto</span>
            <span>Ventas</span>
          </div>
          {cargando ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : error ? (
            <EmptyState dashed={false} title="No se pudo cargar" description={error} />
          ) : barras.length === 0 ? (
            <EmptyState
              dashed={false}
              title="Sin ventas"
              description={`No hay ventas completadas en ${anio}.`}
            />
          ) : (
            <BarList datos={barras} />
          )}
        </Tarjeta>

        <Tarjeta titulo={`Total retiros • ${anio}`} insignia="beta">
          <EmptyState
            dashed={false}
            icon={
              <Clock className="text-muted-foreground size-[19px]" strokeWidth={1.7} />
            }
            title="Retiros aún no disponible"
            description="El módulo de retiros todavía no está en la nueva intranet; este bloque mostrará el conteo por proyecto cuando exista."
          />
        </Tarjeta>
      </div>
    </div>
  )
}
