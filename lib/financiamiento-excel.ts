// Exportar a Excel el anexo de un financiamiento aprobado. Replica el archivo que
// generaba la intranet vieja (anconnet/lib/utils/exportFinanExcel*.ts, con SheetJS):
//   1. Hoja "Financiamiento": el anexo tal cual (cabecera, forma de pago y, para
//      crédito directo, el cronograma), empezando en B2 y con las mismas celdas
//      combinadas.
//   2. Hoja "SAP": una fila por concepto y fecha (VENT/VALI/VESC de cada entrada,
//      VLOT/VINT/VALI/VESC de cada cuota y al final el código del proyecto con el
//      pago total del lote).
// El .xlsx se arma a mano con jszip (ya es dependencia del proyecto) para no sumar
// SheetJS solo por esto; se importa dentro de la función para que no entre al bundle
// inicial.

import { descuentoTipoDeRegistro } from "@/lib/descuento-tipo"
import type { LoteInventario } from "@/lib/api/inventario-api"
import type {
  CuotaAmortizacion,
  EntradaPago,
  FinanciamientoBackend,
  ProcesoBackend,
  RefinanciamientoBackend,
} from "@/lib/api/ventas-api"

type Celda = string | number | null

type Hoja = {
  nombre: string
  // Filas absolutas desde A1.
  filas: Celda[][]
  // Rangos combinados, ej. "B2:J2".
  combinadas: string[]
}

export type OpcionesExcelFinanciamiento = {
  // Un Refinanciamiento tiene la misma forma (entradas + cronograma) más los ajustes
  // manuales sobre el valor del lote (abonos / adicionales).
  financiamiento: FinanciamientoBackend | RefinanciamientoBackend
  proceso: ProcesoBackend | null
  loteInfo: LoteInventario | null
  // "refinanciamiento" replica exportRefinanExcel.ts de la intranet vieja: título
  // "REFINANCIAMIENTO", fecha de creación (AAAA-MM-DD), VINT solo con interés > 0 y
  // el pago total del lote ajustado por abonos/adicionales.
  tipo?: "financiamiento" | "refinanciamiento"
}

// Código SAP del artículo "pago total lote" por proyecto — mismos códigos que la
// intranet vieja (PROJECT_CODES en exportFinanExcel.ts / exportFinanExcelPerla.ts).
const CODIGOS_PROYECTO: Array<[string, string]> = [
  ["MIRADOR DEL LAGO", "LT-ML"],
  ["EL EDEN", "LT-ED"],
  ["EL JARDIN", "LT-EJ"],
  ["EL MANANTIAL", "LT-EM"],
  ["LA FONTANA", "LT-F"],
  ["BALCON DEL CAONY", "LT-BC"],
  ["PUERTO QUITO GARDEN", "LT-G"],
  ["PERLA VERDE", "LT-P"],
  ["PRADERAS DE PUERTO QUITO", "LT-PQ"],
]

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
]

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim()
}

function numero(valor: string | number | null | undefined): number {
  const n = typeof valor === "string" ? parseFloat(valor) : (valor ?? 0)
  return Number.isFinite(n) ? n : 0
}

// Redondeo a centavos para que no salgan restos de punto flotante (0.1 + 0.2).
function dinero(valor: string | number | null | undefined): number {
  return Math.round(numero(valor) * 100) / 100
}

// "2026-11-01" → "01/11/2026" (texto, igual que el ejemplo).
function fechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return ""
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

// "2026-10-31" → "31 oct 2026" (lo que daba toLocaleDateString("es-ES", medium)).
// Se arma a mano para no correr el día por la zona horaria al parsear la fecha.
function fechaLarga(fecha: string | null | undefined): string {
  if (!fecha) return ""
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  const indiceMes = Number(mes) - 1
  if (!anio || !dia || !MESES[indiceMes]) return fecha
  return `${Number(dia)} ${MESES[indiceMes]} ${anio}`
}

