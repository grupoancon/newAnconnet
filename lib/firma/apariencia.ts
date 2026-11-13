// Apariencia de la firma visible, al estilo de FirmaEC: código QR a la izquierda y, a la
// derecha, "Firmado electrónicamente por:" + nombre del firmante en grande (la fecha, razón
// y ubicación van solo en el QR y en los datos de la firma). Todo es vectorial (el QR se dibuja con rectángulos), así que no hace
// falta incrustar imágenes ni fuentes: se usan Helvetica / Helvetica-Bold estándar.

import { StandardFontEmbedder, StandardFonts } from "pdf-lib"
import QRCode from "qrcode"

export type DatosApariencia = {
  nombre: string
  fecha: string // ya formateada en America/Guayaquil
  fechaIso: string
  razon?: string
  ubicacion?: string
  textoQr?: string
}

type NombreFuente = Parameters<typeof StandardFontEmbedder.for>[0]
const helv = StandardFontEmbedder.for(StandardFonts.Helvetica as unknown as NombreFuente)
const helvB = StandardFontEmbedder.for(
  StandardFonts.HelveticaBold as unknown as NombreFuente
)

// WinAnsi cubre ASCII + Latin-1 (tildes, ñ): lo demás se reemplaza.
export const aWinAnsi = (s: string) =>
  s.normalize("NFC").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")

function literal(s: string): string {
  let out = "("
  for (const ch of aWinAnsi(s)) {
    const c = ch.charCodeAt(0)
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch
    else if (c > 0x7e) out += "\\" + c.toString(8).padStart(3, "0")
    else out += ch
  }
  return out + ")"
}

const n = (v: number) => (Math.round(v * 1000) / 1000).toString()

function ancho(texto: string, tam: number, negrita = false) {
  return (negrita ? helvB : helv).widthOfTextAtSize(aWinAnsi(texto), tam)
}

function partirEnLineas(
  texto: string,
  tam: number,
  max: number,
  negrita: boolean
): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean)
  const lineas: string[] = []
  let actual = ""
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ancho(prueba, tam, negrita) <= max || !actual) actual = prueba
    else {
      lineas.push(actual)
      actual = p
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

function recortar(texto: string, tam: number, max: number): string {
  if (ancho(texto, tam) <= max) return texto
  let t = texto
  while (t.length > 1 && ancho(`${t}...`, tam) > max) t = t.slice(0, -1)
  return `${t}...`
}

export function textoQrPorDefecto(d: DatosApariencia): string {
  return [
    `FIRMADO POR: ${d.nombre}`,
    d.razon ? `RAZON: ${d.razon}` : null,
    d.ubicacion ? `LOCALIZACION: ${d.ubicacion}` : null,
    `FECHA: ${d.fechaIso}`,
    "VALIDAR CON: https://www.firmadigital.gob.ec",
  ]
    .filter(Boolean)
    .join("\n")
}

function dibujarQr(texto: string, x: number, y: number, lado: number): string {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "M" })
  const tam = qr.modules.size
  const modulo = lado / (tam + 2) // 1 módulo de zona de silencio por lado
  let ops = `1 1 1 rg ${n(x)} ${n(y)} ${n(lado)} ${n(lado)} re f\n0 0 0 rg\n`
  for (let fila = 0; fila < tam; fila++) {
    let col = 0
    while (col < tam) {
      if (!qr.modules.get(fila, col)) {
        col++
        continue
      }
      const inicio = col
      while (col < tam && qr.modules.get(fila, col)) col++
      const px = x + (inicio + 1) * modulo
      const py = y + lado - (fila + 2) * modulo
      ops += `${n(px)} ${n(py)} ${n((col - inicio) * modulo)} ${n(modulo)} re\n`
    }
  }
  return ops + "f\n"
}

// Devuelve el contenido del stream y el diccionario de recursos del Form XObject.
export function construirApariencia(
  d: DatosApariencia,
  ancho_: number,
  alto: number
): { contenido: string; recursos: string } {
  const pad = Math.max(2, Math.min(6, alto * 0.06))
  const ladoQr = Math.min(alto - pad * 2, ancho_ * 0.4)
  let ops =
    "q\n" + dibujarQr(d.textoQr ?? textoQrPorDefecto(d), pad, (alto - ladoQr) / 2, ladoQr)

  const x0 = pad + ladoQr + pad * 1.5
  const max = ancho_ - x0 - pad
  const escala = Math.max(0.6, Math.min(1.6, alto / 70))
  const tamEtiqueta = 6.5 * escala

  // El nombre se achica hasta entrar en 2 líneas.
  let tamNombre = 12 * escala
  let lineasNombre = partirEnLineas(d.nombre, tamNombre, max, true)
  while (
    (lineasNombre.length > 2 ||
      lineasNombre.some((l) => ancho(l, tamNombre, true) > max)) &&
    tamNombre > 5
  ) {
    tamNombre -= 0.5
    lineasNombre = partirEnLineas(d.nombre, tamNombre, max, true)
  }

  const lineas: { texto: string; tam: number; negrita: boolean; gris: boolean }[] = [
    {
      texto: "Firmado electrónicamente por:",
      tam: tamEtiqueta,
      negrita: false,
      gris: true,
    },
    ...lineasNombre.map((t) => ({
      texto: t,
      tam: tamNombre,
      negrita: true,
      gris: false,
    })),
  ]
  // Solo "Firmado electrónicamente por" + nombre. La fecha, la razón y la ubicación no
  // se imprimen: quedan en los datos de la firma (/M, /Reason, /Location) y en el QR.

  const interlineado = 1.18
  const altoTexto = lineas.reduce((s, l) => s + l.tam * interlineado, 0)
  let y = (alto + altoTexto) / 2 // centrado vertical
  for (const l of lineas) {
    y -= l.tam * interlineado
    const texto = l.negrita ? l.texto : recortar(l.texto, l.tam, max)
    ops += `BT ${l.gris ? "0.3 0.3 0.3" : "0 0 0"} rg /${l.negrita ? "F2" : "F1"} ${n(l.tam)} Tf ${n(x0)} ${n(y + l.tam * 0.18)} Td ${literal(texto)} Tj ET\n`
  }
  ops += "Q\n"

  const recursos =
    "<< /Font << " +
    "/F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> " +
    "/F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> " +
    ">> /ProcSet [/PDF /Text] >>"
  return { contenido: ops, recursos }
}
