"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { Printer, Search } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  obtenerReporteVentas,
  type EstadoGeneralVenta,
  type MiVenta,
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

// "location" es "oficina" | "Puerto Quito" (ver LUGARES_VENTA_OPCIONES en
// select-options.ts) — acá se abrevia para que la columna no ocupe tanto espacio.
function formatearLugarVenta(location: string | null): string {
  const normalizado = location?.trim().toLowerCase()
  if (normalizado === "oficina") return "OF"
  if (normalizado === "puerto quito") return "PQ"
  return location || "—"
}

type VistaReporte = "completadas" | "falta-documentos"

// Vista agregada de TODA la empresa (a diferencia de "Mis ventas", que solo muestra las
// del asesor logueado) — el backend no filtra por ningún asesor salvo que se pida acá.
// `embebido`: se muestra dentro de la página /reportes, que ya trae su propio topbar.
export function ReporteVentasContent({ embebido = false }: { embebido?: boolean }) {
  const [proyectos, setProyectos] = useState<ProyectoInventario[]>([])
  const [proyectoId, setProyectoId] = useState<string>("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [vista, setVista] = useState<VistaReporte>("completadas")
  const [asesor, setAsesor] = useState("")

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
    // La vista (Completadas / Falta documentos) se filtra en el cliente, no acá: ambas
    // conviven en el mismo dataset (aprobado + rechazado, el backend ya excluye
    // en-tramite), así que se trae todo una sola vez y se filtra abajo según `vista`.
    obtenerReporteVentas({
      proyectoId: proyectoId ? +proyectoId : undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      asesor: asesor.trim() || undefined,
    })
      .then((data) => {
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
  }, [proyectoId, desde, hasta, asesor])

  useEffect(() => {
    cargar()
  }, [cargar])

  // KPI "Ventas completadas + documentos": a diferencia de la tabla (que en la vista
  // "Completadas" muestra toda venta aprobada, tenga o no documentos pendientes), este
  // número solo cuenta las que además tienen los documentos 100% completos.
  const totalCompletadasConDocumentos = useMemo(
    () =>
      procesos.filter(
        (p) => p.estadoGeneral === "aprobado" && p.documentosPendientes === 0
      ).length,
    [procesos]
  )

  const procesosVista = useMemo(
    () =>
      vista === "completadas"
        ? procesos.filter((p) => p.estadoGeneral === "aprobado")
        : procesos.filter((p) => p.documentosPendientes > 0),
    [procesos, vista]
  )

  // Agrupa los lotes por proyecto (juntos en vez de intercalados por fecha) para poder
  // mostrar el total de lotes al final de cada grupo — el orden de los grupos es el de
  // primera aparición en procesosVista (ya viene ordenado por fecha desde el backend),
  // y dentro de cada grupo se conserva ese mismo orden.
  const gruposPorProyecto = useMemo(() => {
    const mapa = new Map<string, MiVenta[]>()
    for (const proceso of procesosVista) {
      const clave = proceso.proyectoNombre || "Sin proyecto"
      const lista = mapa.get(clave) ?? []
      lista.push(proceso)
      mapa.set(clave, lista)
    }
    return Array.from(mapa.entries())
  }, [procesosVista])

  return (
    <div className="flex h-full flex-col">
      {!embebido && (
        <div className="no-print">
          <DashboardTopbar />
        </div>
      )}

      <div className="reporte-scroll flex-1 overflow-y-auto p-6.5 print:overflow-visible! print:p-0!">
        <div className="mb-4.5 flex items-start justify-between gap-3 print:mb-2!">
          <div>
            <div className="text-muted-foreground no-print mb-1.5 text-[11px] font-semibold">
              Ventas · Reporte general
            </div>
            <h1 className="no-print text-[23px] font-extrabold tracking-tight">
              Reporte de ventas
            </h1>
            {/* Título de impresión: distinto del título en pantalla (lo pidió el
                usuario), y chico a propósito — el resto de la hoja es para la tabla. */}
            <h1 className="hidden text-[26px] font-extrabold tracking-tight print:block">
              Reporte general de ventas
            </h1>
          </div>
          <Button
            type="button"
            size="sm"
            className="no-print"
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" strokeWidth={1.8} />
            Imprimir
          </Button>
        </div>

        <div className="mb-4.5 grid grid-cols-2 gap-3.5 print:mb-[5px]! print:gap-1.5!">
          <KpiCard
            label="Ventas (filtro actual)"
            value={cargando ? "—" : procesosVista.length}
            className="print:p-1.5!"
          />
          <KpiCard
            label="Ventas completadas + documentos"
            value={cargando ? "—" : totalCompletadasConDocumentos}
            className="print:p-1.5!"
          />
        </div>

        <div className="no-print mb-4 flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={asesor}
              onChange={(e) => setAsesor(e.target.value)}
              placeholder="Buscar por asesor..."
              className="w-48 pl-8"
            />
          </div>

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

          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={vista === "completadas" ? "default" : "outline"}
              onClick={() => setVista("completadas")}
            >
              Completadas
            </Button>
            <Button
              type="button"
              size="sm"
              variant={vista === "falta-documentos" ? "default" : "outline"}
              onClick={() => setVista("falta-documentos")}
            >
              Falta documentos
            </Button>
          </div>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState title="No se pudo cargar el reporte" description={error} dashed />
        ) : procesosVista.length === 0 ? (
          <EmptyState
            title="No hay ventas con estos filtros"
            description="Probá cambiando el proyecto, el asesor, el rango de fechas o la vista."
          />
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-lg border print:rounded-none! print:border-0!">
            <table className="w-full text-sm print:text-[12px]!">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-[11px] font-semibold uppercase print:text-[12px]!">
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Proyecto</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Fecha</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Lote</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Asesor</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Precio</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Venta</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Tipo de venta</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">
                    Cómo nos contactó
                  </th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Prospectador</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Estado</th>
                  <th className="px-4 py-3 print:px-1.5! print:py-1!">Documentos</th>
                </tr>
              </thead>
              <tbody>
                {gruposPorProyecto.map(([proyecto, filas]) => (
                  <Fragment key={proyecto}>
                    {filas.map((proceso) => (
                      <tr
                        key={proceso.id}
                        className="border-border border-b last:border-0"
                      >
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          {proceso.proyectoNombre || "—"}
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          {formatearFecha(proceso.ventaNuevaAt)}
                        </td>
                        <td className="px-4 py-3 font-mono print:px-1.5! print:py-1!">
                          {proceso.cliLote || "—"}
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          {proceso.cliAsesor || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono print:px-1.5! print:py-1!">
                          {formatearMoneda(proceso.lotePrice)}
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          {formatearLugarVenta(proceso.location)}
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          {proceso.tipoVenta || "—"}
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          {proceso.comoNosContacto || "—"}
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          {proceso.prospectador || "—"}
                          {proceso.apoyoProyecto ? " / Karina Coveña" : ""}
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          <StatusBadge
                            variant={ESTADO_VARIANT[proceso.estadoGeneral]}
                            className="print:px-1! print:py-0! print:text-[12px]!"
                          >
                            {ESTADO_LABEL[proceso.estadoGeneral]}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 print:px-1.5! print:py-1!">
                          <StatusBadge
                            variant={
                              proceso.documentosPendientes === 0
                                ? "aprobado"
                                : "rechazado"
                            }
                            className="print:px-1! print:py-0! print:text-[12px]!"
                          >
                            {formatearDocumentosPendientes(proceso.documentosPendientes)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted border-border border-b">
                      <td
                        colSpan={11}
                        className="text-muted-foreground px-4 py-2 text-left text-[11px] font-bold print:px-1.5! print:py-1! print:text-[12px]!"
                      >
                        Total {proyecto}: {filas.length}{" "}
                        {filas.length === 1 ? "lote" : "lotes"}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .reporte-scroll {
            height: auto !important;
          }
          .reporte-scroll * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  )
}
