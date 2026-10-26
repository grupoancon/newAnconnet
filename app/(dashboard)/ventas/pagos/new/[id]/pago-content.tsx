"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { ArrowLeft, Save } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { SelectField, StaticField } from "@/components/shared/select-field"
import {
  BANCOS_RECEPTORES,
  CUENTAS_BANCOS_RECEPTORES,
  TIPOS_PAGO,
} from "@/components/shared/select-options"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  crearPago,
  actualizarPago,
  obtenerFinanciamiento,
  obtenerPago,
  obtenerProceso,
  type FinanciamientoBackend,
  type PagoBackend,
  type PagoInput,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"

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

// finan_status/offert_status del proceso son los que gobiernan si se puede ingresar el
// pago (ver pagoHabilitado en procesos-content.tsx) — esta pantalla repite la misma
// validación acá porque se puede llegar por URL directa, no solo tocando el botón ya
// deshabilitado de la tabla de procesos.
function estaAprobado(crudo: string | null | undefined): boolean {
  return (crudo ?? "").trim().toLowerCase() === "aprobado"
}

// El valor del pago nunca lo escribe el asesor: es el abono inicial ya definido en el
// financiamiento aprobado (misma fila que usa financiamiento-reporte-content.tsx en su
// tabla "Forma de pago") — mismo criterio que aplica el backend en
// PagoService.resolverValorAbonoInicial, acá solo se refleja para mostrarlo.
function resolverAbonoInicial(
  financiamiento: FinanciamientoBackend | null
): number | null {
  const entradas = financiamiento?.entradas ?? []
  const fila = entradas.find((f) => f.forma_pago === "Abono inicial") ?? entradas[0]
  const valor = fila?.abono_lote
  return valor && valor > 0 ? valor : null
}

