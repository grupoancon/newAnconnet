"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import { CheckCircle2, Flag, Pencil, Printer, Undo2 } from "lucide-react"

import { Can } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { LUGARES_VENTA_OPCIONES } from "@/components/shared/select-options"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  aprobarOferta,
  devolverOferta,
  listarClientesExtra,
  listarObservacionesPendientes,
  obtenerDatosFinancieros,
  obtenerFinanciamiento,
  obtenerLicitudFondos,
  obtenerOferta,
  obtenerProceso,
  type ClienteExtraBackend,
  type DatosFinancierosBackend,
  type FinanciamientoBackend,
  type LicitudFondosBackend,
  type ObservacionOfertaBackend,
  type ObservacionOfertaInput,
  type OfertaBackend,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"
import { separarTelefono } from "@/lib/const/codigos-telefonicos"
import { cn } from "@/lib/utils"

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

function labelLugarVenta(valor: string | null | undefined): string {
  if (!valor) return "—"
  return LUGARES_VENTA_OPCIONES.find((opcion) => opcion.value === valor)?.label ?? valor
}

function calcularEdad(fechaNacimiento?: string | Date | null): string {
  if (!fechaNacimiento) return "—"
  const nacimiento = new Date(fechaNacimiento)
  if (isNaN(nacimiento.getTime())) return "—"
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return `${edad} años`
}

function telefonoLegible(valor: string | null | undefined): string {
  if (!valor) return "—"
  const { prefijo, numero } = separarTelefono(valor)
  return numero ? `${prefijo} ${numero}` : "—"
}

// Igual mapeo que procesos-content.tsx (repo newAnconnet): 'Aprobado' (capitalizado,
// el unico valor que exige validateCreateProcess en el backend) y 'ingresado' quedan
// normalizados a minuscula para StatusBadge.
function normalizarEstado(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "aprobado" || clave === "ingresado" || clave === "rechazado") return clave
  return "pendiente"
}

type CampoReporte = { campo: string; label: string; valor: string }

function seccion(
  titulo: string,
  campos: CampoReporte[]
): { titulo: string; campos: CampoReporte[] } {
  return { titulo, campos }
}

