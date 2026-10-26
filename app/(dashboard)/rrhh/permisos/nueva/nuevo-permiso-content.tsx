"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Save } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { SelectField, StaticField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { TIPOS_PERMISO } from "@/components/shared/select-options"
import { TimePickerField } from "@/components/shared/time-picker-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  RrhhApiError,
  crearPermiso,
  obtenerMiPerfilRrhh,
  type PerfilRrhh,
} from "@/lib/api/rrhh-api"

// La fecha del permiso tiene que ser posterior a hoy — nunca hoy mismo ni una fecha
// pasada (ver RrhhService.assertFechaPosteriorAHoy, que aplica la misma regla del
// lado del backend).
function manana(): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

// "2h 15min" / "2h" / "15min" — misma fórmula que RrhhService.calcularHorasSolicitadas
// (anconAPI): solo para la vista previa en vivo, el backend recalcula igual al
// guardar (nunca confía en lo que mande el cliente).
function calcularHorasSolicitadas(horaInicial: string, horaFinal: string): string {
  if (!horaInicial || !horaFinal) return "0min"
  const [hi, mi] = horaInicial.split(":").map((n) => Number(n) || 0)
  const [hf, mf] = horaFinal.split(":").map((n) => Number(n) || 0)
  const inicioMin = hi * 60 + mi
  let finMin = hf * 60 + mf
  if (finMin < inicioMin) finMin += 24 * 60
  const diffMin = finMin - inicioMin
  const horas = Math.floor(diffMin / 60)
  const minutos = diffMin % 60
  if (horas > 0 && minutos > 0) return `${horas}h ${minutos}min`
  if (horas > 0) return `${horas}h`
  return `${minutos}min`
}

export function NuevoPermisoContent() {
  const router = useRouter()
  const toast = useToast()

  const [perfil, setPerfil] = useState<PerfilRrhh | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [fechaPermiso, setFechaPermiso] = useState("")
  const [horaInicial, setHoraInicial] = useState("")
  const [horaFinal, setHoraFinal] = useState("")
  const [tipoPermiso, setTipoPermiso] = useState("")
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

  const horasSolicitadas = useMemo(
    () => calcularHorasSolicitadas(horaInicial, horaFinal),
    [horaInicial, horaFinal]
  )

  const fechaCreacion = useMemo(() => new Date().toLocaleString("es-EC"), [])

  // Fecha, ambas horas y tipo de permiso son obligatorios — "Guardar solicitud" queda
  // deshabilitado hasta completarlos, en vez de dejar que el asesor le dé al botón y
  // recién ahí enterarse por un toast de qué falta.
  const puedeGuardar = Boolean(fechaPermiso && horaInicial && horaFinal && tipoPermiso)

  async function manejarGuardar() {
    if (!fechaPermiso) {
      toast({
        variant: "error",
        title: "Falta la fecha",
        description: "Elige la fecha del permiso.",
      })
      return
    }
    if (!horaInicial || !horaFinal) {
      toast({
        variant: "error",
        title: "Faltan las horas",
        description: "Ingresa la hora inicial y la hora final del permiso.",
      })
      return
    }
    if (!tipoPermiso) {
      toast({
        variant: "error",
        title: "Falta el tipo de permiso",
        description: "Selecciona un tipo de permiso.",
      })
      return
    }
    setGuardando(true)
    try {
      await crearPermiso({
        fechaPermiso,
        horaInicial,
        horaFinal,
        tipoPermiso,
        detalle: detalle.trim() || undefined,
      })
      toast({ variant: "success", description: "Solicitud de permiso creada." })
      router.push("/rrhh")
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
                Crea tu solicitud de permiso
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
                  <DatePickerField
                    label="Fecha de permiso"
                    value={fechaPermiso}
                    onChange={setFechaPermiso}
                    fechaMinima={manana()}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <TimePickerField
                    label="Hora inicial del permiso"
                    value={horaInicial}
                    onChange={setHoraInicial}
                  />
                  <TimePickerField
                    label="Hora final del permiso"
                    value={horaFinal}
                    onChange={setHoraFinal}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StaticField label="Fecha de creación" value={fechaCreacion} mono />
                  <SelectField
                    label="Tipo de permiso"
                    placeholder="Seleccione un tipo de permiso"
                    options={TIPOS_PERMISO}
                    value={tipoPermiso}
                    onValueChange={setTipoPermiso}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StaticField label="Horas solicitadas" value={horasSolicitadas} mono />
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