// "Crédito BIESS (Sin Interés)" solo existe en Refinanciamiento y sigue las mismas
// reglas que "Crédito BIESS" (ver esBiessLike en refinanciamiento-reporte-content.tsx).
function esBiessLike(tipo: string | null | undefined): boolean {
  return tipo === "Crédito BIESS" || tipo === "Crédito BIESS (Sin Interés)"
}

function esContadoLike(tipo: string | null | undefined): boolean {
  return tipo === "Contado" || esBiessLike(tipo)
}

// Etiqueta de la columna "FORMA DE PAGO" — la misma que se ve en pantalla, en
// mayúsculas; el desembolso BIESS va como "CRED. BIESS", igual que en el ejemplo.
function etiquetaFormaPago(fila: EntradaPago, tipo: string | null): string {
  const base = fila.forma_pago || fila.concepto || ""
  if (base === "Desembolso BIESS") return "CRED. BIESS"
  if (esContadoLike(tipo) && base === "Entrada") return "CUOTA"
  return base.toUpperCase()
}

function alicuotaTotalEntrada(fila: EntradaPago): number {
  if (fila.alicuotas?.length)
    return fila.alicuotas.reduce((acc, c) => acc + numero(c.valor), 0)
  return numero(fila.alicuota_comunal)
}

function alicuotaTotalCuota(fila: CuotaAmortizacion): number {
  if (fila.alicuotas?.length)
    return fila.alicuotas.reduce((acc, c) => acc + numero(c.valor), 0)
  return numero(fila.alicuota)
}

// Columnas de alícuota: una por componente con nombre propio (ej. "ALICUOTA MZ Y SERV.
// GENERALES"), igual que en pantalla. Los componentes que están en 0 en todas las
// filas no se muestran (ej. "parques comunales" antes de que arranque), así la tabla
// queda como el ejemplo. Financiamientos viejos sin componentes → 1 columna genérica.
type ColumnaAlicuota = { titulo: string; valor: (indiceFila: number) => number }

function columnasAlicuota<T extends { alicuotas?: { nombre: string; valor: number }[] }>(
  filas: T[],
  legado: (fila: T) => number,
  tituloLegado: string
): ColumnaAlicuota[] {
  const conComponentes = filas.find((fila) => fila.alicuotas?.length)
  if (!conComponentes?.alicuotas) {
    return [{ titulo: tituloLegado, valor: (i) => dinero(legado(filas[i])) }]
  }
  const columnas = conComponentes.alicuotas.map((componente, indice) => ({
    titulo: componente.nombre.toUpperCase(),
    valor: (i: number) => dinero(filas[i].alicuotas?.[indice]?.valor),
  }))
  const conValor = columnas.filter((col) => filas.some((_, i) => col.valor(i) !== 0))
  return conValor.length > 0 ? conValor : columnas.slice(0, 1)
}

function codigoProyecto(nombreProyecto: string): string {
  const clave = normalizar(nombreProyecto)
  return CODIGOS_PROYECTO.find(([nombre]) => clave.includes(nombre))?.[1] ?? "LT"
}