export function OfertaReporteContent({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const idNumero = Number(id)

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [oferta, setOferta] = useState<OfertaBackend | null>(null)
  const [financieros, setFinancieros] = useState<DatosFinancierosBackend | null>(null)
  const [financiamiento, setFinanciamiento] = useState<FinanciamientoBackend | null>(null)
  const [licitud, setLicitud] = useState<LicitudFondosBackend | null>(null)
  const [clientesExtra, setClientesExtra] = useState<ClienteExtraBackend[]>([])
  const [observaciones, setObservaciones] = useState<ObservacionOfertaBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  // Campos marcados como incorrectos en esta sesión de revisión — campo -> comentario.
  const [marcados, setMarcados] = useState<
    Record<string, { label: string; comentario: string }>
  >({})

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

        const [
          lote,
          ofertaData,
          financierosData,
          financiamientoData,
          licitudData,
          extra,
          obs,
        ] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          obtenerOferta(idNumero),
          obtenerDatosFinancieros(idNumero),
          obtenerFinanciamiento(idNumero),
          obtenerLicitudFondos(idNumero),
          listarClientesExtra(idNumero),
          listarObservacionesPendientes(idNumero),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setOferta(ofertaData)
        setFinancieros(financierosData)
        setFinanciamiento(financiamientoData)
        setLicitud(licitudData)
        setClientesExtra(extra)
        setObservaciones(obs)

        if (!ofertaData) {
          setError("Este proceso todavía no tiene una oferta ingresada.")
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
  const estado = normalizarEstado(oferta?.cli_state)
  // Quien puede aprobar/devolver se controla solo con el permiso "ofertas:revisar"
  // (ver <Can> más abajo) — no importa si es la misma persona que creó el proceso. En
  // la práctica ese permiso solo se asigna a roles de supervisor/revisor, nunca al rol
  // "Asesor de Ventas", así que ya queda cubierto que un asesor no apruebe su propia
  // oferta en el uso normal.
  const puedeDecidir = estado === "ingresado"

  // Descuento y ofrecimientos ya no son datos propios de la oferta: vienen del
  // financiamiento del proceso (mismo criterio que financiamiento-reporte-content.tsx)
  // para que los dos reportes siempre muestren la misma cifra. Si el proceso todavía no
  // tiene financiamiento, se muestra "—" en vez de intentar calcular nada.
  const valorLoteNumero = Number(loteInfo?.pvp ?? proceso?.lote_price ?? 0)
  const descuentoTipo =
    Number(financiamiento?.discount) ||
    (financiamiento?.financ_type === "Contado"
      ? valorLoteNumero * 0.05
      : financiamiento?.financ_type === "Crédito BIESS"
        ? valorLoteNumero * 0.03
        : 0)
  const descuentoFinanciamiento = financiamiento
    ? descuentoTipo + (Number(financiamiento.extra_discount) || 0)
    : null

  const secciones = useMemo<Array<{ titulo: string; campos: CampoReporte[] }>>(() => {
    if (!oferta) return []
    return [
      seccion("Cliente", [
        {
          campo: "cli_edad",
          label: "Edad",
          valor: calcularEdad(titular?.fecha_nacimiento),
        },
        {
          campo: "cli_telef",
          label: "Teléfono",
          valor: telefonoLegible(oferta.cli_telef),
        },
        { campo: "cli_mail", label: "Correo electrónico", valor: oferta.cli_mail ?? "—" },
        { campo: "cli_pais", label: "País", valor: oferta.cli_pais ?? "—" },
        {
          campo: "cli_provin",
          label: "Provincia / Estado",
          valor: oferta.cli_provin ?? "—",
        },
        { campo: "cli_ciudad", label: "Ciudad", valor: oferta.cli_ciudad ?? "—" },
        { campo: "cli_sector", label: "Sector", valor: oferta.cli_sector ?? "—" },
        {
          campo: "cli_direccion",
          label: "Dirección del hogar",
          valor: oferta.cli_direccion ?? "—",
        },
        {
          campo: "cli_descuento",
          label: "Descuento",
          valor:
            descuentoFinanciamiento != null
              ? formatearPrecio(descuentoFinanciamiento)
              : "—",
        },
        {
          campo: "cli_ofrecimiento",
          label: "Ofrecimientos",
          valor: financiamiento?.ofrecimientos ?? "—",
        },
        {
          campo: "lugar_venta",
          label: "Lugar de venta",
          valor: labelLugarVenta(proceso?.location),
        },
      ]),
      seccion("Trabajo", [
        {
          campo: "cli_trabActividad",
          label: "Actividad",
          valor: oferta.cli_trabActividad ?? "—",
        },
        {
          campo: "cli_trabEmpresa",
          label: "Empresa",
          valor: oferta.cli_trabEmpresa ?? "—",
        },
        { campo: "cli_trabCargo", label: "Cargo", valor: oferta.cli_trabCargo ?? "—" },
        {
          campo: "cli_trabTiempo",
          label: "Ciudad (trabajo)",
          valor: oferta.cli_trabTiempo ?? "—",
        },
        {
          campo: "cli_trabSector",
          label: "Sector (trabajo)",
          valor: oferta.cli_trabSector ?? "—",
        },
        {
          campo: "cli_trabDireccion",
          label: "Dirección (trabajo)",
          valor: oferta.cli_trabDireccion ?? "—",
        },
        {
          campo: "cli_trabTelefono",
          label: "Teléfono (trabajo)",
          valor: telefonoLegible(oferta.cli_trabTelefono),
        },
        {
          campo: "cli_trabIngresos",
          label: "Ingresos / relación",
          valor: oferta.cli_trabIngresos != null ? String(oferta.cli_trabIngresos) : "—",
        },
        { campo: "cli_trabRuc", label: "RUC / nombre", valor: oferta.cli_trabRuc ?? "—" },
        {
          campo: "cli_trabTipoNegocio",
          label: "Negocio",
          valor: oferta.cli_trabTipoNegocio ?? "—",
        },
      ]),
      seccion("Quién efectúa la transacción", [
        ...(oferta.cli_trabActividad === "OTRO"
          ? [
              {
                campo: "cli_transNombre",
                label: "Nombres y apellidos",
                valor: oferta.cli_transNombre ?? "—",
              },
              {
                campo: "cli_transID",
                label: "N.º Cédula / Pasaporte",
                valor: oferta.cli_transID ?? "—",
              },
              {
                campo: "cli_transNacionalidad",
                label: "Nacionalidad",
                valor: oferta.cli_transNacionalidad ?? "—",
              },
              {
                campo: "cli_transProfesion",
                label: "Profesión",
                valor: oferta.cli_transProfesion ?? "—",
              },
              {
                campo: "cli_transCargo",
                label: "Cargo / Posición",
                valor: oferta.cli_transCargo ?? "—",
              },
              {
                campo: "cli_transTelefono",
                label: "Teléfono",
                valor: telefonoLegible(oferta.cli_transTelefono),
              },
              {
                campo: "cli_transDireccion",
                label: "Dirección domicilio",
                valor: oferta.cli_transDireccion ?? "—",
              },
              {
                campo: "cli_transCiudad",
                label: "Ciudad",
                valor: oferta.cli_transCiudad ?? "—",
              },
              {
                campo: "cli_transEstadoCivil",
                label: "Estado civil",
                valor: oferta.cli_transEstadoCivil ?? "—",
              },
              {
                campo: "cli_transIntermediario",
                label: "¿Actúa como intermediario del verdadero dueño de los fondos?",
                valor: oferta.cli_transIntermediario ?? "—",
              },
              ...(oferta.cli_transIntermediario === "Sí"
                ? [
                    {
                      campo: "cli_transRelacionDueno",
                      label: "Relación con el verdadero dueño de los fondos",
                      valor: oferta.cli_transRelacionDueno ?? "—",
                    },
                  ]
                : []),
            ]
          : []),
      ]),
      seccion("Datos financieros", [
        {
          campo: "otrosIngresos",
          label: "Otros ingresos (mensual)",
          valor:
            financieros?.otrosIngresos != null
              ? formatearPrecio(financieros.otrosIngresos)
              : "—",
        },
        {
          campo: "fuenteIngresos",
          label: "Fuente de Ingresos",
          valor: financieros?.fuenteIngresos ?? "—",
        },
        {
          campo: "patrimonio",
          label: "Patrimonio aproximado",
          valor:
            financieros?.patrimonio != null
              ? formatearPrecio(financieros.patrimonio)
              : "—",
        },
        {
          campo: "fuentePatrimonio",
          label: "Fuente de Patrimonio",
          valor: financieros?.fuentePatrimonio ?? "—",
        },
        {
          campo: "ingresoMensual",
          label: "Ingresos mensuales",
          valor:
            financieros?.ingresoMensual != null
              ? formatearPrecio(financieros.ingresoMensual)
              : "—",
        },
        {
          campo: "gastosMensual",
          label: "Gastos Mensuales",
          valor:
            financieros?.gastosMensual != null
              ? formatearPrecio(financieros.gastosMensual)
              : "—",
        },
        {
          campo: "ahorroMensual",
          label: "Cap. ahorro mensual",
          valor:
            financieros?.ahorroMensual != null
              ? formatearPrecio(financieros.ahorroMensual)
              : "—",
        },
        {
          campo: "ahorroActual",
          label: "Ahorro actual",
          valor:
            financieros?.ahorroActual != null
              ? formatearPrecio(financieros.ahorroActual)
              : "—",
        },
        ...(financieros?.referenciasBancarias ?? []).map((ref, indice): CampoReporte => ({
          campo: `referencia_bancaria_${indice + 1}`,
          label: `${indice + 1}) Ref. bancaria: institución / N.º cuenta / tipo / ciudad`,
          valor: `${ref.institucion || "—"} · ${ref.numeroCuenta || "—"} · ${ref.tipo || "—"} · ${ref.ciudad || "—"}`,
        })),
        ...(financieros?.referenciasComerciales ?? []).map(
          (ref, indice): CampoReporte => ({
            campo: `referencia_comercial_${indice + 1}`,
            label: `${indice + 1}) Ref. comercial: institución / contacto / teléfono / ciudad`,
            valor: `${ref.institucion || "—"} · ${ref.contacto || "—"} · ${ref.telefono || "—"} · ${ref.ciudad || "—"}`,
          })
        ),
      ]),
      seccion("Licitud de Fondos", [
        {
          campo: "funcionarioElecto",
          label: "¿Es o ha sido funcionario, electo o designado en algún cargo público?",
          valor: licitud?.funcionarioElecto ?? "—",
        },
        {
          campo: "relacionGobierno",
          label: "¿Relación familiar o de negocio con funcionario/entidad de gobierno?",
          valor: licitud?.relacionGobierno ?? "—",
        },
        {
          campo: "trabajoSectorPublico",
          label: "¿Realiza trabajos o contratos para el sector público?",
          valor: licitud?.trabajoSectorPublico ?? "—",
        },
        ...([
          licitud?.funcionarioElecto,
          licitud?.relacionGobierno,
          licitud?.trabajoSectorPublico,
        ].includes("Sí")
          ? [
              {
                campo: "pepCargo",
                label: "Cargo / Función PEP",
                valor: licitud?.pepCargo ?? "—",
              },
              { campo: "pepPais", label: "País (PEP)", valor: licitud?.pepPais ?? "—" },
              {
                campo: "pepFechaInicio",
                label: "Fecha inicio (PEP)",
                valor: licitud?.pepFechaInicio?.slice(0, 10) ?? "—",
              },
              {
                campo: "pepFechaFin",
                label: "Fecha fin (PEP)",
                valor: licitud?.pepFechaFin?.slice(0, 10) ?? "—",
              },
              {
                campo: "pepRelacion",
                label: "Relación con el cliente (PEP)",
                valor: licitud?.pepRelacion ?? "—",
              },
            ]
          : []),
        {
          campo: "fondosOrigen",
          label: "¿De dónde provienen los fondos?",
          valor: licitud?.fondosOrigen ?? "—",
        },
        {
          campo: "fondosDestino",
          label: "¿Para qué serán utilizados?",
          valor: licitud?.fondosDestino ?? "—",
        },
      ]),
      seccion("Apoderado", [
        {
          campo: "cli_representante",
          label: "Apellidos y nombres",
          valor: oferta.cli_representante ?? "—",
        },
        {
          campo: "cli_representanteID",
          label: "Identificación",
          valor: oferta.cli_representanteID ?? "—",
        },
        {
          campo: "cli_telefR",
          label: "Teléfono",
          valor: telefonoLegible(oferta.cli_telefR),
        },
        {
          campo: "cli_representanteMail",
          label: "Correo electrónico",
          valor: oferta.cli_representanteMail ?? "—",
        },
      ]),
      seccion("Referencias familiares", [
        {
          campo: "cli_reFami1",
          label: "Nombre — referencia 1",
          valor: oferta.cli_reFami1 ?? "—",
        },
        {
          campo: "cli_paren1",
          label: "Parentesco — referencia 1",
          valor: oferta.cli_paren1 ?? "—",
        },
        {
          campo: "cli_telParen1",
          label: "Teléfono — referencia 1",
          valor: telefonoLegible(oferta.cli_telParen1),
        },
        {
          campo: "cli_reFami2",
          label: "Nombre — referencia 2",
          valor: oferta.cli_reFami2 ?? "—",
        },
        {
          campo: "cli_paren2",
          label: "Parentesco — referencia 2",
          valor: oferta.cli_paren2 ?? "—",
        },
        {
          campo: "cli_telParen2",
          label: "Teléfono — referencia 2",
          valor: telefonoLegible(oferta.cli_telParen2),
        },
      ]),
      seccion("Cónyuge", [
        {
          campo: "cli_conyuName",
          label: "Apellidos y nombres",
          valor: oferta.cli_conyuName ?? "—",
        },
        {
          campo: "cli_conyuID",
          label: "Identificación",
          valor: oferta.cli_conyuID ?? "—",
        },
        {
          campo: "cli_conyuFecNac",
          label: "Fecha de nacimiento",
          valor: oferta.cli_conyuFecNac?.slice(0, 10) ?? "—",
        },
        {
          campo: "cli_conyuCell",
          label: "Teléfono",
          valor: telefonoLegible(oferta.cli_conyuCell),
        },
        {
          campo: "cli_conyuTrabEmpresa",
          label: "Empresa en la que trabaja",
          valor: oferta.cli_conyuTrabEmpresa ?? "—",
        },
        {
          campo: "cli_conyuTrabDireccion",
          label: "Dirección de la empresa",
          valor: oferta.cli_conyuTrabDireccion ?? "—",
        },
        {
          campo: "cli_conyuTrabTelefono",
          label: "Teléfono del trabajo",
          valor: telefonoLegible(oferta.cli_conyuTrabTelefono),
        },
      ]),
      seccion("Referidos", [
        {
          campo: "referido_nombre",
          label: "Nombre de quien refiere",
          valor: oferta.referido_nombre ?? "—",
        },
        {
          campo: "referido_telefono",
          label: "Teléfono",
          valor: telefonoLegible(oferta.referido_telefono),
        },
        {
          campo: "referido_relacion",
          label: "Relación con el cliente",
          valor: oferta.referido_relacion ?? "—",
        },
      ]),
      seccion("Asesor", [
        {
          campo: "cli_asesorTelf",
          label: "Teléfono del asesor",
          valor: telefonoLegible(oferta.cli_asesorTelf),
        },
        {
          campo: "cli_contac",
          label: "¿Cómo nos contactó?",
          valor: oferta.cli_contac ?? "—",
        },
        {
          campo: "cli_contacNombre",
          label: "Nombre de contacto",
          valor: oferta.cli_contacNombre ?? "—",
        },
        {
          campo: "prospectador",
          label: "Prospectador",
          valor: oferta.prospectador ?? "—",
        },
        {
          campo: "cli_motivoCompra",
          label: "Motivo de compra",
          valor: oferta.cli_motivoCompra ?? "—",
        },
        {
          campo: "cli_asistenciaProyecto",
          label: "Asistencia en proyecto",
          valor: oferta.cli_asistenciaProyecto ?? "—",
        },
        {
          campo: "cli_visitaProyecto",
          label: "Visitó el proyecto",
          valor: oferta.cli_visitaProyecto ?? "—",
        },
        {
          campo: "cli_observation",
          label: "Observaciones",
          valor: oferta.cli_observation ?? "—",
        },
      ]),
    ]
  }, [
    oferta,
    financieros,
    financiamiento,
    descuentoFinanciamiento,
    licitud,
    titular,
    proceso,
  ])

  function alternarMarca(campo: string, label: string) {
    setMarcados((anterior) => {
      const copia = { ...anterior }
      if (copia[campo]) {
        delete copia[campo]
      } else {
        copia[campo] = { label, comentario: "" }
      }
      return copia
    })
  }

  function actualizarComentario(campo: string, comentario: string) {
    setMarcados((anterior) => ({
      ...anterior,
      [campo]: { ...anterior[campo], comentario },
    }))
  }

  async function manejarAprobar() {
    setProcesando(true)
    try {
      await aprobarOferta(idNumero)
      toast({ variant: "success", description: "Oferta aprobada." })
      router.push(`/ventas/procesos?lote=${encodeURIComponent(proceso?.cli_lote ?? "")}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo aprobar la oferta",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setProcesando(false)
    }
  }

  async function manejarDevolver() {
    const observacionesInput: ObservacionOfertaInput[] = Object.entries(marcados).map(
      ([campo, { label, comentario }]) => ({
        campo,
        campoLabel: label,
        comentario: comentario || undefined,
      })
    )
    if (observacionesInput.length === 0) return
    setProcesando(true)
    try {
      await devolverOferta(idNumero, observacionesInput)
      toast({
        variant: "success",
        description: "Oferta devuelta al asesor con las observaciones marcadas.",
      })
      router.push(`/ventas/procesos?lote=${encodeURIComponent(proceso?.cli_lote ?? "")}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo devolver la oferta",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="bg-brand-gradient-banner relative flex items-center justify-between gap-4 overflow-hidden px-5 py-5 sm:px-8.5 sm:py-6.5">
            <div className="absolute -top-15 -right-10 size-55 rounded-full bg-white/9" />
            <div className="relative">
              <h1 className="text-xl font-extrabold text-white sm:text-[23px]">
                Reporte de oferta de compra
              </h1>
              <p className="text-sm text-white/90">
                Confirma la información antes de aprobar o devolver la oferta
              </p>
            </div>
            {oferta && (
              <div className="relative">
                <StatusBadge variant={estado} />
              </div>
            )}
          </div>

          <div className="px-4 pt-6 pb-6 sm:px-8.5 sm:pt-8 sm:pb-7.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !oferta ? (
              <EmptyState
                title="No se puede abrir el reporte"
                description={error ?? "No se encontró la oferta."}
                dashed
              />
            ) : (
              <>
                {observaciones.length > 0 && (
                  <div className="border-destructive/40 bg-destructive/5 mb-6 rounded-md border p-4">
                    <div className="text-destructive mb-2 text-sm font-semibold">
                      Esta oferta tiene observaciones pendientes de una devolución
                      anterior
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {observaciones.map((observacion) => (
                        <li key={observacion.id} className="text-sm">
                          <span className="font-semibold">
                            {observacion.campo_label ?? observacion.campo}:
                          </span>{" "}
                          {observacion.comentario || "Marcado como incorrecto"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mb-6 grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                  <div className="border-border rounded-md border p-4">
                    <div className="text-muted-foreground text-xs font-semibold">
                      Cliente
                    </div>
                    <div className="text-sm font-bold">{titular?.nombre ?? "—"}</div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {titular?.identificacion ?? "—"} ·{" "}
                      {calcularEdad(titular?.fecha_nacimiento)} ·{" "}
                      {titular?.estado_civil ?? "—"}
                    </div>
                  </div>
                  <div className="border-border rounded-md border p-4">
                    <div className="text-muted-foreground text-xs font-semibold">
                      Inmueble
                    </div>
                    <div className="text-sm font-bold">
                      {loteInfo?.proyecto?.nombre ?? "—"} —{" "}
                      {loteInfo?.codigo ?? proceso?.cli_lote ?? "—"}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {formatearPrecio(loteInfo?.pvp ?? proceso?.lote_price)} ·{" "}
                      {formatearMetraje(loteInfo?.areaUtil ?? proceso?.lote_mts)} ·{" "}
                      {labelLugarVenta(proceso?.location)}
                    </div>
                  </div>
                </div>

                {clientesExtra.length > 0 && (
                  <div className="border-border mb-6 rounded-md border p-4">
                    <div className="mb-2 text-sm font-semibold">Clientes adicionales</div>
                    <ul className="flex flex-col gap-1">
                      {clientesExtra.map((cliente) => (
                        <li key={cliente.id} className="text-sm">
                          {cliente.nombre} —{" "}
                          <span className="font-mono">{cliente.identificacion}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · Relación: {cliente.relacion || "—"} · País de residencia:{" "}
                            {cliente.pais_residencia || "—"} · PEP:{" "}
                            {cliente.es_pep == null ? "—" : cliente.es_pep ? "Sí" : "No"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col gap-7">
                  {secciones.map((seccionActual) => (
                    <div key={seccionActual.titulo}>
                      <div className="border-border mb-3 border-b pb-2 text-[15px] font-extrabold">
                        {seccionActual.titulo}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {seccionActual.campos.map((campo) => {
                          const marca = marcados[campo.campo]
                          return (
                            <div
                              key={campo.campo}
                              className={cn(
                                "rounded-md border p-3",
                                marca
                                  ? "border-destructive bg-destructive/5"
                                  : "border-border"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-muted-foreground text-xs font-semibold">
                                    {campo.label}
                                  </div>
                                  <div className="text-sm font-medium break-words">
                                    {campo.valor}
                                  </div>
                                </div>
                                {puedeDecidir && (
                                  <Button
                                    type="button"
                                    variant={marca ? "destructive" : "outline"}
                                    size="icon"
                                    aria-label={`Marcar "${campo.label}" como incorrecto`}
                                    onClick={() =>
                                      alternarMarca(campo.campo, campo.label)
                                    }
                                  >
                                    <Flag className="size-3.5" strokeWidth={1.8} />
                                  </Button>
                                )}
                              </div>
                              {marca && (
                                <textarea
                                  placeholder="Comentario para el asesor (opcional)"
                                  value={marca.comentario}
                                  onChange={(e) =>
                                    actualizarComentario(campo.campo, e.target.value)
                                  }
                                  className="border-input bg-card mt-2 w-full rounded-sm border px-3 py-1.5 text-sm outline-none"
                                  rows={2}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-border mt-6 flex flex-col-reverse gap-3 border-t pt-5 sm:mt-7.5 sm:flex-row sm:items-center sm:justify-between sm:pt-5.5">
                  <div className="flex flex-wrap gap-3 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <Can permiso="ofertas:editar">
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/ventas/oferta/new/${idNumero}`)}
                      >
                        <Pencil className="size-3.5" strokeWidth={1.8} />
                        Editar oferta
                      </Button>
                    </Can>
                    {estado === "aprobado" && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          router.push(`/ventas/oferta/reporte/${idNumero}/imprimir`)
                        }
                      >
                        <Printer className="size-3.5" strokeWidth={1.8} />
                        Imprimir
                      </Button>
                    )}
                  </div>

                  {puedeDecidir && (
                    <Can permiso="ofertas:revisar">
                      <div className="flex flex-col gap-3 sm:flex-row [&>button]:w-full sm:[&>button]:w-auto">
                        <Button
                          variant="outline"
                          disabled={procesando || Object.keys(marcados).length === 0}
                          onClick={manejarDevolver}
                        >
                          <Undo2 className="size-3.5" strokeWidth={1.8} />
                          Devolver oferta
                        </Button>
                        <Button disabled={procesando} onClick={manejarAprobar}>
                          <CheckCircle2 className="size-3.5" strokeWidth={1.8} />
                          Aprobar oferta
                        </Button>
                      </div>
                    </Can>
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
