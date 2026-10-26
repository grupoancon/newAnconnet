"use client"

import { useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { FilePlus2 } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LoteInventario } from "@/lib/api/inventario-api"
import {
  calcularFilaDetallada,
  ENTRADA_PORCENTAJE_REFERENCIA,
  formatearNumero,
  normalizarEstado,
  sectorDeLote,
  type FilaDetallada,
} from "./catalogo-helpers"

const OPCIONES_POR_PAGINA = [25, 50, 100]

type ItemTabla =
  | { tipo: "proyecto"; nombre: string }
  | { tipo: "sector"; nombre: string }
  | { tipo: "lote"; fila: FilaDetallada }

// Inserta encabezados de proyecto/sector en la página actual — se recalculan por
// página (no una sola vez sobre toda la lista) para que si una página empieza a mitad
// de un grupo, ese encabezado igual aparezca arriba de esa página.
function conEncabezados(filas: FilaDetallada[]): ItemTabla[] {
  const resultado: ItemTabla[] = []
  let proyectoAnterior: string | null = null
  let sectorAnterior: string | null = null
  for (const fila of filas) {
    const proyectoNombre = fila.lote.proyecto?.nombre || "Sin proyecto"
    const sector = sectorDeLote(fila.lote.codigo)
    if (proyectoNombre !== proyectoAnterior) {
      resultado.push({ tipo: "proyecto", nombre: proyectoNombre })
      proyectoAnterior = proyectoNombre
      sectorAnterior = null
    }
    if (sector !== sectorAnterior) {
      if (sector) resultado.push({ tipo: "sector", nombre: sector })
      sectorAnterior = sector
    }
    resultado.push({ tipo: "lote", fila })
  }
  return resultado
}