// Exportada para las pruebas: arma las hojas sin tocar el DOM.
export function construirHojasFinanciamiento({
  financiamiento,
  proceso,
  loteInfo,
  tipo: documento = "financiamiento",
}: OpcionesExcelFinanciamiento) {
  const esRefinanciamiento = documento === "refinanciamiento"
  const tipo = financiamiento.financ_type
  const lote = loteInfo?.codigo ?? proceso?.cli_lote ?? ""
  const cliente = proceso?.titular?.nombre ?? proceso?.cli_name ?? ""
  const nombreProyecto = loteInfo?.proyecto?.nombre ?? ""
  const proyecto = lote.toUpperCase().includes("PV-J")
    ? "PERLA VERDE - JADE"
    : nombreProyecto.toUpperCase()
  const esPerla =
    normalizar(nombreProyecto).includes("PERLA") || lote.toUpperCase().startsWith("PV-")

  const valorLote = dinero(loteInfo?.pvp ?? proceso?.lote_price)
  const metros = dinero(loteInfo?.areaUtil ?? proceso?.lote_mts)
  // Misma regla que el reporte en pantalla: si el registro quedó sin "discount", el
  // descuento fijo de Contado (5%) / Crédito BIESS (3%) se recalcula.
  // Si una promoción que no se acumula anuló el descuento por tipo, vale 0 (no se
  // recalcula el %) — ver lib/descuento-tipo.ts.
  const descuentoTipo = descuentoTipoDeRegistro({
    financType: tipo,
    discount: financiamiento.discount,
    promoDiscount: financiamiento.promo_discount,
    cantidadPromociones: financiamiento.promociones?.length ?? 0,
    valorLote,
  }).monto
  // Igual que el anexo impreso: "DESCUENTO" suma todos los descuentos (tipo de
  // financiamiento + extra + promociones) y "TOTAL A FINANCIAR" es el valor del lote
  // menos ese total. La fila "DESCUENTO ADICIONAL" se mantiene (en 0) para no mover
  // la estructura del archivo.
  const descuento = dinero(
    descuentoTipo +
      numero(financiamiento.extra_discount) +
      numero(financiamiento.promo_discount)
  )
  const totalAFinanciar = dinero(Math.max(0, valorLote - descuento))

  const entradas = financiamiento.entradas ?? []
  // Las filas "sobrante" (el préstamo ya quedó pagado) no son cuotas reales.
  const cuotas = (financiamiento.detalle ?? []).filter((fila) => !fila.sobrante)
  const conCronograma = !esContadoLike(tipo) && cuotas.length > 0

  const tituloAlicuota = esPerla ? "ALICUOTA MZ Y SERV. GENERALES" : "ALICUOTA COMUNAL"
  const alicEntrada = columnasAlicuota(
    entradas,
    (f) => numero(f.alicuota_comunal),
    tituloAlicuota
  )
  const alicCuota = columnasAlicuota(cuotas, (f) => numero(f.alicuota), tituloAlicuota)

  // --- Hoja "Financiamiento" (todo desplazado a B2, como el original) -------------
  const anexo: Celda[][] = [
    ["ANEXO"],
    [esRefinanciamiento ? "REFINANCIAMIENTO" : "FINANCIAMIENTO"],
    [""],
    [
      "FECHA",
      "",
      esRefinanciamiento
        ? (financiamiento.created_at ?? financiamiento.init_date ?? "").slice(0, 10)
        : fechaLarga(financiamiento.init_date ?? financiamiento.created_at),
    ],
    ["CLIENTE", "", cliente],
    ["PROYECTO", "", proyecto],
    ["INMUEBLE", "", lote, "Mts", metros],
    ["VALOR DEL LOTE", "", valorLote],
    ["DESCUENTO", "", descuento, "OFRECIMIENTOS", financiamiento.ofrecimientos ?? ""],
    ["DESCUENTO ADICIONAL", "", 0],
    ["TOTAL A FINANCIAR", "", totalAFinanciar],
    [""],
    [
      "FORMA DE PAGO",
      "",
      "FECHA",
      "# CUOTAS",
      "ABONO LOTE",
      ...alicEntrada.map((c) => c.titulo),
      "TOTAL A CANCELAR",
      "OBSERVACION",
    ],
    ...entradas.map((fila, i) => [
      etiquetaFormaPago(fila, tipo),
      "",
      fechaCorta(fila.fecha_pago || fila.fecha),
      1,
      dinero(fila.abono_lote ?? fila.monto),
      ...alicEntrada.map((c) => c.valor(i)),
      dinero(fila.total_cancelar),
      fila.observaciones ?? "",
    ]),
    [
      "TOTAL",
      "",
      "",
      "",
      dinero(entradas.reduce((acc, f) => acc + numero(f.abono_lote ?? f.monto), 0)),
      ...alicEntrada.map((c) =>
        dinero(entradas.reduce((acc, _, i) => acc + c.valor(i), 0))
      ),
      dinero(entradas.reduce((acc, f) => acc + numero(f.total_cancelar), 0)),
    ],
    [""],
    conCronograma
      ? [
          "NUMERO MESES",
          "Fecha de pago",
          "CAPITAL",
          "INTERES",
          "ABONO LOTE",
          ...alicCuota.map((c) => c.titulo),
          "ESCRITURA",
          "CUOTA A CANCELAR",
          "SALDO CAPITAL",
        ]
      : [""],
    ...(conCronograma
      ? cuotas.map((fila, i) => [
          fila.desembolso ? "DESEMBOLSO BIESS" : fila.mes,
          fechaCorta(fila.fecha),
          dinero(fila.capital),
          dinero(fila.interes),
          dinero(fila.abono),
          ...alicCuota.map((c) => c.valor(i)),
          dinero(fila.escritura),
          dinero(fila.cuota),
          dinero(fila.saldo),
        ])
      : []),
  ]

  // Origen B2: una fila y una columna vacías antes.
  const filasAnexo: Celda[][] = [[], ...anexo.map((fila) => [null, ...fila])]
  const filaTotal = 2 + 13 + entradas.length // fila (1-based) de "TOTAL"
  const combinadas = [
    "B3:J3",
    "B2:J2",
    ...[5, 6, 7, 8, 9, 10, 11, 13].map((r) => `B${r}:C${r}`),
    ...entradas.map((_, i) => `B${15 + i}:C${15 + i}`),
    `B${filaTotal}:E${filaTotal}`,
  ]

  // --- Hoja "SAP" ------------------------------------------------------------------
  type FilaSap = { item: string; fec_pago: string; total: number; texto: string }
  const sap: FilaSap[] = []

  let escrituraEntrada = 1
  entradas.forEach((fila, i) => {
    const fecha = fechaCorta(fila.fecha_pago || fila.fecha)
    const texto = `ENTRADA ${i + 1}`
    sap.push({
      item: "VENT",
      fec_pago: fecha,
      total: dinero(fila.abono_lote ?? fila.monto),
      texto,
    })
    const alicuota = dinero(alicuotaTotalEntrada(fila))
    if (alicuota > 0) sap.push({ item: "VALI", fec_pago: fecha, total: alicuota, texto })
    const escritura = dinero(fila.escritura)
    if (escritura > 0) {
      sap.push({
        item: "VESC",
        fec_pago: fecha,
        total: escritura,
        texto: `ESCRITURA ${escrituraEntrada}`,
      })
      escrituraEntrada += 1
    }
  })

  let escrituraCuota = 1
  cuotas.forEach((fila, i) => {
    const fecha = fechaCorta(fila.fecha)
    // "Mixto": la última fila es el desembolso BIESS.
    const texto = fila.desembolso ? "DESEMBOLSO BIESS" : `CUOTA ${i + 1}`
    sap.push({ item: "VLOT", fec_pago: fecha, total: dinero(fila.capital), texto })
    // Refinanciamiento (igual que la intranet vieja) no manda el VINT en 0.
    if (!esRefinanciamiento || dinero(fila.interes) > 0) {
      sap.push({ item: "VINT", fec_pago: fecha, total: dinero(fila.interes), texto })
    }
    const alicuota = dinero(alicuotaTotalCuota(fila))
    if (alicuota > 0) sap.push({ item: "VALI", fec_pago: fecha, total: alicuota, texto })
    const escritura = dinero(fila.escritura)
    if (escritura > 0) {
      sap.push({
        item: "VESC",
        fec_pago: fecha,
        total: escritura,
        texto: `ESCRITURA ${escrituraCuota}`,
      })
      escrituraCuota += 1
    }
  })

  // En Refinanciamiento el valor del lote se ajustó antes de armar la tabla
  // (+ adicionales − abono realizado − abono a capital, ver valorLoteAjustado en el
  // backend), así que el pago total del lote deshace ese ajuste: resta adicionales y
  // suma lo que el cliente ya había abonado.
  const ajusteRefinanciamiento =
    esRefinanciamiento && "abono_realizado" in financiamiento
      ? numero(financiamiento.abono_realizado) +
        numero(financiamiento.abono_capital) -
        numero(financiamiento.adicionales)
      : 0
  const totalLote = dinero(
    entradas.reduce((acc, f) => acc + numero(f.abono_lote ?? f.monto), 0) +
      cuotas.reduce((acc, f) => acc + numero(f.capital) + numero(f.interes), 0) +
      ajusteRefinanciamiento
  )
  sap.push({
    item: codigoProyecto(nombreProyecto || proyecto),
    fec_pago: sap[sap.length - 1]?.fec_pago ?? "",
    total: totalLote,
    texto: "Pago total lote",
  })

  const hojaSap: Hoja = {
    nombre: "SAP",
    filas: [
      ["item", "cantidad", "fec_pago", "total", "texto"],
      ...sap.map((f) => [f.item, 1, f.fec_pago, f.total, f.texto]),
    ],
    combinadas: [],
  }

  return {
    hojas: [
      { nombre: "Financiamiento", filas: filasAnexo, combinadas },
      hojaSap,
    ] as Hoja[],
    nombreArchivo: `${esRefinanciamiento ? "Refinanciamiento" : "Financiamiento"} - ${lote} - ${cliente}.xlsx`,
  }
}

