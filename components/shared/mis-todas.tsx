"use client"

import { FilterSearchInput } from "@/components/shared/filter-bar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type VistaMisTodas = "mias" | "todas"

// Minúsculas y sin tildes, para buscar sin importar cómo se escribió.
export function normalizarTexto(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

// Filtra la lista por el texto buscado en los campos que devuelve `campos`.
export function filtrarPorTexto<T>(
  lista: readonly T[] | null | undefined,
  busqueda: string,
  campos: (fila: T) => unknown[]
): T[] | null {
  if (!lista) return null
  const termino = normalizarTexto(busqueda)
  if (!termino) return [...lista]
  return lista.filter((fila) => normalizarTexto(campos(fila).join(" ")).includes(termino))
}

// Selector "Mis … / Todas las …" (solo si puede ver todas) + buscador, como en
// Cotizaciones.
export function BarraMisTodas({
  mostrarTodas,
  vista,
  onVista,
  etiquetas,
  busqueda,
  onBusqueda,
  placeholder,
}: {
  mostrarTodas: boolean
  vista: VistaMisTodas
  onVista: (vista: VistaMisTodas) => void
  etiquetas: [string, string]
  busqueda: string
  onBusqueda: (valor: string) => void
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {mostrarTodas && (
        <Tabs value={vista} onValueChange={(valor) => onVista(valor as VistaMisTodas)}>
          <TabsList className="max-w-full">
            <TabsTrigger value="mias">{etiquetas[0]}</TabsTrigger>
            <TabsTrigger value="todas">{etiquetas[1]}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div className="flex">
        <FilterSearchInput
          placeholder={placeholder}
          value={busqueda}
          onChange={onBusqueda}
        />
      </div>
    </div>
  )
}