// Vista "Detallada": tabla de referencia rápida con precio, entrada y cuota estimada
// (Crédito directo 60 meses / Crédito BIESS 120 meses) por lote — pensada para que el
// asesor tenga una cifra de partida antes de armar el financiamiento real (que puede
// terminar siendo distinto: acá la entrada siempre es 20% fijo y BIESS se estima con la
// misma tasa de la empresa, mientras que en Financiamiento la entrada es libre y BIESS
// no arma cronograma con interés — ver comentario en catalogo-helpers.ts).
export function CatalogoDetalladaView({ lotes }: { lotes: LoteInventario[] }) {
  const router = useRouter()
  const [porPagina, setPorPagina] = useState(50)
  const [pagina, setPagina] = useState(1)

  // Agrupadas por proyecto y, dentro de cada proyecto, por sector (solo Perla Verde usa
  // sectores — el resto no tiene ninguno y esa sub-agrupación no aplica). Se excluyen
  // los reservados y los "hipotecado" (que agrupa Convenio, Vendido, Hipotecado y
  // Facturado — ver normalizarEstado): acá solo interesa lo que se puede ofrecer.
  const filas = useMemo(() => {
    const porProyecto = new Map<string, LoteInventario[]>()
    for (const lote of lotes) {
      const { variant } = normalizarEstado(lote)
      if (variant === "reservado" || variant === "hipotecado") continue
      const clave = lote.proyecto?.nombre || "Sin proyecto"
      const lista = porProyecto.get(clave) ?? []
      lista.push(lote)
      porProyecto.set(clave, lista)
    }
    const resultado: FilaDetallada[] = []
    for (const lotesProyecto of Array.from(porProyecto.values())) {
      const porSector = new Map<string, LoteInventario[]>()
      for (const lote of lotesProyecto) {
        const clave = sectorDeLote(lote.codigo) ?? ""
        const lista = porSector.get(clave) ?? []
        lista.push(lote)
        porSector.set(clave, lista)
      }
      for (const lotesSector of Array.from(porSector.values())) {
        for (const lote of lotesSector) {
          resultado.push(calcularFilaDetallada(lote))
        }
      }
    }
    return resultado
  }, [lotes])

  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * porPagina
  const filasPagina = filas.slice(inicio, inicio + porPagina)
  const items = useMemo(() => conEncabezados(filasPagina), [filasPagina])

  if (filas.length === 0) {
    return (
      <EmptyState
        title="No hay lotes con estos filtros"
        description="Probá cambiando el proyecto o la búsqueda."
      />
    )
  }

  return (
    <div>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr>
              <th
                rowSpan={3}
                className="border-border border bg-sky-100 px-3 py-2 text-xs font-extrabold text-sky-900"
              >
                Código
              </th>
              <th
                colSpan={2}
                className="border-border border bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-900"
              >
                Área
              </th>
              <th
                rowSpan={3}
                className="border-border border bg-emerald-100 px-3 py-2 text-xs font-extrabold text-emerald-900"
              >
                Precio
              </th>
              <th
                rowSpan={3}
                className="border-border border bg-teal-100 px-3 py-2 text-xs font-extrabold text-teal-900"
              >
                Entrada {Math.round(ENTRADA_PORCENTAJE_REFERENCIA * 100)}%
              </th>
              <th className="border-border border bg-violet-100 px-3 py-2 text-xs font-extrabold text-violet-900">
                Crédito BIESS
              </th>
              <th className="border-border border bg-violet-100 px-3 py-2 text-xs font-extrabold text-violet-900">
                Crédito Directo
              </th>
              <th
                rowSpan={3}
                className="border-border border bg-amber-100 px-3 py-2 text-xs font-extrabold text-amber-900"
              >
                Crear Oferta
              </th>
            </tr>
            <tr>
              <th
                rowSpan={2}
                className="border-border border bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-900"
              >
                Valor
              </th>
              <th
                rowSpan={2}
                className="border-border border bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-900"
              >
                Terreno
              </th>
              <th className="border-border border bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900">
                Plazo
              </th>
              <th className="border-border border bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900">
                Con Interés
              </th>
            </tr>
            <tr>
              <th className="border-border border bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900">
                120
              </th>
              <th className="border-border border bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900">
                60
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, indice) => {
              if (item.tipo === "proyecto") {
                return (
                  <tr key={`proyecto-${item.nombre}-${indice}`}>
                    <td
                      colSpan={8}
                      className="border-border border bg-emerald-700 px-3 py-2 text-sm font-extrabold text-white"
                    >
                      {item.nombre.toUpperCase()}
                    </td>
                  </tr>
                )
              }
              if (item.tipo === "sector") {
                return (
                  <tr key={`sector-${item.nombre}-${indice}`}>
                    <td
                      colSpan={8}
                      className="border-border border bg-emerald-100 px-3 py-1.5 text-center text-[12px] font-bold text-emerald-900"
                    >
                      {item.nombre}
                    </td>
                  </tr>
                )
              }

              const {
                lote,
                precio,
                entrada,
                cuotaBiess120,
                cuotaDirecto60,
                terreno,
                valorPorM2,
              } = item.fila
              const { variant } = normalizarEstado(lote)
              const disponible = variant === "disponible"

              return (
                <tr key={lote.id} className="odd:bg-emerald-50/40 even:bg-white">
                  <td className="border-border border px-3 py-2 font-mono text-[12.5px] font-bold">
                    {lote.codigo}
                  </td>
                  <td className="border-border border px-3 py-2 text-[12.5px]">
                    {formatearNumero(valorPorM2)}
                  </td>
                  <td className="border-border border px-3 py-2 text-[12.5px]">
                    {formatearNumero(terreno)}
                  </td>
                  <td className="border-border border bg-emerald-50 px-3 py-2 text-[12.5px] font-bold">
                    {formatearNumero(precio)}
                  </td>
                  <td className="border-border border px-3 py-2 text-[12.5px]">
                    {formatearNumero(entrada)}
                  </td>
                  <td className="border-border border px-3 py-2 text-[12.5px]">
                    {formatearNumero(cuotaBiess120)}
                  </td>
                  <td className="border-border border px-3 py-2 text-[12.5px]">
                    {formatearNumero(cuotaDirecto60)}
                  </td>
                  <td className="border-border border px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={!disponible}
                      title={
                        disponible
                          ? `Crear oferta para ${lote.codigo}`
                          : `${lote.codigo} no está disponible`
                      }
                      onClick={() =>
                        router.push(
                          `/ventas/nuevo-proceso?lote=${encodeURIComponent(lote.codigo)}`
                        )
                      }
                      className="bg-status-disponible inline-flex size-7 items-center justify-center rounded-md text-white transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <FilePlus2 className="size-4" strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="text-muted-foreground">Mostrar</span>
          <Select
            value={String(porPagina)}
            onValueChange={(valor) => {
              setPorPagina(Number(valor))
              setPagina(1)
            }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_POR_PAGINA.map((opcion) => (
                <SelectItem key={opcion} value={String(opcion)}>
                  {opcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">elementos por página</span>
        </div>

        <div className="flex items-center gap-3 text-[12.5px] font-semibold">
          <span className="text-muted-foreground">
            Página {paginaActual} de {totalPaginas} ({filas.length} items)
          </span>
          <button
            type="button"
            disabled={paginaActual <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="border-border hover:bg-muted flex size-7 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            className="border-border hover:bg-muted flex size-7 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
