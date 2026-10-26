"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/lib/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Handshake,
  Heart,
  Home,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { ComboboxField, type ComboboxOption } from "@/components/shared/combobox-field"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { IndicadorAutoguardado } from "@/components/shared/indicador-autoguardado"
import { useCan } from "@/components/shared/can"
import { EmptyState } from "@/components/shared/empty-state"
import { MultiSelectField } from "@/components/shared/multi-select-field"
import { PhoneField } from "@/components/shared/phone-field"
import { SelectField, StaticField } from "@/components/shared/select-field"
import {
  ESTADOS_CIVILES,
  FUENTES_INGRESOS,
  LUGARES_VENTA_OPCIONES,
  MEDIOS_CONTACTO_GRUPOS,
  MOTIVOS_COMPRA,
  PARENTESCOS,
  RELACIONES,
  PROSPECTADORES,
  TIPOS_OPERACION,
} from "@/components/shared/select-options"
import { Spinner } from "@/components/shared/spinner"
import { Stepper } from "@/components/shared/stepper"
import { TextField } from "@/components/shared/text-field"
import { useSession } from "@/components/shared/session-provider"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  InventarioApiError,
  obtenerLote,
  type LoteInventario,
} from "@/lib/api/inventario-api"
import {
  VentasApiError,
  actualizarOferta,
  crearOferta,
  guardarClientesExtra,
  guardarDatosFinancieros,
  guardarLicitudFondos,
  listarObservacionesPendientes,
  listarPersonasProceso,
  obtenerDatosFinancieros,
  obtenerLicitudFondos,
  obtenerOferta,
  obtenerProceso,
  type ClienteExtraInput,
  type ReferenciaBancariaInput,
  type ReferenciaComercialInput,
  type ObservacionOfertaBackend,
  type OfertaFormInput,
  type PersonaProceso,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"
import { useBorradorAutomatico } from "@/lib/borradores/use-borrador-automatico"
import { nacionalidades } from "@/lib/const/nacionalidades"
import { actividades, cargos } from "@/lib/const/actividades"
import { separarTelefono } from "@/lib/const/codigos-telefonicos"
import { validarEmail } from "@/lib/validations/email"
import { validarIdentificacion } from "@/lib/validations/identificacion"
import { validarTelefono } from "@/lib/validations/telefono"
import {
  CANTONES_PICHINCHA,
  ESTADOS_EEUU,
  PROVINCIAS_ECUADOR,
  SECTORES_QUITO,
} from "@/lib/const/ubicacion"

const OPCIONES_PAIS: ComboboxOption[] = Array.from(
  new Set(nacionalidades.map((n) => n.pais))
)
  .sort((a, b) => a.localeCompare(b, "es"))
  .map((pais) => ({ value: pais, label: pais }))

const OPCIONES_NACIONALIDAD: ComboboxOption[] = Array.from(
  new Set(nacionalidades.map((n) => n.nacionalidad))
)
  .sort((a, b) => a.localeCompare(b, "es"))
  .map((nacionalidad) => ({ value: nacionalidad, label: nacionalidad }))

const NO_APLICA = "No aplica"

// Actividad "OTRO": despliega los datos de quien efectúa la transacción (sección 3 del
// formulario UAFE).
const ACTIVIDAD_OTRO = "OTRO"

// Paso "Licitud de Fondos" — respuesta de cada pregunta de relación con el gobierno.
const SI_NO_OPCIONES = ["Sí", "No"]

// Mismo valor que ESTADOS_CIVILES en select-options.ts — dispara el paso Cónyuge.
const ESTADO_CIVIL_CASADO = "CASADO/A"

const OPCIONES_ACTIVIDADES: ComboboxOption[] = Array.from(
  new Set(actividades.map((n) => n.nombre))
).map((nombre) => ({ value: nombre, label: nombre }))

const CARGOS_OPCIONES = Array.from(new Set(cargos.map((n) => n.value)))

type CampoFormulario =
  | "cli_tipoOperacion"
  | "cli_tipoOperacionOtro"
  | "cli_descuento"
  | "cli_telef"
  | "cli_mail"
  | "cli_representante"
  | "cli_representanteID"
  | "cli_telefR"
  | "cli_representanteMail"
  | "cli_reFami1"
  | "cli_paren1"
  | "cli_telParen1"
  | "cli_reFami2"
  | "cli_paren2"
  | "cli_telParen2"
  | "cli_conyuName"
  | "cli_conyuID"
  | "cli_conyuFecNac"
  | "cli_conyuCell"
  | "cli_conyuTrabEmpresa"
  | "cli_conyuTrabDireccion"
  | "cli_conyuTrabTelefono"
  | "referido_nombre"
  | "referido_telefono"
  | "referido_relacion"
  | "cli_asesorTelf"
  | "cli_contac"
  | "cli_contacNombre"
  | "prospectador"
  | "cli_motivoCompra"
  | "cli_asistenciaProyecto"
  | "cli_visitaProyecto"
  | "cli_observation"
  | "cli_pais"
  | "cli_provin"
  | "cli_ciudad"
  | "cli_sector"
  | "cli_direccion"
  | "cli_trabActividad"
  | "cli_trabEmpresa"
  | "cli_trabProfesion"
  | "cli_trabCargo"
  | "cli_trabTiempo"
  | "cli_trabSector"
  | "cli_trabDireccion"
  | "cli_trabTelefono"
  | "cli_trabIngresos"
  | "cli_trabRuc"
  | "cli_trabTipoNegocio"
  | "cli_transNombre"
  | "cli_transID"
  | "cli_transNacionalidad"
  | "cli_transProfesion"
  | "cli_transCargo"
  | "cli_transTelefono"
  | "cli_transTelefono_prefijo"
  | "cli_transDireccion"
  | "cli_transCiudad"
  | "cli_transEstadoCivil"
  | "cli_transIntermediario"
  | "cli_transRelacionDueno"
  | "cli_telef_prefijo"
  | "cli_telefR_prefijo"
  | "cli_telParen1_prefijo"
  | "cli_telParen2_prefijo"
  | "cli_conyuCell_prefijo"
  | "cli_conyuTrabTelefono_prefijo"
  | "referido_telefono_prefijo"
  | "cli_asesorTelf_prefijo"
  | "cli_trabTelefono_prefijo"

// Campos de identificación editables del wizard — misma validación (cédula ecuatoriana
// módulo 10 / RUC de 13 dígitos / pasaporte alfanumérico) que usa /ventas/nuevo-proceso.
// La identificación del titular en el paso Cliente no entra acá porque se muestra
// bloqueada (ya viene registrada, no se puede editar).
const CAMPOS_IDENTIFICACION = new Set<CampoFormulario>([
  "cli_representanteID",
  "cli_conyuID",
])

// Campos de correo editables del wizard — mismo mecanismo que CAMPOS_IDENTIFICACION:
// se valida el formato ("algo@algo.algo") y bloquea el avance del paso si es inválido.
const CAMPOS_EMAIL = new Set<CampoFormulario>(["cli_mail", "cli_representanteMail"])

// Campos de teléfono editables del wizard (menos cli_trabTelefono, que se renderiza
// aparte en el bloque a medida del paso Trabajo) — cada uno mapea a su propio campo de
// prefijo de país, ambos con PhoneField. Al guardar se concatenan prefijo + número en
// el mismo campo legacy (`${prefijo}${numero}`), no se manda un campo nuevo al backend.
const CAMPOS_TELEFONO: Partial<Record<CampoFormulario, CampoFormulario>> = {
  cli_telef: "cli_telef_prefijo",
  cli_telefR: "cli_telefR_prefijo",
  cli_telParen1: "cli_telParen1_prefijo",
  cli_telParen2: "cli_telParen2_prefijo",
  cli_conyuCell: "cli_conyuCell_prefijo",
  cli_conyuTrabTelefono: "cli_conyuTrabTelefono_prefijo",
  referido_telefono: "referido_telefono_prefijo",
  cli_asesorTelf: "cli_asesorTelf_prefijo",
}

const FORM_VACIO: Record<CampoFormulario, string> = {
  cli_tipoOperacion: "",
  cli_tipoOperacionOtro: "",
  cli_descuento: "",
  cli_telef: "",
  cli_mail: "",
  cli_representante: "",
  cli_representanteID: "",
  cli_telefR: "",
  cli_representanteMail: "",
  cli_reFami1: "",
  cli_paren1: "",
  cli_telParen1: "",
  cli_reFami2: "",
  cli_paren2: "",
  cli_telParen2: "",
  cli_conyuName: "",
  cli_conyuID: "",
  cli_conyuFecNac: "",
  cli_conyuCell: "",
  cli_conyuTrabEmpresa: "",
  cli_conyuTrabDireccion: "",
  cli_conyuTrabTelefono: "",
  referido_nombre: "",
  referido_telefono: "",
  referido_relacion: "",
  cli_asesorTelf: "",
  cli_contac: "",
  cli_contacNombre: "",
  prospectador: "",
  cli_motivoCompra: "",
  cli_asistenciaProyecto: "No",
  cli_visitaProyecto: "No",
  cli_observation: "",
  cli_pais: "",
  cli_provin: "",
  cli_ciudad: "",
  cli_sector: "",
  cli_direccion: "",
  cli_trabActividad: "",
  cli_trabEmpresa: "",
  cli_trabProfesion: "",
  cli_trabCargo: "",
  cli_trabTiempo: "",
  cli_trabSector: "",
  cli_trabDireccion: "",
  cli_trabTelefono: "",
  cli_trabIngresos: "",
  cli_trabRuc: "",
  cli_trabTipoNegocio: "",
  cli_transNombre: "",
  cli_transID: "",
  cli_transNacionalidad: "",
  cli_transProfesion: "",
  cli_transCargo: "",
  cli_transTelefono: "",
  cli_transTelefono_prefijo: "+593",
  cli_transDireccion: "",
  cli_transCiudad: "",
  cli_transEstadoCivil: "",
  cli_transIntermediario: "No",
  cli_transRelacionDueno: "",
  cli_telef_prefijo: "+593",
  cli_telefR_prefijo: "+593",
  cli_telParen1_prefijo: "+593",
  cli_telParen2_prefijo: "+593",
  cli_conyuCell_prefijo: "+593",
  cli_conyuTrabTelefono_prefijo: "+593",
  referido_telefono_prefijo: "+593",
  cli_asesorTelf_prefijo: "+593",
  cli_trabTelefono_prefijo: "+593",
}

type CampoBloqueado = { tipo: "bloqueado"; label: string; value: string; mono?: boolean }
type CampoEditable = {
  tipo: "texto" | "fecha" | "seleccion"
  label: string
  campo: CampoFormulario
  placeholder?: string
  requerido?: boolean
  opciones?: string[]
}
type Campo = CampoBloqueado | CampoEditable

type PasoOferta = {
  label: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  titulo: string
  subtitulo: string
  campos: Campo[]
}

// Si la oferta ya tenía guardado un valor libre (de cuando el campo era de texto) que no
// está en el catálogo, se agrega a las opciones para que el select no quede en blanco.
function opcionesCon(opciones: string[], actual: string | null | undefined): string[] {
  return actual && !opciones.includes(actual) ? [...opciones, actual] : opciones
}

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

const calcularEdad = (fechaNacimiento?: string | Date | null): string => {
  if (!fechaNacimiento) return "—"

  const nacimiento = new Date(fechaNacimiento)
  if (isNaN(nacimiento.getTime())) return "—"

  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const mes = hoy.getMonth() - nacimiento.getMonth()

  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--
  }

  return `${edad} años`
}