// --- Escritura del .xlsx (SpreadsheetML mínimo) -------------------------------------

function escaparXml(texto: string): string {
  return (
    texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // Caracteres de control que el XML no admite.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  )
}

function letraColumna(indice: number): string {
  let letra = ""
  let n = indice + 1
  while (n > 0) {
    const resto = (n - 1) % 26
    letra = String.fromCharCode(65 + resto) + letra
    n = Math.floor((n - 1) / 26)
  }
  return letra
}

function xmlHoja(hoja: Hoja): string {
  let maxCol = 0
  const filas = hoja.filas
    .map((fila, r) => {
      const celdas = fila
        .map((valor, c) => {
          if (valor === null || valor === "") return ""
          maxCol = Math.max(maxCol, c)
          const ref = `${letraColumna(c)}${r + 1}`
          if (typeof valor === "number") return `<c r="${ref}"><v>${valor}</v></c>`
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`
        })
        .join("")
      return celdas ? `<row r="${r + 1}">${celdas}</row>` : ""
    })
    .join("")
  const dimension = `A1:${letraColumna(maxCol)}${Math.max(hoja.filas.length, 1)}`
  const combinadas = hoja.combinadas.length
    ? `<mergeCells count="${hoja.combinadas.length}">${hoja.combinadas
        .map((ref) => `<mergeCell ref="${ref}"/>`)
        .join("")}</mergeCells>`
    : ""
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="${dimension}"/><sheetData>${filas}</sheetData>${combinadas}</worksheet>`
  )
}

async function generarXlsx(hojas: Hoja[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`

  zip.file(
    "[Content_Types].xml",
    `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      hojas
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join("") +
      `</Types>`
  )
  zip.file(
    "_rels/.rels",
    `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`
  )
  zip.file(
    "xl/workbook.xml",
    `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
      hojas
        .map(
          (h, i) =>
            `<sheet name="${escaparXml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        )
        .join("") +
      `</sheets></workbook>`
  )
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      hojas
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join("") +
      `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`
  )
  zip.file(
    "xl/styles.xml",
    `${xml}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<fonts count="1"><font><sz val="12"/><name val="Calibri"/><family val="2"/></font></fonts>` +
      `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `</styleSheet>`
  )
  hojas.forEach((hoja, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, xmlHoja(hoja)))

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

export async function descargarFinanciamientoExcel(
  opciones: OpcionesExcelFinanciamiento
) {
  const { hojas, nombreArchivo } = construirHojasFinanciamiento(opciones)
  const blob = await generarXlsx(hojas)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
