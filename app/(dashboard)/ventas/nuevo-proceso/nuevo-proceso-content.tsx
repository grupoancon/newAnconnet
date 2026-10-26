"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { useRouter, useSearchParams } from "@/lib/navigation"

import { ComboboxField, type ComboboxOption } from "@/components/shared/combobox-field"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { MultiSelectField } from "@/components/shared/multi-select-field"
import { SelectField, StaticField } from "@/components/shared/select-field"
import { useSession } from "@/components/shared/session-provider"
import {
  ASESORES,
  ESTADOS_CIVILES,
  LUGARES_VENTA_OPCIONES,
  SEXOS,
} from "@/components/shared/select-options"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import { buscarOrdenSapPorLote, SapsApiError } from "@/lib/api/saps-api"
import {
  VentasApiError,
  consultarVentaUrgente,
  crearProceso,
  esVentaUrgente,
  validarLoteParaProceso,
} from "@/lib/api/ventas-api"
import { nacionalidades } from "@/lib/const/nacionalidades"
import { validarIdentificacion } from "@/lib/validations/identificacion"

const OPCIONES_NACIONALIDAD: ComboboxOption[] = nacionalidades.map((n) => ({
  value: n.nacionalidad,
  label: n.nacionalidad,
  keywords: n.pais,
}))