export function OfertaCompraContent({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const idNumero = Number(id)
  // Esta misma pantalla sirve tanto para crear la oferta por primera vez
  // ("ventas:crear", ya alcanza) como para volver a tocar una que ya existe
  // ("ofertas:editar" — permiso aparte, ver ventas.controller.ts). Cuál de los dos
  // aplica depende de si el proceso ya tiene oferta o no, así que se decide más abajo
  // una vez que carga `ofertaId` (ver puedeUsarPantalla).
  const puedeCrear = useCan("ventas:crear")
  const puedeEditarExistente = useCan("ofertas:editar")

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [ofertaId, setOfertaId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<CampoFormulario, string>>(FORM_VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paso, setPaso] = useState(0)
  const [guardando, setGuardando] = useState(false)
  // Clientes adicionales (paso Cliente) — hasta 3, solo nombre + identificación. Se
  // guardan aparte del titular (POST /procesos/:id/clientes-extra, ver
  // guardarClientesExtra en ventas-api.ts) — ese endpoint no existe todavía en el
  // backend, así que por ahora no hay forma de precargar clientes ya guardados.
  const [clientesExtra, setClientesExtra] = useState<ClienteExtraInput[]>([])
  // Paso "Datos financieros" — vive en oferta_pld/oferta_pld_cuentas (tablas aparte de
  // `ofertas`), se guarda con guardarDatosFinancieros() despues de crear/actualizar la
  // oferta. Montos como texto en el form (igual que cli_trabIngresos), se convierten a
  // number recien al armar el payload.
  // ahorroMensual no vive acá: se calcula solo (ver capacidadAhorroMensual más abajo),
  // ingresos mensuales + otros ingresos - gastos mensuales.
  const [datosFinancieros, setDatosFinancieros] = useState({
    otrosIngresos: "",
    fuenteIngresos: "",
    fuenteIngresosOtro: "",
    patrimonio: "",
    fuentePatrimonio: "",
    ingresoMensual: "",
    gastosMensual: "",
    ahorroActual: "",
  })
  const [referenciasBancarias, setReferenciasBancarias] = useState<
    ReferenciaBancariaInput[]
  >([])
  const [referenciasComerciales, setReferenciasComerciales] = useState<
    ReferenciaComercialInput[]
  >([])
  // Paso "Licitud de Fondos" — vive en oferta_licitud_fondos/
  // oferta_licitud_fondos_transacciones, se guarda con guardarLicitudFondos() despues
  // de crear/actualizar la oferta (igual que datosFinancieros).
  const [licitudFondos, setLicitudFondos] = useState({
    relacionGobierno: "",
    trabajoSectorPublico: "",
    funcionarioElecto: "",
    pepCargo: "",
    pepPais: "",
    pepFechaInicio: "",
    pepFechaFin: "",
    pepRelacion: "",
    fondosOrigen: "",
    fondosDestino: "",
  })
  // Observaciones vigentes de una devolución anterior del revisor (ver
  // /ventas/oferta/reporte/[id]) — se muestran como banner para que el asesor sepa
  // qué corregir; se resuelven solas en el backend al volver a guardar la oferta.
  const [observacionesPendientes, setObservacionesPendientes] = useState<
    ObservacionOfertaBackend[]
  >([])
  // Personas de otros procesos (paso Asesor, "¿Cómo nos contactó?" → Referidos →
  // Cliente) — se cargan una sola vez, recién cuando el usuario elige "Cliente" (no de
  // entrada, para no pegarle al backend si nadie usa esta opción). null = todavía no se
  // pidieron; [] = ya se pidieron y no hay ninguna (o falló la carga).
  const [personasProceso, setPersonasProceso] = useState<PersonaProceso[] | null>(null)
  const [cargandoPersonas, setCargandoPersonas] = useState(false)

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
          ofertaExistente,
          financierosExistentes,
          licitudExistente,
          observaciones,
        ] = await Promise.all([
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
          obtenerOferta(idNumero),
          obtenerDatosFinancieros(idNumero),
          obtenerLicitudFondos(idNumero),
          listarObservacionesPendientes(idNumero),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setObservacionesPendientes(observaciones)

        if (financierosExistentes) {
          setDatosFinancieros({
            otrosIngresos:
              financierosExistentes.otrosIngresos != null
                ? String(financierosExistentes.otrosIngresos)
                : "",
            fuenteIngresos: financierosExistentes.fuenteIngresos ?? "",
            fuenteIngresosOtro: financierosExistentes.fuenteIngresosOtro ?? "",
            patrimonio:
              financierosExistentes.patrimonio != null
                ? String(financierosExistentes.patrimonio)
                : "",
            fuentePatrimonio: financierosExistentes.fuentePatrimonio ?? "",
            ingresoMensual:
              financierosExistentes.ingresoMensual != null
                ? String(financierosExistentes.ingresoMensual)
                : "",
            gastosMensual:
              financierosExistentes.gastosMensual != null
                ? String(financierosExistentes.gastosMensual)
                : "",
            ahorroActual:
              financierosExistentes.ahorroActual != null
                ? String(financierosExistentes.ahorroActual)
                : "",
          })
          setReferenciasBancarias(financierosExistentes.referenciasBancarias ?? [])
          setReferenciasComerciales(financierosExistentes.referenciasComerciales ?? [])
        }

        if (licitudExistente) {
          setLicitudFondos({
            relacionGobierno: licitudExistente.relacionGobierno ?? "",
            trabajoSectorPublico: licitudExistente.trabajoSectorPublico ?? "",
            funcionarioElecto: licitudExistente.funcionarioElecto ?? "",
            pepCargo: licitudExistente.pepCargo ?? "",
            pepPais: licitudExistente.pepPais ?? "",
            pepFechaInicio: licitudExistente.pepFechaInicio?.slice(0, 10) ?? "",
            pepFechaFin: licitudExistente.pepFechaFin?.slice(0, 10) ?? "",
            pepRelacion: licitudExistente.pepRelacion ?? "",
            fondosOrigen: licitudExistente.fondosOrigen ?? "",
            fondosDestino: licitudExistente.fondosDestino ?? "",
          })
        }

        if (ofertaExistente) {
          setOfertaId(ofertaExistente.id)
          const telCliente = separarTelefono(ofertaExistente.cli_telef ?? "")
          const telApoderado = separarTelefono(ofertaExistente.cli_telefR ?? "")
          const telParen1 = separarTelefono(ofertaExistente.cli_telParen1 ?? "")
          const telParen2 = separarTelefono(ofertaExistente.cli_telParen2 ?? "")
          const telConyuge = separarTelefono(ofertaExistente.cli_conyuCell ?? "")
          const telConyugeTrab = separarTelefono(
            ofertaExistente.cli_conyuTrabTelefono ?? ""
          )
          const telReferido = separarTelefono(ofertaExistente.referido_telefono ?? "")
          const telAsesor = separarTelefono(ofertaExistente.cli_asesorTelf ?? "")
          const telTrabajo = separarTelefono(ofertaExistente.cli_trabTelefono ?? "")
          const telTrans = separarTelefono(ofertaExistente.cli_transTelefono ?? "")
          setForm({
            cli_tipoOperacion: ofertaExistente.cli_tipoOperacion ?? "",
            cli_tipoOperacionOtro: ofertaExistente.cli_tipoOperacionOtro ?? "",
            cli_descuento:
              ofertaExistente.cli_descuento != null
                ? String(ofertaExistente.cli_descuento)
                : "",
            cli_telef: telCliente.numero,
            cli_telef_prefijo: telCliente.prefijo,
            cli_mail: ofertaExistente.cli_mail ?? "",
            cli_representante: ofertaExistente.cli_representante ?? "",
            cli_representanteID: ofertaExistente.cli_representanteID ?? "",
            cli_telefR: telApoderado.numero,
            cli_telefR_prefijo: telApoderado.prefijo,
            cli_representanteMail: ofertaExistente.cli_representanteMail ?? "",
            cli_reFami1: ofertaExistente.cli_reFami1 ?? "",
            cli_paren1: ofertaExistente.cli_paren1 ?? "",
            cli_telParen1: telParen1.numero,
            cli_telParen1_prefijo: telParen1.prefijo,
            cli_reFami2: ofertaExistente.cli_reFami2 ?? "",
            cli_paren2: ofertaExistente.cli_paren2 ?? "",
            cli_telParen2: telParen2.numero,
            cli_telParen2_prefijo: telParen2.prefijo,
            cli_conyuName: ofertaExistente.cli_conyuName ?? "",
            cli_conyuID: ofertaExistente.cli_conyuID ?? "",
            cli_conyuFecNac: ofertaExistente.cli_conyuFecNac?.slice(0, 10) ?? "",
            cli_conyuCell: telConyuge.numero,
            cli_conyuCell_prefijo: telConyuge.prefijo,
            cli_conyuTrabEmpresa: ofertaExistente.cli_conyuTrabEmpresa ?? "",
            cli_conyuTrabDireccion: ofertaExistente.cli_conyuTrabDireccion ?? "",
            cli_conyuTrabTelefono: telConyugeTrab.numero,
            cli_conyuTrabTelefono_prefijo: telConyugeTrab.prefijo,
            referido_nombre: ofertaExistente.referido_nombre ?? "",
            referido_telefono: telReferido.numero,
            referido_telefono_prefijo: telReferido.prefijo,
            referido_relacion: ofertaExistente.referido_relacion ?? "",
            cli_asesorTelf: telAsesor.numero,
            cli_asesorTelf_prefijo: telAsesor.prefijo,
            cli_contac: ofertaExistente.cli_contac ?? "",
            cli_contacNombre: ofertaExistente.cli_contacNombre ?? "",
            prospectador: ofertaExistente.prospectador ?? "",
            cli_motivoCompra: ofertaExistente.cli_motivoCompra ?? "",
            cli_asistenciaProyecto: ofertaExistente.cli_asistenciaProyecto ?? "No",
            cli_visitaProyecto: ofertaExistente.cli_visitaProyecto ?? "No",
            cli_observation: ofertaExistente.cli_observation ?? "",
            cli_pais: ofertaExistente.cli_pais ?? "",
            cli_provin:
              ofertaExistente.cli_provin && ofertaExistente.cli_provin !== NO_APLICA
                ? ofertaExistente.cli_provin
                : "",
            cli_ciudad: ofertaExistente.cli_ciudad ?? "",
            cli_sector:
              ofertaExistente.cli_sector && ofertaExistente.cli_sector !== NO_APLICA
                ? ofertaExistente.cli_sector
                : "",
            cli_direccion: ofertaExistente.cli_direccion ?? "",
            cli_trabActividad: ofertaExistente.cli_trabActividad ?? "",
            cli_trabEmpresa: ofertaExistente.cli_trabEmpresa ?? "",
            cli_trabProfesion: ofertaExistente.cli_trabProfesion ?? "",
            cli_trabCargo: ofertaExistente.cli_trabCargo ?? "",
            cli_trabTiempo: ofertaExistente.cli_trabTiempo ?? "",
            cli_trabSector: ofertaExistente.cli_trabSector ?? "",
            cli_trabDireccion: ofertaExistente.cli_trabDireccion ?? "",
            cli_trabTelefono: telTrabajo.numero,
            cli_trabTelefono_prefijo: telTrabajo.prefijo,
            cli_trabIngresos:
              ofertaExistente.cli_trabIngresos != null
                ? String(ofertaExistente.cli_trabIngresos)
                : "",
            cli_trabRuc: ofertaExistente.cli_trabRuc ?? "",
            cli_trabTipoNegocio: ofertaExistente.cli_trabTipoNegocio ?? "",
            cli_transNombre: ofertaExistente.cli_transNombre ?? "",
            cli_transID: ofertaExistente.cli_transID ?? "",
            cli_transNacionalidad: ofertaExistente.cli_transNacionalidad ?? "",
            cli_transProfesion: ofertaExistente.cli_transProfesion ?? "",
            cli_transCargo: ofertaExistente.cli_transCargo ?? "",
            cli_transTelefono: telTrans.numero,
            cli_transTelefono_prefijo: telTrans.prefijo,
            cli_transDireccion: ofertaExistente.cli_transDireccion ?? "",
            cli_transCiudad: ofertaExistente.cli_transCiudad ?? "",
            cli_transEstadoCivil: ofertaExistente.cli_transEstadoCivil ?? "",
            cli_transIntermediario: ofertaExistente.cli_transIntermediario || "No",
            cli_transRelacionDueno: ofertaExistente.cli_transRelacionDueno ?? "",
          })
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

  useEffect(() => {
    if (form.cli_contac !== "CLIENTE" || personasProceso !== null || cargandoPersonas)
      return
    let cancelado = false
    setCargandoPersonas(true)
    listarPersonasProceso()
      .then((datos) => {
        if (!cancelado) setPersonasProceso(datos)
      })
      .catch(() => {
        if (!cancelado) setPersonasProceso([])
      })
      .finally(() => {
        if (!cancelado) setCargandoPersonas(false)
      })
    return () => {
      cancelado = true
    }
  }, [form.cli_contac, personasProceso, cargandoPersonas])

  // --- Borrador automático (ver useBorradorAutomatico) ---
  // Todo lo que el asesor va llenando, en todos los pasos, se guarda solo mientras
  // escribe — si se le vence la sesión o se cierra la pestaña a mitad del formulario,
  // al volver encuentra todo como lo dejó. La oferta real (y lo que ve el revisor) no
  // cambia hasta el "Guardar" final, que además borra el borrador.
  const usuarioActual = useSession()
  const datosBorrador = useMemo(
    () => ({
      version: 1 as const,
      paso,
      form,
      clientesExtra,
      datosFinancieros,
      referenciasBancarias,
      referenciasComerciales,
      licitudFondos,
    }),
    [
      paso,
      form,
      clientesExtra,
      datosFinancieros,
      referenciasBancarias,
      referenciasComerciales,
      licitudFondos,
    ]
  )
  const puedeUsarPantalla = ofertaId ? puedeEditarExistente : puedeCrear
  const borrador = useBorradorAutomatico({
    tipo: "oferta",
    clave: String(idNumero),
    idUsuario: usuarioActual.id,
    datos: datosBorrador,
    listo: !cargando && !error && proceso != null && puedeUsarPantalla,
    alRecuperar: (recuperado) => {
      // FORM_VACIO primero: si después se agregan campos nuevos al formulario, un
      // borrador viejo (sin esos campos) igual deja el form completo.
      setForm({ ...FORM_VACIO, ...recuperado.form })
      setPaso(recuperado.paso ?? 0)
      setClientesExtra(recuperado.clientesExtra ?? [])
      setDatosFinancieros((actual) => ({ ...actual, ...recuperado.datosFinancieros }))
      setReferenciasBancarias(recuperado.referenciasBancarias ?? [])
      setReferenciasComerciales(recuperado.referenciasComerciales ?? [])
      setLicitudFondos((actual) => ({ ...actual, ...recuperado.licitudFondos }))
    },
  })
  const [descartandoBorrador, setDescartandoBorrador] = useState(false)

  async function descartarBorrador() {
    const confirmado = window.confirm(
      "¿Descartar el borrador? Se pierde todo lo que escribiste sin enviar y el formulario vuelve a lo último que se guardó con el botón Guardar."
    )
    if (!confirmado) return
    setDescartandoBorrador(true)
    await borrador.eliminar()
    window.location.reload()
  }

  const titular = proceso?.titular ?? null
  const requiereConyuge = titular?.estado_civil === ESTADO_CIVIL_CASADO

  // Cap. ahorro mensual no se pide: se calcula solo (ingresos mensuales + otros ingresos
  // - gastos mensuales), el campo queda deshabilitado en el paso Datos financieros.
  const capacidadAhorroMensual = useMemo(() => {
    const ingresos = Number(datosFinancieros.ingresoMensual)
    const otros = Number(datosFinancieros.otrosIngresos)
    const gastos = Number(datosFinancieros.gastosMensual)
    if (
      !datosFinancieros.ingresoMensual &&
      !datosFinancieros.otrosIngresos &&
      !datosFinancieros.gastosMensual
    )
      return ""
    if (isNaN(ingresos) || isNaN(otros) || isNaN(gastos)) return ""
    return String(ingresos + otros - gastos)
  }, [
    datosFinancieros.ingresoMensual,
    datosFinancieros.otrosIngresos,
    datosFinancieros.gastosMensual,
  ])

  // Con al menos un "Sí" en las 3 preguntas PEP se despliega el detalle (cargo, país,
  // fechas y relación con el cliente).
  const hayPep = [
    licitudFondos.funcionarioElecto,
    licitudFondos.relacionGobierno,
    licitudFondos.trabajoSectorPublico,
  ].includes("Sí")

  const esEcuador = form.cli_pais === "Ecuador"
  const esEEUU = form.cli_pais === "Estados Unidos"
  const provinciaEstadoAplica = esEcuador || esEEUU
  const labelProvinciaEstado = esEEUU ? "Estado" : "Provincia"
  const opcionesProvinciaEstado = esEcuador
    ? PROVINCIAS_ECUADOR
    : esEEUU
      ? ESTADOS_EEUU
      : []
  const esPichincha = esEcuador && form.cli_provin === "PICHINCHA"
  const esQuito = esPichincha && form.cli_ciudad === "QUITO"

  // Nombre + lote como texto visible (para distinguir personas con el mismo nombre);
  // el valor guardado sigue siendo solo el nombre — ver decisión en cli_contacNombre.
  const opcionesPersonasProceso: ComboboxOption[] = useMemo(
    () =>
      (personasProceso ?? []).map((persona) => ({
        value: persona.nombre,
        label: persona.lote ? `${persona.nombre} — Lote ${persona.lote}` : persona.nombre,
        keywords: persona.lote ?? "",
      })),
    [personasProceso]
  )

  function manejarCambioActividad(nuevaActividad: string) {
    setForm((anterior) => ({
      ...anterior,
      cli_trabActividad: nuevaActividad,
      cli_trabEmpresa: "",
      cli_trabCargo: "",
      cli_trabTiempo: "",
      cli_trabSector: "",
      cli_trabDireccion: "",
      cli_trabTelefono: "",
      cli_trabIngresos: "",
      cli_trabRuc: "",
      cli_trabTipoNegocio: "",
    }))
  }

  function manejarCambioPais(valor: string) {
    setForm((anterior) => ({
      ...anterior,
      cli_pais: valor,
      cli_provin: "",
      cli_ciudad: "",
      cli_sector: "",
    }))
  }

  function manejarCambioProvincia(valor: string) {
    setForm((anterior) => ({
      ...anterior,
      cli_provin: valor,
      cli_ciudad: "",
      cli_sector: "",
    }))
  }

  function manejarCambioCiudad(valor: string) {
    setForm((anterior) => ({ ...anterior, cli_ciudad: valor, cli_sector: "" }))
  }

  const pasos = useMemo<PasoOferta[]>(() => {
    if (!proceso) return []

    const lista: PasoOferta[] = [
      {
        label: "Inmueble",
        icon: Home,
        iconBg: "bg-accent",
        iconColor: "text-primary",
        titulo: "Datos del inmueble",
        subtitulo: "Información del lote ya registrada en el proceso",
        campos: [
          {
            tipo: "seleccion",
            label: "Tipo de operación",
            campo: "cli_tipoOperacion",
            opciones: TIPOS_OPERACION,
            requerido: true,
          },
          {
            tipo: "bloqueado",
            label: "Proyecto",
            value: loteInfo?.proyecto?.nombre ?? "—",
          },
          {
            tipo: "bloqueado",
            label: "Lote",
            value: loteInfo?.codigo ?? proceso.cli_lote ?? "—",
            mono: true,
          },
          {
            tipo: "bloqueado",
            label: "Precio del lote",
            value: formatearPrecio(loteInfo?.pvp ?? proceso.lote_price),
            mono: true,
          },
          {
            tipo: "bloqueado",
            label: "Mts. lote",
            value: formatearMetraje(loteInfo?.areaUtil ?? proceso.lote_mts),
            mono: true,
          },
          {
            tipo: "bloqueado",
            label: "Lugar de venta",
            value: labelLugarVenta(proceso.location),
          },
        ],
      },
      {
        label: "Cliente",
        icon: Users,
        iconBg: "bg-status-hipotecado-bg",
        iconColor: "text-status-hipotecado-fg",
        titulo: "Datos personales — cliente",
        subtitulo: "Lo ya registrado no se puede modificar; complete el contacto",
        campos: [
          {
            tipo: "bloqueado",
            label: "Apellidos y nombres",
            value: titular?.nombre ?? "—",
          },
          {
            tipo: "bloqueado",
            label: "Identificación",
            value: titular?.identificacion ?? "—",
            mono: true,
          },
          {
            tipo: "bloqueado",
            label: "Estado civil",
            value: titular?.estado_civil ?? "—",
          },
          {
            tipo: "bloqueado",
            label: "Fecha nacimiento",
            value: titular?.fecha_nacimiento?.slice(0, 10) ?? "—",
          },
          {
            tipo: "bloqueado",
            label: "Edad",
            value: calcularEdad(titular?.fecha_nacimiento),
          },
          { tipo: "bloqueado", label: "Sexo", value: titular?.sexo ?? "—" },
          {
            tipo: "bloqueado",
            label: "Nacionalidad",
            value: titular?.nacionalidad ?? "—",
          },
          { tipo: "texto", label: "Teléfono", campo: "cli_telef", requerido: true },
          {
            tipo: "texto",
            label: "Correo electrónico",
            campo: "cli_mail",
            requerido: true,
          },
        ],
      },
      {
        label: "Trabajo",
        icon: Briefcase,
        iconBg: "bg-[#F3ECFD]",
        iconColor: "text-[#8B5CF6]",
        titulo: "Datos Laborales",
        subtitulo:
          "Agrege y seleccione los datos relacionados con las labores del cliente",
        campos: [],
      },
      {
        label: "Datos financieros",
        icon: Wallet,
        iconBg: "bg-status-disponible-bg",
        iconColor: "text-status-disponible-fg",
        titulo: "Datos financieros",
        subtitulo:
          "Opcional — ingresos, patrimonio y referencias bancarias y comerciales del cliente",
        campos: [],
      },
      {
        label: "Licitud de Fondos",
        icon: Handshake,
        iconBg: "bg-status-bloqueado-bg",
        iconColor: "text-status-bloqueado-fg",
        titulo: "Licitud de Fondos",
        subtitulo: "Opcional — relación con el gobierno y declaración de fondos",
        campos: [],
      },
      {
        label: "Apoderado",
        icon: Briefcase,
        iconBg: "bg-[#F3ECFD]",
        iconColor: "text-[#8B5CF6]",
        titulo: "Datos de apoderado",
        subtitulo: "Opcional — deje en blanco si el cliente no tiene apoderado",
        campos: [
          { tipo: "texto", label: "Apellidos y nombres", campo: "cli_representante" },
          { tipo: "texto", label: "Identificación", campo: "cli_representanteID" },
          { tipo: "texto", label: "Teléfono", campo: "cli_telefR" },
          { tipo: "texto", label: "Correo electrónico", campo: "cli_representanteMail" },
        ],
      },
      {
        label: "Referencias",
        icon: Handshake,
        iconBg: "bg-status-disponible-bg",
        iconColor: "text-status-disponible-fg",
        titulo: "Referencias familiares",
        subtitulo: "Contactos de familia del cliente",
        // Orden pensado para el grid de 2 columnas: cada fila empareja el mismo campo
        // de ambas referencias (fila 1 = nombres, fila 2 = teléfonos, fila 3 =
        // parentescos que se agregan aparte más abajo), así referencia 1 queda toda en
        // la columna izquierda y referencia 2 toda en la derecha.
        campos: [
          {
            tipo: "texto",
            label: "Nombre — referencia 1",
            campo: "cli_reFami1",
            requerido: true,
          },
          {
            tipo: "texto",
            label: "Nombre — referencia 2",
            campo: "cli_reFami2",
            requerido: true,
          },
          {
            tipo: "texto",
            label: "Teléfono — referencia 1",
            campo: "cli_telParen1",
            requerido: true,
          },
          {
            tipo: "texto",
            label: "Teléfono — referencia 2",
            campo: "cli_telParen2",
            requerido: true,
          },
        ],
      },
    ]

    if (requiereConyuge) {
      lista.push({
        label: "Cónyuge",
        icon: Heart,
        iconBg: "bg-status-bloqueado-bg",
        iconColor: "text-status-bloqueado-fg",
        titulo: "Datos personales — cónyuge",
        subtitulo: "El titular es casado/a — estos datos son obligatorios",
        campos: [
          {
            tipo: "texto",
            label: "Apellidos y nombres",
            campo: "cli_conyuName",
            requerido: true,
          },
          {
            tipo: "texto",
            label: "Identificación",
            campo: "cli_conyuID",
            requerido: true,
          },
          {
            tipo: "fecha",
            label: "Fecha de nacimiento",
            campo: "cli_conyuFecNac",
            requerido: true,
          },
          { tipo: "texto", label: "Teléfono", campo: "cli_conyuCell", requerido: true },
          {
            tipo: "texto",
            label: "Empresa en la que trabaja",
            campo: "cli_conyuTrabEmpresa",
          },
          {
            tipo: "texto",
            label: "Dirección de la empresa",
            campo: "cli_conyuTrabDireccion",
          },
          {
            tipo: "texto",
            label: "Teléfono del trabajo",
            campo: "cli_conyuTrabTelefono",
          },
        ],
      })
    }

    lista.push(
      {
        label: "Referidos",
        icon: UserPlus,
        iconBg: "bg-[#E9FBFA]",
        iconColor: "text-[#0D9488]",
        titulo: "Datos referidos",
        subtitulo: "Opcional — persona que refirió al cliente",
        campos: [
          { tipo: "texto", label: "Nombre de quien refiere", campo: "referido_nombre" },
          { tipo: "texto", label: "Teléfono", campo: "referido_telefono" },
          {
            tipo: "seleccion",
            label: "Relación con el cliente",
            campo: "referido_relacion",
            opciones: RELACIONES,
          },
        ],
      },
      {
        label: "Asesor",
        icon: Users,
        iconBg: "bg-status-reservado-bg",
        iconColor: "text-status-reservado-fg",
        titulo: "Datos asesor inmobiliario",
        subtitulo: "El asesor ya quedó fijado al crear el proceso",
        campos: [
          {
            tipo: "bloqueado",
            label: "Nombre del asesor",
            value: proceso.cli_asesor ?? "—",
          },
          {
            tipo: "texto",
            label: "Teléfono del asesor",
            campo: "cli_asesorTelf",
            requerido: true,
          },
        ],
      }
    )

    return lista
  }, [proceso, loteInfo, titular, requiereConyuge])

  // Un borrador recuperado puede traer un paso que ya no existe (ej. el paso del
  // cónyuge depende de los datos) — se lleva al último disponible.
  useEffect(() => {
    if (pasos.length > 0 && paso > pasos.length - 1) setPaso(pasos.length - 1)
  }, [pasos.length, paso])

  function actualizarCampo(campo: CampoFormulario, valor: string) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
  }

  function agregarClienteExtra() {
    setClientesExtra((anterior) =>
      anterior.length >= 3
        ? anterior
        : [
            ...anterior,
            {
              nombre: "",
              identificacion: "",
              relacion: "",
              pais_residencia: "",
              es_pep: false,
            },
          ]
    )
  }

  function quitarClienteExtra(indice: number) {
    setClientesExtra((anterior) => anterior.filter((_, i) => i !== indice))
  }

  function actualizarClienteExtra(indice: number, cambios: Partial<ClienteExtraInput>) {
    setClientesExtra((anterior) =>
      anterior.map((cliente, i) => (i === indice ? { ...cliente, ...cambios } : cliente))
    )
  }

  function actualizarDatoFinanciero(campo: keyof typeof datosFinancieros, valor: string) {
    setDatosFinancieros((anterior) => ({ ...anterior, [campo]: valor }))
  }

  function agregarReferenciaBancaria() {
    setReferenciasBancarias((anterior) => [
      ...anterior,
      { institucion: "", numeroCuenta: "", tipo: "", ciudad: "" },
    ])
  }

  function quitarReferenciaBancaria(indice: number) {
    setReferenciasBancarias((anterior) => anterior.filter((_, i) => i !== indice))
  }

  function actualizarReferenciaBancaria(
    indice: number,
    cambios: Partial<ReferenciaBancariaInput>
  ) {
    setReferenciasBancarias((anterior) =>
      anterior.map((ref, i) => (i === indice ? { ...ref, ...cambios } : ref))
    )
  }

  function agregarReferenciaComercial() {
    setReferenciasComerciales((anterior) => [
      ...anterior,
      { institucion: "", contacto: "", telefono: "", ciudad: "" },
    ])
  }

  function quitarReferenciaComercial(indice: number) {
    setReferenciasComerciales((anterior) => anterior.filter((_, i) => i !== indice))
  }

  function actualizarReferenciaComercial(
    indice: number,
    cambios: Partial<ReferenciaComercialInput>
  ) {
    setReferenciasComerciales((anterior) =>
      anterior.map((ref, i) => (i === indice ? { ...ref, ...cambios } : ref))
    )
  }

  function actualizarLicitudFondos(campo: keyof typeof licitudFondos, valor: string) {
    setLicitudFondos((anterior) => ({ ...anterior, [campo]: valor }))
  }

  // Un paso está completo cuando todos sus campos marcados "requerido" tienen valor —
  // Apoderado/Referidos no marcan ninguno, así que siempre quedan completos (opcionales
  // de verdad). País/Ciudad/Provincia-Estado/Sector del paso Cliente, Parentesco del
  // paso Referencias y Actividad/campos condicionales del paso Trabajo se renderizan
  // aparte (no viven en el array `campos`), así que su obligatoriedad se valida acá
  // directamente en vez de con la bandera `requerido`.
  function pasoCompleto(p: PasoOferta): boolean {
    const faltaAlgunCampo = p.campos.some(
      (campo) => campo.tipo !== "bloqueado" && campo.requerido && !form[campo.campo]
    )
    if (faltaAlgunCampo) return false
    const identificacionInvalida = p.campos.some(
      (campo) =>
        campo.tipo !== "bloqueado" &&
        CAMPOS_IDENTIFICACION.has(campo.campo) &&
        Boolean(validarIdentificacion(form[campo.campo]))
    )
    if (identificacionInvalida) return false
    const emailInvalido = p.campos.some(
      (campo) =>
        campo.tipo !== "bloqueado" &&
        CAMPOS_EMAIL.has(campo.campo) &&
        Boolean(validarEmail(form[campo.campo]))
    )
    if (emailInvalido) return false
    const telefonoInvalido = p.campos.some(
      (campo) =>
        campo.tipo !== "bloqueado" &&
        campo.campo in CAMPOS_TELEFONO &&
        Boolean(validarTelefono(form[campo.campo]))
    )
    if (telefonoInvalido) return false
    if (p.label === "Inmueble") {
      if (form.cli_tipoOperacion === "Otro" && !form.cli_tipoOperacionOtro.trim())
        return false
    }
    if (p.label === "Cliente") {
      if (!form.cli_pais || !form.cli_ciudad) return false
      if (provinciaEstadoAplica && !form.cli_provin) return false
      if (esQuito && !form.cli_sector) return false
      if (!form.cli_direccion.trim()) return false
      if (
        clientesExtra.some(
          (cliente) =>
            !cliente.nombre ||
            !cliente.identificacion ||
            validarIdentificacion(cliente.identificacion) ||
            !cliente.relacion.trim() ||
            !cliente.pais_residencia
        )
      )
        return false
    }
    if (p.label === "Trabajo") {
      if (!form.cli_trabActividad) return false
      if (!form.cli_trabProfesion) return false
      const esDependiente =
        form.cli_trabActividad === "DEPENDIENTE" || form.cli_trabActividad === "EMPLEADO"
      const esIndependiente =
        form.cli_trabActividad === "INDEPENDIENTE" ||
        form.cli_trabActividad === "COMERCIANTE"
      const esRemesas = form.cli_trabActividad === "REMESAS DEL EXTERIOR"
      if (
        esDependiente &&
        (!form.cli_trabEmpresa ||
          !form.cli_trabCargo ||
          !form.cli_trabTiempo ||
          !form.cli_trabSector ||
          !form.cli_trabDireccion ||
          !form.cli_trabTelefono ||
          Boolean(validarTelefono(form.cli_trabTelefono)))
      )
        return false
      if (
        esIndependiente &&
        (!form.cli_trabTipoNegocio ||
          !form.cli_trabRuc ||
          !form.cli_trabIngresos ||
          !form.cli_trabTiempo)
      )
        return false
      if (esRemesas && (!form.cli_trabRuc || !form.cli_trabIngresos)) return false
      if (form.cli_trabActividad === ACTIVIDAD_OTRO) {
        if (
          !form.cli_transNombre.trim() ||
          !form.cli_transID ||
          Boolean(validarIdentificacion(form.cli_transID)) ||
          !form.cli_transNacionalidad ||
          !form.cli_transProfesion.trim() ||
          !form.cli_transCargo.trim() ||
          !form.cli_transTelefono ||
          Boolean(validarTelefono(form.cli_transTelefono)) ||
          !form.cli_transDireccion.trim() ||
          !form.cli_transCiudad.trim() ||
          !form.cli_transEstadoCivil
        )
          return false
        if (form.cli_transIntermediario === "Sí" && !form.cli_transRelacionDueno.trim())
          return false
      }
    }
    if (p.label === "Referencias") {
      if (!form.cli_paren1 || !form.cli_paren2) return false
    }
    if (p.label === "Datos financieros") {
      if (
        !datosFinancieros.fuenteIngresos ||
        !datosFinancieros.patrimonio ||
        !datosFinancieros.fuentePatrimonio ||
        !datosFinancieros.ingresoMensual ||
        !datosFinancieros.gastosMensual ||
        !datosFinancieros.ahorroActual
      )
        return false
      if (
        datosFinancieros.fuenteIngresos === "Otro" &&
        !(datosFinancieros.fuenteIngresosOtro ?? "").trim()
      )
        return false
    }
    if (p.label === "Licitud de Fondos") {
      if (
        hayPep &&
        (!licitudFondos.pepCargo.trim() ||
          !licitudFondos.pepPais ||
          !licitudFondos.pepFechaInicio ||
          !licitudFondos.pepRelacion.trim())
      )
        return false
      if (
        hayPep &&
        licitudFondos.pepFechaFin &&
        licitudFondos.pepFechaFin < licitudFondos.pepFechaInicio
      )
        return false
    }
    if (p.label === "Asesor") {
      if (!form.cli_contac || !form.cli_motivoCompra) return false
    }
    return true
  }

  const pasoActualCompleto = pasos[paso] ? pasoCompleto(pasos[paso]) : false
  const todosLosPasosCompletos = pasos.length > 0 && pasos.every(pasoCompleto)

  // Concatena prefijo + número al valor plano que espera el backend legacy (ej.
  // "+593999999999") — undefined si no hay número, igual que el resto de campos
  // opcionales del payload.
  function conTelefono(prefijo: string, numero: string): string | undefined {
    return numero ? `${prefijo}${numero}` : undefined
  }

  async function manejarGuardar() {
    if (!proceso || !todosLosPasosCompletos) return
    setGuardando(true)
    try {
      const payload: OfertaFormInput = {
        cli_tipoOperacion: form.cli_tipoOperacion || undefined,
        cli_tipoOperacionOtro:
          form.cli_tipoOperacion === "Otro"
            ? form.cli_tipoOperacionOtro.trim() || undefined
            : "",
        cli_descuento: form.cli_descuento ? Number(form.cli_descuento) : undefined,
        cli_telef: conTelefono(form.cli_telef_prefijo, form.cli_telef),
        cli_mail: form.cli_mail || undefined,
        cli_representante: form.cli_representante || undefined,
        cli_representanteID: form.cli_representanteID || undefined,
        cli_telefR: conTelefono(form.cli_telefR_prefijo, form.cli_telefR),
        cli_representanteMail: form.cli_representanteMail || undefined,
        cli_reFami1: form.cli_reFami1 || undefined,
        cli_paren1: form.cli_paren1 || undefined,
        cli_telParen1: conTelefono(form.cli_telParen1_prefijo, form.cli_telParen1),
        cli_reFami2: form.cli_reFami2 || undefined,
        cli_paren2: form.cli_paren2 || undefined,
        cli_telParen2: conTelefono(form.cli_telParen2_prefijo, form.cli_telParen2),
        cli_conyuName: form.cli_conyuName || undefined,
        cli_conyuID: form.cli_conyuID || undefined,
        cli_conyuFecNac: form.cli_conyuFecNac || undefined,
        cli_conyuCell: conTelefono(form.cli_conyuCell_prefijo, form.cli_conyuCell),
        cli_conyuTrabEmpresa: form.cli_conyuTrabEmpresa || undefined,
        cli_conyuTrabDireccion: form.cli_conyuTrabDireccion || undefined,
        cli_conyuTrabTelefono: conTelefono(
          form.cli_conyuTrabTelefono_prefijo,
          form.cli_conyuTrabTelefono
        ),
        referido_nombre: form.referido_nombre || undefined,
        referido_telefono: conTelefono(
          form.referido_telefono_prefijo,
          form.referido_telefono
        ),
        referido_relacion: form.referido_relacion || undefined,
        cli_asesorTelf: conTelefono(form.cli_asesorTelf_prefijo, form.cli_asesorTelf),
        cli_contac: form.cli_contac || undefined,
        cli_contacNombre: form.cli_contacNombre || undefined,
        prospectador: form.prospectador || undefined,
        cli_motivoCompra: form.cli_motivoCompra || undefined,
        cli_asistenciaProyecto: form.cli_asistenciaProyecto || undefined,
        cli_visitaProyecto: form.cli_visitaProyecto || undefined,
        cli_observation: form.cli_observation || undefined,
        cli_pais: form.cli_pais || undefined,
        cli_provin: provinciaEstadoAplica ? form.cli_provin || undefined : NO_APLICA,
        cli_ciudad: form.cli_ciudad || undefined,
        cli_sector: esQuito ? form.cli_sector || undefined : NO_APLICA,
        cli_direccion: form.cli_direccion.trim() || undefined,
        cli_trabActividad: form.cli_trabActividad || undefined,
        cli_trabEmpresa: form.cli_trabEmpresa || undefined,
        cli_trabProfesion: form.cli_trabProfesion || undefined,
        cli_trabCargo: form.cli_trabCargo || undefined,
        cli_trabTiempo: form.cli_trabTiempo || undefined,
        cli_trabSector: form.cli_trabSector || undefined,
        cli_trabDireccion: form.cli_trabDireccion || undefined,
        cli_trabTelefono: conTelefono(
          form.cli_trabTelefono_prefijo,
          form.cli_trabTelefono
        ),
        cli_trabIngresos: form.cli_trabIngresos
          ? Number(form.cli_trabIngresos)
          : undefined,
        cli_trabRuc: form.cli_trabRuc || undefined,
        cli_trabTipoNegocio: form.cli_trabTipoNegocio || undefined,
        ...(form.cli_trabActividad === ACTIVIDAD_OTRO
          ? {
              cli_transNombre: form.cli_transNombre.trim() || undefined,
              cli_transID: form.cli_transID || undefined,
              cli_transNacionalidad: form.cli_transNacionalidad || undefined,
              cli_transProfesion: form.cli_transProfesion.trim() || undefined,
              cli_transCargo: form.cli_transCargo.trim() || undefined,
              cli_transTelefono: conTelefono(
                form.cli_transTelefono_prefijo,
                form.cli_transTelefono
              ),
              cli_transDireccion: form.cli_transDireccion.trim() || undefined,
              cli_transCiudad: form.cli_transCiudad.trim() || undefined,
              cli_transEstadoCivil: form.cli_transEstadoCivil || undefined,
              cli_transIntermediario: form.cli_transIntermediario || "No",
              cli_transRelacionDueno:
                form.cli_transIntermediario === "Sí"
                  ? form.cli_transRelacionDueno.trim() || undefined
                  : undefined,
            }
          : {}),
        finalizar: true,
      }
      if (ofertaId) {
        await actualizarOferta(idNumero, payload)
      } else {
        await crearOferta(idNumero, payload)
      }
      if (clientesExtra.length > 0) {
        await guardarClientesExtra(idNumero, clientesExtra)
      }
      const hayDatosFinancieros =
        Object.values(datosFinancieros).some(Boolean) ||
        referenciasBancarias.length > 0 ||
        referenciasComerciales.length > 0
      if (hayDatosFinancieros) {
        await guardarDatosFinancieros(idNumero, {
          otrosIngresos: datosFinancieros.otrosIngresos
            ? Number(datosFinancieros.otrosIngresos)
            : undefined,
          fuenteIngresos: datosFinancieros.fuenteIngresos || undefined,
          fuenteIngresosOtro:
            datosFinancieros.fuenteIngresos === "Otro"
              ? (datosFinancieros.fuenteIngresosOtro ?? "").trim() || undefined
              : undefined,
          patrimonio: datosFinancieros.patrimonio
            ? Number(datosFinancieros.patrimonio)
            : undefined,
          fuentePatrimonio: datosFinancieros.fuentePatrimonio || undefined,
          ingresoMensual: datosFinancieros.ingresoMensual
            ? Number(datosFinancieros.ingresoMensual)
            : undefined,
          gastosMensual: datosFinancieros.gastosMensual
            ? Number(datosFinancieros.gastosMensual)
            : undefined,
          ahorroMensual: capacidadAhorroMensual
            ? Number(capacidadAhorroMensual)
            : undefined,
          ahorroActual: datosFinancieros.ahorroActual
            ? Number(datosFinancieros.ahorroActual)
            : undefined,
          referenciasBancarias: referenciasBancarias.filter((ref) =>
            Object.values(ref).some((valor) => valor.trim())
          ),
          referenciasComerciales: referenciasComerciales.filter((ref) =>
            Object.values(ref).some((valor) => valor.trim())
          ),
        })
      }
      const hayLicitudFondos = Object.values(licitudFondos).some(Boolean)
      if (hayLicitudFondos) {
        await guardarLicitudFondos(idNumero, {
          relacionGobierno: licitudFondos.relacionGobierno || undefined,
          trabajoSectorPublico: licitudFondos.trabajoSectorPublico || undefined,
          funcionarioElecto: licitudFondos.funcionarioElecto || undefined,
          pepCargo: hayPep ? licitudFondos.pepCargo.trim() || undefined : undefined,
          pepPais: hayPep ? licitudFondos.pepPais || undefined : undefined,
          pepFechaInicio: hayPep ? licitudFondos.pepFechaInicio || undefined : undefined,
          pepFechaFin: hayPep ? licitudFondos.pepFechaFin || undefined : undefined,
          pepRelacion: hayPep ? licitudFondos.pepRelacion.trim() || undefined : undefined,
          fondosOrigen: licitudFondos.fondosOrigen || undefined,
          fondosDestino: licitudFondos.fondosDestino || undefined,
          // La identificación de la transacción (monto, tipo, banco, cuenta) se movió al
          // paso de Pago — ya no se pide acá.
          transacciones: [],
        })
      }
      // La oferta ya quedó enviada: el borrador deja de hacer falta.
      await borrador.eliminar()
      toast({ variant: "success", description: "Oferta guardada correctamente." })
      // finalizar siempre es true en este payload (ver arriba) — cada guardado exitoso
      // es un envío final, así que se manda al reporte para confirmar/aprobar/devolver
      // en vez de volver a la lista de procesos.
      router.push(`/ventas/oferta/reporte/${idNumero}`)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar la oferta",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  const actual = pasos[paso]
  const esPrimero = paso === 0
  const esUltimo = paso === pasos.length - 1

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="bg-brand-gradient-banner relative flex items-center gap-3 overflow-hidden px-5 py-5 sm:gap-4 sm:px-8.5 sm:py-6.5">
            <div className="absolute -top-15 -right-10 size-55 rounded-full bg-white/9" />
            <div className="relative flex size-11.5 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/18">
              <Users className="size-5.5 text-white" strokeWidth={1.8} />
            </div>
            <div className="relative min-w-0">
              <h1 className="text-lg font-extrabold text-white sm:text-[23px]">
                Formulario de oferta de compra
              </h1>
              <p className="text-sm text-white/90">Complete la información requerida</p>
              <IndicadorAutoguardado estado={borrador.estado} className="mt-1 text-white/85" />
            </div>
          </div>

          <div className="px-4 pt-6 pb-6 sm:px-8.5 sm:pt-8 sm:pb-7.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !actual ? (
              <EmptyState
                title="No se puede abrir la oferta"
                description={error ?? "No se encontró el proceso."}
                dashed
              />
            ) : !(ofertaId ? puedeEditarExistente : puedeCrear) ? (
              <EmptyState
                title="No tienes permiso para esta sección"
                description={
                  ofertaId
                    ? "No tenés el permiso necesario para editar una oferta ya ingresada."
                    : "No tenés el permiso necesario para crear ofertas."
                }
                dashed
              />
            ) : (
              <>
                {borrador.recuperadoEn != null && (
                  <div
                    role="status"
                    className="border-primary/30 bg-primary/5 mb-5.5 flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm">
                      <span className="font-semibold">Recuperamos tu borrador</span>{" "}
                      del{" "}
                      {new Date(borrador.recuperadoEn).toLocaleString("es-EC", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      — todavía no está enviado: revísalo y dale a Guardar cuando esté
                      listo.
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void descartarBorrador()}
                      disabled={descartandoBorrador}
                      className="shrink-0"
                    >
                      Descartar borrador
                    </Button>
                  </div>
                )}
                {observacionesPendientes.length > 0 && (
                  <div className="border-destructive/40 bg-destructive/5 mb-5.5 rounded-md border p-4">
                    <div className="text-destructive mb-2 text-sm font-semibold">
                      El revisor devolvió esta oferta — corrige lo siguiente:
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {observacionesPendientes.map((observacion) => (
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

                <Stepper steps={pasos.map((p) => p.label)} currentIndex={paso} />

                <div className="mb-5.5 flex items-center gap-3.5">
                  <div
                    className={`flex size-10.5 shrink-0 items-center justify-center rounded-xl ${actual.iconBg}`}
                  >
                    <actual.icon
                      className={`size-5 ${actual.iconColor}`}
                      strokeWidth={1.8}
                    />
                  </div>
                  <div>
                    <div className="text-[17px] font-extrabold">{actual.titulo}</div>
                    <div className="text-muted-foreground text-[12.5px]">
                      {actual.subtitulo}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                  {actual.campos.map((campo) => {
                    if (campo.tipo === "bloqueado") {
                      return (
                        <StaticField
                          key={campo.label}
                          label={campo.label}
                          value={campo.value}
                          mono={campo.mono}
                          emphasis={campo.mono}
                        />
                      )
                    }
                    if (campo.tipo === "seleccion") {
                      return (
                        <SelectField
                          key={campo.label}
                          label={campo.requerido ? `${campo.label} *` : campo.label}
                          placeholder="Seleccione"
                          options={opcionesCon(campo.opciones ?? [], form[campo.campo])}
                          value={form[campo.campo]}
                          onValueChange={(valor) => actualizarCampo(campo.campo, valor)}
                        />
                      )
                    }
                    const campoPrefijo = CAMPOS_TELEFONO[campo.campo]
                    if (campoPrefijo) {
                      return (
                        <PhoneField
                          key={campo.label}
                          label={campo.label}
                          requerido={campo.requerido}
                          prefijo={form[campoPrefijo]}
                          numero={form[campo.campo]}
                          onChangePrefijo={(valor) =>
                            actualizarCampo(campoPrefijo, valor)
                          }
                          onChangeNumero={(valor) => actualizarCampo(campo.campo, valor)}
                        />
                      )
                    }
                    return (
                      <TextField
                        key={campo.label}
                        label={campo.requerido ? `${campo.label} *` : campo.label}
                        type={campo.tipo === "fecha" ? "date" : "text"}
                        value={form[campo.campo]}
                        onChange={(valor) => actualizarCampo(campo.campo, valor)}
                        error={
                          CAMPOS_IDENTIFICACION.has(campo.campo)
                            ? validarIdentificacion(form[campo.campo])
                            : CAMPOS_EMAIL.has(campo.campo)
                              ? validarEmail(form[campo.campo])
                              : undefined
                        }
                      />
                    )
                  })}

                  {actual.label === "Inmueble" && form.cli_tipoOperacion === "Otro" && (
                    <TextField
                      label="Especifique el tipo de operación *"
                      value={form.cli_tipoOperacionOtro}
                      onChange={(valor) =>
                        actualizarCampo("cli_tipoOperacionOtro", valor)
                      }
                    />
                  )}

                  {actual.label === "Cliente" && (
                    <>
                      <ComboboxField
                        label="País *"
                        placeholder="Seleccione país"
                        searchPlaceholder="Buscar país…"
                        options={OPCIONES_PAIS}
                        value={form.cli_pais}
                        onChange={manejarCambioPais}
                      />
                      {provinciaEstadoAplica ? (
                        <SelectField
                          label={`${labelProvinciaEstado} *`}
                          placeholder={`Seleccione ${labelProvinciaEstado.toLowerCase()}`}
                          options={opcionesProvinciaEstado}
                          value={form.cli_provin}
                          onValueChange={manejarCambioProvincia}
                        />
                      ) : (
                        <StaticField label="Provincia / Estado" value={NO_APLICA} />
                      )}
                      {esPichincha ? (
                        <SelectField
                          label="Ciudad *"
                          placeholder="Seleccione ciudad"
                          options={CANTONES_PICHINCHA}
                          value={form.cli_ciudad}
                          onValueChange={manejarCambioCiudad}
                        />
                      ) : (
                        <TextField
                          label="Ciudad *"
                          value={form.cli_ciudad}
                          onChange={manejarCambioCiudad}
                        />
                      )}
                      {esQuito ? (
                        <SelectField
                          label="Sector *"
                          placeholder="Seleccione sector"
                          options={SECTORES_QUITO}
                          value={form.cli_sector}
                          onValueChange={(valor) => actualizarCampo("cli_sector", valor)}
                        />
                      ) : (
                        <StaticField label="Sector" value={NO_APLICA} />
                      )}
                      <div className="sm:col-span-2">
                        <TextField
                          label="Dirección del hogar *"
                          placeholder="Calle principal, número y transversal"
                          value={form.cli_direccion}
                          onChange={(valor) => actualizarCampo("cli_direccion", valor)}
                        />
                      </div>

                      <div className="border-border rounded-md border p-4 sm:col-span-2">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">
                              Clientes adicionales
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Opcional — hasta 3
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={clientesExtra.length >= 3}
                            onClick={agregarClienteExtra}
                          >
                            <Plus className="size-3.5" strokeWidth={1.8} />
                            Agregar cliente
                          </Button>
                        </div>
                        {clientesExtra.length > 0 && (
                          <div className="flex flex-col gap-3">
                            {clientesExtra.map((cliente, indice) => (
                              <div
                                key={indice}
                                className="border-border grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2 sm:items-start"
                              >
                                <TextField
                                  label={`Nombre — cliente extra ${indice + 1} *`}
                                  value={cliente.nombre}
                                  onChange={(valor) =>
                                    actualizarClienteExtra(indice, { nombre: valor })
                                  }
                                />
                                <TextField
                                  label={`Identificación — cliente extra ${indice + 1} *`}
                                  value={cliente.identificacion}
                                  onChange={(valor) =>
                                    actualizarClienteExtra(indice, {
                                      identificacion: valor,
                                    })
                                  }
                                  error={validarIdentificacion(cliente.identificacion)}
                                />
                                <SelectField
                                  label="Relación con el cliente *"
                                  placeholder="Seleccione"
                                  options={opcionesCon(RELACIONES, cliente.relacion)}
                                  value={cliente.relacion}
                                  onValueChange={(valor) =>
                                    actualizarClienteExtra(indice, { relacion: valor })
                                  }
                                />
                                <ComboboxField
                                  label="País de residencia *"
                                  placeholder="Seleccione país"
                                  searchPlaceholder="Buscar país…"
                                  options={OPCIONES_PAIS}
                                  value={cliente.pais_residencia}
                                  onChange={(valor) =>
                                    actualizarClienteExtra(indice, {
                                      pais_residencia: valor,
                                    })
                                  }
                                />
                                <SelectField
                                  label="¿Es PEP? *"
                                  placeholder="Seleccione"
                                  options={["Sí", "No"]}
                                  value={cliente.es_pep ? "Sí" : "No"}
                                  onValueChange={(valor) =>
                                    actualizarClienteExtra(indice, {
                                      es_pep: valor === "Sí",
                                    })
                                  }
                                />
                                <div className="flex justify-end sm:items-end sm:self-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Quitar cliente extra ${indice + 1}`}
                                    onClick={() => quitarClienteExtra(indice)}
                                  >
                                    <Trash2
                                      className="text-destructive size-4"
                                      strokeWidth={1.8}
                                    />
                                    Quitar
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {actual.label === "Trabajo" && (
                    <>
                      {/* Seleccionable de Actividad */}
                      <div className="sm:col-span-2">
                        <ComboboxField
                          label="Actividad *"
                          placeholder="Seleccione la actividad laboral"
                          searchPlaceholder="Buscar actividad…"
                          options={OPCIONES_ACTIVIDADES}
                          value={form.cli_trabActividad}
                          onChange={manejarCambioActividad}
                        />
                      </div>

                      {/* Profesión / ocupación — aplica a cualquier tipo de actividad,
                          se muestra en el reporte de licitud de fondos. */}
                      <SelectField
                        label="Profesión / Ocupación *"
                        placeholder="Seleccione la profesión"
                        options={opcionesCon(CARGOS_OPCIONES, form.cli_trabProfesion)}
                        value={form.cli_trabProfesion}
                        onValueChange={(valor) =>
                          actualizarCampo("cli_trabProfesion", valor)
                        }
                      />

                      {/* CAMPOS PARA EMPLEADO / DEPENDIENTE */}
                      {(form.cli_trabActividad === "DEPENDIENTE" ||
                        form.cli_trabActividad === "EMPLEADO") && (
                        <>
                          <TextField
                            label="Empresa donde trabaja *"
                            value={form.cli_trabEmpresa}
                            onChange={(valor) =>
                              actualizarCampo("cli_trabEmpresa", valor)
                            }
                          />
                          {/* CARGO COMO SELECT / DESPLEGABLE */}
                          <SelectField
                            label="Cargo / Puesto *"
                            placeholder="Seleccione el cargo"
                            options={CARGOS_OPCIONES}
                            value={form.cli_trabCargo}
                            onValueChange={(valor) =>
                              actualizarCampo("cli_trabCargo", valor)
                            }
                          />

                          <TextField
                            label="Antigüedad de relación (años) *"
                            type="number"
                            value={form.cli_trabTiempo}
                            onChange={(valor) => actualizarCampo("cli_trabTiempo", valor)}
                          />
                          <TextField
                            label="Sector *"
                            value={form.cli_trabSector}
                            onChange={(valor) => actualizarCampo("cli_trabSector", valor)}
                          />
                          <TextField
                            label="Dirección *"
                            value={form.cli_trabDireccion}
                            onChange={(valor) =>
                              actualizarCampo("cli_trabDireccion", valor)
                            }
                          />
                          <PhoneField
                            label="Telefono"
                            requerido
                            prefijo={form.cli_trabTelefono_prefijo}
                            numero={form.cli_trabTelefono}
                            onChangePrefijo={(valor) =>
                              actualizarCampo("cli_trabTelefono_prefijo", valor)
                            }
                            onChangeNumero={(valor) =>
                              actualizarCampo("cli_trabTelefono", valor)
                            }
                          />
                        </>
                      )}

                      {/* CAMPOS PARA INDEPENDIENTE / NEGOCIO PROPIO */}
                      {(form.cli_trabActividad === "INDEPENDIENTE" ||
                        form.cli_trabActividad === "COMERCIANTE") && (
                        <>
                          <TextField
                            label="Nombre del negocio *"
                            value={form.cli_trabTipoNegocio}
                            onChange={(valor) =>
                              actualizarCampo("cli_trabTipoNegocio", valor)
                            }
                          />
                          <TextField
                            label="RUC / RISE *"
                            value={form.cli_trabRuc}
                            onChange={(valor) => actualizarCampo("cli_trabRuc", valor)}
                          />
                          <TextField
                            label="Ingresos mensuales aproximados ($) *"
                            type="number"
                            value={form.cli_trabIngresos}
                            onChange={(valor) =>
                              actualizarCampo("cli_trabIngresos", valor)
                            }
                          />
                          <TextField
                            label="Antigüedad de relación (años) *"
                            type="number"
                            value={form.cli_trabTiempo}
                            onChange={(valor) => actualizarCampo("cli_trabTiempo", valor)}
                          />
                        </>
                      )}

                      {/* CAMPOS PARA JUBILADO / PENSIONISTA */}
                      {form.cli_trabActividad === "REMESAS DEL EXTERIOR" && (
                        <>
                          <TextField
                            label="Nombre de quien envia dinero *"
                            value={form.cli_trabRuc}
                            onChange={(valor) => actualizarCampo("cli_trabRuc", valor)}
                          />
                          <TextField
                            label="Relacion *"
                            type="number"
                            value={form.cli_trabIngresos}
                            onChange={(valor) =>
                              actualizarCampo("cli_trabIngresos", valor)
                            }
                          />
                        </>
                      )}

                      {/* CAMPOS PARA "OTRO": quién efectúa la transacción (sección 3 UAFE) */}
                      {form.cli_trabActividad === ACTIVIDAD_OTRO && (
                        <div className="border-border rounded-md border p-4 sm:col-span-2">
                          <div className="mb-4 text-sm font-semibold">
                            Datos de quien efectúa la transacción
                          </div>
                          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                            <TextField
                              label="Nombres y apellidos *"
                              value={form.cli_transNombre}
                              onChange={(valor) =>
                                actualizarCampo("cli_transNombre", valor)
                              }
                            />
                            <TextField
                              label="N.º Cédula / Pasaporte *"
                              value={form.cli_transID}
                              onChange={(valor) => actualizarCampo("cli_transID", valor)}
                              error={validarIdentificacion(form.cli_transID)}
                            />
                            <ComboboxField
                              label="Nacionalidad *"
                              placeholder="Seleccione nacionalidad"
                              searchPlaceholder="Buscar nacionalidad…"
                              options={OPCIONES_NACIONALIDAD}
                              value={form.cli_transNacionalidad}
                              onChange={(valor) =>
                                actualizarCampo("cli_transNacionalidad", valor)
                              }
                            />
                            <TextField
                              label="Profesión *"
                              value={form.cli_transProfesion}
                              onChange={(valor) =>
                                actualizarCampo("cli_transProfesion", valor)
                              }
                            />
                            <TextField
                              label="Cargo / Posición *"
                              value={form.cli_transCargo}
                              onChange={(valor) =>
                                actualizarCampo("cli_transCargo", valor)
                              }
                            />
                            <PhoneField
                              label="Teléfono"
                              requerido
                              prefijo={form.cli_transTelefono_prefijo}
                              numero={form.cli_transTelefono}
                              onChangePrefijo={(valor) =>
                                actualizarCampo("cli_transTelefono_prefijo", valor)
                              }
                              onChangeNumero={(valor) =>
                                actualizarCampo("cli_transTelefono", valor)
                              }
                            />
                            <TextField
                              label="Dirección domicilio *"
                              value={form.cli_transDireccion}
                              onChange={(valor) =>
                                actualizarCampo("cli_transDireccion", valor)
                              }
                            />
                            <TextField
                              label="Ciudad *"
                              value={form.cli_transCiudad}
                              onChange={(valor) =>
                                actualizarCampo("cli_transCiudad", valor)
                              }
                            />
                            <SelectField
                              label="Estado civil *"
                              placeholder="Seleccione estado civil"
                              options={ESTADOS_CIVILES}
                              value={form.cli_transEstadoCivil}
                              onValueChange={(valor) =>
                                actualizarCampo("cli_transEstadoCivil", valor)
                              }
                            />
                            <SelectField
                              label="¿Actúa como intermediario del verdadero dueño / beneficiario final de los fondos? *"
                              placeholder="Seleccione"
                              options={SI_NO_OPCIONES}
                              value={form.cli_transIntermediario}
                              onValueChange={(valor) =>
                                actualizarCampo("cli_transIntermediario", valor)
                              }
                            />
                            {form.cli_transIntermediario === "Sí" && (
                              <SelectField
                                label="Relación con el verdadero dueño de los fondos *"
                                placeholder="Seleccione"
                                options={opcionesCon(
                                  RELACIONES,
                                  form.cli_transRelacionDueno
                                )}
                                value={form.cli_transRelacionDueno}
                                onValueChange={(valor) =>
                                  actualizarCampo("cli_transRelacionDueno", valor)
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {actual.label === "Datos financieros" && (
                    <>
                      <SelectField
                        label="Fuente de Ingresos *"
                        placeholder="Seleccione la fuente de ingresos"
                        options={opcionesCon(
                          FUENTES_INGRESOS,
                          datosFinancieros.fuenteIngresos
                        )}
                        value={datosFinancieros.fuenteIngresos}
                        onValueChange={(valor) =>
                          actualizarDatoFinanciero("fuenteIngresos", valor)
                        }
                      />
                      {datosFinancieros.fuenteIngresos === "Otro" && (
                        <TextField
                          label="Especifique la fuente *"
                          value={datosFinancieros.fuenteIngresosOtro ?? ""}
                          onChange={(valor) =>
                            actualizarDatoFinanciero("fuenteIngresosOtro", valor)
                          }
                        />
                      )}
                      <TextField
                        label="Ingresos mensuales ($) *"
                        type="number"
                        value={datosFinancieros.ingresoMensual}
                        onChange={(valor) =>
                          actualizarDatoFinanciero("ingresoMensual", valor)
                        }
                      />
                      <TextField
                        label="Otros ingresos ($/mes)"
                        type="number"
                        value={datosFinancieros.otrosIngresos}
                        onChange={(valor) =>
                          actualizarDatoFinanciero("otrosIngresos", valor)
                        }
                      />
                      <TextField
                        label="Gastos Mensuales ($) *"
                        type="number"
                        value={datosFinancieros.gastosMensual}
                        onChange={(valor) =>
                          actualizarDatoFinanciero("gastosMensual", valor)
                        }
                      />
                      <TextField
                        label="Cap. ahorro mensual ($)"
                        type="number"
                        value={capacidadAhorroMensual}
                        disabled
                      />
                      <TextField
                        label="Ahorro actual ($) *"
                        type="number"
                        value={datosFinancieros.ahorroActual}
                        onChange={(valor) =>
                          actualizarDatoFinanciero("ahorroActual", valor)
                        }
                      />
                      <TextField
                        label="Patrimonio aproximado ($) *"
                        type="number"
                        value={datosFinancieros.patrimonio}
                        onChange={(valor) =>
                          actualizarDatoFinanciero("patrimonio", valor)
                        }
                      />
                      <SelectField
                        label="Fuente de Patrimonio *"
                        placeholder="Seleccione la fuente del patrimonio"
                        options={opcionesCon(
                          FUENTES_INGRESOS,
                          datosFinancieros.fuentePatrimonio
                        )}
                        value={datosFinancieros.fuentePatrimonio}
                        onValueChange={(valor) =>
                          actualizarDatoFinanciero("fuentePatrimonio", valor)
                        }
                      />

                      <div className="border-border rounded-md border p-4 sm:col-span-2">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">
                              Referencias bancarias
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Opcional — institución, cuenta, tipo y ciudad
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={agregarReferenciaBancaria}
                          >
                            <Plus className="size-3.5" strokeWidth={1.8} />
                            Agregar referencia
                          </Button>
                        </div>
                        {referenciasBancarias.length > 0 && (
                          <div className="flex flex-col gap-3">
                            {referenciasBancarias.map((ref, indice) => (
                              <div
                                key={indice}
                                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-start"
                              >
                                <TextField
                                  label={`${indice + 1}) Institución financiera`}
                                  value={ref.institucion}
                                  onChange={(valor) =>
                                    actualizarReferenciaBancaria(indice, {
                                      institucion: valor,
                                    })
                                  }
                                />
                                <TextField
                                  label={`${indice + 1}) N.º de cuenta`}
                                  value={ref.numeroCuenta}
                                  onChange={(valor) =>
                                    actualizarReferenciaBancaria(indice, {
                                      numeroCuenta: valor,
                                    })
                                  }
                                />
                                <SelectField
                                  label={`${indice + 1}) Tipo`}
                                  placeholder="Seleccione"
                                  options={["Ahorros", "Corriente"]}
                                  value={ref.tipo}
                                  onValueChange={(valor) =>
                                    actualizarReferenciaBancaria(indice, { tipo: valor })
                                  }
                                />
                                <TextField
                                  label={`${indice + 1}) Ciudad`}
                                  value={ref.ciudad}
                                  onChange={(valor) =>
                                    actualizarReferenciaBancaria(indice, {
                                      ciudad: valor,
                                    })
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="mt-6.5"
                                  aria-label={`Quitar referencia bancaria ${indice + 1}`}
                                  onClick={() => quitarReferenciaBancaria(indice)}
                                >
                                  <Trash2
                                    className="text-destructive size-4"
                                    strokeWidth={1.8}
                                  />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-border rounded-md border p-4 sm:col-span-2">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">
                              Referencias comerciales
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Opcional — institución, contacto, teléfono y ciudad
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={agregarReferenciaComercial}
                          >
                            <Plus className="size-3.5" strokeWidth={1.8} />
                            Agregar referencia
                          </Button>
                        </div>
                        {referenciasComerciales.length > 0 && (
                          <div className="flex flex-col gap-3">
                            {referenciasComerciales.map((ref, indice) => (
                              <div
                                key={indice}
                                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-start"
                              >
                                <TextField
                                  label={`${indice + 1}) Institución`}
                                  value={ref.institucion}
                                  onChange={(valor) =>
                                    actualizarReferenciaComercial(indice, {
                                      institucion: valor,
                                    })
                                  }
                                />
                                <TextField
                                  label={`${indice + 1}) Contacto`}
                                  value={ref.contacto}
                                  onChange={(valor) =>
                                    actualizarReferenciaComercial(indice, {
                                      contacto: valor,
                                    })
                                  }
                                />
                                <TextField
                                  label={`${indice + 1}) Teléfono`}
                                  value={ref.telefono}
                                  onChange={(valor) =>
                                    actualizarReferenciaComercial(indice, {
                                      telefono: valor,
                                    })
                                  }
                                />
                                <TextField
                                  label={`${indice + 1}) Ciudad`}
                                  value={ref.ciudad}
                                  onChange={(valor) =>
                                    actualizarReferenciaComercial(indice, {
                                      ciudad: valor,
                                    })
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="mt-6.5"
                                  aria-label={`Quitar referencia comercial ${indice + 1}`}
                                  onClick={() => quitarReferenciaComercial(indice)}
                                >
                                  <Trash2
                                    className="text-destructive size-4"
                                    strokeWidth={1.8}
                                  />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {actual.label === "Licitud de Fondos" && (
                    <>
                      <div className="sm:col-span-2">
                        <div className="text-sm font-semibold">
                          Preguntas para Licitud de Fondos
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <SelectField
                          label="¿El cliente es o ha sido funcionario, electo o designado en algún cargo gubernamental o público?"
                          placeholder="Seleccione"
                          options={SI_NO_OPCIONES}
                          value={licitudFondos.funcionarioElecto}
                          onValueChange={(valor) =>
                            actualizarLicitudFondos("funcionarioElecto", valor)
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <SelectField
                          label="¿El cliente tiene relación familiar o de negocio con algún funcionario o entidad de gobierno?"
                          placeholder="Seleccione"
                          options={SI_NO_OPCIONES}
                          value={licitudFondos.relacionGobierno}
                          onValueChange={(valor) =>
                            actualizarLicitudFondos("relacionGobierno", valor)
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <SelectField
                          label="¿El cliente realiza trabajos o contratos para alguna entidad del sector público?"
                          placeholder="Seleccione"
                          options={SI_NO_OPCIONES}
                          value={licitudFondos.trabajoSectorPublico}
                          onValueChange={(valor) =>
                            actualizarLicitudFondos("trabajoSectorPublico", valor)
                          }
                        />
                      </div>

                      {hayPep && (
                        <div className="border-border rounded-md border p-4 sm:col-span-2">
                          <div className="mb-4 text-sm font-semibold">
                            Detalle de persona expuesta políticamente (PEP)
                          </div>
                          <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
                            <TextField
                              label="Cargo / Función PEP *"
                              value={licitudFondos.pepCargo}
                              onChange={(valor) =>
                                actualizarLicitudFondos("pepCargo", valor)
                              }
                            />
                            <ComboboxField
                              label="País *"
                              placeholder="Seleccione país"
                              searchPlaceholder="Buscar país…"
                              options={OPCIONES_PAIS}
                              value={licitudFondos.pepPais}
                              onChange={(valor) =>
                                actualizarLicitudFondos("pepPais", valor)
                              }
                            />
                            <TextField
                              label="Fecha inicio *"
                              type="date"
                              value={licitudFondos.pepFechaInicio}
                              onChange={(valor) =>
                                actualizarLicitudFondos("pepFechaInicio", valor)
                              }
                            />
                            <TextField
                              label="Fecha fin"
                              type="date"
                              value={licitudFondos.pepFechaFin}
                              onChange={(valor) =>
                                actualizarLicitudFondos("pepFechaFin", valor)
                              }
                              error={
                                licitudFondos.pepFechaFin &&
                                licitudFondos.pepFechaFin < licitudFondos.pepFechaInicio
                                  ? "La fecha fin no puede ser anterior a la de inicio"
                                  : undefined
                              }
                            />
                            <div className="sm:col-span-2">
                              <SelectField
                                label="Relación con el cliente (PEP) *"
                                placeholder="Seleccione"
                                options={opcionesCon(
                                  RELACIONES,
                                  licitudFondos.pepRelacion
                                )}
                                value={licitudFondos.pepRelacion}
                                onValueChange={(valor) =>
                                  actualizarLicitudFondos("pepRelacion", valor)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <TextField
                          label="¿De dónde provienen los fondos, bienes muebles e inmuebles de esta transacción?"
                          value={licitudFondos.fondosOrigen}
                          onChange={(valor) =>
                            actualizarLicitudFondos("fondosOrigen", valor)
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <TextField
                          label="¿Para qué serán utilizados los fondos, bienes muebles e inmuebles de esta transacción?"
                          value={licitudFondos.fondosDestino}
                          onChange={(valor) =>
                            actualizarLicitudFondos("fondosDestino", valor)
                          }
                        />
                      </div>
                    </>
                  )}

                  {actual.label === "Referencias" && (
                    <>
                      <SelectField
                        label="Parentesco — referencia 1 *"
                        placeholder="Seleccione parentesco"
                        options={PARENTESCOS}
                        value={form.cli_paren1}
                        onValueChange={(valor) => actualizarCampo("cli_paren1", valor)}
                      />
                      <SelectField
                        label="Parentesco — referencia 2 *"
                        placeholder="Seleccione parentesco"
                        options={PARENTESCOS}
                        value={form.cli_paren2}
                        onValueChange={(valor) => actualizarCampo("cli_paren2", valor)}
                      />
                    </>
                  )}

                  {actual.label === "Asesor" && (
                    <>
                      <SelectField
                        label="¿Cómo nos contactó? *"
                        placeholder="Seleccione como nos contacto"
                        grupos={MEDIOS_CONTACTO_GRUPOS}
                        value={form.cli_contac}
                        onValueChange={(valor) => actualizarCampo("cli_contac", valor)}
                      />
                      {form.cli_contac === "EXTERNO" && (
                        <TextField
                          label="Nombre de la persona"
                          value={form.cli_contacNombre}
                          onChange={(valor) => actualizarCampo("cli_contacNombre", valor)}
                        />
                      )}
                      {form.cli_contac === "CLIENTE" && (
                        <ComboboxField
                          label="Nombre de la persona"
                          placeholder={
                            cargandoPersonas ? "Cargando clientes…" : "Busque por nombre"
                          }
                          searchPlaceholder="Buscar por nombre…"
                          emptyMessage={
                            cargandoPersonas ? "Cargando…" : "Sin resultados."
                          }
                          options={opcionesPersonasProceso}
                          value={form.cli_contacNombre}
                          onChange={(valor) => actualizarCampo("cli_contacNombre", valor)}
                        />
                      )}
                      <SelectField
                        label="Prospectador"
                        placeholder="Seleccione prospectador"
                        options={PROSPECTADORES}
                        value={form.prospectador}
                        onValueChange={(valor) => actualizarCampo("prospectador", valor)}
                      />
                      <MultiSelectField
                        label="Motivo de compra *"
                        placeholder="Seleccione motivo(s) de compra"
                        options={MOTIVOS_COMPRA}
                        value={
                          form.cli_motivoCompra ? form.cli_motivoCompra.split(",") : []
                        }
                        onChange={(valores) =>
                          actualizarCampo("cli_motivoCompra", valores.join(","))
                        }
                      />
                      <div
                        onClick={() =>
                          actualizarCampo(
                            "cli_asistenciaProyecto",
                            form.cli_asistenciaProyecto === "Sí" ? "No" : "Sí"
                          )
                        }
                        className="border-input flex h-11 cursor-pointer items-center justify-between rounded-md border px-3.5"
                      >
                        <span className="text-sm font-medium">
                          Asistencia en proyecto
                        </span>
                        <Checkbox
                          checked={form.cli_asistenciaProyecto === "Sí"}
                          onCheckedChange={(marcado) =>
                            actualizarCampo(
                              "cli_asistenciaProyecto",
                              marcado ? "Sí" : "No"
                            )
                          }
                          aria-label="Asistencia en proyecto"
                        />
                      </div>
                      <div
                        onClick={() =>
                          actualizarCampo(
                            "cli_visitaProyecto",
                            form.cli_visitaProyecto === "Sí" ? "No" : "Sí"
                          )
                        }
                        className="border-input flex h-11 cursor-pointer items-center justify-between rounded-md border px-3.5"
                      >
                        <span className="text-sm font-medium">Visitó el proyecto</span>
                        <Checkbox
                          checked={form.cli_visitaProyecto === "Sí"}
                          onCheckedChange={(marcado) =>
                            actualizarCampo("cli_visitaProyecto", marcado ? "Sí" : "No")
                          }
                          aria-label="Visitó el proyecto"
                        />
                      </div>
                      <TextField
                        label="Observaciones"
                        value={form.cli_observation}
                        onChange={(valor) => actualizarCampo("cli_observation", valor)}
                      />
                    </>
                  )}
                </div>

                <div className="border-border mt-6 border-t pt-5 sm:mt-7.5 sm:pt-5.5">
                  {!pasoActualCompleto && (
                    <p className="text-destructive mb-3 text-xs font-medium">
                      Completa los campos obligatorios (*) para continuar.
                    </p>
                  )}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground text-xs">
                      Paso {paso + 1} de {pasos.length}
                    </span>
                    <div className="flex gap-3 [&>button]:flex-1 sm:[&>button]:flex-none">
                      {esPrimero ? (
                        <Button variant="outline" onClick={() => router.back()}>
                          Cancelar
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => setPaso((p) => p - 1)}>
                          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                          Atrás
                        </Button>
                      )}
                      {esUltimo ? (
                        <Button
                          disabled={!todosLosPasosCompletos || guardando}
                          onClick={manejarGuardar}
                        >
                          {guardando ? "Guardando…" : "Guardar oferta"}
                        </Button>
                      ) : (
                        <Button
                          disabled={!pasoActualCompleto}
                          onClick={() => setPaso((p) => p + 1)}
                        >
                          Siguiente
                          <ArrowRight className="size-3.5" strokeWidth={1.8} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
