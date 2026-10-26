"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "@/lib/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"
import {
  VentasApiError,
  obtenerLotesVendidos,
  type LoteVendido,
} from "@/lib/api/ventas-api"

const LOTES_POR_PAGINA = 10

function formatearMetraje(valor: string | number | null): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return `${new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 }).format(numero)} m²`
}

function formatearPrecio(valor: string | number | null): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

// Mismo patrón que InventarioLotesContent (/ventas/lotes/[proyect]) pero con lotes ya
// vendidos en vez de libres. `procesoId` viene null cuando ese lote todavía no tiene
// ningún sale_process en este sistema (frecuente en ventas históricas) — ahí el click
// manda a "Registrar venta histórica" en vez de directo a refinanciar.
export function LotesVendidosContent() {
  const params = useParams()
  const idProyecto = Number(params?.proyect)
  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState("")
  const [lotes, setLotes] = useState<LoteVendido[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (isNaN(idProyecto)) {
      setError("Proyecto invalido.")
      return
    }
    setError(null)
    obtenerLotesVendidos(idProyecto)
      .then(setLotes)
      .catch((err) => {
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }, [idProyecto])

  const lotesFiltrados = (lotes ?? []).filter((fila) => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return true
    return fila.codigo?.toLowerCase().includes(termino)
  })

  const totalPaginas = Math.max(1, Math.ceil(lotesFiltrados.length / LOTES_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * LOTES_POR_PAGINA
  const lotesPagina = lotesFiltrados.slice(inicio, inicio + LOTES_POR_PAGINA)

  function manejarBusqueda(valor: string) {
    setBusqueda(valor)
    setPagina(1)
  }

  function abrirLote(fila: LoteVendido) {
    if (fila.procesoId) {
      // El lote puede tener varios refinanciamientos a lo largo del tiempo — el
      // historial decide si arranca uno nuevo o retoma el que esté en curso.
      router.push(`/gestion/refinanciamiento/historial/${fila.procesoId}`)
    } else {
      router.push(
        `/gestion/refinanciamiento/registrar-venta/${encodeURIComponent(fila.codigo ?? "")}`
      )
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Refinanciamientos · Lotes vendidos"
            title="Elige el lote a refinanciar"
          />

          <FilterBar>
            <FilterSearchInput
              placeholder="Buscar lote…"
              value={busqueda}
              onChange={manejarBusqueda}
            />

            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {lotes
                ? `${lotesFiltrados.length} lote${lotesFiltrados.length === 1 ? "" : "s"}`
                : "…"}
            </span>
          </FilterBar>

          {!lotes && !error ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-6.5">
              <EmptyState
                title="No se pudieron cargar los lotes"
                description={error}
                dashed
              />
            </div>
          ) : (
            <>
              {/* Mobile: una tarjeta por lote (la tabla de 5 columnas no entra). */}
              <div className="flex flex-col md:hidden">
                {lotesPagina.length === 0 && (
                  <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                    No hay lotes vendidos en este proyecto todavía.
                  </div>
                )}
                {lotesPagina.map((fila, index) => (
                  <button
                    key={fila.id}
                    type="button"
                    onClick={() => abrirLote(fila)}
                    className={cn(
                      "hover:bg-muted/60 flex flex-col gap-2 px-4 py-3.5 text-left transition-colors",
                      index < lotesPagina.length - 1 && "border-border border-b"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-bold">{fila.codigo}</span>
                      <StatusBadge variant="hipotecado">Vendido</StatusBadge>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="text-muted-foreground">
                        {formatearMetraje(fila.areaUtil)}
                        <span className="text-foreground font-mono">
                          {" "}
                          · {formatearPrecio(fila.pvp)}
                        </span>
                      </span>
                      {!fila.procesoId ? (
                        <span className="bg-accent text-accent-foreground shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap">
                          Registrar venta
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden md:block">
                <div className="text-muted-foreground bg-muted/60 border-border grid grid-cols-[1fr_1fr_1fr_1fr_auto] border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide">
                  <span>LOTE</span>
                  <span>METRAJE</span>
                  <span>PRECIO</span>
                  <span>ESTADO</span>
                  <span />
                </div>
                {lotesPagina.length === 0 && (
                  <div className="text-muted-foreground px-6.5 py-8 text-center text-sm">
                    No hay lotes vendidos en este proyecto todavía.
                  </div>
                )}
                {lotesPagina.map((fila, index) => (
                  <div
                    onClick={() => abrirLote(fila)}
                    key={fila.id}
                    className={cn(
                      "hover:bg-muted/60 grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center px-6.5 py-3.5 text-[13px] transition-colors",
                      index < lotesPagina.length - 1 && "border-border border-b"
                    )}
                  >
                    <span className="font-mono font-bold">{fila.codigo}</span>
                    <span className="font-semibold">
                      {formatearMetraje(fila.areaUtil)}
                    </span>
                    <span className="font-mono">{formatearPrecio(fila.pvp)}</span>
                    <span>
                      <StatusBadge variant="hipotecado">Vendido</StatusBadge>
                    </span>
                    <span className="text-right">
                      {fila.procesoId ? (
                        <span className="text-muted-foreground">⋯</span>
                      ) : (
                        <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap">
                          Registrar venta
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {lotes && lotesFiltrados.length > 0 ? (
            <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3.5 sm:px-6.5">
              <span className="text-muted-foreground text-xs">
                Mostrando {inicio + 1}–
                {Math.min(inicio + LOTES_POR_PAGINA, lotesFiltrados.length)} de{" "}
                {lotesFiltrados.length}
              </span>
              <Pagination
                page={paginaActual}
                totalPages={totalPaginas}
                onPageChange={setPagina}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
