"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "@/lib/navigation"
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react"

import { Can } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { SelectField, StaticField } from "@/components/shared/select-field"
import {
  FORMAS_PAGO_ENTRADA,
  OFRECIMIENTOS_FINANCIAMIENTO,
  TIPOS_FINANCIAMIENTO,
} from "@/components/shared/select-options"
import { MultiSelectField } from "@/components/shared/multi-select-field"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { type ComponenteAlicuota, type LoteInventario } from "@/lib/api/inventario-api"
import { cn } from "@/lib/utils"
import {
  VentasApiError,
  actualizarCuotaCotizacion,
  listarPromocionesActivasCotizacion,
  obtenerCotizacion,
  obtenerLoteCotizacion,
  regenerarCotizacion,
  type CotizacionBackend,
  type CuotaAmortizacion,
  type EntradaPagoInput,
  type PromocionBackend,
} from "@/lib/api/ventas-api"
import { PromocionesSheet } from "./promociones-sheet"

// Tasa fija de la empresa — debe coincidir con TASA_INTERES_ANUAL_FIJA en
// anconAPI/apps/intranet/financiamiento/amortizacion.util.ts. Se usa aquí solo para
// mostrar la cuota mensual sugerida en vivo, sin esperar a Regenerar cuotas — el
// cronograma real siempre lo calcula el backend con esa misma fórmula.
const TASA_INTERES_ANUAL_FIJA = 10.6

// "Contado" siempre lleva este descuento fijo sobre el valor del lote — no es
// editable, debe coincidir con DESCUENTO_CONTADO_PORCENTAJE en
// anconAPI/apps/intranet/financiamiento/financiamiento.service.ts (que es quien
// realmente lo calcula y guarda; esto solo es para mostrarlo en vivo aquí).
const DESCUENTO_CONTADO_PORCENTAJE = 0.05

// "Crédito BIESS" tiene su propio descuento fijo, más bajo que el de "Contado" — 3%
// en vez de 5%, mismo criterio de "no editable, solo se muestra en vivo aquí".
const DESCUENTO_BIESS_PORCENTAJE = 0.03

// "Crédito BIESS" no genera cronograma, así que no tiene dónde cobrar la escritura
// como las últimas 6 cuotas de Crédito directo — se cobra de una sola vez, sumada a
// su fila de cierre ("Desembolso BIESS"), con este monto fijo, sin importar la
// escritura configurada en el proyecto. "Contado" también cobra su escritura de una
// sola vez en su fila de cierre ("Pago total"), pero usa directamente la escritura
// configurada en el proyecto (ver escrituraProyecto/calcularFilasEntradaGeneradas),
// no este fijo.
const ESCRITURA_CONTADO = 250

// "Crédito BIESS" usa la misma estructura de tabla que "Contado" (abono inicial +
// hasta 12 cuotas + una fila de cierre), pero con reglas propias: 3% de descuento en
// vez de 5%, y su fila de cierre no es un remanente calculado ("Pago total") sino el
// valor y la fecha de desembolso que fija el asesor ("Desembolso BIESS") — el
// remanente para completar el total a financiar lo absorben las cuotas, no esa fila.
// Ver etiquetaFilaCierre/filaCierreFija más abajo para el detalle de cada tipo.
function esContadoLike(tipo: string): boolean {
  return tipo === "Contado" || tipo === "Crédito BIESS"
}

// Etiqueta de la fila que cierra la tabla de cada tipo — null si ese tipo no tiene
// fila de cierre (Crédito directo/Mixto, que siguen con cronograma).
function etiquetaFilaCierre(tipo: string): string | null {
  if (tipo === "Contado") return "Pago total"
  if (tipo === "Crédito BIESS") return "Desembolso BIESS"
  return null
}

// "Mixto" es igual a "Crédito directo" (cronograma con interés, N.º de meses, cuota
// sugerida) salvo que también lleva un desembolso BIESS fijo — no como fila de cierre
// que reemplaza el remanente (eso es "Crédito BIESS", ver esContadoLike), sino como
// una fila EXTRA que se suma a la tabla de entrada de siempre y resta del total a
// financiar como cualquier otra entrada — el cronograma financia lo que sobra.
function usaDesembolsoBiess(tipo: string): boolean {
  return tipo === "Crédito BIESS" || tipo === "Mixto"
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

// Compara dos montos escritos como texto por su valor numérico (al centavo), no por
// el texto exacto: "100.1" y "100.10" son el mismo monto. Sin esto, el efecto que
// sincroniza los campos del generador con la tabla pisaba lo que el asesor estaba
// escribiendo en cada tecla.
function mismoMonto(a: string, b: string): boolean {
  if (a.trim() === "" || b.trim() === "") return a.trim() === b.trim()
  return Math.abs(Number(a) - Number(b)) < 0.005
}

// Componente de alícuota tal como vive en una fila editable de la tabla — mismo
// concepto que ComponenteAlicuota (inventario-api.ts), pero con `valor` en texto para
// que el input pueda quedar vacío mientras se edita. `fechaInicio` viaja junto (no se
// edita acá, viene del proyecto) para poder mandarla tal cual al guardar.
type ComponenteAlicuotaFila = {
  nombre: string
  valor: string
  fechaInicio: string | null
}

// Valor inicial de la alícuota de una fila nueva — en la TABLA DE ENTRADA (a
// diferencia del cronograma, que sí muestra una columna por componente) siempre se
// ve como un solo monto: la suma de los componentes configurados en el proyecto del
// lote (uno o varios, ver ProyectoAlicuotaComponente en el backend), ya con la fecha
// de inicio de cada componente aplicada (ej. "parques comunales" recién arranca el
// 2027-06-01 — para una fila anterior a esa fecha, ese componente aporta $0 a la
// suma). Siempre devuelve un solo elemento, con nombre genérico "Alicuota".
function alicuotasIniciales(
  componentes: ComponenteAlicuota[],
  fechaFila: string
): ComponenteAlicuotaFila[] {
  if (componentes.length === 0) return []
  const suma = componentes.reduce((acc, c) => {
    const aplica = !c.fechaInicio || fechaFila >= c.fechaInicio
    return acc + (aplica ? c.valor : 0)
  }, 0)
  return [{ nombre: "Alicuota", valor: suma ? suma.toFixed(2) : "", fechaInicio: null }]
}

// Una fila de la tabla de entrada (abono inicial + cuotas de entrada, sin interés) —
// reemplaza el campo suelto "Entrada": para Crédito directo la suma tiene que calzar
// con el 5% del valor del lote (se valida también en el backend).
type FilaEntradaTabla = {
  formaPago: string
  fechaPago: string
  abonoLote: string
  // Uno o varios componentes con nombre propio (ver ComponenteAlicuotaFila) — la
  // mayoría de los proyectos tienen uno solo, algunos (ej. Perla Verde) varios.
  alicuotas: ComponenteAlicuotaFila[]
  // Solo Contado/Crédito BIESS: los $250 fijos de escritura, cargados en la fila
  // "Pago total" — cargo aparte igual que alicuotas, no se suma a "abono lote" (ese
  // sigue sumando exacto el total a financiar, sin la escritura).
  escritura: string
  observaciones: string
  // true si el asesor escribió este monto a mano — al reajustar otras filas
  // "Entrada" para conservar el total, las filas fijadas así no se tocan.
  montoEditado?: boolean
}

// Cuota base (capital + interés) de la amortización francesa estándar — misma
// fórmula que calcularCuotaBase en el backend.
function calcularCuotaMensualSugerida(
  totalFinanciar: number,
  meses: number
): number | null {
  if (!meses || meses <= 0 || !totalFinanciar || totalFinanciar <= 0) return null
  const tasaMensual = TASA_INTERES_ANUAL_FIJA / 100 / 12
  const factor = Math.pow(1 + tasaMensual, -meses)
  return (totalFinanciar * tasaMensual) / (1 - factor)
}

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
  return `${dia}/${mes}/${anio}`
}

function formatearMetraje(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return `${new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 }).format(numero)} m²`
}

// La fecha de inicio de financiamiento solo puede caer el día 5 o el día 20, y solo
// desde el mes actual en adelante (no meses ya pasados) — se elige con
// CalendarioFechaInicioFinanciamiento más abajo, un calendario visual propio (no un
// <input type="date"> nativo, que no permite restringir a días específicos del mes).
const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

function formatearAnioMes(anio: number, mesIndex: number): string {
  return `${anio}-${String(mesIndex + 1).padStart(2, "0")}`
}

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"]
// Hasta 36 meses adelante — mismo horizonte que tenía el select de mes anterior.
const MESES_ADELANTE_CALENDARIO = 36

// Calendario visual (no un <input type="date"> nativo, que no permite restringir a
// días específicos del mes) — no deja navegar a un mes anterior al actual y qué días
// se pueden elegir lo decide "esDiaElegible" (cada calendario que lo usa trae su
// propia regla). Usa getUTCDay/getUTCDate (como calcularFechaEntrada) para que la
// cuadrícula no se corra de día según la zona horaria del navegador.
function CalendarioFecha({
  value,
  onSelect,
  esDiaElegible,
  textoAyuda,
}: {
  value: string
  onSelect: (fecha: string) => void
  esDiaElegible: (dia: number) => boolean
  textoAyuda?: string
}) {
  const hoy = new Date()
  const mesMinimo = formatearAnioMes(hoy.getFullYear(), hoy.getMonth())
  const mesMaximo = (() => {
    const fecha = new Date(
      hoy.getFullYear(),
      hoy.getMonth() + MESES_ADELANTE_CALENDARIO - 1,
      1
    )
    return formatearAnioMes(fecha.getFullYear(), fecha.getMonth())
  })()

  const [mesMostrado, setMesMostrado] = useState(value ? value.slice(0, 7) : mesMinimo)

  // Si la fecha seleccionada cambia desde afuera (ej. se carga un financiamiento
  // guardado), el calendario salta solo al mes correspondiente.
  useEffect(() => {
    if (value) setMesMostrado(value.slice(0, 7))
  }, [value])

  const [anioTexto, mesTexto] = mesMostrado.split("-")
  const anio = Number(anioTexto)
  const mesIndice = Number(mesTexto) - 1
  const primerDiaSemana = new Date(Date.UTC(anio, mesIndice, 1)).getUTCDay()
  const diasEnMes = new Date(Date.UTC(anio, mesIndice + 1, 0)).getUTCDate()

  function irAMesAdyacente(delta: number) {
    const fecha = new Date(anio, mesIndice + delta, 1)
    const nuevoMes = formatearAnioMes(fecha.getFullYear(), fecha.getMonth())
    if (nuevoMes < mesMinimo || nuevoMes > mesMaximo) return
    setMesMostrado(nuevoMes)
  }

  return (
    <div className="flex w-64 flex-col p-4.5">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="text-sm font-bold">
          {MESES_NOMBRES[mesIndice]} {anio}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={mesMostrado <= mesMinimo}
            onClick={() => irAMesAdyacente(-1)}
            className="border-border flex size-[26px] items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="text-muted-foreground size-3.5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            disabled={mesMostrado >= mesMaximo}
            onClick={() => irAMesAdyacente(1)}
            className="border-border flex size-[26px] items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="text-muted-foreground size-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className="text-muted-foreground mb-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="text-foreground grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: primerDiaSemana }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((dia) => {
          const fechaDelDia = `${mesMostrado}-${String(dia).padStart(2, "0")}`
          const esElegible = esDiaElegible(dia)
          const esPasado = mesMostrado === mesMinimo && dia < hoy.getDate()
          const esSeleccionado = value === fechaDelDia

          if (!esElegible) {
            return (
              <span
                key={dia}
                className="text-muted-foreground/40 flex items-center justify-center py-1.5"
              >
                {dia}
              </span>
            )
          }
          return (
            <button
              key={dia}
              type="button"
              disabled={esPasado}
              onClick={() => onSelect(fechaDelDia)}
              className="relative flex items-center justify-center py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                className={cn(
                  "flex size-[26px] items-center justify-center rounded-full font-bold transition-colors",
                  esSeleccionado
                    ? "bg-brand-gradient text-white"
                    : "border-primary text-primary hover:bg-muted border"
                )}
              >
                {dia}
              </span>
            </button>
          )
        })}
      </div>
      {textoAyuda && <p className="text-muted-foreground mt-3 text-xs">{textoAyuda}</p>}
    </div>
  )
}

function CalendarioFechaInicioFinanciamiento({
  value,
  onSelect,
}: {
  value: string
  onSelect: (fecha: string) => void
}) {
  return (
    <CalendarioFecha
      value={value}
      onSelect={onSelect}
      esDiaElegible={(dia) => dia === 5 || dia === 20}
      textoAyuda="Solo se puede iniciar el financiamiento el día 5 o el día 20."
    />
  )
}

// "Crédito BIESS": la fecha de desembolso la fija el banco, cualquier día desde hoy —
// a diferencia de la fecha de inicio de financiamiento, no está restringida al 5/20.
function CalendarioFechaDesembolso({
  value,
  onSelect,
}: {
  value: string
  onSelect: (fecha: string) => void
}) {
  return <CalendarioFecha value={value} onSelect={onSelect} esDiaElegible={() => true} />
}

// Arma las filas de la tabla de entrada (abono inicial + N cuotas repartidas en
// partes iguales, + fila de cierre si el tipo tiene una) a partir de los 3 campos
// generadores — usada tanto por el botón "Regenerar entradas" (con validación y
// toasts) como por el auto-generado silencioso en cuanto esos 3 campos quedan
// completos.
function calcularFilasEntradaGeneradas(
  abonoInicial: number,
  // Monto a repartir entre las cuotas — para Crédito BIESS el llamador ya lo pasa SIN
  // el valor de desembolso (ver valorEntradaTotalEfectivo más abajo), porque esa fila
  // no participa del reparto, es fija.
  valorEntradaTotal: number,
  numero: number,
  fechaInicioFinanciamiento: string,
  componentesAlicuotaProyecto: ComponenteAlicuota[],
  // Fila de cierre, si el tipo tiene una: "Contado" pasa solo la etiqueta ("Pago
  // total") y esa fila sale de las mismas "numero" cuotas (la última se relabela y
  // absorbe el residuo del reparto). "Crédito BIESS" pasa además "fijo" (el valor y
  // la fecha de desembolso que fijó el asesor): esa fila se agrega APARTE de las
  // "numero" cuotas, con su propio monto/fecha, sin participar del reparto.
  filaCierre: { etiqueta: string; fijo?: { monto: number; fecha: string } } | null = null,
  // Solo se usa en la fila de cierre de "Contado" ("Pago total", el branch sin
  // `filaCierre.fijo` más abajo) — la de "Crédito BIESS" sigue con el fijo
  // ESCRITURA_CONTADO. Ver escrituraProyecto donde se llama a esta función.
  escrituraCierreContado: number = ESCRITURA_CONTADO
) {
  const fechaAbonoInicial = new Date().toISOString().slice(0, 10)
  const abonoInicialFila = {
    // El abono inicial tiene fecha libre (la del día en que se hace, hoy) — no
    // sigue la fecha de inicio de financiamiento, esa solo aplica a las cuotas.
    formaPago: "Abono inicial",
    fechaPago: fechaAbonoInicial,
    abonoLote: abonoInicial.toFixed(2),
    alicuotas: alicuotasIniciales(componentesAlicuotaProyecto, fechaAbonoInicial).map(
      (c) => ({
        ...c,
        valor: "",
      })
    ),
    escritura: "",
    observaciones: "",
  }

  // "Crédito BIESS": la fila de cierre ya trae su monto/fecha fijos — se agrega
  // aparte, y las "numero" cuotas se reparten solo entre ellas el remanente.
  if (filaCierre?.fijo) {
    const numeroCuotas = Math.max(0, numero - 1)
    const valorPorEntrada =
      numeroCuotas > 0 ? Math.round((valorEntradaTotal / numeroCuotas) * 100) / 100 : 0
    const cuotas = Array.from({ length: numeroCuotas }, (_, indice) => {
      const esUltima = indice === numeroCuotas - 1
      // La última cuota absorbe el residuo de redondeo para que la suma calce exacto
      // con el valor a repartir.
      const monto = esUltima
        ? Math.round((valorEntradaTotal - valorPorEntrada * (numeroCuotas - 1)) * 100) /
          100
        : valorPorEntrada
      const fechaPago = calcularFechaEntrada(fechaInicioFinanciamiento, indice)
      return {
        formaPago: "Entrada",
        fechaPago,
        abonoLote: monto.toFixed(2),
        alicuotas: alicuotasIniciales(componentesAlicuotaProyecto, fechaPago),
        escritura: "",
        observaciones: "",
      }
    })
    return [
      abonoInicialFila,
      ...cuotas,
      {
        formaPago: filaCierre.etiqueta,
        fechaPago: filaCierre.fijo.fecha,
        abonoLote: filaCierre.fijo.monto.toFixed(2),
        alicuotas: alicuotasIniciales(componentesAlicuotaProyecto, filaCierre.fijo.fecha),
        // Este branch (filaCierre.fijo) es exclusivo de "Crédito BIESS" — su
        // escritura sigue siendo el monto fijo ESCRITURA_CONTADO.
        escritura: ESCRITURA_CONTADO.toFixed(2),
        observaciones: "",
      },
    ]
  }

  // Crédito directo (sin fila de cierre) o "Contado" ("Pago total" = la última de las
  // "numero" cuotas, relabeled, absorbiendo el residuo del reparto).
  const valorPorEntrada =
    numero > 0 ? Math.round((valorEntradaTotal / numero) * 100) / 100 : 0
  const cuotas = Array.from({ length: numero }, (_, indice) => {
    const esUltima = indice === numero - 1
    const esCierre = esUltima && filaCierre != null
    // La última cuota absorbe el residuo de redondeo para que la suma calce exacto
    // con el valor de entrada total.
    const monto = esUltima
      ? Math.round((valorEntradaTotal - valorPorEntrada * (numero - 1)) * 100) / 100
      : valorPorEntrada
    const fechaPago = calcularFechaEntrada(fechaInicioFinanciamiento, indice)
    return {
      formaPago: esCierre ? filaCierre!.etiqueta : "Entrada",
      fechaPago,
      abonoLote: monto.toFixed(2),
      alicuotas: alicuotasIniciales(componentesAlicuotaProyecto, fechaPago),
      // Este branch (sin filaCierre.fijo) es exclusivo de "Contado" cuando hay fila
      // de cierre — su escritura es la configurada en el proyecto (escrituraCierreContado),
      // no un fijo. Queda editable a mano después de inicializarse acá (ver el
      // comentario en el useEffect que recalcula "abono lote" para esta misma fila).
      escritura: esCierre ? escrituraCierreContado.toFixed(2) : "",
      observaciones: "",
    }
  })
  return [abonoInicialFila, ...cuotas]
}

