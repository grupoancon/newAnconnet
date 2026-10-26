"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Printer } from "lucide-react"
import { useRouter } from "@/lib/navigation"

import { useCan } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import {
  CheckBox,
  Cell,
  FormSection,
  FormTable,
  Label,
  Nota,
  Row,
  SignatureCell,
  Value,
  YesNoRow,
} from "@/components/shared/compliance-form-grid"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { obtenerLote, type LoteInventario } from "@/lib/api/inventario-api"
import {
  VentasApiError,
  listarClientesExtra,
  obtenerDatosFinancieros,
  obtenerLicitudFondos,
  obtenerOferta,
  obtenerPago,
  obtenerProceso,
  type ClienteExtraBackend,
  type DatosFinancierosBackend,
  type LicitudFondosBackend,
  type OfertaBackend,
  type PagoBackend,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"

const EMPRESA = "INMOCONSTRUCCIONES CÍA. LTDA."

const DOCUMENTOS_CHECKLIST = [
  "Cédula de identidad / Pasaporte (original verificado)",
  "RUC / RISE (si aplica)",
  "Estado de cuenta bancario (últimos 3 meses)",
  "Carta / certificado de ingresos o rol de pagos",
  "Declaración de impuesto a la renta (último año)",
  "Documentos del inmueble (escritura, avalúo catastral)",
  "Consulta en listas restrictivas UAFE / OFAC / ONU",
  "Comprobante de origen de fondos (transferencia / depósito)",
]

// Los campos sin dato quedan en blanco (igual que el formulario impreso), no con "—".
function texto(valor: string | null | undefined): string {
  return valor && valor.trim() ? valor : ""
}

// Antigüedad de relación (paso Trabajo de la oferta) solo se pide para dependientes e
// independientes — para el resto de actividades (jubilado, remesas del exterior, otro)
// no aplica, se marca "Sin información" en vez de dejarlo en blanco.
function labelAntiguedad(
  actividad: string | null | undefined,
  tiempo: string | null | undefined
): string {
  const aplica = ["DEPENDIENTE", "EMPLEADO", "INDEPENDIENTE", "COMERCIANTE"].includes(
    actividad ?? ""
  )
  return aplica ? texto(tiempo) : "Sin información"
}

function numeroPlano(valor: number | null | undefined): string {
  return valor == null || Number.isNaN(valor) ? "" : String(valor)
}

// % de participación repartido en partes iguales entre el titular y los clientes
// adicionales (sección 4) — 1 persona = 100%, 2 = 50%, 3 = 33.33%, etc.
function formatearPorcentaje(totalPersonas: number): string {
  const valor = totalPersonas > 0 ? 100 / totalPersonas : 100
  const redondeado = Math.round(valor * 100) / 100
  return `${Number.isInteger(redondeado) ? redondeado : redondeado.toFixed(2)}%`
}

function formatearPrecio(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return ""
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

// "1954-07-22..." -> "22/07/1954"
function soloFecha(valor: string | null | undefined): string {
  const [anio, mes, dia] = (valor ?? "").slice(0, 10).split("-")
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : ""
}

// "17/9/2026, 9:15:52" (dia/mes sin cero a la izquierda, hora 24h, como el PDF)
function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return ""
  const f = new Date(valor)
  if (isNaN(f.getTime())) return ""
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}, ${f.getHours()}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`
}

function respuesta(valor: string | null | undefined): "si" | "no" | null {
  const limpio = (valor ?? "").trim().toLowerCase()
  if (limpio.startsWith("s")) return "si"
  if (limpio.startsWith("n")) return "no"
  return null
}

export function LicitudReporteContent({ id }: { id: string }) {
  const router = useRouter()
  const idNumero = Number(id)
  // Sin este permiso no se puede ni ver ni imprimir la licitud de fondos (no hay ruta
  // /imprimir aparte para esta pantalla: el botón "Imprimir licitud" usa window.print()
  // sobre el mismo contenido) — se bloquea toda la sección más abajo.
  const puedeVer = useCan("licitud:imprimir")

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [oferta, setOferta] = useState<OfertaBackend | null>(null)
  const [financieros, setFinancieros] = useState<DatosFinancierosBackend | null>(null)
  const [licitud, setLicitud] = useState<LicitudFondosBackend | null>(null)
  const [clientesExtra, setClientesExtra] = useState<ClienteExtraBackend[]>([])
  const [pago, setPago] = useState<PagoBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          ofertaData,
          financierosData,
          licitudData,
          clientesExtraData,
          pagoData,
          lote,
        ] = await Promise.all([
          obtenerOferta(idNumero),
          obtenerDatosFinancieros(idNumero),
          obtenerLicitudFondos(idNumero),
          listarClientesExtra(idNumero),
          obtenerPago(idNumero),
          procesoData.cli_lote
            ? obtenerLote(procesoData.cli_lote)
            : Promise.resolve(null),
        ])
        if (cancelado) return
        setOferta(ofertaData)
        setFinancieros(financierosData)
        setLicitud(licitudData)
        setClientesExtra(clientesExtraData)
        setPago(pagoData)
        setLoteInfo(lote)

        if (!ofertaData) {
          setError("Este proceso todavía no tiene una oferta ingresada.")
        }
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof VentasApiError
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
  const otraPersona = oferta?.cli_trabActividad === "OTRO"

  // Sección 4 — beneficiarios finales: siempre arranca con el titular (sección 1), le
  // siguen los clientes adicionales agregados en el paso "Cliente" de la oferta. La
  // participación se reparte en partes iguales entre todos (ver formatearPorcentaje);
  // el PEP del titular sale de las 3 preguntas de la sección 2, el de cada cliente
  // extra ya viene guardado (es_pep) desde ese mismo paso.
  const esPepTitular = [
    licitud?.funcionarioElecto,
    licitud?.relacionGobierno,
    licitud?.trabajoSectorPublico,
  ].some((valor) => valor === "Sí")
  const beneficiarios = [
    {
      id: "titular",
      nombre: titular?.nombre ?? "",
      identificacion: titular?.identificacion ?? "",
      relacion: "TITULAR",
      pais: oferta?.cli_pais ?? "",
      esPep: esPepTitular,
    },
    ...clientesExtra.map((cliente) => ({
      id: String(cliente.id),
      nombre: cliente.nombre ?? "",
      identificacion: cliente.identificacion ?? "",
      relacion: cliente.relacion ?? "",
      pais: cliente.pais_residencia ?? "",
      esPep: Boolean(cliente.es_pep),
    })),
  ]
  const porcentajeParticipacion = formatearPorcentaje(beneficiarios.length)
  const referenciasBancarias = financieros?.referenciasBancarias ?? []
  const referenciasComerciales = financieros?.referenciasComerciales ?? []
  const filasReferencias = Math.max(
    2,
    referenciasBancarias.length,
    referenciasComerciales.length
  )

  return (
    <div className="flex h-full flex-col">
      <div className="no-print">
        <DashboardTopbar />
      </div>

      {!puedeVer ? (
        <div className="flex flex-1 items-center justify-center p-6.5">
          <EmptyState
            title="No tienes permiso para esta sección"
            description="No tenés el permiso necesario para ver ni imprimir la licitud de fondos."
            dashed
          />
        </div>
      ) : (
        <>
          <div className="bg-brand-gradient-banner no-print flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6.5">
            <Button
              className="bg-status-disponible text-white shadow-none hover:brightness-95"
              size="sm"
              disabled={!oferta}
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" strokeWidth={1.8} />
              Imprimir licitud
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border border-white/50 text-white hover:bg-white/10"
              onClick={() => router.back()}
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.8} />
              Atrás
            </Button>
          </div>

          <div className="licitud-scroll flex-1 overflow-auto p-4 sm:p-5 lg:p-6.5 print:overflow-visible! print:p-0!">
            {cargando ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : error && !oferta ? (
              <EmptyState title="No se pudo cargar la licitud" description={error} />
            ) : (
              // Hoja A4 (794px) con 32px de margen = 730px de contenido, que es el ancho sobre el
              // que se midieron las proporciones del PDF; al imprimir el margen lo pone @page.
              <div className="licitud-sheet border-border mx-auto w-full max-w-[794px] min-w-[794px] rounded-lg border bg-white p-8 text-black shadow-sm print:mx-0! print:max-w-none! print:min-w-0! print:rounded-none! print:border-0! print:p-0! print:shadow-none!">
                {/* ENCABEZADO */}
                <header className="mb-1.5 text-center">
                  <div className="text-[11.5px] leading-[14px] font-extrabold">
                    {EMPRESA}
                  </div>
                  <div className="mt-2 text-[10px] leading-[12px] font-extrabold">
                    FORMULARIO ÚNICO DE ORIGEN LÍCITO DE RECURSOS
                  </div>
                  <div className="mt-2.5 text-[7.5px] leading-[9px] text-neutral-500 italic">
                    Conforme Decreto Ejecutivo N.° 298 — Reglamento General Ley Orgánica
                    de Prevención, Detección y Combate del Lavado de Activos / UAFE 2026
                  </div>
                </header>

                <FormTable className="mb-2.5">
                  <Row cols={[85, 83, 43, 85, 86, 83, 87, 84, 47, 164]}>
                    <Label>N.º FORMULARIO:</Label>
                    <Value>{texto(proceso?.cli_lote)}</Value>
                    <Label>FECHA:</Label>
                    <Value>{formatearFechaHora(oferta?.created_at)}</Value>
                    <Label>N.º REF. SISLAFT:</Label>
                    <Value />
                    <Label>NIVEL DE RIESGO:</Label>
                    <Value />
                    <Label>ASESOR:</Label>
                    <Value>{texto(proceso?.cli_asesor)}</Value>
                  </Row>
                </FormTable>

                {/* SECCIÓN 0 */}
                <FormSection title="SECCIÓN 0 — TIPO DE OPERACIÓN INMOBILIARIA">
                  <Row cols={[91, 163, 107, 232, 93, 161]}>
                    <Label>Tipo de operación:</Label>
                    <Value>{texto(oferta?.cli_tipoOperacion)}</Value>
                    <Label>Especifique si es Otro:</Label>
                    <Value>{texto(oferta?.cli_tipoOperacionOtro)}</Value>
                    <Label>Monto total (USD):</Label>
                    <Value>{formatearPrecio(proceso?.lote_price)}</Value>
                  </Row>
                  <Row cols={[100, 324, 112, 311]}>
                    <Label>Inmueble / Proyecto:</Label>
                    <Value>{texto(proceso?.cli_lote)}</Value>
                    <Label>Dirección del inmueble:</Label>
                    <Value>{texto(loteInfo?.proyecto?.direccion)}</Value>
                  </Row>
                </FormSection>

                {/* SECCIÓN 1 */}
                <FormSection title="SECCIÓN 1 — IDENTIDAD DEL TITULAR / BENEFICIARIO DE LA TRANSACCIÓN">
                  <Row cols={[147, 319, 100, 68, 65, 148]}>
                    <Label>Nombres y apellidos completos:</Label>
                    <Value>{texto(titular?.nombre)}</Value>
                    <Label>Fecha de nacimiento:</Label>
                    <Value>{soloFecha(titular?.fecha_nacimiento)}</Value>
                    <Label>Estado civil:</Label>
                    <Value>{texto(titular?.estado_civil)}</Value>
                  </Row>
                  <Row cols={[133, 163, 70, 227, 92, 162]}>
                    <Label>N.º Cédula / Pasaporte / RUC:</Label>
                    <Value>{texto(titular?.identificacion)}</Value>
                    <Label>Nacionalidad:</Label>
                    <Value>{texto(titular?.nacionalidad)}</Value>
                    <Label>País de residencia:</Label>
                    <Value>{texto(oferta?.cli_pais)}</Value>
                  </Row>
                  <Row cols={[127, 339, 76, 134, 45, 126]}>
                    <Label>Dirección domicilio — Calle:</Label>
                    <Value>{texto(oferta?.cli_direccion)}</Value>
                    <Label>Sector / Barrio:</Label>
                    <Value>{texto(oferta?.cli_sector)}</Value>
                    <Label>Ciudad:</Label>
                    <Value>{texto(oferta?.cli_ciudad)}</Value>
                  </Row>
                  <Row cols={[89, 191, 93, 195, 85, 194]}>
                    <Label>Teléfono / Celular:</Label>
                    <Value>{texto(oferta?.cli_telef)}</Value>
                    <Label>Correo electrónico:</Label>
                    <Value className="normal-case">{texto(oferta?.cli_mail)}</Value>
                    <Label>Teléfono trabajo:</Label>
                    <Value>{texto(oferta?.cli_trabTelefono)}</Value>
                  </Row>
                  <Row cols={[121, 345, 40, 341]}>
                    <Label>Dirección trabajo — Calle:</Label>
                    <Value>{texto(oferta?.cli_trabDireccion)}</Value>
                    <Label>Sector:</Label>
                    <Value>{texto(oferta?.cli_trabSector)}</Value>
                  </Row>
                  <Row cols={[131, 251, 161, 304]}>
                    <Label>Nombre del lugar de trabajo:</Label>
                    <Value>{texto(oferta?.cli_trabEmpresa)}</Value>
                    <Label>Actividad laboral / Giro del negocio:</Label>
                    <Value>{texto(oferta?.cli_trabActividad)}</Value>
                  </Row>
                  <Row cols={[106, 173, 85, 195, 128, 160]}>
                    <Label>Profesión / Ocupación:</Label>
                    <Value>{texto(oferta?.cli_trabProfesion)}</Value>
                    <Label>Cargo / Posición:</Label>
                    <Value>{texto(oferta?.cli_trabCargo)}</Value>
                    <Label>Antigüedad relación (años):</Label>
                    <Value>
                      {labelAntiguedad(oferta?.cli_trabActividad, oferta?.cli_trabTiempo)}
                    </Value>
                  </Row>
                </FormSection>

                {/* SECCIÓN 2 */}
                <FormSection title="SECCIÓN 2 — VERIFICACIÓN DE PERSONA EXPUESTA POLÍTICAMENTE (PEP) — ART. DEBIDA DILIGENCIA REFORZADA D.E. 298">
                  <YesNoRow value={respuesta(licitud?.funcionarioElecto)}>
                    2.1 ¿El cliente es o ha sido funcionario, electo o designado en algún
                    cargo gubernamental o público?
                  </YesNoRow>
                  <YesNoRow value={respuesta(licitud?.relacionGobierno)}>
                    2.2 ¿El cliente tiene relación familiar o de negocio con algún
                    funcionario o entidad de gobierno?
                  </YesNoRow>
                  <YesNoRow value={respuesta(licitud?.trabajoSectorPublico)}>
                    2.3 ¿El cliente realiza trabajos o contratos para alguna entidad del
                    sector público?
                  </YesNoRow>
                  <Nota className="py-[6px] text-neutral-500 italic">
                    Si respondió SÍ — Detalle (Debida Diligencia Reforzada):
                  </Nota>
                  <Row cols={[94, 243, 33, 139, 64, 106, 50, 118]}>
                    <Label>Cargo/Función PEP:</Label>
                    <Value>{texto(licitud?.pepCargo)}</Value>
                    <Label>País:</Label>
                    <Value>{texto(licitud?.pepPais)}</Value>
                    <Label>Fecha inicio:</Label>
                    <Value>{soloFecha(licitud?.pepFechaInicio)}</Value>
                    <Label>Fecha fin:</Label>
                    <Value>{soloFecha(licitud?.pepFechaFin)}</Value>
                  </Row>
                  <Row cols={[135, 333, 163, 216]}>
                    <Label>Relación con el cliente (PEP):</Label>
                    <Value>{texto(licitud?.pepRelacion)}</Value>
                    <Label>Fuente consultada (lista restrictiva):</Label>
                    <Value />
                  </Row>
                  <Row cols={[164, 261, 85, 128, 88, 121]}>
                    <Label>Aprobación nivel superior (nombre):</Label>
                    <Value />
                    <Label>Cargo aprobador:</Label>
                    <Value />
                    <Label>Fecha aprobación:</Label>
                    <Value />
                  </Row>
                </FormSection>

                {/* SECCIÓN 3 */}
                <FormSection title="SECCIÓN 3 — IDENTIDAD DE QUIEN EFECTÚA LA TRANSACCIÓN (CUANDO NO ES EL TITULAR)">
                  <Row cols={[98, 368, 109, 102, 68, 102]}>
                    <Label>Nombres y apellidos:</Label>
                    <Value>{otraPersona ? texto(oferta?.cli_transNombre) : ""}</Value>
                    <Label>N.º Cédula / Pasaporte:</Label>
                    <Value>{otraPersona ? texto(oferta?.cli_transID) : ""}</Value>
                    <Label>Nacionalidad:</Label>
                    <Value>
                      {otraPersona ? texto(oferta?.cli_transNacionalidad) : ""}
                    </Value>
                  </Row>
                  <Row cols={[53, 237, 81, 198, 87, 191]}>
                    <Label>Profesión:</Label>
                    <Value>{otraPersona ? texto(oferta?.cli_transProfesion) : ""}</Value>
                    <Label>Cargo / Posición:</Label>
                    <Value>{otraPersona ? texto(oferta?.cli_transCargo) : ""}</Value>
                    <Label>Teléfono / Celular:</Label>
                    <Value>{otraPersona ? texto(oferta?.cli_transTelefono) : ""}</Value>
                  </Row>
                  <Row cols={[96, 243, 42, 210, 65, 191]}>
                    <Label>Dirección domicilio:</Label>
                    <Value>{otraPersona ? texto(oferta?.cli_transDireccion) : ""}</Value>
                    <Label>Ciudad:</Label>
                    <Value>{otraPersona ? texto(oferta?.cli_transCiudad) : ""}</Value>
                    <Label>Estado civil:</Label>
                    <Value>
                      {otraPersona ? texto(oferta?.cli_transEstadoCivil) : ""}
                    </Value>
                  </Row>
                  <YesNoRow
                    value={otraPersona ? respuesta(oferta?.cli_transIntermediario) : null}
                  >
                    3.4 ¿Actúa como intermediario del verdadero dueño / beneficiario final
                    de los fondos?
                  </YesNoRow>
                  <Row cols={[212, 635]}>
                    <Label>Relación con el verdadero dueño de los fondos:</Label>
                    <Value>
                      {otraPersona ? texto(oferta?.cli_transRelacionDueno) : ""}
                    </Value>
                  </Row>
                </FormSection>

                {/* SECCIÓN 4 */}
                <FormSection title="SECCIÓN 4 — IDENTIFICACIÓN DEL BENEFICIARIO FINAL (DECRETO 298 — SISLAFT)">
                  {beneficiarios.map((beneficiario) => (
                    <div key={beneficiario.id}>
                      <Row cols={[179, 200, 89, 167, 81, 131]}>
                        <Label>Nombre completo del beneficiario final:</Label>
                        <Value>{texto(beneficiario.nombre)}</Value>
                        <Label>N.º Identificación:</Label>
                        <Value>{texto(beneficiario.identificacion)}</Value>
                        <Label>% Participación:</Label>
                        <Value>{porcentajeParticipacion}</Value>
                      </Row>
                      <Row cols={[110, 178, 90, 191, 42, 236]}>
                        <Label>Relación con el cliente:</Label>
                        <Value>{texto(beneficiario.relacion)}</Value>
                        <Label>País de residencia:</Label>
                        <Value>{texto(beneficiario.pais)}</Value>
                        <Label>Es PEP:</Label>
                        <Value>{beneficiario.esPep ? "Sí" : "No"}</Value>
                      </Row>
                    </div>
                  ))}
                </FormSection>

                {/* SECCIÓN 5 */}
                <FormSection title="SECCIÓN 5 — INFORMACIÓN FINANCIERA DEL CLIENTE">
                  <Row cols={[138, 114, 98, 200, 95, 202]}>
                    <Label>Ingreso mensual aprox. (USD):</Label>
                    <Value>{numeroPlano(financieros?.ingresoMensual)}</Value>
                    <Label>Fuente de ingresos:</Label>
                    <Value>{texto(financieros?.fuenteIngresos)}</Value>
                    <Label>Especifique fuente:</Label>
                    <Value>{texto(financieros?.fuenteIngresosOtro)}</Value>
                  </Row>
                  <Row cols={[113, 139, 111, 187, 119, 178]}>
                    <Label>Patrimonio aprox. (USD):</Label>
                    <Value>{numeroPlano(financieros?.patrimonio)}</Value>
                    <Label>Fuente del patrimonio:</Label>
                    <Value>{texto(financieros?.fuentePatrimonio)}</Value>
                    <Label>Otros ingresos (USD/mes):</Label>
                    <Value>{numeroPlano(financieros?.otrosIngresos)}</Value>
                  </Row>
                  <Row cols={[1, 1]}>
                    <Label className="justify-center bg-neutral-100 py-[2px]">
                      REFERENCIAS BANCARIAS
                    </Label>
                    <Label className="justify-center bg-neutral-100 py-[2px]">
                      REFERENCIAS COMERCIALES
                    </Label>
                  </Row>
                  <Row cols={[1, 1, 1, 1, 1, 1, 1, 1]}>
                    <Label>Institución Financiera</Label>
                    <Label>N.º Cuenta</Label>
                    <Label>Tipo</Label>
                    <Label>Ciudad</Label>
                    <Label>Institución / Empresa</Label>
                    <Label>Contacto</Label>
                    <Label>Teléfono</Label>
                    <Label>Ciudad</Label>
                  </Row>
                  {Array.from({ length: filasReferencias }, (_, indice) => {
                    const bancaria = referenciasBancarias[indice]
                    const comercial = referenciasComerciales[indice]
                    return (
                      <Row key={indice} cols={[1, 1, 1, 1, 1, 1, 1, 1]}>
                        <Value>{texto(bancaria?.institucion)}</Value>
                        <Value>{texto(bancaria?.numeroCuenta)}</Value>
                        <Value>{texto(bancaria?.tipo)}</Value>
                        <Value>{texto(bancaria?.ciudad)}</Value>
                        <Value>{texto(comercial?.institucion)}</Value>
                        <Value>{texto(comercial?.contacto)}</Value>
                        <Value>{texto(comercial?.telefono)}</Value>
                        <Value>{texto(comercial?.ciudad)}</Value>
                      </Row>
                    )
                  })}
                </FormSection>

                {/* SECCIÓN 6 — la hoja impresa parte aquí, igual que el PDF (2 hojas). Sale
                del pago del proceso (no de la oferta): recién ahí se mueve el dinero. */}
                <FormSection
                  title="SECCIÓN 6 — IDENTIFICACIÓN DE LA TRANSACCIÓN"
                  className="print:[break-before:page]"
                >
                  <Row cols={[142, 154, 98, 199, 48, 206]}>
                    <Label>Monto de la transacción (USD):</Label>
                    <Value>{formatearPrecio(pago?.valor_total)}</Value>
                    <Label>Tipo de transacción:</Label>
                    <Value>{texto(pago?.tipo_pago)}</Value>
                    <Label>Moneda:</Label>
                    <Value>{pago ? "USD" : ""}</Value>
                  </Row>
                  <Row cols={[151, 188, 149, 148, 77, 134]}>
                    <Label>N.º y Tipo de cuenta de depósito:</Label>
                    <Value>{texto(pago?.cuenta_destino)}</Value>
                    <Label>Institución financiera receptora:</Label>
                    <Value>{texto(pago?.institucion_financiera)}</Value>
                    <Label>Fecha depósito:</Label>
                    <Value>{soloFecha(pago?.fec_pago)}</Value>
                  </Row>
                  <Row cols={[194, 315, 130, 208]}>
                    <Label>Número de operación / referencia bancaria:</Label>
                    <Value>{texto(pago?.ref_pago)}</Value>
                    <Label>Número de cuota (si aplica):</Label>
                    <Value>{pago ? "1" : ""}</Value>
                  </Row>
                </FormSection>

                {/* SECCIÓN 7 */}
                <FormSection title="SECCIÓN 7 — DECLARACIÓN DE ORIGEN Y DESTINO DE FONDOS">
                  <Nota>
                    Describa de manera ESPECÍFICA el origen y destino de los fondos.
                    Respuestas genéricas (“ahorros”, “trabajo”) no son aceptadas bajo el
                    Decreto 298. Ej: honorarios profesionales facturados bajo RUC,
                    utilidades distribuidas según acta de junta de socios, préstamo (con
                    soporte) o venta de un bien (con escritura o factura de respaldo).
                  </Nota>
                  <Row cols={[1]}>
                    <Cell className="min-h-[44px] py-[6px]">
                      <div className="text-[7px] leading-[9px] font-bold">
                        LOS FONDOS, BIENES MUEBLES E INMUEBLES DE ESTA TRANSACCIÓN
                        PROVIENEN DE:
                      </div>
                      <div className="mt-2.5 uppercase">
                        {texto(licitud?.fondosOrigen)}
                      </div>
                    </Cell>
                  </Row>
                  <Row cols={[1]}>
                    <Cell className="min-h-[44px] py-[6px]">
                      <div className="text-[7px] leading-[9px] font-bold">
                        LOS FONDOS, BIENES MUEBLES E INMUEBLES DE ESTA TRANSACCIÓN SERÁN
                        UTILIZADOS PARA:
                      </div>
                      <div className="mt-2.5 uppercase">
                        {texto(licitud?.fondosDestino)}
                      </div>
                    </Cell>
                  </Row>
                </FormSection>

                {/* SECCIÓN 8 */}
                <FormSection title="SECCIÓN 8 — CHECKLIST DE DOCUMENTOS VERIFICADOS (DILIGENCIADO POR EL OFICIAL DE CUMPLIMIENTO)">
                  <Row cols={[43, 507, 149, 148]}>
                    <Label className="justify-center bg-neutral-100">#</Label>
                    <Label className="bg-neutral-100">Documento</Label>
                    <Label className="justify-center bg-neutral-100">Estado</Label>
                    <Label className="justify-center bg-neutral-100">
                      N.º Doc. / Referencia
                    </Label>
                  </Row>
                  {DOCUMENTOS_CHECKLIST.map((documento, indice) => (
                    <Row key={documento} cols={[43, 507, 149, 148]}>
                      <Value className="justify-center py-[2px] normal-case">
                        8.{indice + 1}
                      </Value>
                      <Value className="py-[2px] normal-case">{documento}</Value>
                      <Value className="py-[2px]" />
                      <Value className="py-[2px]" />
                    </Row>
                  ))}
                </FormSection>

                {/* SECCIÓN 9 */}
                <FormSection title="SECCIÓN 9 — CLASIFICACIÓN DE RIESGO Y OBSERVACIONES DEL OFICIAL DE CUMPLIMIENTO">
                  <Row cols={[119, 304, 129, 295]}>
                    <Label>Nivel de riesgo asignado:</Label>
                    <Value />
                    <Label>Criterio principal de riesgo:</Label>
                    <Value />
                  </Row>
                  <Row cols={[1]}>
                    <Cell className="min-h-[35px] text-[7px] leading-[9px] font-bold">
                      Observaciones y justificación del nivel de riesgo:
                    </Cell>
                  </Row>
                  <Row cols={[161, 118, 110, 170, 100, 188]}>
                    <Label>¿Se requiere monitoreo reforzado?:</Label>
                    <Value />
                    <Label>Frecuencia de revisión:</Label>
                    <Value />
                    <Label>¿Se reportó a UAFE?:</Label>
                    <Value />
                  </Row>
                </FormSection>

                {/* SECCIÓN 10 */}
                <FormSection title="SECCIÓN 10 — DECLARACIONES JURADAS DEL CLIENTE">
                  <Row cols={[744, 103]}>
                    <Cell className="py-px text-[7.5px] leading-[20px]">
                      <span className="font-extrabold">ENTREGA DE ACTIVOS:</span>{" "}
                      Conocedor/a de las penas de perjurio, DECLARO BAJO JURAMENTO que el
                      origen de los fondos, bienes muebles e inmuebles entregados a{" "}
                      {EMPRESA} es LÍCITO y procede de actividades legales.
                    </Cell>
                    <Cell className="flex flex-col items-center justify-center gap-1.5 text-[7px] leading-[9px] font-bold">
                      <span>Acepto:</span>
                      <CheckBox checked={Boolean(licitud)} />
                    </Cell>
                  </Row>
                  <Row cols={[744, 103]}>
                    <Cell className="py-px text-[7.5px] leading-[20px]">
                      <span className="font-extrabold">RECEPCIÓN DE ACTIVOS:</span>{" "}
                      Conocedor/a de las penas de perjurio, DECLARO BAJO JURAMENTO que los
                      fondos, bienes muebles e inmuebles recibidos de {EMPRESA} NO serán
                      destinados a transacciones ilícitas ni actividades relacionadas con
                      el lavado de activos.
                    </Cell>
                    <Cell className="flex flex-col items-center justify-center gap-1.5 text-[7px] leading-[9px] font-bold">
                      <span>Acepto:</span>
                      <CheckBox checked={Boolean(licitud)} />
                    </Cell>
                  </Row>
                  <Nota className="leading-[9.5px]">
                    Conocedor/a de las disposiciones de la Ley Orgánica de Prevención,
                    Detección y Combate del Delito de Lavado de Activos y del Decreto
                    Ejecutivo N.° 298, CERTIFICO que la información arriba indicada es
                    correcta, completa y verdadera, y que esta declaración podrá ser
                    revisada por las autoridades competentes.
                  </Nota>
                </FormSection>

                {/* SECCIÓN 11 */}
                <FormSection title="SECCIÓN 11 — FIRMAS Y CERTIFICACIONES">
                  <Row cols={[1, 1]}>
                    <SignatureCell
                      label="Firma del cliente o persona que realiza la transacción"
                      name={texto(titular?.nombre)}
                      detail={
                        titular?.identificacion
                          ? `CI: ${titular.identificacion}`
                          : undefined
                      }
                    />
                    <SignatureCell
                      label="Firma y sello del Asesor / Oficial de Cumplimiento"
                      name={texto(proceso?.cli_asesor)}
                    />
                  </Row>
                  <Nota className="py-[13px] text-center leading-[18px] italic">
                    POR LA PRESENTE CERTIFICO, según mi leal saber y entender, que en base
                    a mi investigación razonable, la información es correcta y verdadera.
                    He validado y verificado la identificación, documentación e
                    información proporcionada conforme al Decreto Ejecutivo N.° 298 (UAFE
                    2026).
                  </Nota>
                </FormSection>

                <p className="mt-3.5 text-center text-[7px] leading-[9px] text-neutral-500">
                  Formulario elaborado conforme al Decreto Ejecutivo N.° 298 — R.O.
                  Suplemento N.° 216 de febrero de 2026 | UAFE Ecuador |
                  Inmoconstrucciones Cía. Ltda. © 2026
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .licitud-scroll {
            height: auto !important;
          }
          .licitud-sheet,
          .licitud-sheet * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 9mm;
          }
        }
      `}</style>
    </div>
  )
}
