// Generadores de los reportes PDF de RRHH (solicitudes aprobadas de préstamo, permiso y
// vacaciones). Se arman en el navegador con jsPDF — el texto queda vectorial y no hace
// falta ningún endpoint nuevo en el backend.
//
// Las medidas están en "px de diseño" sobre una hoja A4 de 827x1169 (la misma escala de
// los PDF de referencia que entregó RRHH); K las convierte a puntos de jsPDF.
//
// jspdf se importa dentro de la función (no a nivel de módulo) para que no entre al
// bundle inicial ni al SSR — solo se descarga cuando alguien pide un reporte.

import type { jsPDF } from "jspdf"

import {
  listarColaboradores,
  obtenerMiPerfilRrhh,
  type SolicitudPermisoBackend,
  type SolicitudPrestamoBackend,
  type SolicitudVacacionBackend,
} from "@/lib/api/rrhh-api"

const K = 595.28 / 827
const ANCHO = 827
const ALTO = 1169

// Quien aprueba los préstamos y a quien va dirigida la carta.
const APROBADOR_PRESTAMOS = "Msc. Diego Andrade"
const CIUDAD = "Quito"

const EMPRESA = {
  nombre: "GRUPO ANCON",
  razon: "INMOCONSTRUCCIONES",
  direccion: "Eloy Alfaro N32 330 y Fco. Andrade Marin",
  contacto: "Tel: (02) 252 8289 | Email: sjurado@grupoancon.com",
  web: "www.grupoancon.com",
}

const COLOR = {
  texto: [17, 17, 17] as const,
  gris: [140, 140, 140] as const,
  naranja: [245, 137, 31] as const,
  rojo: [220, 38, 38] as const,
  verde: [21, 128, 61] as const,
  verdeFondo: [240, 253, 244] as const,
  borde: [120, 120, 120] as const,
}

const FRANJA_PIE = ["#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d"]

type Rgb = readonly [number, number, number]
type Alineacion = "left" | "center" | "right"
type Trozo = { texto: string; negrita?: boolean }

// --- utilidades de fecha/formato ---------------------------------------------------

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

function fechaGenerada(): string {
  const f = new Date()
  return `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`
}

// "2026-10-07" -> "7 de octubre de 2026". Se arma a mano (sin new Date) para que la zona
// horaria no corra la fecha un día.
function fechaLarga(fecha: string | null | undefined): string {
  const [anio, mes, dia] = (fecha ?? "").slice(0, 10).split("-").map(Number)
  if (!anio || !mes || !dia) {
    const hoy = new Date()
    return `${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`
  }
  return `${dia} de ${MESES[mes - 1]} de ${anio}`
}