function formatearPrecio(valor: string | number | null | undefined): string {
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

export function NuevoProcesoContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const lote = searchParams.get("lote") ?? ""
  const usuario = useSession()
  // El asesor logeado va preseleccionado y no se puede quitar desde este selector —
  // solo si su nombre calza exacto con uno de la lista de ASESORES (si no esta en la
  // lista, se deja el campo vacio como antes, sin inventarle una opcion).
  const asesorLogeado = ASESORES.includes(usuario.nombre) ? usuario.nombre : null

  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [asesor, setAsesor] = useState<string[]>(asesorLogeado ? [asesorLogeado] : [])
  const [lugarVenta, setLugarVenta] = useState("")
  const [nombres, setNombres] = useState("")
  const [identificacion, setIdentificacion] = useState("")
  const [estadoCivil, setEstadoCivil] = useState("")
  const [fechaNacimiento, setFechaNacimiento] = useState("")
  const [sexo, setSexo] = useState("")
  const [nacionalidad, setNacionalidad] = useState("")
  const [creando, setCreando] = useState(false)

  const errorIdentificacion = validarIdentificacion(identificacion)
  // Lo minimo que pide crear un proceso: lote ya cargado, al menos un asesor, lugar de
  // venta, y todos los datos del cliente (nombre, identificacion valida, estado civil,
  // fecha de nacimiento, sexo, nacionalidad) — se guardan como titular del proceso en
  // process_users.
  const puedeCrear =
    Boolean(loteInfo) &&
    asesor.length > 0 &&
    Boolean(lugarVenta) &&
    Boolean(nombres) &&
    Boolean(identificacion) &&
    !errorIdentificacion &&
    Boolean(estadoCivil) &&
    Boolean(fechaNacimiento) &&
    Boolean(sexo) &&
    Boolean(nacionalidad)

  function manejarCambioAsesor(siguiente: string[]) {
    if (asesorLogeado && !siguiente.includes(asesorLogeado)) {
      setAsesor([asesorLogeado, ...siguiente])
      return
    }
    setAsesor(siguiente)
  }

  async function manejarCrear() {
    if (!loteInfo || !puedeCrear) return
    setCreando(true)
    try {
      await crearProceso({
        cli_name: nombres,
        identificacion,
        nacionalidad,
        sexo,
        estado_civil: estadoCivil,
        fecha_nacimiento: fechaNacimiento,
        cli_asesor: asesor.join(","),
        id_pry: loteInfo.id_proyecto,
        cli_lote: loteInfo.codigo,
        lote_price: Number(loteInfo.pvp) || 0,
        lote_mts: Number(loteInfo.areaUtil) || 0,
        location: lugarVenta,
      })
      toast({ variant: "success", description: "Proceso creado correctamente." })
      router.push(`/ventas/procesos?lote=${encodeURIComponent(loteInfo.codigo)}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo crear el proceso",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setCreando(false)
    }
  }

  useEffect(() => {
    if (!lote) {
      setCargando(false)
      setError("No se especificó un lote.")
      return
    }
    let cancelado = false

    async function verificarLote() {
      setCargando(true)
      setError(null)
      try {
        // La venta urgente pasa por encima de todo lo demas: si el backend la
        // reconoce para este lote, se salta validarLoteParaProceso y
        // buscarOrdenSapPorLote por completo (solo hace falta la info para mostrarla).
        const ventaUrgente = await consultarVentaUrgente(lote)
        if (cancelado) return

        if (esVentaUrgente(ventaUrgente)) {
          const info = await obtenerLote(lote)
          if (cancelado) return
          if (!info?.codigo) {
            setError("Este lote no existe.")
            return
          }
          setLoteInfo(info)
          return
        }

        // No es venta urgente: se validan las dos vias de siempre — que el backend lo
        // marque como valido para un proceso nuevo, y que SAP no tenga ya una orden
        // abierta para el (entrar por URL directamente tambien debe respetar esto, no
        // solo el boton "Crear proceso").
        const [info, validacion, orden] = await Promise.all([
          obtenerLote(lote),
          validarLoteParaProceso(lote),
          buscarOrdenSapPorLote(lote),
        ])
        if (cancelado) return

        const problemas: string[] = []
        // Si el backend no lanza un error real para un codigo inexistente (200 con
        // cuerpo vacio/null en vez de 404), se detecta aca por la falta del campo
        // `codigo` — sin esto el formulario se mostraba igual, con todo en "—".
        if (!info?.codigo) {
          problemas.push("Este lote no existe.")
        }
        if (orden.encontrada && !orden.cerrada) {
          problemas.push("Este lote ya tiene un proceso en SAP en curso.")
        }
        if (!validacion.valido) {
          problemas.push("Este lote no es válido para crear un proceso de venta.")
        }
        if (problemas.length > 0) {
          setError(problemas.join(" "))
          return
        }
        setLoteInfo(info)
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof InventarioApiError ||
            err instanceof VentasApiError ||
            err instanceof SapsApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    verificarLote()

    return () => {
      cancelado = true
    }
  }, [lote])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-brand-gradient-banner mb-6 flex items-center gap-3.5 rounded-lg px-7 py-5.5">
          <div className="flex size-9.5 shrink-0 items-center justify-center rounded-md bg-white/20">
            <CheckCircle2 className="size-5 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            Crear nuevo proceso de venta
          </h1>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState title="No se puede crear el proceso" description={error} dashed />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <StaticField label="Proyecto" value={loteInfo?.proyecto?.nombre ?? "—"} />
              <StaticField label="Lote" value={loteInfo?.codigo ?? lote} mono emphasis />
              <StaticField
                label="Precio del lote"
                value={formatearPrecio(loteInfo?.pvp)}
                mono
              />
              <StaticField
                label="Mts"
                value={formatearMetraje(loteInfo?.areaUtil)}
                mono
              />
              <SelectField
                label="Lugar de venta"
                placeholder="Seleccione lugar de venta"
                opciones={LUGARES_VENTA_OPCIONES}
                value={lugarVenta}
                onValueChange={setLugarVenta}
              />
              <MultiSelectField
                label="Asesor"
                placeholder="Seleccione asesor(es)"
                options={ASESORES}
                value={asesor}
                onChange={manejarCambioAsesor}
                bloqueados={asesorLogeado ? [asesorLogeado] : []}
              />
              <TextField
                label="Apellidos y nombres"
                value={nombres}
                onChange={(valor) => setNombres(valor.toUpperCase())}
              />
              <TextField
                label="Identificación"
                placeholder="Cédula, RUC o pasaporte"
                value={identificacion}
                onChange={setIdentificacion}
                error={errorIdentificacion}
              />
              <SelectField
                label="Estado civil"
                placeholder="Estado civil"
                options={ESTADOS_CIVILES}
                value={estadoCivil}
                onValueChange={setEstadoCivil}
              />
              <TextField
                label="Fecha nacimiento"
                type="date"
                value={fechaNacimiento}
                onChange={setFechaNacimiento}
              />
              <SelectField
                label="Sexo"
                placeholder="Sexo"
                options={SEXOS}
                value={sexo}
                onValueChange={setSexo}
              />
              <ComboboxField
                label="Nacionalidad"
                placeholder="Seleccione nacionalidad"
                searchPlaceholder="Buscar por nacionalidad o país…"
                options={OPCIONES_NACIONALIDAD}
                value={nacionalidad}
                onChange={setNacionalidad}
              />
            </div>

            <div className="mt-7 flex gap-3">
              <Button
                variant="dark"
                disabled={!puedeCrear || creando}
                onClick={manejarCrear}
              >
                {creando ? "Creando…" : "Crear"}
              </Button>
              <Button variant="outline" onClick={() => router.back()} disabled={creando}>
                Volver
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
