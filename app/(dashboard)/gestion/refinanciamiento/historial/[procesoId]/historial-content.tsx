"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Plus } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { StaticField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  listarRefinanciamientosDeProceso,
  obtenerProceso,
  type ProcesoBackend,
  type RefinanciamientoBackend,
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

// Mismo criterio que refinanciamiento-reporte-content.tsx: "borrador" (y cualquier
// otro valor inesperado) cae en el badge "pendiente".
function normalizarEstado(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "aprobado" || clave === "ingresado" || clave === "rechazado") return clave
  return "pendiente"
}

// Un lote puede refinanciarse más de una vez — esta pantalla lista todo el historial
// de refinanciamientos de un proceso (sea o no el activo), con su estado, y deja
// entrar a cada reporte puntual o arrancar/continuar uno nuevo. "Nuevo
// refinanciamiento" se oculta solo si el más reciente está "ingresado" (compromiso
// real, pendiente de revisión — ver RefinanciamientoService.crearRefinanciamiento en
// el backend); con uno en "borrador" o "rechazado" conviven los dos botones —
// "Continuar" retoma ese mismo registro, "Nuevo" lo abandona y arranca en blanco.
export function HistorialRefinanciamientosContent({ procesoId }: { procesoId: string }) {
  const router = useRouter()
  const idProceso = Number(procesoId)

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [refinanciamientos, setRefinanciamientos] = useState<
    RefinanciamientoBackend[] | null
  >(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!idProceso || Number.isNaN(idProceso)) {
      setCargando(false)
      setError("Proceso inválido.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const procesoData = await obtenerProceso(idProceso)
        if (cancelado) return
        if (!procesoData) {
          setError("No se encontró el proceso.")
          return
        }
        setProceso(procesoData)

        const [lote, lista] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          listarRefinanciamientosDeProceso(idProceso),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setRefinanciamientos(lista)
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof VentasApiError || err instanceof InventarioApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
  }, [idProceso])

  const activo = refinanciamientos?.[0] ?? null
  // "ingresado" es el único estado que de verdad bloquea crear uno nuevo (ver
  // RefinanciamientoService.crearRefinanciamiento en el backend) — es un compromiso
  // real, el asesor ya le dio "Guardar", pendiente de aprobación. Un "borrador" o un
  // "rechazado" no bloquean: se puede seguir editando ESE registro ("Continuar") o
  // abandonarlo y arrancar uno limpio ("Nuevo") — por eso ambos botones conviven en
  // esos dos casos.
  const puedeContinuar =
    activo != null &&
    (activo.status === "borrador" ||
      activo.status === "ingresado" ||
      activo.status === "rechazado")
  const hayIngresado = activo != null && activo.status === "ingresado"

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="border-border flex items-center gap-3.5 border-b px-4 py-4 sm:px-7.5 sm:py-5">
            <button
              type="button"
              className="border-border flex size-8 items-center justify-center rounded-md border"
              aria-label="Volver"
              onClick={() => router.back()}
            >
              <ArrowLeft className="text-muted-foreground size-3.5" strokeWidth={1.8} />
            </button>
            <h1 className="min-w-0 text-lg font-extrabold tracking-tight sm:text-xl">
              Historial de refinanciamientos
            </h1>
          </div>

          <div className="flex flex-col gap-4.5 px-4 py-5 sm:gap-5.5 sm:px-7.5 sm:py-6.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !proceso ? (
              <EmptyState
                title="No se puede abrir el historial"
                description={error ?? "No se encontró el proceso."}
                dashed
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <StaticField
                    label="CLIENTE"
                    value={proceso.titular?.nombre ?? "—"}
                    emphasis
                  />
                  <StaticField
                    label="PROYECTO"
                    value={loteInfo?.proyecto?.nombre ?? "—"}
                  />
                  <StaticField
                    label="INMUEBLE"
                    value={loteInfo?.codigo ?? proceso.cli_lote ?? "—"}
                    mono
                    emphasis
                  />
                  <StaticField
                    label="VALOR DEL LOTE"
                    value={formatearMoneda(loteInfo?.pvp ?? proceso.lote_price)}
                    mono
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground text-xs font-bold tracking-wide">
                    REFINANCIAMIENTOS DE ESTE LOTE
                  </div>
                  <div className="flex flex-wrap gap-2.5 [&>button]:flex-1 sm:[&>button]:flex-none">
                    {/* Solo si hay un borrador o ingresado activo — retoma ESE registro
                        puntual con todos sus datos (ver refinanciamiento-content.tsx). */}
                    {puedeContinuar && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(`/gestion/refinanciamiento/new/${idProceso}`)
                        }
                      >
                        Continuar refinanciamiento
                      </Button>
                    )}
                    {/* Oculto solo si hay uno "ingresado" (compromiso real, pendiente de
                        aprobación) — con un borrador sí se puede, abandonándolo: el
                        query param ?nuevo=1 le dice a la pantalla que arranque en
                        blanco en vez de retomar ese borrador. */}
                    {!hayIngresado && (
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/gestion/refinanciamiento/new/${idProceso}?nuevo=1`
                          )
                        }
                      >
                        <Plus className="size-3.5" strokeWidth={1.8} />
                        Nuevo refinanciamiento
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mobile: una tarjeta por refinanciamiento (la tabla de 5 columnas no entra). */}
                <div className="flex flex-col gap-2.5 md:hidden">
                  {!refinanciamientos || refinanciamientos.length === 0 ? (
                    <div className="text-muted-foreground border-border rounded-lg border px-4 py-8 text-center text-sm">
                      Todavía no se ha refinanciado este lote.
                    </div>
                  ) : (
                    refinanciamientos.map((refi) => (
                      <button
                        key={refi.id}
                        type="button"
                        onClick={() =>
                          router.push(`/gestion/refinanciamiento/reporte/${refi.id}`)
                        }
                        className="border-border hover:bg-muted/60 flex flex-col gap-2 rounded-lg border p-3.5 text-left transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm font-semibold">
                            {refi.financ_type ?? "—"}
                          </span>
                          <StatusBadge variant={normalizarEstado(refi.status)} />
                        </div>
                        <div className="border-border flex items-end justify-between gap-3 border-t pt-2">
                          <div>
                            <div className="text-muted-foreground text-[10.5px] font-bold tracking-wide">
                              TOTAL A FINANCIAR
                            </div>
                            <div className="font-mono text-sm font-semibold">
                              {formatearMoneda(refi.total_financ)}
                            </div>
                          </div>
                          <span className="text-muted-foreground font-mono text-xs">
                            {formatearFecha(refi.created_at)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="border-border hidden overflow-hidden rounded-lg border md:block">
                  <div className="text-muted-foreground bg-muted/60 border-border grid grid-cols-[1fr_1.4fr_1fr_1fr_40px] border-b px-4.5 py-2.75 text-[11px] font-bold tracking-wide">
                    <span>FECHA</span>
                    <span>TIPO</span>
                    <span>TOTAL A FINANCIAR</span>
                    <span>ESTADO</span>
                    <span />
                  </div>
                  {!refinanciamientos || refinanciamientos.length === 0 ? (
                    <div className="text-muted-foreground px-4.5 py-8 text-center text-sm">
                      Todavía no se ha refinanciado este lote.
                    </div>
                  ) : (
                    refinanciamientos.map((refi, index) => (
                      <div
                        key={refi.id}
                        onClick={() =>
                          router.push(`/gestion/refinanciamiento/reporte/${refi.id}`)
                        }
                        className={cn(
                          "hover:bg-muted/60 grid grid-cols-[1fr_1.4fr_1fr_1fr_40px] items-center px-4.5 py-3.5 text-[13px] transition-colors",
                          index < refinanciamientos.length - 1 && "border-border border-b"
                        )}
                      >
                        <span className="font-mono">
                          {formatearFecha(refi.created_at)}
                        </span>
                        <span>{refi.financ_type ?? "—"}</span>
                        <span className="font-mono">
                          {formatearMoneda(refi.total_financ)}
                        </span>
                        <span>
                          <StatusBadge variant={normalizarEstado(refi.status)} />
                        </span>
                        <span className="text-muted-foreground text-right">⋯</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
