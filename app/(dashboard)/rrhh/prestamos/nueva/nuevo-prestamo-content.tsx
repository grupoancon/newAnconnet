"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Save } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { SelectField, StaticField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import {
  MESES_COBRO,
  PLAZOS_PRESTAMO,
  TIPOS_PRESTAMO,
} from "@/components/shared/select-options"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  RrhhApiError,
  crearPrestamo,
  obtenerMiPerfilRrhh,
  type PerfilRrhh,
} from "@/lib/api/rrhh-api"

// La fecha de la solicitud (permiso o préstamo) tiene que ser posterior a hoy — nunca
// hoy mismo ni una fecha pasada (ver RrhhService.assertFechaPosteriorAHoy, que aplica
// la misma regla del lado del backend).
function manana(): string {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

export function NuevoPrestamoContent() {
  const router = useRouter()
  const toast = useToast()

  const [perfil, setPerfil] = useState<PerfilRrhh | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [detalle, setDetalle] = useState("")
  const [valor, setValor] = useState("")
  const [tipoPrestamo, setTipoPrestamo] = useState("")
  const [plazos, setPlazos] = useState("")
  const [mesCobro, setMesCobro] = useState("")
  const [fecha, setFecha] = useState("")

  useEffect(() => {
    obtenerMiPerfilRrhh()
      .then(setPerfil)
      .catch(() => {
        // Silencioso: si falla, "Departamento"/"Cargo" quedan vacíos pero el
        // formulario sigue usándose — el backend igual los resuelve al guardar.
      })
      .finally(() => setCargando(false))
  }, [])

  // Fecha, tipo de préstamo, plazos y mes de cobro son obligatorios — el monto se
  // valida aparte (puede ser cero mientras se escribe), así que no entra acá.
  const puedeGuardar = Boolean(fecha && tipoPrestamo && plazos && mesCobro)

  async function manejarGuardar() {
    const valorNumero = Number(valor)
    if (!valor || isNaN(valorNumero) || valorNumero <= 0) {
      toast({
        variant: "error",
        title: "Falta el monto",
        description: "Ingresa un monto de préstamo mayor a 0.",
      })
      return
    }
    if (!fecha || !tipoPrestamo || !plazos || !mesCobro) {
      toast({
        variant: "error",
        title: "Faltan datos",
        description:
          "Selecciona la fecha, el tipo de préstamo, los plazos y el mes de cobro.",
      })
      return
    }
    setGuardando(true)
    try {
      await crearPrestamo({
        valor: valorNumero,
        tipoPrestamo,
        plazos,
        mesCobro,
        fecha,
        detalle: detalle.trim() || undefined,
      })
      toast({ variant: "success", description: "Solicitud de préstamo creada." })
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
                Crea tu solicitud de préstamo / anticipo
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
                  <StaticField label="Departamento" value={perfil?.departamento ?? "—"} />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <StaticField label="Cargo" value={perfil?.cargo ?? "—"} />
                  <DatePickerField
                    label="Fecha"
                    value={fecha}
                    onChange={setFecha}
                    fechaMinima={manana()}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <TextField
                    label="Préstamo"
                    type="number"
                    placeholder="0"
                    value={valor}
                    onChange={setValor}
                  />
                  <SelectField
                    label="Tipo de préstamo"
                    placeholder="Seleccione un tipo"
                    options={TIPOS_PRESTAMO}
                    value={tipoPrestamo}
                    onValueChange={setTipoPrestamo}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                      Detalle
                    </label>
                    <Textarea
                      placeholder="Escriba aquí el detalle de su solicitud…"
                      value={detalle}
                      onChange={(event) => setDetalle(event.target.value)}
                      className="min-h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <SelectField
                    label="Plazos"
                    placeholder="Seleccione el plazo"
                    options={PLAZOS_PRESTAMO}
                    value={plazos}
                    onValueChange={setPlazos}
                  />
                  <SelectField
                    label="Mes de cobro"
                    placeholder="Seleccione el mes"
                    options={MESES_COBRO}
                    value={mesCobro}
                    onValueChange={setMesCobro}
                  />
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
