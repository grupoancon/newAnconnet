"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { Tendencias } from "./datos"

// Gráficos hechos con HTML, igual que SalesBarChart (el proyecto no usa librería de
// gráficos). Colores: --chart-error / --chart-warn (globals.css), par validado para
// daltonismo y para ambos temas. La identidad nunca va solo por color: leyenda con
// totales, tooltip por columna y la tabla de errores debajo.

export function LeyendaErrores({
  errores,
  advertencias,
}: {
  errores: number
  advertencias: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-chart-error size-2.5 rounded-[3px]" aria-hidden />
        <span className="text-muted-foreground">Errores</span>
        <span className="font-semibold">{errores}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-chart-warn size-2.5 rounded-[3px]" aria-hidden />
        <span className="text-muted-foreground">Advertencias</span>
        <span className="font-semibold">{advertencias}</span>
      </span>
    </div>
  )
}

// Barras apiladas por hora (24h) o por día (7d): errores abajo, advertencias encima,
// con 2px de separación entre segmentos.
export function GraficoTendencia({ tendencias }: { tendencias: Tendencias }) {
  const { series, granularity } = tendencias
  const maximo = Math.max(1, ...series.map((p) => p.errores + p.advertencias))
  // En 24h no caben 24 etiquetas: se muestra una cada 6 horas.
  const mostrarEtiqueta = (i: number) =>
    granularity === "day" || i % 6 === 0 || i === series.length - 1

  return (
    <div>
      <div className="relative h-48">
        {/* Línea de referencia del máximo, recesiva. */}
        <div className="border-border absolute inset-x-0 top-0 border-t border-dashed" />
        <span className="text-muted-foreground bg-card absolute top-0 right-0 -translate-y-1/2 pl-1.5 text-[10.5px]">
          {maximo}
        </span>
        <div className="border-border absolute inset-x-0 bottom-0 border-t" />

        <div
          className={cn(
            "relative flex h-full items-end",
            granularity === "day" ? "gap-3" : "gap-[3px]"
          )}
        >
          {series.map((punto) => {
            const total = punto.errores + punto.advertencias
            return (
              <Tooltip key={punto.t}>
                <TooltipTrigger asChild>
                  {/* Área de hover = toda la columna, más grande que la barra. */}
                  <div className="group flex h-full flex-1 cursor-default flex-col justify-end">
                    <div
                      className="flex flex-col justify-end gap-[2px] transition-opacity group-hover:opacity-80"
                      style={{ height: `${(total / maximo) * 100}%` }}
                    >
                      {punto.advertencias > 0 ? (
                        <div
                          className="bg-chart-warn min-h-[2px] rounded-t-[4px]"
                          style={{ flexGrow: punto.advertencias }}
                        />
                      ) : null}
                      {punto.errores > 0 ? (
                        <div
                          className={cn(
                            "bg-chart-error min-h-[2px]",
                            punto.advertencias === 0 && "rounded-t-[4px]"
                          )}
                          style={{ flexGrow: punto.errores }}
                        />
                      ) : null}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold">{punto.t}</p>
                    <p>Errores: {punto.errores}</p>
                    <p>Advertencias: {punto.advertencias}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>

      <div
        className={cn("mt-1.5 flex", granularity === "day" ? "gap-3" : "gap-[3px]")}
        aria-hidden
      >
        {series.map((punto, i) => (
          <span
            key={punto.t}
            className="text-muted-foreground flex-1 text-center text-[10.5px]"
          >
            {mostrarEtiqueta(i) ? punto.t : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

// Ranking horizontal de una sola serie (magnitud): un solo color, valor y porcentaje
// escritos en texto, no en el color.
export function ListaBarras({
  datos,
  vacio = "Sin datos",
}: {
  datos: { name: string; value: number }[]
  vacio?: string
}) {
  if (datos.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-xs">{vacio}</p>
  }
  const maximo = Math.max(1, ...datos.map((d) => d.value))
  const total = datos.reduce((acc, d) => acc + d.value, 0)

  return (
    <ul className="space-y-2.5">
      {datos.map((dato) => (
        <li key={dato.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate">{dato.name}</span>
            <span className="shrink-0">
              <span className="font-semibold">{dato.value}</span>
              <span className="text-muted-foreground ml-1">
                ({Math.round((dato.value / Math.max(1, total)) * 100)}%)
              </span>
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-chart-error h-full rounded-full"
              style={{ width: `${(dato.value / maximo) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