// "Mixto": a diferencia de "Crédito BIESS" (donde el desembolso REEMPLAZA una de las
// "numero" cuotas como fila de cierre), acá se agrega como una fila EXTRA, aparte de
// las entradas normales de Crédito directo — resta del total a financiar como
// cualquier otra entrada, el cronograma financia lo que sobra.
function construirFilaDesembolsoBiess(
  desembolsoValor: string,
  desembolsoFecha: string,
  componentesAlicuotaProyecto: ComponenteAlicuota[]
) {
  return {
    formaPago: "Desembolso BIESS",
    fechaPago: desembolsoFecha,
    abonoLote: desembolsoValor,
    alicuotas: alicuotasIniciales(componentesAlicuotaProyecto, desembolsoFecha),
    escritura: "",
    observaciones: "",
  }
}

// "Mixto": el desembolso BIESS se inserta justo después del abono inicial — NUNCA al
// final. Su fecha es libre (el banco desembolsa cuando desembolsa, no sigue la
// secuencia mensual de las cuotas) — si quedara como última fila del arreglo, el
// backend seguiría el cronograma a partir de ESA fecha en vez de la de la última
// cuota real, descuadrando todas las fechas del cronograma (mismo criterio que ya
// usa sincronizarCronogramaConEntradas para la vista previa: ignora "Desembolso
// BIESS" y sigue solo la última fila "Entrada").
function insertarFilaDesembolso<T>(filas: T[], filaDesembolso: T[]): T[] {
  if (filaDesembolso.length === 0) return filas
  return [filas[0], ...filaDesembolso, ...filas.slice(1)]
}

// Fecha de la N-ésima fila "Entrada" (0-indexed): la primera cae exacto en
// fechaInicio, cada una siguiente un mes después, mismo día. Usa getters/setters UTC
// (no locales) porque fechaInicio es un string "YYYY-MM-DD" — new Date(str) lo
// interpreta como medianoche UTC, y getMonth()/setMonth() (hora local) podrían correr
// el día según la zona horaria del navegador.
function calcularFechaEntrada(fechaInicio: string, indiceEntrada: number): string {
  const fecha = new Date(fechaInicio)
  fecha.setUTCMonth(fecha.getUTCMonth() + indiceEntrada)
  return fecha.toISOString().slice(0, 10)
}

// Próximo día 5 o 20 disponible desde hoy (nunca en el pasado).
function calcularFechaInicioPorDefecto(): string {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth()
  const dia = hoy.getDate()
  if (dia <= 5) return `${formatearAnioMes(anio, mes)}-05`
  if (dia <= 20) return `${formatearAnioMes(anio, mes)}-20`
  const siguiente = new Date(anio, mes + 1, 1)
  return `${formatearAnioMes(siguiente.getFullYear(), siguiente.getMonth())}-05`
}

