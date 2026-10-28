"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Save } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { StaticField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  RrhhApiError,
  crearSolicitudVacacion,
  obtenerMiPerfilRrhh,
  type PerfilRrhh,
} from "@/lib/api/rrhh-api"

// Desde mañana en adelante — mismo criterio que VacacionesService.crearSolicitud del
// lado del backend.
function manana(): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

// Días calendario, contando inicio y fin — misma fórmula que
// VacacionesService.calcularDias: solo para la vista previa, el backend recalcula al
// guardar.
function calcularDias(fechaInicio: string, fechaFin: string): number {
  if (!fechaInicio || !fechaFin || fechaFin < fechaInicio) return 0
  const inicio = new Date(`${fechaInicio}T00:00:00Z`)
  const fin = new Date(`${fechaFin}T00:00:00Z`)
  return Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1
}

export function NuevaVacacionContent() {
  const router = useRouter()
  const toast = useToast()

  const [perfil, setPerfil] = useState<PerfilRrhh | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [detalle, setDetalle] = useState("")

  useEffect(() => {
    obtenerMiPerfilRrhh()
      .then(setPerfil)
      .catch(() => {
        // Silencioso: si falla, "Solicitante" queda vacío pero el formulario sigue
        // usándose — el backend igual resuelve el departamento al guardar.
      })
      .finally(() => setCargando(false))
  }, [])

  // Si mueve el inicio después del fin, el fin elegido deja de valer.
  useEffect(() => {
    if (fechaFin && fechaInicio && fechaFin < fechaInicio) setFechaFin("")
  }, [fechaInicio, fechaFin])

  const dias = useMemo(() => calcularDias(fechaInicio, fechaFin), [fechaInicio, fechaFin])
  const fechaCreacion = useMemo(() => new Date().toLocaleString("es-EC"), [])

  const puedeGuardar = Boolean(fechaInicio && fechaFin && dias > 0)

  async function manejarGuardar() {
    if (!puedeGuardar) {
      toast({
        variant: "error",
        title: "Faltan las fechas",
        description: "Elige la fecha de inicio y la fecha de fin de tus vacaciones.",
      })
      return
    }
    setGuardando(true)
    try {
      await crearSolicitudVacacion({
        fechaInicio,
        fechaFin,
        detalle: detalle.trim() || undefined,
      })
      toast({ variant: "success", description: "Solicitud de vacaciones creada." })
      router.push("/rrhh?tab=vacaciones")
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar la solicitud",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border mx-auto max-w-3xl overflow-hidden rounded-lg border">
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
                Crea tu solicitud de vacaciones
              </h1>
            </div>
          </div>

          <div className="flex flex-col gap-4.5 px-4 py-5 sm:gap-5.5 sm:px-7.5 sm:py-6.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StaticField
                    label="Solicitante"
                    value={perfil?.nombre ?? "—"}
                    emphasis
                  />
                  <StaticField label="Fecha de creación" value={fechaCreacion} mono />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <DatePickerField
                    label="Desde"
                    value={fechaInicio}
                    onChange={setFechaInicio}
                    fechaMinima={manana()}
                  />
                  <DatePickerField
                    label="Hasta"
                    value={fechaFin}
                    onChange={setFechaFin}
                    fechaMinima={fechaInicio || manana()}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StaticField
                    label="Días solicitados"
                    value={dias > 0 ? `${dias} ${dias === 1 ? "día" : "días"}` : "—"}
                    mono
                  />
                  <div>
                    <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                      Detalle
                    </label>
                    <Textarea
                      placeholder="Escriba aquí el detalle de su solicitud…"
                      value={detalle}
                      onChange={(event) => setDetalle(event.target.value)}
                      className="min-h-22"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button disabled={guardando || !puedeGuardar} onClick={manejarGuardar}>
                    <Save className="size-3.5" strokeWidth={1.8} />
                    {guardando ? "Guardando…" : "Guardar solicitud"}
                  </Button>
                  <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                    Volver
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
