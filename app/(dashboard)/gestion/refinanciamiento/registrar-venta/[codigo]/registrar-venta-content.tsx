"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { StaticField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import { VentasApiError, registrarVentaHistorica } from "@/lib/api/ventas-api"

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

function formatearMetraje(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return `${new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 }).format(numero)} m²`
}

// Módulo aparte de Nueva Venta: registra el sale_process mínimo que le falta a un
// lote ya vendido (estado "convenio") para poder refinanciarlo — Refinanciamiento lee
// nombre/lote desde sale_process, igual que Financiamiento, así que sin este paso no
// hay de dónde traer esos datos para las ventas históricas que nunca pasaron por el
// flujo de "Nueva Venta" en este sistema. Solo pide lo mínimo (nombre y cédula); el
// resto de datos del cliente (nacionalidad, sexo, estado civil, fecha de nacimiento)
// queda vacío y se puede completar después a mano si hiciera falta.
export function RegistrarVentaHistoricaContent({ codigo }: { codigo: string }) {
  const router = useRouter()
  const toast = useToast()

  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [cliName, setCliName] = useState("")
  const [identificacion, setIdentificacion] = useState("")

  useEffect(() => {
    if (!codigo) {
      setCargando(false)
      setError("Lote inválido.")
      return
    }
    let cancelado = false
    obtenerLote(codigo)
      .then((lote) => {
        if (cancelado) return
        if (!lote) {
          setError("No se encontró el lote.")
          return
        }
        setLoteInfo(lote)
      })
      .catch((err) => {
        if (cancelado) return
        setError(
          err instanceof InventarioApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [codigo])

  async function manejarRegistrar() {
    if (!loteInfo) return
    if (!cliName.trim()) {
      toast({
        variant: "error",
        title: "Falta el nombre",
        description: "Ingresa el nombre del cliente.",
      })
      return
    }
    setGuardando(true)
    try {
      const proceso = await registrarVentaHistorica({
        cliLote: codigo,
        idPry: loteInfo.id_proyecto,
        cliName: cliName.trim(),
        identificacion: identificacion.trim() || undefined,
      })
      toast({ variant: "success", description: "Venta registrada." })
      router.push(`/gestion/refinanciamiento/new/${proceso.id}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo registrar la venta",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

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
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                Registrar venta histórica
              </h1>
              <p className="text-muted-foreground text-[13px]">
                Este lote ya está vendido pero no tiene un proceso registrado — completa
                lo básico para poder refinanciarlo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4.5 px-4 py-5 sm:gap-5.5 sm:px-7.5 sm:py-6.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !loteInfo ? (
              <EmptyState
                title="No se puede abrir este lote"
                description={error ?? "No se encontró el lote."}
                dashed
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <StaticField
                    label="PROYECTO"
                    value={loteInfo.proyecto?.nombre ?? "—"}
                  />
                  <StaticField label="LOTE" value={loteInfo.codigo} mono emphasis />
                  <StaticField
                    label="VALOR DEL LOTE"
                    value={formatearMoneda(loteInfo.pvp)}
                    mono
                  />
                  <StaticField
                    label="MTS. LOTE"
                    value={formatearMetraje(loteInfo.areaUtil)}
                    mono
                  />
                </div>

                <div className="border-border flex flex-col gap-3.5 rounded-lg border p-5">
                  <div className="text-muted-foreground text-xs font-bold tracking-wide">
                    DATOS DEL CLIENTE
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label="Nombre completo"
                      value={cliName}
                      onChange={setCliName}
                      placeholder="Nombre del cliente"
                    />
                    <TextField
                      label="Cédula / identificación"
                      value={identificacion}
                      onChange={setIdentificacion}
                      placeholder="Opcional"
                    />
                  </div>
                  <Button
                    disabled={guardando || !cliName.trim()}
                    onClick={manejarRegistrar}
                  >
                    {guardando ? "Registrando…" : "Registrar y continuar a refinanciar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