// Fecha de hoy — default de "Fecha de desembolso" ("Crédito BIESS"): a diferencia de
// la fecha de inicio de financiamiento, cualquier día sirve, así que hoy es válido.
function calcularFechaDesembolsoPorDefecto(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CotizacionContent({ id }: { id: string }) {
  const router = useRouter()
  const toast = useToast()
  const idNumero = Number(id)
  // A diferencia de Financiamiento, acá no hay distinción crear-vs-editar: el "casco"
  // de la cotización (proyecto, lote, datos del cliente) ya se creó en el paso
  // anterior (/gestion/cotizaciones/nueva/...) — esta pantalla SIEMPRE regenera sobre
  // un registro que ya existe. Tampoco hay ningún permiso de módulo que gatee esto
  // ("accesos todos sin restricciones"): el backend ya resuelve la única restricción
  // real (solo quien la creó puede editarla) devolviendo 403 en obtenerCotizacion, que
  // cae en el branch de error de abajo.

  const [cotizacion, setCotizacion] = useState<CotizacionBackend | null>(null)
  const [loteInfo, setLoteInfo] = useState<LoteInventario | null>(null)
  const [promocionesActivas, setPromocionesActivas] = useState<PromocionBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)

  const [financType, setFinancType] = useState("Crédito directo")
  const [discount, setDiscount] = useState("")
  // Solo "Mixto": a diferencia de Contado/Crédito BIESS, el 3% no es obligatorio —
  // el asesor decide si aplica o no. Si está desmarcado, "discount" queda en "" igual
  // que en Crédito directo (ver el useEffect de descuento fijo más abajo).
  const [aplicarDescuentoMixto, setAplicarDescuentoMixto] = useState(false)
  const [extraDiscount, setExtraDiscount] = useState("")
  const [meses, setMeses] = useState("48")
  // Fecha desde la que arrancan las fechas de pago: primero la tabla de entrada,
  // luego el cronograma continúa justo después de la última fila de esa tabla. Solo
  // puede caer el día 5 o 20, desde el mes actual en adelante.
  const [fechaInicioFinanciamiento, setFechaInicioFinanciamiento] = useState(
    calcularFechaInicioPorDefecto()
  )
  // Cuota fija que el asesor quiere pagar cada mes (capital + interés = "abono
  // lote") — si se define, reemplaza la cuota calculada por la fórmula estándar; la
  // última cuota siempre ajusta para saldar el préstamo, así que no tiene por qué
  // coincidir con este valor.
  const [cuotaSugerida, setCuotaSugerida] = useState("")

  // "Crédito BIESS"/"Mixto": el banco desembolsa el préstamo por un valor y en una
  // fecha propios (no coinciden necesariamente con el valor del lote ni con la fecha
  // de inicio de financiamiento) — sin estos dos datos no se puede armar la tabla.
  const [desembolsoValor, setDesembolsoValor] = useState("")
  const [desembolsoFecha, setDesembolsoFecha] = useState(
    calcularFechaDesembolsoPorDefecto()
  )
  const [calendarioDesembolsoAbierto, setCalendarioDesembolsoAbierto] = useState(false)

  // El cronograma ya generado (si existe) se reajusta en vista previa a partir de las
  // filas "Entrada" actuales: la cuota 1 cae un mes después de la última entrada, o
  // EXACTO en la fecha de inicio si no hay entradas — sigue haciendo falta Guardar/
  // Regenerar cuotas para persistirlo en el backend. Mismo criterio que
  // resolverFechaInicioCronograma en financiamiento.service.ts (anconAPI).
  function sincronizarCronogramaConEntradas(
    nuevasEntradas: typeof entradasTabla,
    fechaInicioRespaldo: string
  ) {
    if (!cotizacion?.detalle?.length) return
    const filasEntrada = nuevasEntradas.filter((fila) => fila.formaPago === "Entrada")
    // calcularFechaEntrada(base, cuota.mes) le suma "cuota.mes" meses a la base
    // (mes 1 = +1 mes) — cuando no hay entradas y el mes 1 tiene que caer EXACTO en
    // fechaInicioRespaldo, ese +1 mes se neutraliza restando un mes de antemano acá
    // (calcularFechaEntrada admite índices negativos).
    const baseCronograma =
      filasEntrada.length > 0
        ? filasEntrada[filasEntrada.length - 1].fechaPago
        : calcularFechaEntrada(fechaInicioRespaldo, -1)
    setCotizacion({
      ...cotizacion,
      detalle: cotizacion.detalle.map((cuota) => ({
        ...cuota,
        fecha: calcularFechaEntrada(baseCronograma, cuota.mes),
      })),
    })
  }

  // Al cambiar el mes o el día de inicio, las filas "Entrada" ya generadas se
  // reajustan solas a las fechas correctas (sin tener que volver a darle a "Regenerar
  // entradas") — se conservan sus montos/observaciones, solo cambia la fecha. El
  // abono inicial no se toca: su fecha es libre.
  function resincronizarFechasPago(nuevaFechaInicio: string) {
    let indiceEntrada = 0
    const nuevasEntradas = entradasTabla.map((fila) => {
      if (fila.formaPago !== "Entrada") return fila
      const fechaPago = calcularFechaEntrada(nuevaFechaInicio, indiceEntrada)
      indiceEntrada += 1
      return { ...fila, fechaPago }
    })
    setEntradasTabla(nuevasEntradas)
    sincronizarCronogramaConEntradas(nuevasEntradas, nuevaFechaInicio)
  }

  function manejarSeleccionarFechaInicio(nuevaFecha: string) {
    setFechaInicioFinanciamiento(nuevaFecha)
    resincronizarFechasPago(nuevaFecha)
  }
  // Tabla de entrada (abono inicial + cuotas de entrada, sin interés) — reemplaza el
  // campo suelto "Entrada": para Crédito directo la suma tiene que calzar con el 5%
  // del valor del lote (se valida también en el backend).
  const [entradasTabla, setEntradasTabla] = useState<FilaEntradaTabla[]>([])
  const [promocionesSeleccionadas, setPromocionesSeleccionadas] = useState<number[]>([])
  const [gestionarPromocionesAbierto, setGestionarPromocionesAbierto] = useState(false)
  const [desgloseCalculoAbierto, setDesgloseCalculoAbierto] = useState(false)
  const [calendarioInicioAbierto, setCalendarioInicioAbierto] = useState(false)
  const [verificacionAbierta, setVerificacionAbierta] = useState(false)
  const [problemasVerificacion, setProblemasVerificacion] = useState<
    {
      mensaje: string
      accion?: { etiqueta: string; ejecutar: () => void }
      // true solo para el cronograma desactualizado — a diferencia del resto de
      // advertencias (que se pueden ignorar con "Guardar de todas formas"), esta
      // bloquea el guardado: la vista previa no coincide con la configuración
      // actual, así que guardar así guardaría un cronograma que ni el asesor vio.
      bloqueante?: boolean
    }[]
  >([])
  // Generador rápido de la tabla de entrada: el asesor pone el abono inicial (el
  // valor que quiera) y el valor total de las entradas + en cuántas cuotas repartirlo
  // — sin ninguna regla de porcentaje sobre el valor del lote.
  const [abonoInicialGenerar, setAbonoInicialGenerar] = useState("")
  const [valorEntradaTotalGenerar, setValorEntradaTotalGenerar] = useState("")
  // Vacío por defecto (no "2"): un valor precargado se contaría como "el asesor sí
  // quiere cuotas", bloqueando el caso de generar solo con abono inicial (ver
  // generarFilasEntrada / el useEffect de auto-generación más abajo).
  const [numeroEntradasGenerar, setNumeroEntradasGenerar] = useState("")
  // true justo después de rellenar los 3 campos de arriba a partir de un financiamiento
  // ya guardado (ver cargar() más abajo) — evita que el useEffect de auto-generación
  // regenere entradasTabla desde cero y pise filas reales con fechas/montos desiguales,
  // alícuota puntual u observaciones que no se pueden reconstruir solo con esos 3 números.
  const saltarAutoGeneracionRef = useRef(false)
  // Hasta 3 comentarios libres sobre el financiamiento.
  const [comentarios, setComentarios] = useState<string[]>([])
  // Ofrecimientos adicionales del lote (ej. Huerto, Tanque biodigestor) — selección múltiple.
  const [ofrecimientos, setOfrecimientos] = useState<string[]>([])

  async function recargarPromocionesActivas() {
    try {
      setPromocionesActivas(await listarPromocionesActivasCotizacion())
    } catch {
      // Silencioso: el checklist de promociones simplemente no se actualiza si falla.
    }
  }

  useEffect(() => {
    if (!idNumero || Number.isNaN(idNumero)) {
      setCargando(false)
      setError("Cotización inválida.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const cotizacionData = await obtenerCotizacion(idNumero)
        if (cancelado) return
        if (!cotizacionData) {
          setError("No se encontró la cotización.")
          return
        }
        setCotizacion(cotizacionData)

        const [lote, promociones] = await Promise.all([
          obtenerLoteCotizacion(cotizacionData.codigo_lote),
          listarPromocionesActivasCotizacion(),
        ])
        if (cancelado) return
        setLoteInfo(lote)
        setPromocionesActivas(promociones)

        // El "casco" recién creado todavía no tiene financ_type — recién lo trae una
        // vez que el asesor generó la tabla al menos una vez (ver
        // CotizacionesService.crear, que lo deja en null).
        if (cotizacionData.financ_type) {
          const financiamientoExistente = cotizacionData
          const tipoCargado = financiamientoExistente.financ_type ?? "Crédito directo"
          setFinancType(tipoCargado)
          setDiscount(financiamientoExistente.discount ?? "")
          // "Mixto" cargado con un descuento ya guardado (>0): el checkbox arranca
          // marcado para reflejarlo — si no, el useEffect de descuento fijo lo
          // limpiaría a "" apenas carga la pantalla (ver más abajo).
          if (tipoCargado === "Mixto") {
            setAplicarDescuentoMixto(Number(financiamientoExistente.discount) > 0)
          }
          setExtraDiscount(financiamientoExistente.extra_discount ?? "")
          // "||" (no "??"): 0 nunca es válido acá — Contado/Crédito BIESS siempre
          // guardan no_cuotas = 0 (no usan cronograma), así que si el registro
          // fue/pasó por uno de esos dos tipos y luego se cambia a Crédito directo,
          // "N.º de meses" no debe quedar en 0 (eso hace que generarCronogramaFrances
          // no produzca ninguna fila).
          setMeses(String(financiamientoExistente.no_cuotas || 48))
          if (financiamientoExistente.init_date) {
            setFechaInicioFinanciamiento(financiamientoExistente.init_date)
          }
          setCuotaSugerida(financiamientoExistente.cuota_sugerida ?? "")
          setComentarios(financiamientoExistente.comentarios ?? [])
          setOfrecimientos(
            financiamientoExistente.ofrecimientos
              ? financiamientoExistente.ofrecimientos.split(",")
              : []
          )
          if (financiamientoExistente.entradas?.length) {
            // Compatibilidad: registros viejos guardaron concepto/fecha/monto.
            // "Pago total"/"Desembolso BIESS" solo aplican a Contado/Crédito BIESS —
            // si el registro quedó con una fila así guardada para otro tipo (ej. de
            // una prueba anterior), se descarta al cargar para que no infle "entrada"
            // y deje el total a financiar en $0.
            const filasCargadas = financiamientoExistente.entradas
              .map((fila) => ({
                formaPago: fila.forma_pago ?? fila.concepto ?? "Abono inicial",
                fechaPago: fila.fecha_pago ?? fila.fecha ?? "",
                abonoLote: String(fila.abono_lote ?? fila.monto ?? ""),
                // En la tabla de entrada la alícuota siempre se ve como un solo monto
                // (a diferencia del cronograma, que sí desglosa por componente) — si el
                // registro guardado tiene varios componentes (backend/cronograma), se
                // suman en uno solo acá; si es del formato legado (un único escalar
                // "alicuota_comunal"), se usa tal cual.
                alicuotas: fila.alicuotas?.length
                  ? [
                      {
                        nombre: "Alicuota",
                        valor: String(
                          fila.alicuotas.reduce(
                            (acc, c) => acc + (Number(c.valor) || 0),
                            0
                          )
                        ),
                        fechaInicio: null,
                      },
                    ]
                  : fila.alicuota_comunal != null
                    ? [
                        {
                          nombre: "Alicuota",
                          valor: String(fila.alicuota_comunal),
                          fechaInicio: null,
                        },
                      ]
                    : [],
                escritura: fila.escritura != null ? String(fila.escritura) : "",
                observaciones: fila.observaciones ?? "",
              }))
              .filter((fila) => {
                if (fila.formaPago === "Pago total") return tipoCargado === "Contado"
                if (fila.formaPago === "Desembolso BIESS") {
                  return usaDesembolsoBiess(tipoCargado)
                }
                return true
              })

            // "Contado" siempre cierra con una fila "Pago total" — si el registro se
            // guardó sin ella (ej. de antes de que existiera esta regla), se agrega
            // acá con un monto provisional: el useEffect que ya recalcula "Pago total"
            // en cuanto cambia entradasTabla/totalAFinanciar la corrige sola al toque.
            // "Crédito BIESS" no se autocompleta: su fila de cierre depende del
            // valor/fecha de desembolso que ingrese el asesor, no hay un monto
            // provisional razonable que fabricar acá.
            if (
              tipoCargado === "Contado" &&
              filasCargadas.length > 0 &&
              !filasCargadas.some((fila) => fila.formaPago === "Pago total")
            ) {
              const ultimaFecha = filasCargadas[filasCargadas.length - 1].fechaPago
              filasCargadas.push({
                formaPago: "Pago total",
                fechaPago: ultimaFecha
                  ? calcularFechaEntrada(ultimaFecha, 1)
                  : (financiamientoExistente.init_date ?? ""),
                abonoLote: "0.00",
                alicuotas: [],
                escritura: Number(lote?.proyecto?.escritura ?? 0).toFixed(2),
                observaciones: "",
              })
            }
            // "Crédito BIESS"/"Mixto": si el registro cargado ya trae su fila
            // "Desembolso BIESS", los campos "Valor de desembolso"/"Fecha de
            // desembolso" de arriba se rellenan con esos mismos valores — si no se
            // hace esto ANTES de setEntradasTabla, el useEffect que sincroniza esa
            // fila con esos dos campos (que arrancan vacíos) la pisaría con "" apenas
            // carga la pantalla.
            if (usaDesembolsoBiess(tipoCargado)) {
              const filaDesembolso = filasCargadas.find(
                (f) => f.formaPago === "Desembolso BIESS"
              )
              if (filaDesembolso) {
                setDesembolsoValor(filaDesembolso.abonoLote)
                setDesembolsoFecha(filaDesembolso.fechaPago)
              }
            }
            setEntradasTabla(filasCargadas)

            // Rellena los 3 campos del generador (abono inicial / valor de entrada /
            // N.º de entradas) solo para que se vean en pantalla lo que ya se guardó —
            // saltarAutoGeneracionRef evita que esto dispare la auto-generación de más
            // abajo y pise las filas reales recién cargadas.
            const filasAbonoInicial = filasCargadas.filter(
              (f) => f.formaPago === "Abono inicial"
            )
            // Solo "Entrada" cuenta como entrada para estos 3 campos — "Desembolso
            // BIESS" (Mixto/Crédito BIESS) y "Pago total" (Contado) son filas fijas
            // aparte, no reparto de "valor de entrada"/"N.º de entradas".
            const filasEntrada = filasCargadas.filter((f) => f.formaPago === "Entrada")
            const sumaAbonoInicial = filasAbonoInicial.reduce(
              (acc, f) => acc + (Number(f.abonoLote) || 0),
              0
            )
            const sumaEntradas = filasEntrada.reduce(
              (acc, f) => acc + (Number(f.abonoLote) || 0),
              0
            )

            saltarAutoGeneracionRef.current = true
            setAbonoInicialGenerar(
              filasAbonoInicial.length ? String(redondear(sumaAbonoInicial)) : ""
            )
            setValorEntradaTotalGenerar(filasEntrada.length ? String(redondear(sumaEntradas)) : "")
            setNumeroEntradasGenerar(
              filasEntrada.length ? String(filasEntrada.length) : ""
            )
          }
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

  const valorLote = loteInfo?.pvp ?? null
  const valorLoteNumero =
    typeof valorLote === "string" ? parseFloat(valorLote) : (valorLote ?? 0)
  // Escritura configurada en el proyecto del lote — "Contado" la usa tal cual en su
  // fila de cierre ("Pago total", ver calcularFilasEntradaGeneradas/agregarFilaEntrada);
  // "Crédito BIESS" no, sigue con el monto fijo ESCRITURA_CONTADO en la suya.
  const escrituraProyecto = Number(loteInfo?.proyecto?.escritura ?? 0)
  // Componentes de alícuota del proyecto (uno o varios, ej. Perla Verde tiene 2 con
  // nombre propio) — se aplican a cada "Entrada" generada, pero NO al abono inicial
  // (ese es un depósito único, no una cuota periódica). Memoizado (no "?? []" suelto)
  // para que sea una referencia estable mientras loteInfo no cambie — si no, el efecto
  // de abajo que corrige filas desalineadas se dispararía en cada render sin necesidad
  // mientras loteInfo todavía es null (antes de que cargue obtenerLote).
  const componentesAlicuotaProyecto = useMemo(
    () => loteInfo?.proyecto?.componentesAlicuota ?? [],
    [loteInfo]
  )

  // Descuento total que aportan las promociones seleccionadas, sobre el PVP bruto del
  // lote — es el primero de la cadena de descuentos (Promoción → Tipo de
  // Financiamiento → Descuento adicional). Se extrae a su propio memo porque el
  // descuento por Tipo de Financiamiento (más abajo) necesita este valor: su % se
  // calcula sobre el subtotal que queda después de la promoción, no sobre el PVP
  // bruto.
  const promoDescuentoTotal = useMemo(
    () =>
      promocionesSeleccionadas.reduce((acc, id) => {
        const promo = promocionesActivas.find((p) => p.id === id)
        if (!promo) return acc
        const valorEfecto = Number(promo.valor_efecto ?? 0)
        const monto =
          promo.tipo_efecto === "porcentaje"
            ? (valorLoteNumero * valorEfecto) / 100
            : valorEfecto
        return acc + monto
      }, 0),
    [valorLoteNumero, promocionesSeleccionadas, promocionesActivas]
  )

  // Contado/Crédito BIESS siempre llevan un descuento fijo, no editable (5% Contado,
  // 3% Crédito BIESS) — el backend lo recalcula igual al guardar (nunca confía en lo
  // que mande este campo), esto solo mantiene el campo mostrando ese mismo valor
  // mientras el tipo sea uno de esos dos. "Mixto" también lleva el 3%, pero es
  // opcional — solo se aplica si el asesor marca "aplicarDescuentoMixto"; si lo
  // desmarca (o cambia a un tipo sin descuento fijo, ej. Crédito directo), el campo se
  // limpia — es manual desde ahí, igual que en Crédito directo.
  // Orden de descuentos: Promoción → Tipo de Financiamiento → Descuento adicional —
  // este % se calcula sobre el subtotal que ya resta la promoción, no sobre el PVP
  // bruto (ver promoDescuentoTotal arriba).
  useEffect(() => {
    const subtotalTrasPromocion = Math.max(0, valorLoteNumero - promoDescuentoTotal)
    if (financType === "Contado" && valorLoteNumero > 0) {
      setDiscount(
        redondear(subtotalTrasPromocion * DESCUENTO_CONTADO_PORCENTAJE).toFixed(2)
      )
    } else if (financType === "Crédito BIESS" && valorLoteNumero > 0) {
      setDiscount(
        redondear(subtotalTrasPromocion * DESCUENTO_BIESS_PORCENTAJE).toFixed(2)
      )
    } else if (financType === "Mixto") {
      if (aplicarDescuentoMixto && valorLoteNumero > 0) {
        setDiscount(
          redondear(subtotalTrasPromocion * DESCUENTO_BIESS_PORCENTAJE).toFixed(2)
        )
      } else if (!aplicarDescuentoMixto) {
        setDiscount("")
      }
    }
  }, [financType, valorLoteNumero, promoDescuentoTotal, aplicarDescuentoMixto])

  // Si el tipo deja de ser el dueño de una fila de cierre — "Pago total" solo existe
  // en "Contado"; "Desembolso BIESS" solo en "Crédito BIESS"/"Mixto" (ej. el asesor
  // prueba un tipo y luego vuelve a "Crédito directo") — esa fila se quita sola: si se
  // queda, se suma dentro de "entrada" y deja el total a financiar de los demás tipos
  // en prácticamente $0 (por eso generarCronogramaFrances no producía cronograma: no
  // había nada que financiar).
  useEffect(() => {
    setEntradasTabla((anterior) => {
      const filtrado = anterior.filter((fila) => {
        if (fila.formaPago === "Pago total") return financType === "Contado"
        if (fila.formaPago === "Desembolso BIESS") return usaDesembolsoBiess(financType)
        return true
      })
      return filtrado.length === anterior.length ? anterior : filtrado
    })
  }, [financType, entradasTabla])

  // Contado/Crédito BIESS son una sola tabla: abono inicial + hasta 12 cuotas
  // ("Entrada") + una fila final de cierre — "Pago total" (Contado) o "Desembolso
  // BIESS" (Crédito BIESS). Esa etiqueta es exclusiva de esos tipos: para los demás se
  // saca de las opciones (el resto de "Entrada" ahí se financia vía el cronograma, no
  // con una fila que liquide todo de una) — salvo "Mixto", que sí necesita
  // "Desembolso BIESS" en sus opciones aunque no sea una fila de cierre para él (es una
  // fila extra, ver usaDesembolsoBiess/construirFilaDesembolsoBiess).
  const etiquetaCierreActual = etiquetaFilaCierre(financType)
  const formasPagoDisponibles = etiquetaCierreActual
    ? ["Abono inicial", "Entrada", etiquetaCierreActual]
    : FORMAS_PAGO_ENTRADA.filter(
        (opcion) =>
          opcion !== "Pago total" &&
          (opcion !== "Desembolso BIESS" || financType === "Mixto")
      )

  // La "entrada" que reduce el saldo a financiar es solo la suma de "abono lote"
  // (la alícuota comunal es un cargo aparte, no se aplica al lote).
  const entradaTotal = useMemo(
    () => entradasTabla.reduce((acc, fila) => acc + (Number(fila.abonoLote) || 0), 0),
    [entradasTabla]
  )

  const alicuotaComunalTotal = useMemo(
    () =>
      entradasTabla.reduce(
        (acc, fila) =>
          acc + fila.alicuotas.reduce((subacc, c) => subacc + (Number(c.valor) || 0), 0),
        0
      ),
    [entradasTabla]
  )

  // Nombres de las columnas de alícuota a mostrar en la tabla de entrada — de la
  // primera fila que tenga componentes (todas las filas de un mismo financiamiento
  // comparten la misma estructura, vienen del mismo proyecto).
  // La tabla de ENTRADA muestra la alícuota como UNA sola columna — a diferencia del
  // cronograma, que sí desglosa por componente (ver columnasAlicuotaCronograma), acá
  // no interesa el detalle: solo si corresponde mostrarla (el proyecto tiene algún
  // componente configurado, o el financiamiento ya traía algo guardado) y, si es así,
  // se muestra un total (ver alicuotasIniciales, que ya suma los componentes). La
  // fuente de verdad es la configuración VIVA del proyecto (no depende de que alguna
  // fila ya tenga el dato bien armado) — solo cae a mirar las filas para
  // financiamientos cargados de un proyecto que ya no tiene componentes configurados.
  const columnasAlicuota = useMemo(
    () =>
      componentesAlicuotaProyecto.length > 0 ||
      entradasTabla.some((fila) => fila.alicuotas.length > 0)
        ? [{ nombre: "Alicuota" }]
        : [],
    [componentesAlicuotaProyecto, entradasTabla]
  )

  // Total por columna de alícuota (para la fila "Total" de la tabla) — alineado por
  // índice con columnasAlicuota.
  const alicuotaComunalTotalPorColumna = useMemo(
    () =>
      columnasAlicuota.map((_, indice) =>
        entradasTabla.reduce(
          (acc, fila) => acc + (Number(fila.alicuotas[indice]?.valor) || 0),
          0
        )
      ),
    [entradasTabla, columnasAlicuota]
  )

  // Solo trae algo en la fila de cierre de Contado/Crédito BIESS ("Pago
  // total"/"Desembolso BIESS") — el resto de tipos siempre suma $0 acá.
  const escrituraTotal = useMemo(
    () => entradasTabla.reduce((acc, fila) => acc + (Number(fila.escritura) || 0), 0),
    [entradasTabla]
  )

  // Total a cancelar = suma de (abono lote + alícuota comunal + escritura) de todas
  // las filas.
  const totalCancelarTabla = useMemo(
    () => entradaTotal + alicuotaComunalTotal + escrituraTotal,
    [entradaTotal, alicuotaComunalTotal, escrituraTotal]
  )

  function totalFila(fila: {
    abonoLote: string
    alicuotas: ComponenteAlicuotaFila[]
    escritura?: string
  }): number {
    return (
      (Number(fila.abonoLote) || 0) +
      fila.alicuotas.reduce((acc, c) => acc + (Number(c.valor) || 0), 0) +
      (Number(fila.escritura) || 0)
    )
  }

  const totalAFinanciar = useMemo(() => {
    const valor = valorLoteNumero
    const desc = Number(discount) || 0
    const descExtra = Number(extraDiscount) || 0
    // Contado/Crédito BIESS no restan la tabla de entrada: no hay un saldo aparte que se financie
    // después (sin cronograma) — abono inicial + cuotas + pago total SON el total a
    // financiar, no lo reducen. Para el resto de tipos sí se resta (esa parte ya
    // quedó cubierta con abono inicial/entradas, financiar es el remanente).
    const restaEntrada = esContadoLike(financType) ? 0 : entradaTotal
    return Math.max(0, valor - promoDescuentoTotal - desc - descExtra - restaEntrada)
  }, [
    valorLoteNumero,
    discount,
    extraDiscount,
    entradaTotal,
    promoDescuentoTotal,
    financType,
  ])

  // Si el asesor edita la tabla de entrada (o el descuento, promociones, N.º de
  // meses) después de haber generado el cronograma, lo que se ve en pantalla
  // (interés/capital por cuota) queda desactualizado respecto al nuevo total a
  // financiar — hace falta "Regenerar cuotas" para que el backend lo vuelva a
  // calcular. Solo aplica a tipos con cronograma propio (Contado/Crédito BIESS no
  // tienen) y cuando ya existe un cronograma generado para el tipo actual (si el tipo
  // cambió, ese botón ni se muestra — ver el pill de abajo, ahí ya se trata como
  // "Generar tabla" de nuevo).
  const cronogramaDesactualizado =
    !esContadoLike(financType) &&
    !!cotizacion &&
    cotizacion.financ_type === financType &&
    (cotizacion.detalle?.length ?? 0) > 0 &&
    (Math.abs(totalAFinanciar - Number(cotizacion.total_financ ?? 0)) > 0.01 ||
      Number(meses) !== (cotizacion.no_cuotas ?? 0))

  // Contado/Crédito BIESS no piden el valor de las cuotas a mano — se deriva solo del
  // total a financiar menos el abono inicial (ya no tiene sentido pedirlo aparte, es
  // una resta que el sistema ya sabe hacer). Crédito directo conserva el campo "Valor
  // de entrada" tal cual, sin ningún cambio. Memorizado para que la auto-generación de
  // abajo solo reaccione cuando este valor REALMENTE cambia — no en cada recálculo de
  // totalAFinanciar que no afecta a Crédito directo (evita pisar ediciones manuales de
  // la tabla por un cambio no relacionado, ej. una promoción).
  const valorEntradaTotalEfectivo = useMemo(() => {
    const abonoInicial = Number(abonoInicialGenerar)
    if (financType === "Contado") return redondear(totalAFinanciar - abonoInicial)
    // "Crédito BIESS": el valor de desembolso tampoco lo reparten las cuotas — sale
    // aparte, fijo — así que también se resta acá antes de repartir el remanente.
    if (financType === "Crédito BIESS") {
      return redondear(totalAFinanciar - abonoInicial - (Number(desembolsoValor) || 0))
    }
    return Number(valorEntradaTotalGenerar)
  }, [
    financType,
    totalAFinanciar,
    abonoInicialGenerar,
    valorEntradaTotalGenerar,
    desembolsoValor,
  ])

  // Genera de una la tabla de entrada: el abono inicial es el valor que el asesor
  // ponga (libre, sin ninguna regla de porcentaje), y el "valor de entrada" total se
  // reparte en partes iguales entre el número de entradas — reemplaza cualquier fila
  // que ya hubiera. Además del botón "Regenerar entradas" (con toasts si faltan
  // datos), esto mismo se dispara solo en cuanto los campos quedan completos (ver el
  // useEffect más abajo).
  function generarFilasEntrada() {
    const abonoInicial = Number(abonoInicialGenerar)
    const valorEntradaTotal = valorEntradaTotalEfectivo
    const numero = parseInt(numeroEntradasGenerar, 10)

    // Contado/Crédito BIESS siempre necesitan los dos datos — sin cuotas la tabla
    // queda incompleta (no habría de dónde sacar la fila "Pago total" que cierra el
    // financiamiento). Crédito directo sí puede generarse solo con abono inicial (ver
    // abajo).
    if (esContadoLike(financType)) {
      const esBiess = financType === "Crédito BIESS"
      const faltaAbono =
        abonoInicialGenerar.trim() === "" || isNaN(abonoInicial) || abonoInicial < 0
      const faltaCuotas = numeroEntradasGenerar.trim() === "" || !numero || numero < 1
      // "Crédito BIESS" además necesita el valor y la fecha de desembolso — sin eso no
      // hay cómo armar su fila de cierre (ver CONFIGURACIÓN DE FINANCIAMIENTO más
      // arriba, donde se piden esos dos campos solo para este tipo).
      const faltaDesembolso =
        esBiess &&
        (desembolsoValor.trim() === "" ||
          isNaN(Number(desembolsoValor)) ||
          Number(desembolsoValor) <= 0)
      if (faltaAbono || faltaCuotas || faltaDesembolso) {
        toast({
          variant: "error",
          title: "Faltan datos",
          description: faltaAbono
            ? "Ingresa el valor de abono inicial."
            : faltaDesembolso
              ? "Ingresa el valor de desembolso."
              : "Ingresa el número de cuotas.",
        })
        return
      }
      const desembolso = Number(desembolsoValor) || 0
      if (valorEntradaTotal <= 0) {
        toast({
          variant: "error",
          title: esBiess
            ? "Abono inicial + desembolso demasiado alto"
            : "Abono inicial demasiado alto",
          description: esBiess
            ? "El abono inicial más el valor de desembolso no puede ser mayor o igual al total a financiar."
            : "El abono inicial no puede ser mayor o igual al total a financiar.",
        })
        return
      }
      if (numero > 12) {
        toast({
          variant: "error",
          title: "Demasiadas cuotas",
          description: `"${financType}" permite máximo 12 cuotas.`,
        })
        return
      }
      // "Crédito BIESS" necesita al menos una cuota además de su fila de cierre — sin
      // eso no habría dónde repartir el remanente (abono inicial + desembolso no
      // cubren solos el total a financiar).
      if (esBiess && numero < 2) {
        toast({
          variant: "error",
          title: "Faltan cuotas",
          description:
            '"Crédito BIESS" necesita al menos 1 cuota además del desembolso para repartir el remanente.',
        })
        return
      }
      setEntradasTabla(
        calcularFilasEntradaGeneradas(
          abonoInicial,
          valorEntradaTotal,
          numero,
          fechaInicioFinanciamiento,
          componentesAlicuotaProyecto,
          {
            etiqueta: etiquetaFilaCierre(financType)!,
            fijo: esBiess ? { monto: desembolso, fecha: desembolsoFecha } : undefined,
          },
          escrituraProyecto
        )
      )
      return
    }

    if (isNaN(abonoInicial) || abonoInicial < 0) {
      toast({
        variant: "error",
        title: "Falta el abono inicial",
        description: "Ingresa el valor del abono inicial (puede ser 0).",
      })
      return
    }

    // "Mixto" es Crédito directo con un desembolso BIESS extra en la tabla — sin el
    // valor de desembolso no hay con qué armar esa fila (ver CONFIGURACIÓN DE
    // FINANCIAMIENTO más arriba, donde se pide ese campo solo para este tipo).
    const esMixto = financType === "Mixto"
    if (
      esMixto &&
      (desembolsoValor.trim() === "" ||
        isNaN(Number(desembolsoValor)) ||
        Number(desembolsoValor) <= 0)
    ) {
      toast({
        variant: "error",
        title: "Faltan datos",
        description: "Ingresa el valor de desembolso.",
      })
      return
    }
    const filaDesembolso = esMixto
      ? [
          construirFilaDesembolsoBiess(
            desembolsoValor,
            desembolsoFecha,
            componentesAlicuotaProyecto
          ),
        ]
      : []

    // Sin cuotas/entradas indicadas (campos vacíos), la tabla queda solo con el
    // abono inicial (+ desembolso, si es "Mixto") — no hace falta forzar también una
    // entrada/cuota para generar.
    const seIndicaronCuotas =
      numeroEntradasGenerar.trim() !== "" || valorEntradaTotalGenerar.trim() !== ""

    if (!seIndicaronCuotas) {
      setEntradasTabla(
        insertarFilaDesembolso(
          calcularFilasEntradaGeneradas(
            abonoInicial,
            0,
            0,
            fechaInicioFinanciamiento,
            componentesAlicuotaProyecto,
            null
          ),
          filaDesembolso
        )
      )
      return
    }
    if (!numero || numero < 1 || !valorEntradaTotal || valorEntradaTotal <= 0) {
      toast({
        variant: "error",
        title: "Faltan datos",
        description:
          "Ingresa el valor de entrada y en cuántas cuotas repartirlo (o déjalos vacíos para solo abono inicial).",
      })
      return
    }

    setEntradasTabla(
      insertarFilaDesembolso(
        calcularFilasEntradaGeneradas(
          abonoInicial,
          valorEntradaTotal,
          numero,
          fechaInicioFinanciamiento,
          componentesAlicuotaProyecto,
          null
        ),
        filaDesembolso
      )
    )
  }

  // Auto-generación silenciosa: en cuanto los campos necesarios quedan completos, la
  // tabla se arma sola — no hace falta darle a "Regenerar entradas" para verla por
  // primera vez. Reacciona a valorEntradaTotalEfectivo (no a totalAFinanciar
  // directo) para que, en Crédito directo, un recálculo de totalAFinanciar que
  // no le afecta (ese valor ahí sigue siendo el campo a mano) no dispare una
  // regeneración que pise ediciones manuales de la tabla. No reacciona a la fecha de
  // inicio ni a la alícuota del proyecto: esos otros cambios ya los maneja
  // resincronizarFechasPago sin pisar filas que el asesor haya fijado a mano.
  useEffect(() => {
    if (saltarAutoGeneracionRef.current) {
      saltarAutoGeneracionRef.current = false
      return
    }
    // Sin nada escrito en abono inicial todavía (formulario recién reseteado/vacío),
    // no se genera nada solo — hace falta que el asesor escriba algo primero.
    if (abonoInicialGenerar.trim() === "") return
    const abonoInicial = Number(abonoInicialGenerar)
    const valorEntradaTotal = valorEntradaTotalEfectivo
    const numero = parseInt(numeroEntradasGenerar, 10)
    if (isNaN(abonoInicial) || abonoInicial < 0) return

    // Contado/Crédito BIESS siempre necesitan también el número de cuotas — sin eso
    // no se genera nada solo (mismo criterio que "Regenerar entradas": ahí se ve el
    // error explicando qué falta). Crédito directo sí arma la tabla solo con abono
    // inicial si se dejó todo lo demás vacío.
    if (esContadoLike(financType)) {
      const esBiess = financType === "Crédito BIESS"
      if (
        esBiess &&
        (desembolsoValor.trim() === "" ||
          isNaN(Number(desembolsoValor)) ||
          Number(desembolsoValor) <= 0)
      ) {
        return
      }
      if (numeroEntradasGenerar.trim() === "" || !numero || numero < 1) return
      if (esBiess && numero < 2) return
      if (valorEntradaTotal <= 0 || numero > 12) return
      setEntradasTabla(
        calcularFilasEntradaGeneradas(
          abonoInicial,
          valorEntradaTotal,
          numero,
          fechaInicioFinanciamiento,
          componentesAlicuotaProyecto,
          {
            etiqueta: etiquetaFilaCierre(financType)!,
            fijo: esBiess
              ? { monto: Number(desembolsoValor) || 0, fecha: desembolsoFecha }
              : undefined,
          },
          escrituraProyecto
        )
      )
      return
    }

    // "Mixto" es Crédito directo con un desembolso BIESS extra — sin ese valor no se
    // genera nada solo, igual que "Regenerar entradas".
    const esMixto = financType === "Mixto"
    if (
      esMixto &&
      (desembolsoValor.trim() === "" ||
        isNaN(Number(desembolsoValor)) ||
        Number(desembolsoValor) <= 0)
    ) {
      return
    }
    const filaDesembolso = esMixto
      ? [
          construirFilaDesembolsoBiess(
            desembolsoValor,
            desembolsoFecha,
            componentesAlicuotaProyecto
          ),
        ]
      : []

    const seIndicaronCuotas =
      numeroEntradasGenerar.trim() !== "" || valorEntradaTotalGenerar.trim() !== ""
    if (!seIndicaronCuotas) {
      setEntradasTabla(
        insertarFilaDesembolso(
          calcularFilasEntradaGeneradas(
            abonoInicial,
            0,
            0,
            fechaInicioFinanciamiento,
            componentesAlicuotaProyecto,
            null
          ),
          filaDesembolso
        )
      )
      return
    }

    if (!valorEntradaTotal || valorEntradaTotal <= 0 || !numero || numero < 1) return
    setEntradasTabla(
      insertarFilaDesembolso(
        calcularFilasEntradaGeneradas(
          abonoInicial,
          valorEntradaTotal,
          numero,
          fechaInicioFinanciamiento,
          componentesAlicuotaProyecto,
          null
        ),
        filaDesembolso
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    abonoInicialGenerar,
    valorEntradaTotalEfectivo,
    numeroEntradasGenerar,
    desembolsoValor,
    desembolsoFecha,
  ])

  // Si el asesor agrega/quita/edita filas directamente en la tabla (sin pasar por
  // "Regenerar entradas" — ej. "Agregar fila", o editando un monto a mano), los
  // campos del generador (abono inicial / valor de entrada / N.º de entradas) se
  // quedaban mostrando lo que había antes, sin reflejar la tabla real. Este efecto los
  // mantiene siempre sincronizados con la tabla actual — mismo cálculo que ya usa la
  // carga inicial de un financiamiento existente más arriba (solo "Entrada" cuenta
  // para "Valor de entrada"; "Desembolso BIESS" de Mixto/Crédito BIESS y "Pago total"
  // de Contado son filas fijas aparte, si se contaran ahí "Valor de entrada" se
  // pisaría solo con el valor de desembolso apenas se genera esa fila). saltarAutoGeneracionRef
  // evita que esto dispare la auto-generación de arriba y regenere la tabla, pisando
  // los montos a mano que el asesor puso.
  useEffect(() => {
    const filasAbonoInicial = entradasTabla.filter((f) => f.formaPago === "Abono inicial")
    const filasEntrada = entradasTabla.filter((f) => f.formaPago === "Entrada")
    const sumaAbonoInicial = filasAbonoInicial.reduce(
      (acc, f) => acc + (Number(f.abonoLote) || 0),
      0
    )
    const sumaEntradas = filasEntrada.reduce(
      (acc, f) => acc + (Number(f.abonoLote) || 0),
      0
    )

    // A diferencia de "Valor de entrada", "N.º de cuotas" en Contado/Crédito BIESS SÍ
    // incluye su fila de cierre ("Pago total"/"Desembolso BIESS") — así se le explica
    // al asesor bajo el campo ("la última fila se agrega siempre como..."), y así la
    // arma calcularFilasEntradaGeneradas. Sin sumarla acá, cada "Regenerar tabla"
    // perdía una cuota: se generaban N cuotas (N-1 "Entrada" + 1 cierre), este efecto
    // releía solo las N-1 "Entrada" como el nuevo N.º de cuotas, y la siguiente
    // regeneración ya partía de N-1.
    const tieneFilaCierre =
      esContadoLike(financType) &&
      entradasTabla.some((f) => f.formaPago === etiquetaFilaCierre(financType))

    const nuevoAbonoInicial = filasAbonoInicial.length ? String(redondear(sumaAbonoInicial)) : ""
    const nuevoValorEntrada = filasEntrada.length ? String(redondear(sumaEntradas)) : ""
    const nuevoNumeroEntradas =
      filasEntrada.length || tieneFilaCierre
        ? String(filasEntrada.length + (tieneFilaCierre ? 1 : 0))
        : ""

    const abonoIgual = mismoMonto(nuevoAbonoInicial, abonoInicialGenerar)
    const valorIgual = mismoMonto(nuevoValorEntrada, valorEntradaTotalGenerar)
    const numeroIgual = nuevoNumeroEntradas === numeroEntradasGenerar
    if (abonoIgual && valorIgual && numeroIgual) return

    saltarAutoGeneracionRef.current = true
    if (!abonoIgual) setAbonoInicialGenerar(nuevoAbonoInicial)
    if (!valorIgual) setValorEntradaTotalGenerar(nuevoValorEntrada)
    if (!numeroIgual) setNumeroEntradasGenerar(nuevoNumeroEntradas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entradasTabla, financType])

  // Si la tabla se armó (auto-generación o "Regenerar entradas") antes de que
  // terminara de cargar el lote/proyecto (ej. obtenerLote todavía en vuelo), las filas
  // quedaban sin columnas de alícuota para siempre — ninguna acción posterior las
  // vuelve a generar solas, ni siquiera cuando el proyecto sí tiene componentes
  // configurados. Este efecto corrige eso apenas componentesAlicuotaProyecto está
  // disponible: si el N.º de componentes de una fila no coincide con el del proyecto,
  // le vuelve a copiar los nombres (y valores por defecto según la fecha de esa fila,
  // igual que alicuotasIniciales) — solo toca filas desalineadas, nunca pisa valores
  // que ya coincidan en cantidad de componentes.
  useEffect(() => {
    if (componentesAlicuotaProyecto.length === 0) return
    setEntradasTabla((anterior) => {
      const desalineada = anterior.some((fila) => fila.alicuotas.length === 0)
      if (!desalineada) return anterior
      return anterior.map((fila) =>
        fila.alicuotas.length > 0
          ? fila
          : {
              ...fila,
              alicuotas: alicuotasIniciales(componentesAlicuotaProyecto, fila.fechaPago),
            }
      )
    })
  }, [componentesAlicuotaProyecto])

  // La nueva fila se agrega como "Entrada" (no "Abono inicial"): el total que ya
  // estaba repartido entre las entradas existentes se vuelve a repartir en partes
  // iguales entre todas (incluida la nueva), y las fechas se recorren desde la fecha
  // de inicio de financiamiento — igual que "Regenerar entradas". El cronograma ya
  // generado (si existe) también se reajusta en vista previa.
  function agregarFilaEntrada() {
    // Contado/Crédito BIESS son abono inicial -> hasta 12 cuotas ("Entrada") -> una
    // fila final de cierre ("Pago total"/"Desembolso BIESS", agregada sola al llegar
    // al tope, ver formaPagoNuevaFila más abajo). Una vez que ya existe esa fila no se
    // agregan más: siempre tiene que quedar al final.
    const cierreEtiqueta = etiquetaFilaCierre(financType)
    if (
      cierreEtiqueta &&
      entradasTabla.some((fila) => fila.formaPago === cierreEtiqueta)
    ) {
      toast({
        variant: "error",
        title: "Ya está completa",
        description: `"${cierreEtiqueta}" siempre va al final — no se pueden agregar más filas.`,
      })
      return
    }

    const entradasExistentes = entradasTabla.filter(
      (fila) => fila.formaPago === "Entrada"
    )
    const totalEntradaActual = entradasExistentes.reduce(
      (acc, fila) => acc + (Number(fila.abonoLote) || 0),
      0
    )
    // Las filas "Entrada" fijadas a mano (montoEditado) no se tocan — el total que
    // queda se reparte solo entre las filas libres, incluida la nueva.
    const sumaFilasFijadas = entradasExistentes.reduce(
      (acc, fila) => acc + (fila.montoEditado ? Number(fila.abonoLote) || 0 : 0),
      0
    )
    const conteoLibres =
      entradasExistentes.filter((fila) => !fila.montoEditado).length + 1
    const restante = Math.max(
      0,
      Math.round((totalEntradaActual - sumaFilasFijadas) * 100) / 100
    )
    const valorPorEntrada = Math.round((restante / conteoLibres) * 100) / 100

    // Secuencia para Contado/Crédito BIESS: Abono inicial -> Entrada (cuota, hasta 12)
    // -> fila de cierre (una vez alcanzado el tope).
    const formaPagoNuevaFila = cierreEtiqueta
      ? !entradasTabla.some((fila) => fila.formaPago === "Abono inicial")
        ? "Abono inicial"
        : entradasTabla.filter((fila) => fila.formaPago === "Entrada").length < 12
          ? "Entrada"
          : cierreEtiqueta
      : "Entrada"
    const esNuevaFilaCierre = formaPagoNuevaFila === cierreEtiqueta

    // "Desembolso BIESS" nace ya con el valor/fecha de desembolso fijados por el
    // asesor (no con placeholders vacíos) — "Pago total" sí queda vacío: el useEffect
    // correspondiente lo recalcula solo.
    const fechaNuevaFila =
      esNuevaFilaCierre && financType === "Crédito BIESS" ? desembolsoFecha : ""
    const conNuevaFila = [
      ...entradasTabla,
      {
        formaPago: formaPagoNuevaFila,
        fechaPago: fechaNuevaFila,
        abonoLote:
          esNuevaFilaCierre && financType === "Crédito BIESS" ? desembolsoValor : "",
        alicuotas: alicuotasIniciales(componentesAlicuotaProyecto, fechaNuevaFila),
        // "Pago total" (Contado) usa la escritura del proyecto; "Desembolso BIESS"
        // sigue con el fijo ESCRITURA_CONTADO — ver mismo criterio en
        // calcularFilasEntradaGeneradas.
        escritura: esNuevaFilaCierre
          ? financType === "Contado"
            ? escrituraProyecto.toFixed(2)
            : ESCRITURA_CONTADO.toFixed(2)
          : "",
        observaciones: "",
      },
    ]

    let indiceEntrada = 0
    let indiceLibre = 0
    const nuevasEntradas = conNuevaFila.map((fila) => {
      if (fila.formaPago !== "Entrada") return fila
      const fechaPago = calcularFechaEntrada(fechaInicioFinanciamiento, indiceEntrada)
      indiceEntrada += 1
      if (fila.montoEditado) return { ...fila, fechaPago }
      const esUltimaLibre = indiceLibre === conteoLibres - 1
      const monto = esUltimaLibre
        ? Math.round((restante - valorPorEntrada * (conteoLibres - 1)) * 100) / 100
        : valorPorEntrada
      indiceLibre += 1
      return { ...fila, fechaPago, abonoLote: monto.toFixed(2) }
    })

    setEntradasTabla(nuevasEntradas)
    sincronizarCronogramaConEntradas(nuevasEntradas, fechaInicioFinanciamiento)
  }

  // Al borrar una fila "Entrada" (Crédito directo/Crédito BIESS): su monto se reparte
  // entre las demás filas "Entrada" libres (no fijadas a mano) — mismo criterio que al
  // editar una a mano (reajustarAbonoLoteEntradas), para que el total de la tabla no
  // cambie solo por quitar una fila — y además las fechas de las "Entrada" que quedan
  // se recorren para volver a quedar consecutivas (sin el hueco que deja la fila
  // eliminada), igual que hace agregarFilaEntrada al agregar una. El cronograma ya
  // generado (si existe) se reajusta en vista previa a partir de esa nueva fecha base,
  // igual que en agregarFilaEntrada. "Contado" no necesita nada de esto — "Pago total"
  // ya absorbe la diferencia solo (ver useEffect de totalAFinanciar) y no tiene
  // cronograma. "Crédito BIESS" sí redistribuye: su fila de cierre está fija al valor
  // de desembolso, así que son las cuotas las que tienen que absorber la diferencia.
  function quitarFilaEntrada(indice: number) {
    const filaEliminada = entradasTabla[indice]
    const restante = entradasTabla.filter((_, i) => i !== indice)
    if (financType === "Contado" || filaEliminada?.formaPago !== "Entrada") {
      setEntradasTabla(restante)
      return
    }

    const montoEliminado = Number(filaEliminada.abonoLote) || 0
    const filasLibres = restante
      .map((fila, i) => ({ fila, i }))
      .filter(({ fila }) => fila.formaPago === "Entrada" && !fila.montoEditado)

    const sumaLibresActual = filasLibres.reduce(
      (acc, { fila }) => acc + (Number(fila.abonoLote) || 0),
      0
    )
    const nuevoTotalLibres = Math.max(
      0,
      Math.round((sumaLibresActual + montoEliminado) * 100) / 100
    )
    const valorPorFila =
      filasLibres.length > 0
        ? Math.round((nuevoTotalLibres / filasLibres.length) * 100) / 100
        : 0

    let indiceEntrada = 0
    const nuevasEntradas = restante.map((fila, i) => {
      if (fila.formaPago !== "Entrada") return fila
      const fechaPago = calcularFechaEntrada(fechaInicioFinanciamiento, indiceEntrada)
      indiceEntrada += 1

      const posicion = filasLibres.findIndex((o) => o.i === i)
      if (posicion === -1 || montoEliminado <= 0) return { ...fila, fechaPago }
      const esUltima = posicion === filasLibres.length - 1
      const monto = esUltima
        ? Math.round((nuevoTotalLibres - valorPorFila * (filasLibres.length - 1)) * 100) /
          100
        : valorPorFila
      return { ...fila, fechaPago, abonoLote: monto.toFixed(2) }
    })

    setEntradasTabla(nuevasEntradas)
    sincronizarCronogramaConEntradas(nuevasEntradas, fechaInicioFinanciamiento)
  }

  // Al editar el abono lote de una fila "Entrada", el resto de filas "Entrada"
  // (nunca el abono inicial) se reparte lo que falta para conservar el mismo total
  // que había antes de esta edición — así el total de entradas nunca cambia solo por
  // mover valores entre filas.
  function reajustarAbonoLoteEntradas(
    filas: typeof entradasTabla,
    indiceEditado: number,
    nuevoValorTexto: string
  ): typeof entradasTabla {
    const totalOriginal = filas.reduce(
      (acc, fila) =>
        acc + (fila.formaPago === "Entrada" ? Number(fila.abonoLote) || 0 : 0),
      0
    )
    const nuevoValor = Math.max(0, Number(nuevoValorTexto) || 0)

    // Filas libres para absorber el ajuste: "Entrada", no la que se está editando
    // ahora, y que no hayan sido fijadas a mano antes — esas se respetan tal cual.
    const filasLibres = filas
      .map((fila, indice) => ({ fila, indice }))
      .filter(
        ({ fila, indice }) =>
          fila.formaPago === "Entrada" && indice !== indiceEditado && !fila.montoEditado
      )
    const sumaFilasFijadas = filas.reduce((acc, fila, indice) => {
      if (
        fila.formaPago !== "Entrada" ||
        indice === indiceEditado ||
        !fila.montoEditado
      ) {
        return acc
      }
      return acc + (Number(fila.abonoLote) || 0)
    }, 0)

    const restante = Math.max(
      0,
      Math.round((totalOriginal - nuevoValor - sumaFilasFijadas) * 100) / 100
    )
    const valorPorFila =
      filasLibres.length > 0 ? Math.round((restante / filasLibres.length) * 100) / 100 : 0

    return filas.map((fila, indice) => {
      if (indice === indiceEditado) {
        return { ...fila, abonoLote: nuevoValorTexto, montoEditado: true }
      }
      const posicion = filasLibres.findIndex((o) => o.indice === indice)
      if (posicion === -1) return fila
      const esUltima = posicion === filasLibres.length - 1
      const monto = esUltima
        ? Math.round((restante - valorPorFila * (filasLibres.length - 1)) * 100) / 100
        : valorPorFila
      return { ...fila, abonoLote: monto.toFixed(2) }
    })
  }

  function actualizarFilaEntrada(
    indice: number,
    campo: "formaPago" | "fechaPago" | "abonoLote" | "escritura" | "observaciones",
    valor: string
  ) {
    setEntradasTabla((anterior) => {
      // Para "Contado" no se redistribuye entre cuotas al editar una: acá el total no
      // es un valor fijo a repartir, "Pago total" absorbe la diferencia solo (ver
      // useEffect de totalAFinanciar más arriba). Crédito directo/Crédito BIESS sí
      // redistribuyen entre las demás cuotas — en BIESS la fila de cierre está fija al
      // valor de desembolso, así que las cuotas son las que absorben la diferencia.
      if (
        campo === "abonoLote" &&
        anterior[indice]?.formaPago === "Entrada" &&
        financType !== "Contado"
      ) {
        return reajustarAbonoLoteEntradas(anterior, indice, valor)
      }
      return anterior.map((fila, i) =>
        i === indice ? { ...fila, [campo]: valor } : fila
      )
    })
  }

  // Edita un componente de alícuota puntual (por índice de columna) de una fila —
  // aparte de actualizarFilaEntrada porque necesita ubicar el componente dentro del
  // array `alicuotas`, no solo reemplazar un campo escalar.
  function actualizarAlicuotaFila(
    indice: number,
    indiceComponente: number,
    valor: string
  ) {
    setEntradasTabla((anterior) =>
      anterior.map((fila, i) => {
        if (i !== indice) return fila
        // Si esta fila quedó con un array de alícuotas desalineado (ej. se generó un
        // instante antes de que cargara la configuración del proyecto), se rearma acá
        // mismo antes de aplicar la edición — si no, escribir en la columna que "no
        // existe" en esta fila se perdía en silencio, sin guardar nada.
        const alicuotas =
          fila.alicuotas.length === columnasAlicuota.length
            ? fila.alicuotas
            : alicuotasIniciales(componentesAlicuotaProyecto, fila.fechaPago)
        return {
          ...fila,
          alicuotas: alicuotas.map((c, ci) =>
            ci === indiceComponente ? { ...c, valor } : c
          ),
        }
      })
    )
  }

  // "Contado": la fila "Pago total" siempre es el restante — abono inicial + cuotas +
  // pago total (columna ABONO LOTE) tienen que sumar exacto el total a financiar. La
  // escritura (tomada de la configuración del proyecto, ver escrituraProyecto) es un
  // cargo aparte, igual que la alícuota comunal: se cobra en esa misma fila pero en
  // su propia columna, sin sumarse a "abono lote" — Contado no genera cronograma, así
  // que no tiene las últimas 6 cuotas de Crédito directo donde repartirla, se cobra
  // de una sola vez al cierre. "abono lote" no es un valor que el asesor escriba a
  // mano en esa fila (por eso queda deshabilitado más abajo);
  // se recalcula solo cada vez que cambia alguna otra fila o el total a financiar. La
  // escritura SÍ se puede editar a mano — este efecto solo le pone el valor por
  // defecto al crear la fila (ver calcularFilasEntradaGeneradas/agregarFilaEntrada),
  // nunca la vuelve a tocar. "Crédito BIESS" no usa este mecanismo — su fila de
  // cierre ("Desembolso BIESS") es fija, ver el useEffect siguiente.
  useEffect(() => {
    if (financType !== "Contado") return
    const sumaSinPagoTotal = entradasTabla.reduce(
      (acc, fila) =>
        acc + (fila.formaPago === "Pago total" ? 0 : Number(fila.abonoLote) || 0),
      0
    )
    const pagoTotalCalculado = redondear(totalAFinanciar - sumaSinPagoTotal).toFixed(2)
    setEntradasTabla((anterior) => {
      let cambio = false
      const actualizado = anterior.map((fila) => {
        if (fila.formaPago !== "Pago total" || fila.abonoLote === pagoTotalCalculado)
          return fila
        cambio = true
        return { ...fila, abonoLote: pagoTotalCalculado }
      })
      return cambio ? actualizado : anterior
    })
  }, [financType, entradasTabla, totalAFinanciar])

  // "Crédito BIESS"/"Mixto": la fila "Desembolso BIESS" no es un remanente
  // calculado — es el valor y la fecha de desembolso que fija el asesor arriba, en
  // CONFIGURACIÓN DE FINANCIAMIENTO. Este efecto solo mantiene esa fila sincronizada
  // con esos dos campos (por eso también queda deshabilitada para edición directa más
  // abajo); el remanente para completar el total a financiar lo absorben las cuotas
  // (ver reajustarAbonoLoteEntradas/valorEntradaTotalEfectivo), no esta fila.
  useEffect(() => {
    if (!usaDesembolsoBiess(financType)) return
    setEntradasTabla((anterior) => {
      let cambio = false
      const actualizado = anterior.map((fila) => {
        if (fila.formaPago !== "Desembolso BIESS") return fila
        if (fila.abonoLote === desembolsoValor && fila.fechaPago === desembolsoFecha)
          return fila
        cambio = true
        return { ...fila, abonoLote: desembolsoValor, fechaPago: desembolsoFecha }
      })
      return cambio ? actualizado : anterior
    })
  }, [financType, entradasTabla, desembolsoValor, desembolsoFecha])

  // Desglose paso a paso de cómo se llega al total a financiar, en el mismo orden en
  // que se aplican las restas (mismo cálculo que totalAFinanciar arriba, pero
  // mostrando el subtotal después de cada resta).
  const desgloseCalculo = useMemo(() => {
    const valor = valorLoteNumero
    const lineas: {
      etiqueta: string
      monto: number
      tipo: "base" | "resta" | "subtotal" | "total"
    }[] = [{ etiqueta: "Valor del lote", monto: valor, tipo: "base" }]
    let corriente = valor

    function aplicarResta(etiqueta: string, monto: number) {
      if (monto <= 0) return
      lineas.push({ etiqueta: `− ${etiqueta}`, monto, tipo: "resta" })
      corriente = Math.max(0, corriente - monto)
      lineas.push({ etiqueta: "Subtotal", monto: corriente, tipo: "subtotal" })
    }

    // Orden de descuentos: Promoción → Tipo de Financiamiento → Descuento adicional
    // (ver mismo criterio en promoDescuentoTotal/el useEffect de discount, arriba).
    promocionesSeleccionadas.forEach((id) => {
      const promo = promocionesActivas.find((p) => p.id === id)
      if (!promo) return
      const valorEfecto = Number(promo.valor_efecto ?? 0)
      const monto =
        promo.tipo_efecto === "porcentaje" ? (valor * valorEfecto) / 100 : valorEfecto
      const etiqueta =
        promo.tipo_efecto === "porcentaje"
          ? `Descuento de promoción — ${promo.nombre} (${valorEfecto}%)`
          : `Descuento de promoción — ${promo.nombre}`
      aplicarResta(etiqueta, monto)
    })
    aplicarResta("Descuento", Number(discount) || 0)
    aplicarResta("Descuento extra", Number(extraDiscount) || 0)
    // Contado/Crédito BIESS no restan la entrada acá tampoco — ver mismo comentario en
    // totalAFinanciar arriba.
    if (!esContadoLike(financType)) {
      aplicarResta("Entrada (suma de la tabla)", entradaTotal)
    }

    const ultima = lineas[lineas.length - 1]
    if (lineas.length > 1 && ultima.tipo === "subtotal") {
      lineas[lineas.length - 1] = {
        ...ultima,
        etiqueta: "Total a financiar",
        tipo: "total",
      }
    }
    return lineas
  }, [
    valorLoteNumero,
    discount,
    extraDiscount,
    entradaTotal,
    promocionesSeleccionadas,
    promocionesActivas,
    financType,
  ])

  // Cuota mensual sugerida por el sistema (fórmula estándar sobre el total a
  // financiar y el N.º de meses) — solo informativa, no se aplica sola; el botón
  // "Aplicar" la copia al campo "Cuota sugerida" para usarla como cuota fija.
  const cuotaMensualSugerida = useMemo(
    () => calcularCuotaMensualSugerida(totalAFinanciar, Number(meses)),
    [totalAFinanciar, meses]
  )

  function agregarComentario() {
    setComentarios((anterior) => (anterior.length >= 3 ? anterior : [...anterior, ""]))
  }

  function actualizarComentario(indice: number, valor: string) {
    setComentarios((anterior) => anterior.map((c, i) => (i === indice ? valor : c)))
  }

  function quitarComentario(indice: number) {
    setComentarios((anterior) => anterior.filter((_, i) => i !== indice))
  }

  function alternarPromocion(idPromo: number) {
    setPromocionesSeleccionadas((anterior) =>
      anterior.includes(idPromo)
        ? anterior.filter((p) => p !== idPromo)
        : [...anterior, idPromo]
    )
  }

  // confirmar=false (Generar/Regenerar cuotas): guarda todo pero deja la cotización
  // en "borrador" — el asesor sigue editando. confirmar=true (Guardar): lo mismo,
  // pero además lo deja en "ingresado" — sin aprobación aparte, ya es el estado
  // final. descartarEdiciones=true (solo "Regenerar cuotas"): arma el cronograma
  // desde cero como si fuera la primera vez, sin arrastrar cuotas editadas a mano del
  // cronograma anterior — "Guardar" en cambio sigue conservándolas (ver
  // reaplicarCuotasEditadas en el backend).
  async function manejarGenerarTabla(
    confirmar = false,
    descartarEdiciones = false
  ): Promise<boolean> {
    if (!cotizacion) return false
    if (entradasTabla.length === 0) {
      // Contado/Crédito BIESS necesitan abono inicial + N.º de cuotas para armar la tabla sola
      // (ver generarFilasEntrada) — si todavía no hay filas es porque falta uno de
      // los dos (o ambos) en el generador rápido; el mensaje dice cuál exactamente
      // en vez del genérico "falta la tabla de entrada".
      if (esContadoLike(financType)) {
        const faltaAbono = abonoInicialGenerar.trim() === ""
        const faltaCuotas = numeroEntradasGenerar.trim() === ""
        toast({
          variant: "error",
          title: "Faltan datos",
          description:
            faltaAbono && faltaCuotas
              ? "Ingresa el valor de abono inicial y el número de cuotas."
              : faltaAbono
                ? "Ingresa el valor de abono inicial."
                : faltaCuotas
                  ? "Ingresa el número de cuotas."
                  : "Revisa el abono inicial y el número de cuotas antes de generar.",
        })
        return false
      }
      toast({
        variant: "error",
        title: "Falta la tabla de entrada",
        description: "Agrega al menos una fila (ej. Abono inicial) antes de generar.",
      })
      return false
    }
    const diaInicio = fechaInicioFinanciamiento.slice(8, 10)
    if (!fechaInicioFinanciamiento || (diaInicio !== "05" && diaInicio !== "20")) {
      toast({
        variant: "error",
        title: "Falta la fecha de inicio",
        description:
          "Elige una fecha de inicio de financiamiento (solo día 5 o 20) antes de generar.",
      })
      return false
    }
    if (!esContadoLike(financType) && (!Number(meses) || Number(meses) <= 0)) {
      toast({
        variant: "error",
        title: "Falta el N.º de meses",
        description:
          "Este tipo de financiamiento necesita un N.º de meses mayor a 0 para generar el cronograma de amortización.",
      })
      return false
    }
    // Si la cuota sugerida no alcanza a cubrir ni el interés del primer mes (el más
    // alto: el saldo todavía no bajó nada), el capital de esa fila da negativo — la
    // deuda no se reduce, crece — y arrastra el mismo problema (cada vez peor) en las
    // filas siguientes. No tiene sentido generar un cronograma así: se bloquea acá en
    // vez de dejar que salga con "CAPITAL" en rojo/negativo.
    if (!esContadoLike(financType) && cuotaSugerida.trim() !== "") {
      const tasaMensual = TASA_INTERES_ANUAL_FIJA / 100 / 12
      const interesPrimerMes = redondear(totalAFinanciar * tasaMensual)
      if (Number(cuotaSugerida) <= interesPrimerMes) {
        toast({
          variant: "error",
          title: "La cuota sugerida es demasiado baja",
          description: `Con $${totalAFinanciar.toFixed(2)} a financiar, el interés del primer mes ya es ${formatearMoneda(interesPrimerMes)} — una cuota de ${formatearMoneda(Number(cuotaSugerida))} nunca alcanzaría a cubrirlo y la deuda crecería en vez de bajar. Subí la cuota sugerida o dejá el campo vacío para usar la cuota calculada automáticamente.`,
        })
        return false
      }
    }
    setGenerando(true)
    try {
      const entradas: EntradaPagoInput[] = entradasTabla.map((fila) => ({
        formaPago: fila.formaPago,
        fechaPago: fila.fechaPago,
        abonoLote: Number(fila.abonoLote) || 0,
        alicuotas: fila.alicuotas.map((c) => ({
          nombre: c.nombre,
          valor: Number(c.valor) || 0,
          fechaInicio: c.fechaInicio,
        })),
        escritura: Number(fila.escritura) || 0,
        observaciones: fila.observaciones || undefined,
      }))
      const payload = {
        financType,
        discount: discount ? Number(discount) : undefined,
        extraDiscount: extraDiscount ? Number(extraDiscount) : undefined,
        promocionesIds: promocionesSeleccionadas,
        entradas,
        meses: esContadoLike(financType) ? 0 : Number(meses),
        comentarios: comentarios.map((c) => c.trim()).filter((c) => c.length > 0),
        ofrecimientos,
        fechaInicio: fechaInicioFinanciamiento || undefined,
        cuotaSugerida: cuotaSugerida ? Number(cuotaSugerida) : undefined,
        confirmar,
        descartarEdiciones,
      }
      const resultado = await regenerarCotizacion(idNumero, payload)
      setCotizacion(resultado)
      toast({
        variant: "success",
        description: confirmar
          ? "Cotización guardada como ingresada."
          : "Tabla de amortización generada (borrador).",
      })
      return true
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo generar la tabla",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
      return false
    } finally {
      setGenerando(false)
    }
  }

  // Al quitar cuotas "de más" hay que fijar la cuota mensual con la que se armó el
  // cronograma. Si solo se bajara el N.º de meses, al guardar el backend recalcula la
  // cuota base con menos meses (sale más alta), el préstamo se termina de pagar antes
  // y vuelven a aparecer cuotas "de más". Si ya había una cuota sugerida, esa es la
  // que se usó y no se toca.
  function fijarCuotaDelCronograma() {
    if (!cotizacion || esContadoLike(financType) || cuotaSugerida.trim() !== "") return
    const cuota = calcularCuotaMensualSugerida(
      Number(cotizacion.total_financ) || 0,
      cotizacion.no_cuotas ?? 0
    )
    if (cuota != null) setCuotaSugerida(cuota.toFixed(2))
  }

  // Quita una fila "de más" (sobrante) del cronograma, una por una, y ajusta el N.º
  // de meses de la configuración al número real de cuotas que quedan — sigue
  // haciendo falta Guardar/Regenerar cuotas para persistirlo en el backend.
  function quitarFilaSobranteCronograma(mes: number) {
    if (!cotizacion?.detalle) return
    fijarCuotaDelCronograma()
    const nuevoDetalle = cotizacion.detalle.filter((fila) => fila.mes !== mes)
    setCotizacion({
      ...cotizacion,
      detalle: nuevoDetalle,
      no_cuotas: nuevoDetalle.length,
    })
    if (!esContadoLike(financType)) setMeses(String(nuevoDetalle.length))
  }

  // Igual que quitarFilaSobranteCronograma pero de una sola vez — la usa el botón
  // "Arreglar" de la verificación antes de guardar.
  function quitarTodasFilasSobrantes() {
    if (!cotizacion?.detalle) return
    fijarCuotaDelCronograma()
    const nuevoDetalle = cotizacion.detalle.filter((fila) => !fila.sobrante)
    setCotizacion({
      ...cotizacion,
      detalle: nuevoDetalle,
      no_cuotas: nuevoDetalle.length,
    })
    if (!esContadoLike(financType)) setMeses(String(nuevoDetalle.length))
  }

  // Última verificación antes de guardar como "ingresado": fechas repetidas entre la
  // tabla de entrada y el cronograma, escritura repartida que no coincide con la del
  // proyecto, y cuotas "de más" que todavía no se quitaron.
  function verificarFinanciamiento(): {
    mensaje: string
    accion?: { etiqueta: string; ejecutar: () => void }
    bloqueante?: boolean
  }[] {
    const problemas: {
      mensaje: string
      accion?: { etiqueta: string; ejecutar: () => void }
      bloqueante?: boolean
    }[] = []

    // El cronograma que se ve en pantalla ya no corresponde a la tabla de
    // entrada/configuración actual — bloquea el guardado hasta que se regenere (ver
    // cronogramaDesactualizado más arriba, mismo criterio que pinta el botón
    // "Regenerar cuotas" del pill de abajo).
    if (cronogramaDesactualizado) {
      problemas.push({
        mensaje:
          'La tabla de entrada (o la configuración) cambió después de generar el cronograma — lo que ves en pantalla no es lo que se va a guardar. Dale a "Regenerar cuotas" antes de guardar.',
        accion: {
          etiqueta: "Regenerar cuotas",
          ejecutar: () => manejarGenerarTabla(false, true),
        },
        bloqueante: true,
      })
    }

    // El capital de una cuota real (no "sobrante") nunca debería dar negativo — si da,
    // significa que la cuota (fija o calculada) no alcanza a cubrir ni el interés del
    // mes: la deuda crece en vez de bajar. Bloqueante: guardar así deja un cronograma
    // que nunca amortiza el préstamo.
    const cuotasConCapitalNegativo = cronograma.filter(
      (fila) => !fila.sobrante && fila.capital < 0
    )
    if (cuotasConCapitalNegativo.length > 0) {
      problemas.push({
        mensaje: `Hay ${cuotasConCapitalNegativo.length} cuota${cuotasConCapitalNegativo.length > 1 ? "s" : ""} en el cronograma con "Capital" negativo (ej. mes ${cuotasConCapitalNegativo[0].mes}) — la cuota no alcanza a cubrir el interés y la deuda crece en vez de bajar. Revisá la cuota sugerida (o alguna fila editada a mano) y regenerá las cuotas.`,
        bloqueante: true,
      })
    }

    const fechasEntrada = entradasTabla.map((fila) => fila.fechaPago).filter(Boolean)
    const fechasCronograma = cronograma
      .filter((fila) => !fila.sobrante)
      .map((fila) => fila.fecha)
    const vistas = new Set<string>()
    const repetidas = new Set<string>()
    for (const fecha of [...fechasEntrada, ...fechasCronograma]) {
      if (vistas.has(fecha)) repetidas.add(fecha)
      vistas.add(fecha)
    }
    if (repetidas.size > 0) {
      problemas.push({
        mensaje: `Hay ${repetidas.size} fecha${repetidas.size > 1 ? "s" : ""} repetida${repetidas.size > 1 ? "s" : ""} entre la tabla de entrada y el cronograma (ej. ${formatearFecha(Array.from(repetidas)[0])}).`,
      })
    }

    // Contado/Crédito BIESS no tienen cronograma — "Contado" ya carga la escritura
    // del proyecto directo en su fila de cierre (ver escrituraProyecto más arriba) y
    // "Crédito BIESS" usa el monto fijo ESCRITURA_CONTADO en la suya, así que esta
    // comparación (pensada para el reparto en las últimas 6 cuotas de Crédito
    // directo/Mixto) no les aplica a ninguno de los dos.
    if (!esContadoLike(financType)) {
      const escrituraCronograma = redondear(
        cronograma.reduce((acc, fila) => acc + fila.escritura, 0)
      )
      if (
        escrituraProyecto > 0 &&
        Math.abs(escrituraCronograma - escrituraProyecto) > 0.01
      ) {
        problemas.push({
          mensaje: `La escritura repartida en el cronograma (${formatearMoneda(escrituraCronograma)}) no coincide con la del proyecto (${formatearMoneda(escrituraProyecto)}).`,
        })
      }
    }

    const filasSobrante = cronograma.filter((fila) => fila.sobrante)
    if (filasSobrante.length > 0) {
      problemas.push({
        mensaje: `Hay ${filasSobrante.length} cuota${filasSobrante.length > 1 ? "s" : ""} "de más" en el cronograma — el N.º de meses tiene más meses de los que el préstamo realmente necesita.`,
        accion: { etiqueta: "Quitar todas", ejecutar: quitarTodasFilasSobrantes },
      })
    }

    // Continuidad de fechas en la tabla de entrada: solo las filas "Entrada" (cuotas
    // reales, "Cuota" en pantalla para Contado/BIESS/Mixto) siguen la secuencia
    // mensual — "Abono inicial", "Pago total" y "Desembolso BIESS" tienen fecha libre
    // (no la fija la secuencia, la fija el asesor) y quedan fuera de esta revisión a
    // propósito. Si el asesor editó a mano la fecha de una cuota y quedó fuera de
    // secuencia (no exactamente un mes después de la anterior), se avisa acá.
    const fechasCuotasEntrada = entradasTabla
      .filter((fila) => fila.formaPago === "Entrada" && fila.fechaPago)
      .map((fila) => fila.fechaPago)
      .sort()
    const cuotasFueraDeSecuencia: string[] = []
    for (let indice = 1; indice < fechasCuotasEntrada.length; indice++) {
      const esperada = calcularFechaEntrada(fechasCuotasEntrada[indice - 1], 1)
      if (fechasCuotasEntrada[indice] !== esperada) {
        cuotasFueraDeSecuencia.push(fechasCuotasEntrada[indice])
      }
    }
    if (cuotasFueraDeSecuencia.length > 0) {
      problemas.push({
        mensaje: `Hay ${cuotasFueraDeSecuencia.length} cuota${cuotasFueraDeSecuencia.length > 1 ? "s" : ""} en la tabla de entrada que no sigue la secuencia mensual esperada (ej. ${formatearFecha(cuotasFueraDeSecuencia[0])}) — revisa si alguna fecha se editó a mano.`,
      })
    }

    // Filas con un valor que no se puede leer como número (ej. un typo en "abono
    // lote"/"alícuota comunal"/"escritura") — esos campos se suman como $0 sin avisar
    // en ningún otro lado de la pantalla, así que la fila queda con un "total a
    // cancelar" más bajo de lo que debería sin que se note a simple vista.
    const filasConValorInvalido = entradasTabla.filter((fila) =>
      [fila.abonoLote, ...fila.alicuotas.map((c) => c.valor), fila.escritura].some(
        (valor) => valor != null && valor.trim() !== "" && isNaN(Number(valor))
      )
    )
    if (filasConValorInvalido.length > 0) {
      problemas.push({
        mensaje: `Hay ${filasConValorInvalido.length} fila${filasConValorInvalido.length > 1 ? "s" : ""} en la tabla de entrada con un valor que no es un número válido — esa fila se está sumando como $0 en "abono lote"/"alícuota"/"escritura" sin avisar, y el total a cancelar de esa fila queda incompleto.`,
      })
    }

    // Contado/Crédito BIESS no tienen cronograma que cubra el resto — abono inicial +
    // cuotas + fila de cierre ("Pago total"/"Desembolso BIESS") tienen que sumar
    // EXACTO el total a financiar. Un desfase acá (ej. redondeo acumulado en muchas
    // filas, o una fila de cierre que quedó desincronizada) deja el financiamiento
    // cobrando de más o de menos sin que se note en la tabla.
    if (esContadoLike(financType)) {
      const diferenciaTotalEntrada = redondear(entradaTotal - totalAFinanciar)
      if (Math.abs(diferenciaTotalEntrada) > 0.01) {
        problemas.push({
          mensaje: `La suma de "abono lote" en la tabla de entrada (${formatearMoneda(entradaTotal)}) no coincide con el total a financiar (${formatearMoneda(totalAFinanciar)}) — diferencia de ${formatearMoneda(Math.abs(diferenciaTotalEntrada))}.`,
          bloqueante: true,
        })
      }
    }

    return problemas
  }

  function abrirVerificacionGuardar() {
    setProblemasVerificacion(verificarFinanciamiento())
    setVerificacionAbierta(true)
  }

  // Después de un "Arreglar"/"Quitar todas" del diálogo hay que volver a verificar,
  // pero recién en el render siguiente: llamarlo en el mismo clic leía el cronograma
  // de antes del arreglo y el aviso seguía apareciendo aunque ya se había corregido.
  const [reverificar, setReverificar] = useState(0)
  useEffect(() => {
    if (reverificar > 0) setProblemasVerificacion(verificarFinanciamiento())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reverificar])

  async function confirmarGuardadoFinal() {
    const exito = await manejarGenerarTabla(true)
    if (!exito) return
    setVerificacionAbierta(false)
    router.push(`/gestion/cotizaciones/reporte/${idNumero}`)
  }

  // Se dispara en el onBlur de cada celda — solo manda la edición si el valor
  // realmente cambió. Sin esto, recorrer las celdas con Tab marcaba cada fila como
  // editada a mano (editado/escrituraEditada) en el backend, y esas filas dejaban de
  // recalcularse en cascada. Un campo vacío o negativo se descarta y la celda vuelve
  // a su valor (Number("") es 0: borrar el campo dejaba la cuota en $0).
  async function manejarEditarCuota(
    mes: number,
    campo: "abonoLote" | "escritura",
    input: HTMLInputElement,
    valorActual: number
  ) {
    const texto = input.value.trim()
    const numero = Number(texto)
    if (texto === "" || !Number.isFinite(numero) || numero < 0) {
      input.value = String(valorActual)
      if (texto !== "") {
        toast({
          variant: "error",
          title: "Valor no válido",
          description: "Ingresa un monto mayor o igual a 0.",
        })
      }
      return
    }
    if (Math.abs(numero - valorActual) < 0.005) return
    try {
      const actualizado = await actualizarCuotaCotizacion(idNumero, mes, {
        [campo]: numero,
      })
      setCotizacion(actualizado)
    } catch (err) {
      input.value = String(valorActual)
      toast({
        variant: "error",
        title: "No se pudo actualizar la cuota",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    }
  }

  const cronograma: CuotaAmortizacion[] = cotizacion?.detalle ?? []

  const totalesCronograma = useMemo(
    () =>
      cronograma.reduce(
        (acc, fila) => ({
          interes: acc.interes + fila.interes,
          capital: acc.capital + fila.capital,
          abono: acc.abono + fila.abono,
          alicuota: acc.alicuota + fila.alicuota,
          escritura: acc.escritura + fila.escritura,
          cuota: acc.cuota + fila.cuota,
        }),
        { interes: 0, capital: 0, abono: 0, alicuota: 0, escritura: 0, cuota: 0 }
      ),
    [cronograma]
  )

  // Nombres de las columnas de alícuota del cronograma — de la primera fila con
  // componentes (formato nuevo); si el financiamiento se guardó antes de este cambio
  // (sin `alicuotas`), se muestra 1 sola columna genérica con el escalar legado.
  const columnasAlicuotaCronograma = useMemo(() => {
    const conComponentes = cronograma.find((fila) => fila.alicuotas?.length)
    if (conComponentes?.alicuotas) return conComponentes.alicuotas.map((c) => c.nombre)
    return cronograma.length > 0 ? ["Alícuota"] : []
  }, [cronograma])

  // Valores de alícuota de una fila del cronograma, alineados por índice con
  // columnasAlicuotaCronograma.
  function alicuotasDeFilaCronograma(fila: CuotaAmortizacion): number[] {
    return fila.alicuotas?.length ? fila.alicuotas.map((c) => c.valor) : [fila.alicuota]
  }

  const alicuotaTotalPorColumnaCronograma = useMemo(
    () =>
      columnasAlicuotaCronograma.map((_, indice) =>
        cronograma.reduce(
          (acc, fila) => acc + (alicuotasDeFilaCronograma(fila)[indice] ?? 0),
          0
        )
      ),
    [cronograma, columnasAlicuotaCronograma]
  )

  // Al cambiar el tipo de financiamiento a mano, se resetea todo lo relacionado a la
  // tabla de entrada — abono inicial, N.º de cuotas/entradas y las filas ya generadas
  // — para que no queden valores pensados para el tipo anterior (ej. el 5% de
  // descuento fijo de Contado/Crédito BIESS, o cuotas armadas para otro tipo) al configurar o
  // generar la tabla de nuevo. El cronograma ya generado (si había) también se limpia
  // en vista previa — vuelve a aparecer recién al generar la tabla para el tipo
  // nuevo. No toca promociones/comentarios/ofrecimientos/fecha de inicio: esos no son
  // específicos del tipo de financiamiento.
  function manejarCambioFinancType(nuevoTipo: string) {
    setFinancType(nuevoTipo)
    setEntradasTabla([])
    setAbonoInicialGenerar("")
    setValorEntradaTotalGenerar("")
    setNumeroEntradasGenerar("")
    setDiscount("")
    setAplicarDescuentoMixto(false)
    setCotizacion((anterior) => (anterior ? { ...anterior, detalle: [] } : anterior))
  }

  return (
    <div className="relative flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 pb-28 sm:p-5 sm:pb-24 lg:p-6.5 lg:pb-24">
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
            <h1 className="text-xl font-extrabold tracking-tight">Cotización</h1>
          </div>

          <div className="flex flex-col gap-4.5 px-4 py-5 sm:gap-5.5 sm:px-7.5 sm:py-6.5">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : error || !cotizacion ? (
              <EmptyState
                title="No se puede abrir la cotización"
                description={error ?? "No se encontró la cotización."}
                dashed
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1.8fr_1fr]">
                  <StaticField
                    label="CLIENTE"
                    value={cotizacion.cliente_nombre}
                    emphasis
                  />
                  <StaticField
                    label="FECHA"
                    value={new Date().toLocaleDateString("es-EC")}
                    mono
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                  <StaticField
                    label="PROYECTO"
                    value={loteInfo?.proyecto?.nombre ?? "—"}
                  />
                  <StaticField
                    label="INMUEBLE"
                    value={loteInfo?.codigo ?? cotizacion.codigo_lote ?? "—"}
                    mono
                    emphasis
                  />
                  <StaticField
                    label="VALOR DEL LOTE"
                    value={formatearMoneda(valorLote)}
                    mono
                  />
                  <StaticField
                    label="MTS. LOTE"
                    value={formatearMetraje(loteInfo?.areaUtil)}
                    mono
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.6fr]">
                  <div className="border-border flex flex-col gap-3.5 rounded-lg border p-4 sm:p-5">
                    <div className="text-muted-foreground text-xs font-bold tracking-wide">
                      CONFIGURACIÓN DE FINANCIAMIENTO
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <SelectField
                          label="Tipo financiamiento"
                          placeholder="Seleccione"
                          options={TIPOS_FINANCIAMIENTO}
                          value={financType}
                          onValueChange={manejarCambioFinancType}
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground mb-1.5 text-xs font-bold tracking-wide">
                          Fecha de inicio de financiamiento
                        </div>
                        <Popover
                          open={calendarioInicioAbierto}
                          onOpenChange={setCalendarioInicioAbierto}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="border-input bg-card focus:border-primary focus:ring-ring/15 flex h-11 w-full items-center justify-between rounded-md border px-3.5 text-sm outline-none focus:ring-3"
                            >
                              <span
                                className={cn(
                                  !fechaInicioFinanciamiento && "text-muted-foreground"
                                )}
                              >
                                {fechaInicioFinanciamiento
                                  ? formatearFecha(fechaInicioFinanciamiento)
                                  : "Seleccione una fecha"}
                              </span>
                              <CalendarIcon
                                className="text-muted-foreground size-4 shrink-0"
                                strokeWidth={1.8}
                              />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-auto">
                            <CalendarioFechaInicioFinanciamiento
                              value={fechaInicioFinanciamiento}
                              onSelect={(fecha) => {
                                manejarSeleccionarFechaInicio(fecha)
                                setCalendarioInicioAbierto(false)
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {usaDesembolsoBiess(financType) && (
                        <>
                          <TextField
                            label="Valor de desembolso ($)"
                            type="number"
                            value={desembolsoValor}
                            onChange={setDesembolsoValor}
                          />
                          <div>
                            <div className="text-muted-foreground mb-1.5 text-xs font-bold tracking-wide">
                              Fecha de desembolso
                            </div>
                            <Popover
                              open={calendarioDesembolsoAbierto}
                              onOpenChange={setCalendarioDesembolsoAbierto}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="border-input bg-card focus:border-primary focus:ring-ring/15 flex h-11 w-full items-center justify-between rounded-md border px-3.5 text-sm outline-none focus:ring-3"
                                >
                                  <span
                                    className={cn(
                                      !desembolsoFecha && "text-muted-foreground"
                                    )}
                                  >
                                    {desembolsoFecha
                                      ? formatearFecha(desembolsoFecha)
                                      : "Seleccione una fecha"}
                                  </span>
                                  <CalendarIcon
                                    className="text-muted-foreground size-4 shrink-0"
                                    strokeWidth={1.8}
                                  />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-auto">
                                <CalendarioFechaDesembolso
                                  value={desembolsoFecha}
                                  onSelect={(fecha) => {
                                    setDesembolsoFecha(fecha)
                                    setCalendarioDesembolsoAbierto(false)
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </>
                      )}
                      {!esContadoLike(financType) && cuotaMensualSugerida != null && (
                        <div className="bg-foreground text-background col-span-2 flex items-center justify-between rounded-lg px-4.5 py-3.5">
                          <div>
                            <div className="text-background/60 text-xs font-bold tracking-wide">
                              CUOTA MENSUAL SUGERIDA
                            </div>
                            <div className="font-mono text-xl font-extrabold">
                              {formatearMoneda(cuotaMensualSugerida)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-background/30 text-background hover:bg-background/15 bg-transparent"
                            onClick={() =>
                              setCuotaSugerida(cuotaMensualSugerida.toFixed(2))
                            }
                          >
                            Aplicar
                          </Button>
                        </div>
                      )}
                      {!esContadoLike(financType) && (
                        <TextField
                          label="Cuota sugerida ($)"
                          type="number"
                          value={cuotaSugerida}
                          onChange={setCuotaSugerida}
                        />
                      )}
                      {financType === "Mixto" && (
                        <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={aplicarDescuentoMixto}
                            onCheckedChange={(marcado) =>
                              setAplicarDescuentoMixto(marcado === true)
                            }
                          />
                          Aplicar descuento del 3%
                        </label>
                      )}
                      {(esContadoLike(financType) ||
                        (financType === "Mixto" && aplicarDescuentoMixto)) && (
                        <StaticField
                          label="Descuento ($)"
                          value={`${financType === "Contado" ? "5%" : "3%"} · ${formatearMoneda(discount)}`}
                          mono
                        />
                      )}
                      <TextField
                        label="Descuento extra ($)"
                        type="number"
                        value={extraDiscount}
                        onChange={setExtraDiscount}
                      />
                      <StaticField
                        label="Entrada (suma de la tabla)"
                        value={formatearMoneda(entradaTotal)}
                        mono
                      />
                      {!esContadoLike(financType) && (
                        <TextField
                          label="N.º de meses"
                          type="number"
                          value={meses}
                          onChange={setMeses}
                        />
                      )}
                    </div>

                    <div className="border-border rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-muted-foreground text-xs font-bold tracking-wide">
                          PROMOCIONES VIGENTES
                        </div>
                        <Can permiso="promociones:gestionar">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setGestionarPromocionesAbierto(true)}
                          >
                            <Settings2 className="size-3.5" strokeWidth={1.8} />
                            Gestionar
                          </Button>
                        </Can>
                      </div>
                      {promocionesActivas.length === 0 ? (
                        <div className="text-muted-foreground text-xs">
                          No hay promociones vigentes hoy.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {promocionesActivas.map((promo) => (
                            <label
                              key={promo.id}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={promocionesSeleccionadas.includes(promo.id)}
                                onCheckedChange={() => alternarPromocion(promo.id)}
                              />
                              {promo.nombre} (
                              {promo.tipo_efecto === "porcentaje"
                                ? `${promo.valor_efecto}%`
                                : formatearMoneda(promo.valor_efecto)}
                              )
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-border rounded-md border p-3">
                      <div className="text-muted-foreground mb-2 text-xs font-bold tracking-wide">
                        OFRECIMIENTOS
                      </div>
                      <MultiSelectField
                        placeholder="Seleccione ofrecimiento(s)"
                        options={OFRECIMIENTOS_FINANCIAMIENTO}
                        value={ofrecimientos}
                        onChange={setOfrecimientos}
                      />
                    </div>

                    <div className="border-border rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-muted-foreground text-xs font-bold tracking-wide">
                          COMENTARIOS
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={comentarios.length >= 3}
                          onClick={agregarComentario}
                        >
                          <Plus className="size-3.5" strokeWidth={1.8} />
                          Agregar
                        </Button>
                      </div>
                      {comentarios.length === 0 ? (
                        <div className="text-muted-foreground text-xs">
                          Sin comentarios (máximo 3).
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {comentarios.map((comentario, indice) => (
                            <div key={indice} className="flex items-center gap-2">
                              <div className="flex-1">
                                <TextField
                                  value={comentario}
                                  onChange={(valor) =>
                                    actualizarComentario(indice, valor)
                                  }
                                  placeholder={`Comentario ${indice + 1}`}
                                />
                              </div>
                              <button
                                type="button"
                                className="border-border text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border"
                                aria-label="Quitar comentario"
                                onClick={() => quitarComentario(indice)}
                              >
                                <Trash2 className="size-3.5" strokeWidth={1.8} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="border-border overflow-hidden rounded-lg border">
                      <div className="border-border text-muted-foreground border-b px-4.5 py-3.5 text-xs font-bold tracking-wide">
                        RESUMEN
                      </div>
                      <div className="grid grid-cols-1 gap-3 p-4.5 text-sm">
                        <StaticField
                          label="Estado"
                          value={cotizacion?.status ?? "Sin generar"}
                        />
                        <StaticField
                          label="Tasa de interés anual"
                          value={
                            cotizacion?.anual_interes
                              ? `${cotizacion.anual_interes}%`
                              : "—"
                          }
                          mono
                        />
                        <StaticField
                          label="N.º de cuotas"
                          value={String(cotizacion?.no_cuotas ?? "—")}
                          mono
                        />
                        <StaticField
                          label="Descuento de promoción"
                          value={formatearMoneda(cotizacion?.promo_discount)}
                          mono
                        />
                        <StaticField
                          label="Total a financiar"
                          value={formatearMoneda(totalAFinanciar)}
                          mono
                          emphasis
                        />
                      </div>

                      <div className="border-border border-t px-4.5 py-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            setDesgloseCalculoAbierto((anterior) => !anterior)
                          }
                          className="flex w-full items-center justify-between"
                          aria-expanded={desgloseCalculoAbierto}
                        >
                          <span className="text-muted-foreground text-xs font-bold tracking-wide">
                            CÁLCULO DEL TOTAL A FINANCIAR
                          </span>
                          <ChevronDown
                            className={cn(
                              "text-muted-foreground size-3.5 transition-transform duration-150",
                              desgloseCalculoAbierto && "rotate-180"
                            )}
                            strokeWidth={1.8}
                          />
                        </button>
                        {desgloseCalculoAbierto && (
                          <div className="mt-2 flex flex-col gap-1">
                            {desgloseCalculo.map((linea, indice) => (
                              <div
                                key={indice}
                                className={cn(
                                  "flex items-center justify-between gap-3 font-mono text-sm",
                                  linea.tipo === "subtotal" &&
                                    "text-muted-foreground border-border border-t pt-1 text-xs",
                                  linea.tipo === "total" &&
                                    "border-border mt-1 border-t pt-1.5 text-base font-extrabold"
                                )}
                              >
                                <span className="truncate">{linea.etiqueta}</span>
                                <span className="shrink-0">
                                  {linea.tipo === "resta" ? "-" : ""}
                                  {formatearMoneda(linea.monto)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-border rounded-md border p-3">
                      <div className="text-muted-foreground mb-2 text-xs font-bold tracking-wide">
                        {esContadoLike(financType)
                          ? "ABONO INICIAL + CUOTAS (máx. 12)"
                          : "TABLA DE ENTRADA — abono inicial + entradas"}
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <TextField
                          label="Abono inicial ($)"
                          type="number"
                          value={abonoInicialGenerar}
                          onChange={setAbonoInicialGenerar}
                        />
                        {!esContadoLike(financType) && (
                          <TextField
                            label="Valor de entrada ($)"
                            type="number"
                            value={valorEntradaTotalGenerar}
                            onChange={setValorEntradaTotalGenerar}
                          />
                        )}
                        <TextField
                          label={
                            esContadoLike(financType)
                              ? "N.º de cuotas (máx. 12)"
                              : "N.º de entradas"
                          }
                          type="number"
                          value={numeroEntradasGenerar}
                          onChange={setNumeroEntradasGenerar}
                        />
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {financType === "Contado"
                          ? `El valor de las cuotas se calcula solo: total a financiar (${formatearMoneda(totalAFinanciar)}) menos el abono inicial, repartido en partes iguales; la última fila se agrega siempre como "Pago total". Usa "Regenerar entradas" en la barra inferior para generarlas.`
                          : financType === "Crédito BIESS"
                            ? `La última fila se agrega siempre como "Desembolso BIESS", con el valor y la fecha de desembolso que fijaste arriba. El resto — total a financiar (${formatearMoneda(totalAFinanciar)}) menos abono inicial menos desembolso — se reparte en partes iguales entre las demás cuotas. Usa "Regenerar entradas" en la barra inferior para generarlas.`
                            : financType === "Mixto"
                              ? 'El valor de entrada se reparte en partes iguales entre el N.º de entradas — más una fila extra "Desembolso BIESS" con el valor y la fecha que fijaste arriba, que también resta del total a financiar (el cronograma financia el resto). Usa "Regenerar entradas" en la barra inferior para generarlas.'
                              : 'El valor de entrada se reparte en partes iguales entre el N.º de entradas. Usa "Regenerar entradas" en la barra inferior para generarlas.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-border overflow-hidden rounded-lg border">
                  <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-4.5">
                    <div className="text-muted-foreground text-xs font-bold tracking-wide">
                      {financType === "Contado"
                        ? "TABLA DE FINANCIAMIENTO — abono inicial, cuotas y pago total"
                        : financType === "Crédito BIESS"
                          ? "TABLA DE FINANCIAMIENTO — abono inicial, cuotas y desembolso BIESS"
                          : financType === "Mixto"
                            ? "TABLA DE ENTRADA — abono inicial, entradas y desembolso BIESS"
                            : "TABLA DE ENTRADA — abono inicial y cuotas de entrada, sin interés"}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={agregarFilaEntrada}
                    >
                      <Plus className="size-3.5" strokeWidth={1.8} />
                      Agregar fila
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                          <th className="px-4.5 py-2.5 text-left">FORMA DE PAGO</th>
                          <th className="px-4.5 py-2.5 text-left">FECHA DE PAGO</th>
                          <th className="px-4.5 py-2.5 text-right">ABONO LOTE</th>
                          {columnasAlicuota.map((componente, indice) => (
                            <th
                              key={indice}
                              className="px-4.5 py-2.5 text-right uppercase"
                            >
                              {componente.nombre}
                            </th>
                          ))}
                          {esContadoLike(financType) && (
                            <th className="px-4.5 py-2.5 text-right">ESCRITURA</th>
                          )}
                          <th className="px-4.5 py-2.5 text-right">TOTAL A CANCELAR</th>
                          <th className="px-4.5 py-2.5 text-left">OBSERVACIONES</th>
                          <th className="px-2 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {entradasTabla.map((fila, indice) => (
                          <tr key={indice} className="border-border border-b">
                            <td className="px-2 py-1.5">
                              <select
                                value={fila.formaPago}
                                onChange={(e) =>
                                  actualizarFilaEntrada(
                                    indice,
                                    "formaPago",
                                    e.target.value
                                  )
                                }
                                className="border-input bg-card w-full rounded-sm border px-2 py-1 text-sm outline-none"
                              >
                                {formasPagoDisponibles.map((opcion) => (
                                  <option key={opcion} value={opcion}>
                                    {/* Contado/Crédito BIESS no financian con interés,
                                        así que sus filas intermedias se muestran como
                                        "Cuota" en vez de "Entrada" — mismo valor
                                        guardado ("Entrada"), solo cambia la etiqueta. */}
                                    {esContadoLike(financType) && opcion === "Entrada"
                                      ? "Cuota"
                                      : opcion}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="date"
                                value={fila.fechaPago}
                                disabled={
                                  ((financType === "Crédito directo" ||
                                    financType === "Mixto") &&
                                    fila.formaPago !== "Abono inicial") ||
                                  (usaDesembolsoBiess(financType) &&
                                    fila.formaPago === "Desembolso BIESS")
                                }
                                onChange={(e) =>
                                  actualizarFilaEntrada(
                                    indice,
                                    "fechaPago",
                                    e.target.value
                                  )
                                }
                                className="border-input bg-card w-full rounded-sm border px-2 py-1 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={fila.abonoLote}
                                disabled={
                                  (etiquetaCierreActual != null &&
                                    fila.formaPago === etiquetaCierreActual) ||
                                  (usaDesembolsoBiess(financType) &&
                                    fila.formaPago === "Desembolso BIESS")
                                }
                                onChange={(e) =>
                                  actualizarFilaEntrada(
                                    indice,
                                    "abonoLote",
                                    e.target.value
                                  )
                                }
                                className="border-input bg-card w-full rounded-sm border px-2 py-1 text-right font-mono text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              />
                            </td>
                            {columnasAlicuota.map((_, indiceComponente) => (
                              <td key={indiceComponente} className="px-2 py-1.5">
                                <input
                                  type="number"
                                  value={fila.alicuotas[indiceComponente]?.valor ?? ""}
                                  onChange={(e) =>
                                    actualizarAlicuotaFila(
                                      indice,
                                      indiceComponente,
                                      e.target.value
                                    )
                                  }
                                  className="border-input bg-card w-full rounded-sm border px-2 py-1 text-right font-mono text-sm outline-none"
                                />
                              </td>
                            ))}
                            {esContadoLike(financType) && (
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  value={fila.escritura}
                                  onChange={(e) =>
                                    actualizarFilaEntrada(
                                      indice,
                                      "escritura",
                                      e.target.value
                                    )
                                  }
                                  className="border-input bg-card w-full rounded-sm border px-2 py-1 text-right font-mono text-sm outline-none"
                                />
                              </td>
                            )}
                            <td className="px-4.5 py-1.5 text-right font-mono text-sm font-bold">
                              {formatearMoneda(totalFila(fila))}
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                value={fila.observaciones}
                                placeholder="Opcional"
                                onChange={(e) =>
                                  actualizarFilaEntrada(
                                    indice,
                                    "observaciones",
                                    e.target.value
                                  )
                                }
                                className="border-input bg-card w-full rounded-sm border px-2 py-1 text-sm outline-none"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Quitar fila ${indice + 1}`}
                                onClick={() => quitarFilaEntrada(indice)}
                              >
                                <Trash2
                                  className="text-destructive size-4"
                                  strokeWidth={1.8}
                                />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-muted/60">
                          <td className="px-4.5 py-2.75 font-extrabold">Total</td>
                          <td />
                          <td className="px-4.5 py-2.75 text-right font-mono font-extrabold">
                            {formatearMoneda(entradaTotal)}
                          </td>
                          {alicuotaComunalTotalPorColumna.map((total, indice) => (
                            <td
                              key={indice}
                              className="px-4.5 py-2.75 text-right font-mono font-extrabold"
                            >
                              {formatearMoneda(total)}
                            </td>
                          ))}
                          {esContadoLike(financType) && (
                            <td className="px-4.5 py-2.75 text-right font-mono font-extrabold">
                              {formatearMoneda(escrituraTotal)}
                            </td>
                          )}
                          <td className="text-accent-foreground px-4.5 py-2.75 text-right font-mono font-extrabold">
                            {formatearMoneda(totalCancelarTabla)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {cronograma.length > 0 && (
                  <div className="border-border overflow-hidden rounded-lg border">
                    <div className="border-border text-muted-foreground border-b px-4.5 py-3.5 text-xs font-bold tracking-wide">
                      CRONOGRAMA DE PAGOS — puedes editar el abono lote y la escritura (se
                      reparte sola entre las últimas 6 cuotas reales, a menos que fijes
                      una fila a mano); la fecha, el interés, el capital y la alícuota se
                      calculan automáticamente
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                            <th className="px-4.5 py-2.75 text-left">MES</th>
                            <th className="px-4.5 py-2.75 text-left">FECHA</th>
                            <th className="px-4.5 py-2.75 text-left">INTERÉS</th>
                            <th className="px-4.5 py-2.75 text-left">CAPITAL</th>
                            <th className="px-4.5 py-2.75 text-left">ABONO LOTE</th>
                            {columnasAlicuotaCronograma.map((nombre, indice) => (
                              <th
                                key={indice}
                                className="px-4.5 py-2.75 text-left uppercase"
                              >
                                {nombre}
                              </th>
                            ))}
                            <th className="px-4.5 py-2.75 text-left">ESCRIT.</th>
                            <th className="px-4.5 py-2.75 text-left">CUOTA A CANCELAR</th>
                            <th className="px-4.5 py-2.75 text-left">SALDO</th>
                            <th className="px-2 py-2.75" />
                          </tr>
                        </thead>
                        <tbody className="font-mono text-[12.5px]">
                          {cronograma.map((fila, index) => (
                            <tr
                              // Incluye update_at en la key: los inputs de abono
                              // lote/alícuota/escritura son no controlados
                              // (defaultValue) — al regenerar, remonta la fila para
                              // que muestren los valores nuevos en vez de quedarse
                              // con lo último que el navegador tenía en pantalla.
                              key={`${fila.mes}-${cotizacion?.update_at ?? ""}`}
                              className={cn(
                                index < cronograma.length - 1 && "border-border border-b",
                                fila.sobrante && "bg-destructive/10 text-destructive"
                              )}
                            >
                              <td className="px-4.5 py-1.5 font-bold">
                                {fila.mes}
                                {fila.sobrante && (
                                  <span className="ml-1.5 text-[10px] font-bold tracking-wide">
                                    DE MÁS
                                  </span>
                                )}
                              </td>
                              <td
                                className={cn(
                                  "px-4.5 py-1.5",
                                  !fila.sobrante && "text-muted-foreground"
                                )}
                              >
                                {formatearFecha(fila.fecha)}
                              </td>
                              <td
                                className={cn(
                                  "px-4.5 py-1.5",
                                  !fila.sobrante && "text-muted-foreground"
                                )}
                              >
                                {formatearMoneda(fila.interes)}
                              </td>
                              <td
                                className={cn(
                                  "px-4.5 py-1.5",
                                  !fila.sobrante && "text-muted-foreground"
                                )}
                              >
                                {formatearMoneda(fila.capital)}
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  defaultValue={fila.abono}
                                  disabled={fila.sobrante}
                                  onBlur={(e) =>
                                    manejarEditarCuota(
                                      fila.mes,
                                      "abonoLote",
                                      e.currentTarget,
                                      fila.abono
                                    )
                                  }
                                  className="border-input bg-card w-24 rounded-sm border px-1.5 py-1 text-right font-mono text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </td>
                              {alicuotasDeFilaCronograma(fila).map(
                                (valor, indiceComponente) => (
                                  <td
                                    key={indiceComponente}
                                    className={cn(
                                      "px-4.5 py-1.5 text-right",
                                      !fila.sobrante && "text-muted-foreground"
                                    )}
                                  >
                                    {formatearMoneda(valor)}
                                  </td>
                                )
                              )}
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  defaultValue={fila.escritura}
                                  disabled={fila.sobrante}
                                  onBlur={(e) =>
                                    manejarEditarCuota(
                                      fila.mes,
                                      "escritura",
                                      e.currentTarget,
                                      fila.escritura
                                    )
                                  }
                                  className={cn(
                                    "border-input bg-card w-20 rounded-sm border px-1.5 py-1 text-right font-mono text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50",
                                    fila.escrituraEditada && "border-primary"
                                  )}
                                />
                              </td>
                              <td className="px-4.5 py-1.5 font-bold">
                                {formatearMoneda(fila.cuota)}
                              </td>
                              <td className="px-4.5 py-1.5">
                                {formatearMoneda(fila.saldo)}
                              </td>
                              <td className="px-2 py-1.5">
                                {fila.sobrante && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Quitar fila de más — mes ${fila.mes}`}
                                    onClick={() => quitarFilaSobranteCronograma(fila.mes)}
                                  >
                                    <Trash2
                                      className="text-destructive size-4"
                                      strokeWidth={1.8}
                                    />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/60">
                            <td className="px-4.5 py-2.75 font-extrabold" colSpan={2}>
                              Total
                            </td>
                            <td className="px-4.5 py-2.75 text-left font-extrabold">
                              {formatearMoneda(totalesCronograma.interes)}
                            </td>
                            <td className="px-4.5 py-2.75 text-left font-extrabold">
                              {formatearMoneda(totalesCronograma.capital)}
                            </td>
                            <td className="px-4.5 py-2.75 text-left font-extrabold">
                              {formatearMoneda(totalesCronograma.abono)}
                            </td>
                            {alicuotaTotalPorColumnaCronograma.map((total, indice) => (
                              <td
                                key={indice}
                                className="px-4.5 py-2.75 text-left font-extrabold"
                              >
                                {formatearMoneda(total)}
                              </td>
                            ))}
                            <td className="px-4.5 py-2.75 text-left font-extrabold">
                              {formatearMoneda(totalesCronograma.escritura)}
                            </td>
                            <td className="text-accent-foreground px-4.5 py-2.75 text-left font-extrabold">
                              {formatearMoneda(totalesCronograma.cuota)}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!cargando && !error && cotizacion && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4 sm:bottom-6 sm:px-6.5">
          <div className="bg-foreground text-background pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-3xl px-2 py-1.5 text-sm shadow-lg sm:flex-nowrap sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-2">
            {/* Si el asesor cambia el tipo de financiamiento después de ya haber
                generado uno (ej. de "Crédito directo" a "Contado"), la tabla guardada
                pertenece al tipo anterior — cada tipo tiene reglas propias (Contado:
                5% fijo, sin cronograma, solo abono inicial + pago total), así que hay
                que tratarlo como si no se hubiera generado nada todavía y mostrar
                "Generar tabla" de nuevo, no "Regenerar". */}
            {cotizacion && cotizacion.financ_type === financType ? (
              <>
                {/* Contado/Crédito BIESS tienen una sola tabla (no hay una "entrada" y
                    un "cronograma" separados como en Crédito directo/Mixto) — mostrar
                    "Regenerar entradas" (reconstruye las filas desde abono inicial/N.º
                    de cuotas) y "Regenerar cuotas" (guarda lo que ya está en pantalla
                    en el backend) ahí es redundante y confuso, porque ahí no hay un
                    cronograma aparte que regenerar. Un solo botón "Regenerar tabla"
                    alcanza — y tiene que ser el que SÍ reconstruye las filas
                    (generarFilasEntrada), no el que solo guarda; "Guardar" ya se
                    encarga de persistir. */}
                {esContadoLike(financType) ? (
                  <button
                    type="button"
                    disabled={generando}
                    onClick={generarFilasEntrada}
                    className="hover:bg-background/15 flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-transparent sm:px-3.5 sm:text-sm"
                  >
                    <RefreshCw className="size-3.5" strokeWidth={1.8} />
                    Regenerar tabla
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={generando}
                      onClick={generarFilasEntrada}
                      className="hover:bg-background/15 flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-transparent sm:px-3.5 sm:text-sm"
                    >
                      <RefreshCw className="size-3.5" strokeWidth={1.8} />
                      Regenerar entradas
                    </button>
                    <span className="text-background/30 hidden sm:inline">|</span>
                    <button
                      type="button"
                      disabled={generando}
                      onClick={() => manejarGenerarTabla(false, true)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 sm:px-3.5 sm:text-sm",
                        cronogramaDesactualizado
                          ? "bg-brand-gradient animate-pulse text-white hover:opacity-90"
                          : "hover:bg-background/15 disabled:hover:bg-transparent"
                      )}
                    >
                      <Sparkles className="size-3.5" strokeWidth={1.8} />
                      {generando
                        ? "Regenerando…"
                        : cronogramaDesactualizado
                          ? "Regenerar cuotas (cambió la tabla)"
                          : "Regenerar cuotas"}
                    </button>
                  </>
                )}
                <span className="text-background/30 hidden sm:inline">|</span>
                <button
                  type="button"
                  disabled={generando}
                  onClick={abrirVerificacionGuardar}
                  className="hover:bg-background/15 flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-transparent sm:px-3.5 sm:text-sm"
                >
                  <Save className="size-3.5" strokeWidth={1.8} />
                  Guardar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={generando}
                  onClick={() => manejarGenerarTabla(false, true)}
                  className="hover:bg-background/15 flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-transparent sm:px-3.5 sm:text-sm"
                >
                  <Sparkles className="size-3.5" strokeWidth={1.8} />
                  {generando ? "Generando…" : "Generar tabla"}
                </button>
                {/* Contado/Crédito BIESS no tienen cronograma con interés que revisar
                    (la tabla de entrada ya se arma sola apenas se completan los campos
                    del generador) — no hace falta forzar a pasar por "Generar tabla"
                    antes de "Guardar", que ya sabe crear el financiamiento si todavía
                    no existe (ver manejarGenerarTabla). Crédito directo/Mixto sí
                    generan un cronograma real (interés, cuotas) — ahí conviene que el
                    asesor lo vea/revise generándolo primero, antes de poder guardar. */}
                {esContadoLike(financType) && (
                  <>
                    <span className="text-background/30 hidden sm:inline">|</span>
                    <button
                      type="button"
                      disabled={generando}
                      onClick={abrirVerificacionGuardar}
                      className="hover:bg-background/15 flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-transparent sm:px-3.5 sm:text-sm"
                    >
                      <Save className="size-3.5" strokeWidth={1.8} />
                      Guardar
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <PromocionesSheet
        abierto={gestionarPromocionesAbierto}
        onCerrar={() => setGestionarPromocionesAbierto(false)}
        onCambio={recargarPromocionesActivas}
      />

      <Sheet
        open={verificacionAbierta}
        onOpenChange={(valor) => !valor && setVerificacionAbierta(false)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Verificación antes de guardar</SheetTitle>
            <SheetDescription>
              {problemasVerificacion.length > 0
                ? `Se encontraron ${problemasVerificacion.length} punto${problemasVerificacion.length > 1 ? "s" : ""} a revisar antes de guardar como ingresado.`
                : "No se encontró nada raro — el financiamiento está listo para guardarse."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 p-5">
            {problemasVerificacion.length > 0 ? (
              problemasVerificacion.map((problema, indice) => (
                <div
                  key={indice}
                  className={cn(
                    "flex flex-col gap-2.5 rounded-md border p-3.5",
                    problema.bloqueante
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-border bg-destructive/5"
                  )}
                >
                  <p className="text-sm">{problema.mensaje}</p>
                  {problema.accion && (
                    <Button
                      type="button"
                      variant={problema.bloqueante ? "default" : "outline"}
                      size="sm"
                      className={cn(problema.bloqueante && "self-start")}
                      onClick={() => {
                        problema.accion!.ejecutar()
                        setReverificar((n) => n + 1)
                      }}
                    >
                      {problema.accion.etiqueta}
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="border-border flex items-center gap-2.5 rounded-md border p-3.5 text-sm">
                <CheckCircle2
                  className="text-status-disponible-fg size-4 shrink-0"
                  strokeWidth={1.8}
                />
                Todo correcto.
              </div>
            )}
          </div>

          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVerificacionAbierta(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={generando || problemasVerificacion.some((p) => p.bloqueante)}
              onClick={confirmarGuardadoFinal}
            >
              {generando
                ? "Guardando…"
                : problemasVerificacion.some((p) => p.bloqueante)
                  ? "Regenera las cuotas primero"
                  : problemasVerificacion.length > 0
                    ? "Guardar de todas formas"
                    : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
