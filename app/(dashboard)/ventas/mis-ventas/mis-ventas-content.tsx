"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "@/lib/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listarProyectos, type ProyectoInventario } from "@/lib/api/inventario-api"
import {
  VentasApiError,
  obtenerMisVentas,
  type EstadoGeneralVenta,
  type MiVenta,
  type ResumenMisVentas,
} from "@/lib/api/ventas-api"

const ESTADO_LABEL: Record<EstadoGeneralVenta, string> = {
  aprobado: "Completadas",
  rechazado: "Rechazadas",
  "en-tramite": "En trámite",
}

const ESTADO_VARIANT: Record<EstadoGeneralVenta, StatusVariant> = {
  aprobado: "aprobado",
  rechazado: "rechazado",
  "en-tramite": "en-tramite",
}

function formatearMoneda(valor: number | null | undefined): string {
  if (valor == null || isNaN(valor)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

function formatearFecha(fecha: string | null): string {
  return fecha ? fecha.slice(0, 10) : "—"
}

function formatearDocumentosPendientes(pendientes: number): string {
  if (pendientes <= 0) return "Completo"
  return pendientes === 1 ? "Falta 1" : `Faltan ${pendientes}`
}

// Reporte del asesor logueado — al backend nunca se le manda un nombre/id de asesor, lo
// resuelve solo desde la sesión (ver obtenerMisVentas), así que esta pantalla siempre
// muestra las ventas de quien la abre, sin importar los filtros elegidos acá.
//
// Solo muestra ventas 100% aprobadas (oferta + financiamiento + pago) — a diferencia
// del reporte general, acá no tiene sentido ver procesos en trámite o rechazados, y el
// estado queda fijo en vez de un toggle porque no hay nada más para elegir.
export function MisVentasContent() {
  const router = useRouter()
  const [proyectos, setProyectos] = useState<ProyectoInventario[]>([])
  const [proyectoId, setProyectoId] = useState<string>("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")

  const [resumen, setResumen] = useState<ResumenMisVentas | null>(null)
  const [procesos, setProcesos] = useState<MiVenta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch(() => setProyectos([]))
  }, [])

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)
    obtenerMisVentas({
      proyectoId: proyectoId ? +proyectoId : undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      estado: "aprobado",
    })
      .then((data) => {
        setResumen(data.resumen)
        setProcesos(data.procesos)
      })
      .catch((err) => {
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
      .finally(() => setCargando(false))
  }, [proyectoId, desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="mb-4.5">
          <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
            Ventas · Mi reporte
          </div>
          <h1 className="text-[23px] font-extrabold tracking-tight">Mis ventas</h1>
        </div>

        <div className="mb-4.5 grid grid-cols-2 gap-3.5">
          <KpiCard
            label="Procesos (filtro actual)"
            value={cargando ? "—" : (resumen?.totalProcesos ?? 0)}
          />
          <KpiCard
            label="Ventas completadas"
            value={cargando ? "—" : (resumen?.totalCompletadas ?? 0)}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Select
            value={proyectoId || "todos"}
            onValueChange={(v) => setProyectoId(v === "todos" ? "" : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los proyectos</SelectItem>
              {proyectos.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border-input bg-card focus:border-primary focus:ring-ring/15 h-9 rounded-md border px-3 text-sm outline-none focus:ring-3"
          />
          <span className="text-muted-foreground text-xs">a</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border-input bg-card focus:border-primary focus:ring-ring/15 h-9 rounded-md border px-3 text-sm outline-none focus:ring-3"
          />
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="No se pudieron cargar tus ventas"
            description={error}
            dashed
          />
        ) : procesos.length === 0 ? (
          <EmptyState
            title="No hay ventas con estos filtros"
            description="Probá cambiando el proyecto, el rango de fechas o el estado."
          />
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-[11px] font-semibold uppercase">
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Proyecto</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Documentos</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {procesos.map((proceso) => (
                  <tr key={proceso.id} className="border-border border-b last:border-0">
                    <td className="px-4 py-3 font-mono">{proceso.cliLote || "—"}</td>
                    <td className="px-4 py-3">{proceso.cliName || "—"}</td>
                    <td className="px-4 py-3">{proceso.proyectoNombre || "—"}</td>
                    <td className="px-4 py-3 font-mono">
                      {formatearMoneda(proceso.lotePrice)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={ESTADO_VARIANT[proceso.estadoGeneral]}>
                        {ESTADO_LABEL[proceso.estadoGeneral]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/ventas/procesos/documentos?proceso=${proceso.id}`)
                        }
                        className="inline-block transition-transform hover:scale-105 active:scale-95"
                      >
                        <StatusBadge
                          variant={
                            proceso.documentosPendientes === 0 ? "aprobado" : "rechazado"
                          }
                        >
                          {formatearDocumentosPendientes(proceso.documentosPendientes)}
                        </StatusBadge>
                      </button>
                    </td>
                    <td className="px-4 py-3">{formatearFecha(proceso.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