export function PagoContent({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const idNumero = Number(id)
  // Pago no tiene fase de "borrador" (queda "ingresado" desde que se crea, ver
  // PAGO_ESTADO_INGRESADO en pago.service.ts) — a diferencia de financiamiento/oferta,
  // acá no hace falta mirar ningún estado intermedio: si ya existe un pago para este
  // proceso, reabrirlo para corregirlo exige "pago:editar"; si no existe todavía,
  // alcanza con "ventas:crear".
  const puedeCrear = useCan("ventas:crear")
  const puedeEditarExistente = useCan("pago:editar")

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [financiamiento, setFinanciamiento] = useState<FinanciamientoBackend | null>(null)
  const [pagoExistente, setPagoExistente] = useState<PagoBackend | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [tipoPago, setTipoPago] = useState("")
  const [institucionFinanciera, setInstitucionFinanciera] = useState("")
  const [refPago, setRefPago] = useState("")
  const [fecPago, setFecPago] = useState("")
  const [comentario, setComentario] = useState("")
  const [otroMonto, setOtroMonto] = useState(false)
  const [montoPersonalizado, setMontoPersonalizado] = useState("")

  useEffect(() => {
    if (!idNumero || Number.isNaN(idNumero)) {
      setCargando(false)
      setError("Proceso inválido.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const procesoData = await obtenerProceso(idNumero)
        if (cancelado) return
        if (!procesoData) {
          setError("No se encontró el proceso.")
          return
        }
        setProceso(procesoData)

        const [lote, financiamientoData, pagoData] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          obtenerFinanciamiento(idNumero),
          obtenerPago(idNumero),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setFinanciamiento(financiamientoData)
        setPagoExistente(pagoData)

        if (pagoData) {
          setTipoPago(pagoData.tipo_pago ?? "")
          setInstitucionFinanciera(pagoData.institucion_financiera ?? "")
          setRefPago(pagoData.ref_pago ?? "")
          setFecPago(pagoData.fec_pago?.slice(0, 10) ?? "")
          setComentario(pagoData.comentario ?? "")

          const esOtroMonto =
            Number(pagoData.valor_total) !== Number(pagoData.valor_esperado)
          setOtroMonto(esOtroMonto)
          setMontoPersonalizado(esOtroMonto ? String(pagoData.valor_total) : "")
        }
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
  }, [idNumero])

  const titular = proceso?.titular ?? null
  const financieramientoAprobado = estaAprobado(proceso?.finan_status)
  const ofertaAprobada = estaAprobado(proceso?.offert_status)
  const puedeIngresarPago = financieramientoAprobado && ofertaAprobada
  const abonoInicial = resolverAbonoInicial(financiamiento)

  async function manejarGuardar() {
    if (!tipoPago || !fecPago) {
      toast({
        variant: "warning",
        description: "Completa el tipo de pago y la fecha de pago.",
      })
      return
    }
    let valorTotal: number | undefined
    if (otroMonto) {
      valorTotal = parseFloat(montoPersonalizado)
      if (!valorTotal || valorTotal <= 0) {
        toast({ variant: "warning", description: "Ingresa un monto válido." })
        return
      }
    } else if (!abonoInicial) {
      toast({
        variant: "error",
        description:
          "No se encontró el abono inicial del financiamiento de este proceso.",
      })
      return
    }

    const datos: PagoInput = {
      tipoPago,
      refPago: refPago.trim() || undefined,
      fecPago,
      institucionFinanciera: institucionFinanciera || undefined,
      comentario: comentario.trim() || undefined,
      valorTotal,
    }

    setGuardando(true)
    try {
      if (pagoExistente) {
        await actualizarPago(idNumero, datos)
      } else {
        await crearPago(idNumero, datos)
      }
      toast({ variant: "success", description: "Pago guardado." })
      router.push(`/ventas/pagos/reporte/${idNumero}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar el pago",
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
            <h1 className="text-xl font-extrabold tracking-tight">Registro de pago</h1>
          </div>

          <div className="flex flex-col gap-4.5 px-4 py-5 sm:gap-5.5 sm:px-7.5 sm:py-6.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !proceso ? (
              <EmptyState
                title="No se puede abrir el pago"
                description={error ?? "No se encontró el proceso."}
                dashed
              />
            ) : !(pagoExistente ? puedeEditarExistente : puedeCrear) ? (
              <EmptyState
                title="No tienes permiso para esta sección"
                description={
                  pagoExistente
                    ? "No tenés el permiso necesario para editar un pago ya ingresado."
                    : "No tenés el permiso necesario para ingresar pagos."
                }
                dashed
              />
            ) : !puedeIngresarPago ? (
              <EmptyState
                title="Todavía no se puede ingresar el pago"
                description="La oferta y el financiamiento de este proceso deben estar los dos aprobados antes de registrar un pago."
                dashed
              />
            ) : (
              <>
                <div className="border-border flex flex-col gap-3.5 rounded-lg border p-5">
                  <div className="text-muted-foreground text-xs font-bold tracking-wide">
                    INFORMACIÓN DEL PAGO
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    <StaticField
                      label="Nombre cliente"
                      value={titular?.nombre ?? "—"}
                      emphasis
                    />
                    <StaticField
                      label="Proyecto"
                      value={loteInfo?.proyecto?.nombre ?? "—"}
                    />
                    <StaticField
                      label="Lote"
                      value={loteInfo?.codigo ?? proceso.cli_lote ?? "—"}
                      mono
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    <StaticField
                      label="N.º de recibo"
                      value={pagoExistente?.no_recibo ?? "Se genera al guardar"}
                      mono
                    />
                    <SelectField
                      label="Tipo de pago"
                      placeholder="Seleccione"
                      options={TIPOS_PAGO}
                      value={tipoPago}
                      onValueChange={setTipoPago}
                    />
                    <TextField
                      label="Fecha de pago realizado"
                      type="date"
                      value={fecPago}
                      onChange={setFecPago}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <SelectField
                      label="Institución financiera receptora"
                      placeholder="Seleccione el banco"
                      options={BANCOS_RECEPTORES}
                      value={institucionFinanciera}
                      onValueChange={setInstitucionFinanciera}
                    />
                    <TextField
                      label="N.º y tipo de cuenta destino"
                      value={CUENTAS_BANCOS_RECEPTORES[institucionFinanciera] ?? ""}
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <StaticField
                        label="Valor total"
                        value={abonoInicial ? formatearMoneda(abonoInicial) : "—"}
                        mono
                        emphasis
                      />
                      <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs">
                        <Checkbox
                          checked={otroMonto}
                          onCheckedChange={(marcado) => setOtroMonto(marcado === true)}
                        />
                        Otro monto
                      </label>
                    </div>
                    <TextField
                      label="N.º de comprobante"
                      placeholder="Ej. número de transferencia o de cheque"
                      value={refPago}
                      onChange={setRefPago}
                    />
                  </div>
                  {otroMonto && (
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <TextField
                        label="Monto pagado"
                        type="number"
                        placeholder="0.00"
                        value={montoPersonalizado}
                        onChange={setMontoPersonalizado}
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                      Comentarios
                    </Label>
                    <Textarea
                      value={comentario}
                      onChange={(event) => setComentario(event.target.value)}
                      placeholder="Ingrese comentarios o notas adicionales sobre este pago"
                    />
                  </div>
                </div>

                <div className="border-border mt-2 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-5.5 [&>button]:w-full sm:[&>button]:w-auto">
                  <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                    Cancelar
                  </Button>
                  <Button disabled={guardando} onClick={manejarGuardar}>
                    <Save className="size-3.5" strokeWidth={1.8} />
                    {guardando ? "Guardando…" : "Guardar"}
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
