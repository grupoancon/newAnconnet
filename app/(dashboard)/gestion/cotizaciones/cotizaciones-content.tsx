"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { Plus } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type ProyectoInventario } from "@/lib/api/inventario-api"
import {
  VentasApiError,
  listarMisCotizaciones,
  listarProyectosCotizacion,
  listarTodasCotizaciones,
  type CotizacionBackend,
  type CotizacionConCreador,
} from "@/lib/api/ventas-api"
import { cn } from "@/lib/utils"

function formatearMoneda(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

// "borrador" (sin aprobación, a diferencia de Financiamiento/Refinanciamiento)
// todavía se ve "pendiente" en la UI — "ingresado" ya es el estado final.
function normalizarEstado(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "ingresado") return "ingresado"
  return "pendiente"
}

function TablaCotizaciones({
  cotizaciones,
  proyectosPorId,
  mostrarCreador,
}: {
  cotizaciones: CotizacionBackend[] | CotizacionConCreador[]
  proyectosPorId: Map<number, string>
  mostrarCreador: boolean
}) {
  const router = useRouter()

  if (cotizaciones.length === 0) {
    return (
      <div className="text-muted-foreground px-4.5 py-8 text-center text-sm">
        Todavía no hay cotizaciones.
      </div>
    )
  }

  const columnas = mostrarCreador
    ? "1fr_1.4fr_1fr_1fr_1fr_1fr_40px"
    : "1fr_1.4fr_1fr_1fr_1fr_40px"

  function abrir(fila: CotizacionBackend | CotizacionConCreador) {
    router.push(
      fila.status === "ingresado"
        ? `/gestion/cotizaciones/reporte/${fila.id}`
        : `/gestion/cotizaciones/new/${fila.id}`
    )
  }

  return (
    <>
      {/* Mobile: una tarjeta por cotización (la tabla de 6-7 columnas no entra). */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {cotizaciones.map((fila) => {
          const creadorNombre = "creador_nombre" in fila ? fila.creador_nombre : null
          return (
            <button
              key={fila.id}
              type="button"
              onClick={() => abrir(fila)}
              className="border-border hover:bg-muted/60 flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm font-semibold break-words">
                  {fila.cliente_nombre}
                </span>
                <StatusBadge variant={normalizarEstado(fila.status)} />
              </div>
              <div className="text-muted-foreground text-xs">
                {proyectosPorId.get(fila.id_proyecto) ?? "—"}
                <span className="font-mono"> · {fila.codigo_lote}</span>
              </div>
              <div className="border-border flex items-end justify-between gap-3 border-t pt-2">
                <div>
                  <div className="text-muted-foreground text-[10.5px] font-bold tracking-wide">
                    TOTAL A FINANCIAR
                  </div>
                  <div className="font-mono text-sm font-semibold">
                    {formatearMoneda(fila.total_financ)}
                  </div>
                </div>
                <div className="text-muted-foreground text-right text-xs">
                  <div className="font-mono">{formatearFecha(fila.created_at)}</div>
                  {mostrarCreador && creadorNombre ? <div>{creadorNombre}</div> : null}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="border-border hidden overflow-hidden rounded-lg border md:block">
        <div
          className={cn(
            "text-muted-foreground bg-muted/60 border-border grid border-b px-4.5 py-2.75 text-[11px] font-bold tracking-wide"
          )}
          style={{ gridTemplateColumns: columnas.split("_").join(" ") }}
        >
          <span>FECHA</span>
          <span>CLIENTE</span>
          <span>PROYECTO / LOTE</span>
          <span>TOTAL A FINANCIAR</span>
          {mostrarCreador && <span>CREADO POR</span>}
          <span>ESTADO</span>
          <span />
        </div>
        {cotizaciones.map((fila, index) => {
          const creadorNombre = "creador_nombre" in fila ? fila.creador_nombre : null
          return (
            <div
              key={fila.id}
              onClick={() => abrir(fila)}
              className={cn(
                "hover:bg-muted/60 grid cursor-pointer items-center px-4.5 py-3.5 text-[13px] transition-colors",
                index < cotizaciones.length - 1 && "border-border border-b"
              )}
              style={{ gridTemplateColumns: columnas.split("_").join(" ") }}
            >
              <span className="font-mono">{formatearFecha(fila.created_at)}</span>
              <span className="font-semibold">{fila.cliente_nombre}</span>
              <span className="text-muted-foreground">
                {proyectosPorId.get(fila.id_proyecto) ?? "—"}
                <span className="font-mono"> · {fila.codigo_lote}</span>
              </span>
              <span className="font-mono">{formatearMoneda(fila.total_financ)}</span>
              {mostrarCreador && (
                <span className="text-muted-foreground">{creadorNombre ?? "—"}</span>
              )}
              <span>
                <StatusBadge variant={normalizarEstado(fila.status)} />
              </span>
              <span className="text-muted-foreground text-right">⋯</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

// Entrada del Cotizador: a diferencia de Refinanciamiento (que arranca eligiendo
// proyecto), esta pantalla muestra directo la lista de cotizaciones ya hechas — el
// flujo de elegir proyecto/lote recién empieza al apretar "Nueva cotización" (ver
// /gestion/cotizaciones/nueva). Sin ningún permiso de módulo: cualquier usuario
// logeado entra y ve (al menos) las suyas — "cotizaciones:ver_todas" agrega la
// pestaña "Todas las cotizaciones".
export function CotizacionesContent() {
  const router = useRouter()
  const puedeVerTodas = useCan("cotizaciones:ver_todas")

  const [proyectos, setProyectos] = useState<ProyectoInventario[] | null>(null)
  const [misCotizaciones, setMisCotizaciones] = useState<CotizacionBackend[] | null>(null)
  const [todasCotizaciones, setTodasCotizaciones] = useState<
    CotizacionConCreador[] | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setError(null)
      try {
        const [proyectosData, misCotizacionesData, todasCotizacionesData] =
          await Promise.all([
            // La ruta del cotizador (solo exige sesión), no /inventarios/proyectos:
            // esa pide permisos de ventas/inventario, y un Colaborador sin ellos
            // recibía 403 y veía "No se pudo conectar con el servidor".
            listarProyectosCotizacion(),
            listarMisCotizaciones(),
            puedeVerTodas ? listarTodasCotizaciones() : Promise.resolve(null),
          ])
        if (cancelado) return
        setProyectos(proyectosData)
        setMisCotizaciones(misCotizacionesData)
        setTodasCotizaciones(todasCotizacionesData)
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof VentasApiError || err instanceof Error
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      }
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [puedeVerTodas])

  const proyectosPorId = useMemo(
    () => new Map((proyectos ?? []).map((p) => [p.id, p.nombre])),
    [proyectos]
  )

  const cargando = misCotizaciones === null && !error

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Gestión · Cotizador"
            title="Cotizaciones"
            actions={
              <Button onClick={() => router.push("/gestion/cotizaciones/nueva")}>
                <Plus className="size-3.5" strokeWidth={1.8} />
                Nueva cotización
              </Button>
            }
          />

          <div className="p-4 sm:p-5 lg:p-6.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error ? (
              <EmptyState
                title="No se pudieron cargar las cotizaciones"
                description={error}
                dashed
              />
            ) : puedeVerTodas ? (
              <Tabs defaultValue="mias">
                <TabsList className="max-w-full">
                  <TabsTrigger value="mias">Mis cotizaciones</TabsTrigger>
                  <TabsTrigger value="todas">Todas las cotizaciones</TabsTrigger>
                </TabsList>
                <TabsContent value="mias" className="mt-4">
                  <TablaCotizaciones
                    cotizaciones={misCotizaciones ?? []}
                    proyectosPorId={proyectosPorId}
                    mostrarCreador={false}
                  />
                </TabsContent>
                <TabsContent value="todas" className="mt-4">
                  <TablaCotizaciones
                    cotizaciones={todasCotizaciones ?? []}
                    proyectosPorId={proyectosPorId}
                    mostrarCreador
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <TablaCotizaciones
                cotizaciones={misCotizaciones ?? []}
                proyectosPorId={proyectosPorId}
                mostrarCreador={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