// "23/9/2025, 9:56:41" — el formato de las firmas de los PDF de referencia.
function fechaHoraFirma(valor: string | null | undefined): string {
  if (!valor) return ""
  const f = new Date(valor)
  if (isNaN(f.getTime())) return ""
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}, ${f.getHours()}:${dos(
    f.getMinutes()
  )}:${dos(f.getSeconds())}`
}

function valorOGuion(valor: string | null | undefined): string {
  const limpio = (valor ?? "").trim()
  return limpio || "—"
}

// --- cargo del solicitante ---------------------------------------------------------
// Las solicitudes de permiso y vacaciones no traen el cargo; sí lo tiene la lista de
// colaboradores (solo rrhh:gestionar, que es quien descarga estos reportes). Se cruza por
// nombre ignorando tildes, mayúsculas y el orden ("PROAÑO ANDRADE JUAN" == "Juan Proaño
// Andrade").

let colaboradoresCache: ReturnType<typeof listarColaboradores> | null = null

function claveNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ")
}

// Para quien descarga su PROPIA solicitud: no hace falta (ni se puede, sin rrhh:gestionar)
// consultar la lista de colaboradores — alcanza con el perfil del usuario logeado.
export async function buscarMiSolicitante(): Promise<DatosSolicitante> {
  try {
    const perfil = await obtenerMiPerfilRrhh()
    return { nombre: perfil?.nombre ?? null, cargo: perfil?.cargo ?? null }
  } catch {
    return { nombre: null, cargo: null }
  }
}

export type DatosSolicitante = { nombre: string | null; cargo: string | null }

// `soliciter` en las solicitudes es el ID del usuario (no el nombre), así que se busca
// primero por ID; el cruce por nombre queda de respaldo (ej. `creador_nombre`).
export async function buscarSolicitante(
  ...claves: Array<string | null | undefined>
): Promise<DatosSolicitante> {
  try {
    colaboradoresCache ??= listarColaboradores()
    const colaboradores = await colaboradoresCache
    const valores = claves.filter((c): c is string => !!c?.trim())
    const encontrado =
      colaboradores.find((c) => valores.includes(c.id)) ??
      colaboradores.find((c) => valores.map(claveNombre).includes(claveNombre(c.nombre)))
    return { nombre: encontrado?.nombre ?? null, cargo: encontrado?.cargo ?? null }
  } catch {
    colaboradoresCache = null
    return { nombre: null, cargo: null }
  }
}

// --- bloques de dibujo -------------------------------------------------------------

type Pdf = {
  doc: jsPDF
  logo: string | null
}

async function cargarLogo(): Promise<string | null> {
  try {
    const respuesta = await fetch("/images/Inmoconstrucciones.png")
    if (!respuesta.ok) return null
    const blob = await respuesta.blob()
    return await new Promise((resolve) => {
      const lector = new FileReader()
      lector.onload = () =>
        resolve(typeof lector.result === "string" ? lector.result : null)
      lector.onerror = () => resolve(null)
      lector.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function crearPdf(): Promise<Pdf> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  doc.setLineHeightFactor(1.2)
  return { doc, logo: await cargarLogo() }
}

type OpcionesTexto = {
  tamano?: number
  negrita?: boolean
  color?: Rgb
  alinear?: Alineacion
}

function texto(pdf: Pdf, valor: string, x: number, y: number, op: OpcionesTexto = {}) {
  const { doc } = pdf
  doc.setFont("helvetica", op.negrita ? "bold" : "normal")
  doc.setFontSize((op.tamano ?? 16) * K)
  doc.setTextColor(...(op.color ?? COLOR.texto))
  doc.text(valor, x * K, y * K, { align: op.alinear ?? "left", baseline: "middle" })
}

function anchoTexto(pdf: Pdf, valor: string, tamano: number, negrita = false): number {
  pdf.doc.setFont("helvetica", negrita ? "bold" : "normal")
  pdf.doc.setFontSize(tamano * K)
  return pdf.doc.getTextWidth(valor) / K
}

function linea(
  pdf: Pdf,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Rgb,
  grosor = 1
) {
  pdf.doc.setDrawColor(...color)
  pdf.doc.setLineWidth(grosor * K)
  pdf.doc.line(x1 * K, y1 * K, x2 * K, y2 * K)
}

// Parte una lista de trozos (con o sin negrita) en líneas que caben en `ancho`.
function envolver(pdf: Pdf, trozos: Trozo[], ancho: number, tamano: number): Trozo[][] {
  const palabras: Trozo[] = []
  for (const trozo of trozos) {
    for (const p of trozo.texto.split(/\s+/).filter(Boolean)) {
      palabras.push({ texto: p, negrita: trozo.negrita })
    }
  }

  const espacio = anchoTexto(pdf, " ", tamano)
  const lineas: Trozo[][] = []
  let actual: Trozo[] = []
  let usado = 0
  for (const palabra of palabras) {
    const w = anchoTexto(pdf, palabra.texto, tamano, palabra.negrita)
    if (actual.length > 0 && usado + espacio + w > ancho) {
      lineas.push(actual)
      actual = []
      usado = 0
    }
    usado += (actual.length > 0 ? espacio : 0) + w
    actual.push(palabra)
  }
  if (actual.length > 0) lineas.push(actual)
  return lineas
}

// Dibuja un párrafo (puede mezclar negritas) y devuelve la `y` donde terminó.
function parrafo(
  pdf: Pdf,
  trozos: Trozo[],
  x: number,
  y: number,
  ancho: number,
  op: { tamano?: number; interlineado?: number; justificar?: boolean; color?: Rgb } = {}
): number {
  const tamano = op.tamano ?? 16
  const interlineado = op.interlineado ?? tamano * 1.55
  const espacioBase = anchoTexto(pdf, " ", tamano)
  const lineas = envolver(pdf, trozos, ancho, tamano)

  lineas.forEach((palabras, indice) => {
    const esUltima = indice === lineas.length - 1
    const sumaPalabras = palabras.reduce(
      (acc, p) => acc + anchoTexto(pdf, p.texto, tamano, p.negrita),
      0
    )
    const huecos = palabras.length - 1
    const espacio =
      op.justificar && !esUltima && huecos > 0
        ? (ancho - sumaPalabras) / huecos
        : espacioBase

    let cursor = x
    for (const p of palabras) {
      texto(pdf, p.texto, cursor, y, { tamano, negrita: p.negrita, color: op.color })
      cursor += anchoTexto(pdf, p.texto, tamano, p.negrita) + espacio
    }
    y += interlineado
  })
  return y
}

function insignia(
  pdf: Pdf,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  etiqueta: string
) {
  const { doc } = pdf
  doc.setFillColor(...COLOR.verdeFondo)
  doc.setDrawColor(...COLOR.verde)
  doc.setLineWidth(1.6 * K)
  doc.roundedRect(x * K, y * K, ancho * K, alto * K, 4 * K, 4 * K, "FD")

  // check dibujado a mano — Helvetica no trae el glifo ✔.
  const cx = x + 12
  const cy = y + alto / 2
  linea(pdf, cx, cy, cx + 3.5, cy + 4, COLOR.verde, 1.8)
  linea(pdf, cx + 3.5, cy + 4, cx + 10, cy - 4, COLOR.verde, 1.8)

  texto(pdf, etiqueta, x + 26, y + alto / 2 + 0.5, {
    tamano: alto * 0.46,
    negrita: true,
    color: COLOR.verde,
  })
}

function pie(pdf: Pdf) {
  const ancho = ANCHO / FRANJA_PIE.length
  FRANJA_PIE.forEach((color, i) => {
    pdf.doc.setFillColor(color)
    pdf.doc.rect(i * ancho * K, 1135 * K, (ancho + 0.5) * K, (ALTO - 1135) * K, "F")
  })
}

type EncabezadoOpciones = {
  titulo: string
  numero: number
  /** Posición X donde empieza el bloque de la empresa. */
  xEmpresa: number
  izquierda: number
  derecha: number
  /** Y del N° y de la línea naranja — cambian un poco entre los tres formatos. */
  yNumero: number
  yLinea: number
  conInsignia: boolean
}

function encabezado(pdf: Pdf, op: EncabezadoOpciones) {
  if (pdf.logo) {
    const lado = Math.min(100, op.xEmpresa - op.izquierda - 6)
    pdf.doc.addImage(pdf.logo, "PNG", op.izquierda * K, 0, lado * K, lado * K)
  }

  texto(pdf, EMPRESA.nombre, op.xEmpresa, 55, { tamano: 18, negrita: true })
  texto(pdf, EMPRESA.razon, op.xEmpresa, 79, { tamano: 12, color: COLOR.gris })
  texto(pdf, EMPRESA.direccion, op.xEmpresa, 101, { tamano: 12, color: COLOR.gris })
  texto(pdf, EMPRESA.contacto, op.xEmpresa, 117, { tamano: 12, color: COLOR.gris })
  texto(pdf, EMPRESA.web, op.xEmpresa, 134, { tamano: 12, color: COLOR.gris })

  texto(pdf, op.titulo, op.derecha, 54, { tamano: 16, negrita: true, alinear: "right" })
  texto(pdf, `Fecha de generada: ${fechaGenerada()}`, op.derecha, 80, {
    tamano: 12,
    color: COLOR.gris,
    alinear: "right",
  })
  if (op.conInsignia) insignia(pdf, op.derecha - 83, 100, 83, 21, "APROBADO")
  texto(pdf, `N°: ${op.numero}`, op.derecha, op.yNumero, {
    tamano: 26,
    negrita: true,
    color: COLOR.rojo,
    alinear: "right",
  })
  linea(pdf, op.izquierda, op.yLinea, op.derecha, op.yLinea, COLOR.naranja, 2)
}

// "ETIQUETA: valor" con el valor subrayado (campos de la cabecera de permisos/vacaciones).
function campoSubrayado(
  pdf: Pdf,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  tamano = 16
) {
  texto(pdf, `${etiqueta}:`, x, y, { tamano, negrita: true })
  const xValor = x + anchoTexto(pdf, `${etiqueta}: `, tamano, true)
  texto(pdf, valor, xValor, y, { tamano })
  const fin = xValor + anchoTexto(pdf, valor, tamano)
  linea(pdf, xValor, y + tamano * 0.7, fin, y + tamano * 0.7, COLOR.texto, 0.8)
}

// "ETIQUETA: valor" sin subrayado.
function campo(
  pdf: Pdf,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  op: { tamano?: number; colorValor?: Rgb } = {}
) {
  const tamano = op.tamano ?? 16
  texto(pdf, `${etiqueta}:`, x, y, { tamano, negrita: true })
  texto(pdf, valor, x + anchoTexto(pdf, `${etiqueta}: `, tamano, true), y, {
    tamano,
    color: op.colorValor,
  })
}

function firmasTres(
  pdf: Pdf,
  y: number,
  columnas: Array<{ x1: number; x2: number; etiqueta: string; fecha: string }>
) {
  for (const c of columnas) {
    const centro = (c.x1 + c.x2) / 2
    linea(pdf, c.x1, y, c.x2, y, COLOR.texto, 1.2)
    texto(pdf, c.etiqueta, centro, y + 14, {
      tamano: 16,
      negrita: true,
      alinear: "center",
    })
    if (c.fecha) {
      const etiqueta = "FECHA: "
      const ancho = anchoTexto(pdf, etiqueta + c.fecha, 11)
      const inicio = centro - ancho / 2
      texto(pdf, etiqueta, inicio, y + 31, { tamano: 11, color: COLOR.gris })
      texto(pdf, c.fecha, inicio + anchoTexto(pdf, etiqueta, 11), y + 31, {
        tamano: 11,
        color: COLOR.gris,
      })
    }
  }
}

export type AccionReporte = "descargar" | "imprimir"

// Imprimir: el PDF se carga en un iframe oculto (mismo origen vía blob) y se llama a
// print() — abre el diálogo de impresión del navegador sin salir de la página.
function imprimir(pdf: Pdf, nombreArchivo: string) {
  const blob = pdf.doc.output("blob")
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement("iframe")
  iframe.title = nombreArchivo
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
  const limpiar = () => {
    iframe.remove()
    URL.revokeObjectURL(url)
  }
  iframe.onload = () => {
    const ventana = iframe.contentWindow
    if (!ventana) return limpiar()
    ventana.addEventListener("afterprint", limpiar)
    ventana.focus()
    ventana.print()
    // Respaldo por si el navegador no emite afterprint.
    setTimeout(limpiar, 60_000)
  }
  iframe.src = url
  document.body.appendChild(iframe)
}

function guardar(pdf: Pdf, nombreArchivo: string, accion: AccionReporte = "descargar") {
  if (accion === "imprimir") imprimir(pdf, nombreArchivo)
  else pdf.doc.save(nombreArchivo)
}

// --- 1. Préstamo -------------------------------------------------------------------

function montoEnTexto(valor: number | null): string {
  const monto = valor ?? 0
  const cents = Math.round((monto - Math.trunc(monto)) * 100)
  const entero = Number.isInteger(monto) ? String(monto) : monto.toFixed(2)
  return `${entero}(dolares con ${String(cents).padStart(2, "0")}/100 ctvs)`
}

export async function descargarReportePrestamo(
  solicitud: SolicitudPrestamoBackend,
  solicitante: DatosSolicitante,
  accion: AccionReporte = "descargar"
) {
  const pdf = await crearPdf()

  encabezado(pdf, {
    titulo: "SOLICITUD DE PRÉSTAMOS",
    numero: solicitud.id,
    xEmpresa: 142,
    izquierda: 42,
    derecha: 785,
    yNumero: 151,
    yLinea: 180,
    conInsignia: true,
  })

  texto(
    pdf,
    `${CIUDAD}, ${fechaLarga(solicitud.dateState ?? solicitud.created_at)}`,
    744,
    234,
    {
      tamano: 17,
      negrita: true,
      alinear: "right",
    }
  )

  texto(pdf, "Estimado", 83, 262, { tamano: 17, negrita: true })
  texto(pdf, APROBADOR_PRESTAMOS, 83, 290, { tamano: 17, negrita: true })
  texto(pdf, "Presente. -", 83, 318, { tamano: 17, negrita: true })

  campo(pdf, "Nombres y Apellidos", valorOGuion(solicitante.nombre), 83, 363, {
    tamano: 17,
  })
  campo(pdf, "Departamento", valorOGuion(solicitud.departmentSoliciter), 83, 393, {
    tamano: 17,
  })
  campo(pdf, "Cargo", valorOGuion(solicitud.cargo ?? solicitante.cargo), 83, 423, {
    tamano: 17,
  })

  const interlineado = 29
  let y = 468
  y = parrafo(
    pdf,
    [
      {
        texto:
          "Por medio de la presente y luego de saludarle, solicito a usted se me otorgue, el siguiente desembolso:",
      },
    ],
    83,
    y,
    661,
    { tamano: 17, interlineado, justificar: true }
  )

  texto(pdf, valorOGuion(solicitud.type).toUpperCase(), 413, y, {
    tamano: 17,
    negrita: true,
    alinear: "center",
  })
  y += interlineado

  y = parrafo(
    pdf,
    [
      {
        texto: `Por la cantidad de $: ${montoEnTexto(solicitud.valor)} comprometiéndome a pagar la totalidad del mismo en un plazo de: `,
      },
      { texto: valorOGuion(solicitud.plazos), negrita: true },
      { texto: " a partir del mes de: " },
      { texto: valorOGuion(solicitud.cobroM).toUpperCase(), negrita: true },
    ],
    83,
    y,
    661,
    { tamano: 17, interlineado, justificar: true }
  )
  texto(pdf, "Por su atención y comprensión, quedo a sus ordenes", 83, y, { tamano: 17 })
  texto(pdf, "Gracias.", 83, y + interlineado, { tamano: 17 })
  y += interlineado * 2

  const yObs = Math.max(722, y + 40)
  texto(pdf, "Observaciones:", 83, yObs, { tamano: 17, negrita: true })
  if (solicitud.observation?.trim()) {
    parrafo(pdf, [{ texto: solicitud.observation.trim() }], 83, yObs + 33, 661, {
      tamano: 16,
      interlineado: 24,
    })
  }

  const yFirma = 955
  linea(pdf, 76, yFirma, 345, yFirma, COLOR.texto, 1.2)
  linea(pdf, 421, yFirma, 744, yFirma, COLOR.texto, 1.2)
  texto(pdf, "Firma Solicitante", 210, yFirma + 15, {
    tamano: 16,
    negrita: true,
    alinear: "center",
  })
  texto(pdf, "Cédula:", 210, yFirma + 30, {
    tamano: 11,
    color: COLOR.gris,
    alinear: "center",
  })
  texto(pdf, `Msc: ${APROBADOR_PRESTAMOS.replace(/^Msc\.\s*/, "")}`, 582, yFirma + 13, {
    tamano: 16,
    negrita: true,
    alinear: "center",
  })
  texto(pdf, "Aprobado", 582, yFirma + 31, {
    tamano: 11,
    color: COLOR.gris,
    alinear: "center",
  })

  texto(
    pdf,
    "Nota: Documento generado electrónicamente, no requiere firma física.",
    413,
    1018,
    { tamano: 11, color: COLOR.gris, alinear: "center" }
  )

  pie(pdf)
  guardar(pdf, `Solicitud de Préstamo N° ${solicitud.id}.pdf`, accion)
}

// --- 2. Permiso --------------------------------------------------------------------

export async function descargarReportePermiso(
  solicitud: SolicitudPermisoBackend,
  solicitante: DatosSolicitante,
  accion: AccionReporte = "descargar"
) {
  const pdf = await crearPdf()

  encabezado(pdf, {
    titulo: "SOLICITUD DE PERMISOS",
    numero: solicitud.id,
    xEmpresa: 133,
    izquierda: 40,
    derecha: 788,
    yNumero: 122,
    yLinea: 150,
    conInsignia: false,
  })

  campoSubrayado(pdf, "SOLICITANTE", valorOGuion(solicitante.nombre), 62, 221)
  campoSubrayado(pdf, "CARGO", valorOGuion(solicitante.cargo), 62, 252)
  campoSubrayado(pdf, "DEPARTAMENTO", valorOGuion(solicitud.departmentSoliciter), 62, 283)

  campo(pdf, "FECHA DEL PERMISO", valorOGuion(solicitud.dateS?.slice(0, 10)), 131, 324, {
    tamano: 15,
  })
  campo(pdf, "HORAS SOLICITADAS", valorOGuion(solicitud.requestedHour), 513, 324, {
    tamano: 15,
  })
  campo(pdf, "DESDE LAS", valorOGuion(solicitud.startTime), 179, 350, { tamano: 15 })
  campo(pdf, "HASTA LAS", valorOGuion(solicitud.finalTime), 537, 350, { tamano: 15 })

  const ancho = 690
  texto(pdf, "EXPLIQUE SU PEDIDO:", 70, 436, { negrita: true })
  texto(pdf, "UD ESCOGIO EL SIGUIENTE TIPO DE PERMISO:", 70, 467, { negrita: true })
  texto(pdf, valorOGuion(solicitud.typePermissions), 70, 499)
  texto(pdf, "DETALLE DE SU SOLICITUD:", 70, 530, { negrita: true })
  let y = parrafo(pdf, [{ texto: valorOGuion(solicitud.details) }], 70, 561, ancho, {
    interlineado: 24,
  })

  y += 8
  texto(pdf, "COMENTARIO RRHH:", 70, y, { negrita: true })
  y = parrafo(pdf, [{ texto: valorOGuion(solicitud.observation) }], 70, y + 32, ancho, {
    interlineado: 24,
  })

  const yEstado = Math.max(768, y + 40)
  texto(pdf, "ESTADO DE SU SOLICITUD:", 70, yEstado, { negrita: true })
  insignia(
    pdf,
    70 + anchoTexto(pdf, "ESTADO DE SU SOLICITUD:", 16, true) + 12,
    yEstado - 13,
    105,
    26,
    "APROBADO"
  )

  const fechaSolicitud = fechaHoraFirma(solicitud.created_at)
  const fechaAprobacion = fechaHoraFirma(solicitud.aprovedDate) || fechaSolicitud
  firmasTres(pdf, 937, [
    { x1: 65, x2: 263, etiqueta: "FIRMA SOLICITANTE", fecha: fechaSolicitud },
    { x1: 312, x2: 491, etiqueta: "JEFE INMEDIATO", fecha: fechaAprobacion },
    { x1: 542, x2: 760, etiqueta: "RECURSOS HUMANOS", fecha: fechaAprobacion },
  ])

  pie(pdf)
  guardar(pdf, `Solicitud de Permiso N° ${solicitud.id}.pdf`, accion)
}

// --- 3. Vacaciones -----------------------------------------------------------------

export async function descargarReporteVacaciones(
  solicitud: SolicitudVacacionBackend,
  solicitante: DatosSolicitante
) {
  const pdf = await crearPdf()

  encabezado(pdf, {
    titulo: "SOLICITUD DE VACACIONES",
    numero: solicitud.id,
    xEmpresa: 142,
    izquierda: 42,
    derecha: 785,
    yNumero: 130,
    yLinea: 159,
    conInsignia: false,
  })

  campoSubrayado(pdf, "SOLICITANTE", valorOGuion(solicitante.nombre), 67, 237, 12)
  campoSubrayado(pdf, "CARGO", valorOGuion(solicitante.cargo), 67, 270, 12)
  campoSubrayado(
    pdf,
    "DEPARTAMENTO",
    valorOGuion(solicitud.departmentSoliciter),
    67,
    303,
    12
  )

  const dias = solicitud.approvedDays ?? solicitud.requestedDays
  const etiquetaDias = "DIAS SOLICITADOS: "
  const valorDias = String(dias ?? "—")
  const inicioDias =
    413 -
    (anchoTexto(pdf, etiquetaDias, 15, true) + anchoTexto(pdf, valorDias, 15, true)) / 2
  texto(pdf, etiquetaDias, inicioDias, 349, { tamano: 15, negrita: true })
  texto(pdf, valorDias, inicioDias + anchoTexto(pdf, etiquetaDias, 15, true), 349, {
    tamano: 15,
    negrita: true,
    color: [249, 115, 22],
  })
  texto(pdf, "FECHA", 413, 388, { tamano: 12, negrita: true, alinear: "center" })
  campo(pdf, "DESDE", valorOGuion(solicitud.dateS?.slice(0, 10)), 162, 414, {
    tamano: 12,
  })
  campo(pdf, "HASTA", valorOGuion(solicitud.dateE?.slice(0, 10)), 515, 414, {
    tamano: 12,
  })

  pdf.doc.setDrawColor(...COLOR.borde)
  pdf.doc.setLineWidth(1 * K)
  pdf.doc.rect(42 * K, 198 * K, 743 * K, 259 * K)

  texto(pdf, "EXPLIQUE SU PEDIDO:", 76, 548, { tamano: 12, negrita: true })
  texto(pdf, "UD ESCOGIO EL SIGUIENTE TIPO DE VACACIONES:", 76, 573, {
    tamano: 12,
    negrita: true,
  })
  // El backend no guarda el tipo al crear la solicitud (todas son por periodo anual).
  texto(pdf, solicitud.type?.trim() || "Vacaciones Anuales", 76, 597, { tamano: 12 })
  texto(pdf, "DETALLE DE SU SOLICITUD:", 76, 622, { tamano: 12, negrita: true })
  const yFin = parrafo(pdf, [{ texto: valorOGuion(solicitud.details) }], 76, 647, 670, {
    tamano: 12,
    interlineado: 21,
  })

  const yEstado = Math.max(768, yFin + 40)
  texto(pdf, "ESTADO DE SU SOLICITUD:", 76, yEstado, { tamano: 12, negrita: true })
  insignia(
    pdf,
    76 + anchoTexto(pdf, "ESTADO DE SU SOLICITUD:", 12, true) + 12,
    yEstado - 14,
    111,
    28,
    "APROBADO"
  )

  pdf.doc.setDrawColor(...COLOR.borde)
  pdf.doc.setLineWidth(1 * K)
  pdf.doc.rect(42 * K, 500 * K, 743 * K, (Math.max(815, yEstado + 47) - 500) * K)

  const fechaSolicitud = fechaHoraFirma(solicitud.created_at)
  const fechaAprobacion = fechaHoraFirma(solicitud.aprovedDate) || fechaSolicitud
  firmasTres(pdf, 962, [
    { x1: 68, x2: 265, etiqueta: "FIRMA SOLICITANTE", fecha: fechaSolicitud },
    { x1: 312, x2: 491, etiqueta: "JEFE INMEDIATO", fecha: fechaAprobacion },
    { x1: 541, x2: 757, etiqueta: "RECURSOS HUMANOS", fecha: fechaAprobacion },
  ])

  pie(pdf)
  guardar(pdf, `Solicitud de Vacaciones N° ${solicitud.id}.pdf`)
}
