"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useRouter } from "@/lib/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  VentasApiError,
  listarProcesosPendientesRevision,
  type ProcesoPendienteRevision,
} from "@/lib/api/ventas-api"

const PAGE_SIZE = 20

function formatearFecha(fecha: string | null): string {
  return fecha ? fecha.slice(0, 10) : "—"
}

// Lista de ventas pendientes de revision. "Ver detalle" no abre un panel aparte —
// lleva directo a /ventas/procesos/documentos?proceso=X, la MISMA pantalla que usa el
// asesor para subir documentos: ahi el revisor ve, solicita y verifica (acciones
// gateadas por <Can permiso="documentos:revisar"> en esa pantalla), sin duplicar UI.
export function RevisionDocumentosContent() {
  const router = useRouter()
  const [items, setItems] = useState<ProcesoPendienteRevision[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [estado, setEstado] = useState<"pendiente" | "todos">("pendiente")
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargarLista = useCallback(() => {
    setCargando(true)
    setError(null)
    listarProcesosPendientesRevision({ page, pageSize: PAGE_SIZE, estado, busqueda })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
      })
      .catch((err) => {
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
      .finally(() => setCargando(false))
  }, [page, estado, busqueda])

  useEffect(() => {
    cargarLista()
  }, [cargarLista])

  const verDetalle = (idProcess: number) => {
    router.push(`/ventas/procesos/documentos?proceso=${idProcess}`)
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mb-4.5">
          <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
            Ventas · Documentación
          </div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-[23px]">
            Revisión de documentos
          </h1>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-auto">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={busqueda}
              onChange={(event) => {
                setPage(1)
                setBusqueda(event.target.value)
              }}
              placeholder="Buscar cliente o lote..."
              className="w-full pl-8 sm:w-64"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={estado === "pendiente" ? "default" : "outline"}
              onClick={() => {
                setPage(1)
                setEstado("pendiente")
              }}
            >
              Pendientes
            </Button>
            <Button
              type="button"
              size="sm"
              variant={estado === "todos" ? "default" : "outline"}
              onClick={() => {
                setPage(1)
                setEstado("todos")
              }}
            >
              Todos
            </Button>
          </div>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="No se pudieron cargar las ventas"
            description={error}
            dashed
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No hay ventas pendientes de revisión"
            description="Todas las ventas tienen su documentación verificada."
          />
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="tabla-apilada w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-[11px] font-semibold uppercase">
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Asesor</th>
                  <th className="px-4 py-3">Documentos</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((proceso) => (
                  <tr key={proceso.id} className="border-border border-b last:border-0">
                    <td data-label="Lote" className="px-4 py-3 font-mono">
                      {proceso.cli_lote || "—"}
                    </td>
                    <td data-label="Cliente" className="px-4 py-3">
                      {proceso.cli_name || "—"}
                    </td>
                    <td data-label="Asesor" className="px-4 py-3">
                      {proceso.cli_asesor || "—"}
                    </td>
                    <td data-label="Documentos" className="px-4 py-3">
                      <StatusBadge
                        variant={
                          proceso.resumenDocumentos.revisados >=
                          proceso.resumenDocumentos.total
                            ? "aprobado"
                            : "pendiente"
                        }
                      >
                        {proceso.resumenDocumentos.revisados}/
                        {proceso.resumenDocumentos.total}
                      </StatusBadge>
                    </td>
                    <td data-label="Fecha" className="px-4 py-3">
                      {formatearFecha(proceso.created_at)}
                    </td>
                    <td data-label="" className="justify-end px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => verDetalle(proceso.id)}
                      >
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargando && !error && total > PAGE_SIZE ? (
          <div className="mt-3.5 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Página {page} de {totalPaginas} · {total} ventas
            </span>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3.5" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPaginas}
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
              >
                Siguiente
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
