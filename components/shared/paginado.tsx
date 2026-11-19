"use client"

import { useState } from "react"

import { Pagination } from "@/components/shared/pagination"

// Paginación del lado del cliente para tablas que ya tienen la lista completa en memoria.
// Si la lista se achica (filtros, eliminación) la página actual se ajusta sola.
export function usePaginado<T>(lista: readonly T[] | null | undefined, porPagina = 10) {
  const [pagina, setPagina] = useState(1)
  const total = lista?.length ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = (lista ?? []).slice(
    (paginaActual - 1) * porPagina,
    paginaActual * porPagina
  )
  return { visibles, pagina: paginaActual, totalPaginas, total, setPagina }
}

// Pie de tabla: "N registros" a la izquierda y el paginador a la derecha (solo si hay
// más de una página).
export function PiePaginado({
  pagina,
  totalPaginas,
  total,
  setPagina,
  etiqueta = ["registro", "registros"],
}: {
  pagina: number
  totalPaginas: number
  total: number
  setPagina: (pagina: number) => void
  etiqueta?: [string, string]
}) {
  if (total === 0) return null
  return (
    <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
      <span className="text-muted-foreground text-xs">
        {total} {total === 1 ? etiqueta[0] : etiqueta[1]}
      </span>
      {totalPaginas > 1 ? (
        <Pagination page={pagina} totalPages={totalPaginas} onPageChange={setPagina} />
      ) : null}
    </div>
  )
}
