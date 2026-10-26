"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "@/lib/navigation"
import { Receipt } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import type { LoteInventario } from "@/lib/api/inventario-api"
import { cn } from "@/lib/utils"
import { VentasApiError, obtenerLotesLibres } from "@/lib/api/ventas-api"

const LOTES_POR_PAGINA = 10

// Mismo mapeo de estado -> variante que inventario-content.tsx (trim de espacios de
// mas, tipo " LIBRE"; "convenio" cuenta visualmente como vendido).
const ESTADO_VARIANTE: Record<string, StatusVariant> = {
  libre: "disponible",
  disponible: "disponible",
  reservado: "reservado",
  convenio: "hipotecado",
  bloqueado: "bloqueado",
  hipotecado: "hipotecado",
  vendido: "hipotecado",
}

function normalizarEstado(crudo: string | null | undefined): {
  label: string
  variant: StatusVariant
} {
  const texto = (crudo ?? "").trim()
  if (!texto) return { label: "—", variant: "pronto" }
  const clave = texto.toLowerCase()
  return {
    label: texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase(),
    variant: ESTADO_VARIANTE[clave] ?? "pronto",
  }
}

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

export function InventarioLotesContent() {
  const params = useParams()
  // [proyect] es el id numerico del proyecto (ver /ventas/proyectos, que enlaza aca
  // con el id real del backend) — no un slug de texto como antes.
  const idProyecto = Number(params?.proyect)
  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState("")
  const [lotes, setLotes] = useState<LoteInventario[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  // "Ventas realizadas" es solo para gerencia/administración (ver su page.tsx).
  const puedeVerVentasRealizadas = useCan("ventas:reporte")

  useEffect(() => {
    if (isNaN(idProyecto)) {
      setError("Proyecto invalido.")
      return
    }
    setError(null)
    obtenerLotesLibres(idProyecto)
      .then(setLotes)
      .catch((err) => {
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }, [idProyecto]) // La API ya trae todos los lotes libres del proyecto; paginacion y busqueda son en frontend, no hace falta volver a pedirlos

  // Busqueda por codigo de lote o proyecto sobre lo que ya trajo la API (sin re-fetch).
  const lotesFiltrados = (lotes ?? []).filter((fila) => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return true
    return (
      fila.codigo?.toLowerCase().includes(termino) ||
      fila.proyecto?.nombre?.toLowerCase().includes(termino)
    )
  })

  const totalPaginas = Math.max(1, Math.ceil(lotesFiltrados.length / LOTES_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * LOTES_POR_PAGINA
  const lotesPagina = lotesFiltrados.slice(inicio, inicio + LOTES_POR_PAGINA)

  function manejarBusqueda(valor: string) {
    setBusqueda(valor)
    setPagina(1) // vuelve a la primera pagina para no quedar en una pagina vacia
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Ventas · Lotes"
            title="Lotes disponibles"
            actions={
              puedeVerVentasRealizadas ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/ventas/realizadas")}
                >
                  <Receipt className="size-3.5" strokeWidth={1.7} />
                  <span className="hidden sm:inline">Ventas realizadas</span>
                </Button>
              ) : undefined
            }
          />

          <FilterBar>
            <FilterSearchInput
              placeholder="Buscar lote, proyecto…"
              value={busqueda}
              onChange={manejarBusqueda}
            />

            <span className="text-muted-foreground ml-auto text-xs">
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
            <div className="p-4 sm:p-6.5">
              <EmptyState
                title="No se pudieron cargar los lotes"
                description={error}
                dashed
              />
            </div>
          ) : (
            <div>
              <div className="text-muted-foreground bg-muted/60 border-border hidden grid-cols-[1fr_1.4fr_1.4fr_1fr_1fr_40px] border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide sm:grid">
                <span>LOTE</span>
                <span>PROYECTO</span>
                <span>METRAJE</span>
                <span>PRECIO</span>
                <span>ESTADO</span>
                <span />
              </div>
              {lotesPagina.length === 0 && (
                <div className="text-muted-foreground px-6.5 py-8 text-center text-sm">
                  No se encontraron lotes.
                </div>
              )}
              {lotesPagina.map((fila, index) => {
                const estado = normalizarEstado(fila.estado)
                return (
                  <div
                    onClick={() =>
                      router.push(
                        `/ventas/procesos?lote=${encodeURIComponent(fila.codigo)}`
                      )
                    }
                    key={fila.id}
                    className={cn(
                      "hover:bg-muted/60 grid cursor-pointer items-center px-4 py-3.5 text-[13px] transition-colors sm:grid-cols-[1fr_1.4fr_1.4fr_1fr_1fr_40px] sm:px-6.5",
                      index < lotesPagina.length - 1 && "border-border border-b"
                    )}
                  >
                    {/* Móvil: tarjeta en dos líneas (código + estado / proyecto + datos) */}
                    <div className="col-span-full flex flex-col gap-1.5 sm:hidden">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-bold">{fila.codigo}</span>
                        <StatusBadge variant={estado.variant}>{estado.label}</StatusBadge>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {fila.proyecto?.nombre}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">
                          {formatearMetraje(fila.areaUtil)}
                        </span>
                        <span className="font-mono font-semibold">
                          {formatearPrecio(fila.pvp)}
                        </span>
                      </div>
                    </div>

                    <span className="hidden font-mono font-bold sm:inline">
                      {fila.codigo}
                    </span>
                    <span className="text-muted-foreground hidden sm:inline">
                      {fila.proyecto?.nombre}
                    </span>
                    <span className="hidden font-semibold sm:inline">
                      {formatearMetraje(fila.areaUtil)}
                    </span>
                    <span className="hidden font-mono sm:inline">
                      {formatearPrecio(fila.pvp)}
                    </span>
                    <span className="hidden sm:inline">
                      <StatusBadge variant={estado.variant}>{estado.label}</StatusBadge>
                    </span>
                    <span className="text-muted-foreground hidden text-right sm:inline">
                      ⋯
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {lotes && lotesFiltrados.length > 0 ? (
            <div className="border-border flex flex-col items-center gap-2.5 border-t px-4 py-3.5 sm:flex-row sm:justify-between sm:px-6.5">
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
