// Preparación del PDF para firmar mediante ACTUALIZACIÓN INCREMENTAL.
//
// Nunca se reescribe el archivo: se le agregan al final los objetos nuevos (diccionario
// de firma, campo/widget, apariencia) y las versiones nuevas de los objetos tocados
// (página → /Annots, catálogo/AcroForm → /Fields), más una sección xref con /Prev
// apuntando a la anterior. Así los bytes que cubren las firmas previas quedan intactos
// y esas firmas siguen siendo válidas (varios firmantes).
//
// pdf-lib se usa solo para LEER la estructura (páginas, catálogo, AcroForm); los bytes
// que se agregan se escriben acá.

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
  type PDFContext,
  type PDFObject,
} from "pdf-lib"

import { construirApariencia, type DatosApariencia } from "./apariencia"
import { FirmaError } from "./errores"

export type PosicionFirma = {
  pagina: "primera" | "ultima" | number // número = 1-based
  x?: number // puntos desde el borde IZQUIERDO de la página
  y?: number // puntos desde el borde INFERIOR de la página
  ancho?: number
  alto?: number
}

export type OpcionesPreparar = {
  fechaPdf: string // D:YYYYMMDDHHmmss-05'00'
  razon?: string
  ubicacion?: string
  contacto?: string
  espacioFirma: number // bytes reservados para el CMS
  visible?: { posicion: PosicionFirma; datos: DatosApariencia }
}

export type PdfPreparado = {
  pdf: Buffer
  byteRange: [number, number, number, number]
  inicioContents: number // offset del '<'
  largoHex: number // cantidad de dígitos hex reservados
}

const ANCHO_DEF = 220
const ALTO_DEF = 70
const PH_BYTERANGE = "[0 /********** /********** /**********]"

const nom = (s: string) => PDFName.of(s)
const textoPdf = (s: string) => PDFHexString.fromText(s).toString()

function buscarUltimo(buf: Buffer, texto: string, desde = buf.length): number {
  return buf.lastIndexOf(Buffer.from(texto, "latin1"), desde)
}

function validarEstructura(pdf: Buffer): {
  prev: number
  esStream: boolean
  size: number
} {
  const cabecera = pdf.subarray(0, 1024).indexOf(Buffer.from("%PDF-", "latin1"))
  const posStart = buscarUltimo(pdf, "startxref")
  if (cabecera < 0 || posStart < 0 || buscarUltimo(pdf, "%%EOF") < posStart) {
    throw new FirmaError(
      "PDF_CORRUPTO",
      "El archivo no es un PDF válido o está incompleto."
    )
  }
  const m = /startxref\s+(\d+)/.exec(
    pdf.subarray(posStart, posStart + 64).toString("latin1")
  )
  const prev = m ? Number(m[1]) : NaN
  if (!Number.isFinite(prev) || prev <= 0 || prev >= pdf.length) {
    throw new FirmaError("PDF_CORRUPTO", "La tabla de referencias del PDF está dañada.")
  }
  const zona = pdf.subarray(prev, prev + 8192).toString("latin1")
  const esTabla = zona.startsWith("xref")
  const esStream = /^\d+\s+\d+\s+obj/.test(zona)
  if (!esTabla && !esStream) {
    throw new FirmaError("PDF_CORRUPTO", "La tabla de referencias del PDF está dañada.")
  }
  const size = /\/Size\s+(\d+)/.exec(zona)
  return { prev, esStream, size: size ? Number(size[1]) : 0 }
}

async function cargar(pdf: Buffer): Promise<PDFDocument> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(pdf, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
    })
  } catch {
    throw new FirmaError("PDF_CORRUPTO", "El PDF está dañado y no se puede leer.")
  }
  if (doc.context.trailerInfo.Encrypt) {
    throw new FirmaError(
      "PDF_PROTEGIDO",
      "El PDF está protegido con contraseña o cifrado; quite la protección antes de firmar."
    )
  }
  return doc
}

function hojasDePaginas(ctx: PDFContext, raiz: PDFRef): PDFRef[] {
  const out: PDFRef[] = []
  const visitados = new Set<string>()
  const visitar = (ref: PDFRef) => {
    if (visitados.has(ref.toString())) return
    visitados.add(ref.toString())
    const nodo = ctx.lookup(ref)
    if (!(nodo instanceof PDFDict)) return
    const kids = nodo.lookup(nom("Kids"))
    if (kids instanceof PDFArray) {
      for (const k of kids.asArray()) if (k instanceof PDFRef) visitar(k)
    } else out.push(ref)
  }
  visitar(raiz)
  return out
}

function heredado(
  ctx: PDFContext,
  pagina: PDFDict,
  clave: string
): PDFObject | undefined {
  let nodo: PDFDict | undefined = pagina
  for (let i = 0; nodo && i < 32; i++) {
    const v = nodo.lookup(nom(clave))
    if (v) return v
    const padre: PDFObject | undefined = nodo.lookup(nom("Parent"))
    nodo = padre instanceof PDFDict ? padre : undefined
  }
  return undefined
}

function cajaPagina(ctx: PDFContext, pagina: PDFDict): [number, number, number, number] {
  const caja = heredado(ctx, pagina, "CropBox") ?? heredado(ctx, pagina, "MediaBox")
  if (caja instanceof PDFArray && caja.size() === 4) {
    const v = caja.asArray().map((o) => (o instanceof PDFNumber ? o.asNumber() : 0))
    return [
      Math.min(v[0]!, v[2]!),
      Math.min(v[1]!, v[3]!),
      Math.max(v[0]!, v[2]!),
      Math.max(v[1]!, v[3]!),
    ]
  }
  return [0, 0, 595.28, 841.89]
}

function nombresDeCampos(ctx: PDFContext, campos: PDFArray | undefined): Set<string> {
  const nombres = new Set<string>()
  for (const r of campos?.asArray() ?? []) {
    const c = ctx.lookup(r)
    const t = c instanceof PDFDict ? c.lookup(nom("T")) : undefined
    if (t instanceof PDFString || t instanceof PDFHexString) nombres.add(t.decodeText())
  }
  return nombres
}

export async function prepararPdf(
  original: Buffer,
  op: OpcionesPreparar
): Promise<PdfPreparado> {
  const estructura = validarEstructura(original)
  const doc = await cargar(original)
  const ctx = doc.context
  ctx.largestObjectNumber = Math.max(ctx.largestObjectNumber, estructura.size - 1)

  const raizRef = ctx.trailerInfo.Root
  if (!(raizRef instanceof PDFRef))
    throw new FirmaError("PDF_CORRUPTO", "El PDF no tiene catálogo.")
  const catalogo = ctx.lookup(raizRef, PDFDict)
  const paginasRef = catalogo.get(nom("Pages"))
  if (!(paginasRef instanceof PDFRef))
    throw new FirmaError("PDF_CORRUPTO", "El PDF no tiene páginas.")
  const paginas = hojasDePaginas(ctx, paginasRef)
  if (paginas.length === 0)
    throw new FirmaError("PDF_CORRUPTO", "El PDF no tiene páginas.")

  // Objetos modificados (misma numeración) y nuevos.
  const modificados = new Map<number, { ref: PDFRef; cuerpo: Buffer }>()
  const marcar = (ref: PDFRef, obj: PDFObject) =>
    modificados.set(ref.objectNumber, {
      ref,
      cuerpo: Buffer.from(obj.toString(), "latin1"),
    })

  // --- Página destino -----------------------------------------------------------------
  const pos = op.visible?.posicion ?? { pagina: "primera" as const }
  const indice =
    pos.pagina === "primera"
      ? 0
      : pos.pagina === "ultima"
        ? paginas.length - 1
        : Number(pos.pagina) - 1
  if (!Number.isInteger(indice) || indice < 0 || indice >= paginas.length) {
    throw new FirmaError(
      "PAGINA_INVALIDA",
      `La página ${String(pos.pagina)} no existe (el PDF tiene ${paginas.length}).`
    )
  }
  const paginaRef = paginas[indice]!
  const pagina = ctx.lookup(paginaRef, PDFDict)

  // --- AcroForm ---------------------------------------------------------------------------
  let acroRef: PDFRef | null = null
  let acro: PDFDict
  const acroRaw = catalogo.get(nom("AcroForm"))
  if (acroRaw instanceof PDFRef) {
    acroRef = acroRaw
    acro = ctx.lookup(acroRaw, PDFDict)
  } else if (acroRaw instanceof PDFDict) {
    acro = acroRaw
  } else {
    acro = ctx.obj({}) as PDFDict
    acroRef = ctx.nextRef()
    catalogo.set(nom("AcroForm"), acroRef)
    marcar(raizRef, catalogo)
  }

  let camposRef: PDFRef | null = null
  let campos: PDFArray
  const camposRaw = acro.get(nom("Fields"))
  if (camposRaw instanceof PDFRef) {
    camposRef = camposRaw
    campos = ctx.lookup(camposRaw, PDFArray)
  } else if (camposRaw instanceof PDFArray) {
    campos = camposRaw
  } else {
    campos = ctx.obj([]) as PDFArray
    acro.set(nom("Fields"), campos)
  }

  const usados = nombresDeCampos(ctx, campos)
  let num = 1
  while (usados.has(`Firma${num}`)) num++
  const nombreCampo = `Firma${num}`

  // --- Objetos nuevos ---------------------------------------------------------------------
  const firmaRef = ctx.nextRef()
  const widgetRef = ctx.nextRef()
  let apRef: PDFRef | null = null

  let rect = [0, 0, 0, 0]
  let apariencia: { contenido: string; recursos: string } | null = null
  if (op.visible) {
    const [x1, y1, x2] = cajaPagina(ctx, pagina)
    const w = op.visible.posicion.ancho ?? ANCHO_DEF
    const h = op.visible.posicion.alto ?? ALTO_DEF
    const x = x1 + (op.visible.posicion.x ?? x2 - x1 - w - 36)
    const y = y1 + (op.visible.posicion.y ?? 36)
    rect = [x, y, x + w, y + h]
    apariencia = construirApariencia(op.visible.datos, w, h)
    apRef = ctx.nextRef()
  }

  const widget = ctx.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    T: PDFString.of(nombreCampo),
    V: firmaRef,
    P: paginaRef,
    Rect: rect,
    F: 132, // Print + Locked
  }) as PDFDict
  if (apRef) widget.set(nom("AP"), ctx.obj({ N: apRef }))

  // Página: agregar el widget a /Annots (directo o indirecto).
  const annotsRaw = pagina.get(nom("Annots"))
  if (annotsRaw instanceof PDFRef) {
    const arr = ctx.lookup(annotsRaw, PDFArray)
    arr.push(widgetRef)
    marcar(annotsRaw, arr)
  } else if (annotsRaw instanceof PDFArray) {
    annotsRaw.push(widgetRef)
    marcar(paginaRef, pagina)
  } else {
    pagina.set(nom("Annots"), ctx.obj([widgetRef]))
    marcar(paginaRef, pagina)
  }

  campos.push(widgetRef)
  acro.set(nom("SigFlags"), PDFNumber.of(3)) // SignaturesExist | AppendOnly
  if (camposRef) marcar(camposRef, campos)
  if (acroRef) marcar(acroRef, acro)
  else marcar(raizRef, catalogo) // AcroForm directo dentro del catálogo

  // --- Escritura del incremento ---------------------------------------------------------
  const partes: Buffer[] = []
  let offset = original.length
  const offsets = new Map<number, { offset: number; gen: number }>()
  const escribir = (b: Buffer | string) => {
    const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b
    partes.push(buf)
    offset += buf.length
  }
  const abrirObjeto = (ref: PDFRef) => {
    offsets.set(ref.objectNumber, { offset, gen: ref.generationNumber })
    escribir(`${ref.objectNumber} ${ref.generationNumber} obj\n`)
  }

  if (original[original.length - 1] !== 0x0a) escribir("\n")

  // Diccionario de firma con los marcadores de posición.
  abrirObjeto(firmaRef)
  escribir(
    "<<\n/Type /Sig\n/Filter /Adobe.PPKLite\n/SubFilter /ETSI.CAdES.detached\n/ByteRange "
  )
  const offByteRange = offset
  escribir(PH_BYTERANGE)
  escribir("\n/Contents ")
  const offContents = offset
  const largoHex = op.espacioFirma * 2
  escribir(`<${"0".repeat(largoHex)}>`)
  escribir(`\n/M (${op.fechaPdf})`)
  if (op.razon) escribir(`\n/Reason ${textoPdf(op.razon)}`)
  if (op.ubicacion) escribir(`\n/Location ${textoPdf(op.ubicacion)}`)
  if (op.contacto) escribir(`\n/ContactInfo ${textoPdf(op.contacto)}`)
  escribir("\n/Prop_Build << /App << /Name /ANCONnet >> >>\n>>\nendobj\n")

  abrirObjeto(widgetRef)
  escribir(widget.toString() + "\nendobj\n")

  if (apRef && apariencia) {
    const [x1, y1, x2, y2] = rect as [number, number, number, number]
    const contenido = Buffer.from(apariencia.contenido, "latin1")
    abrirObjeto(apRef)
    escribir(
      `<< /Type /XObject /Subtype /Form /FormType 1 /BBox [0 0 ${x2 - x1} ${y2 - y1}] ` +
        `/Resources ${apariencia.recursos} /Length ${contenido.length} >>\nstream\n`
    )
    escribir(contenido)
    escribir("\nendstream\nendobj\n")
  }

  if (acroRef && !modificados.has(acroRef.objectNumber)) marcar(acroRef, acro)
  for (const { ref, cuerpo } of Array.from(modificados.values())) {
    abrirObjeto(ref)
    escribir(cuerpo)
    escribir("\nendobj\n")
  }

  // --- Xref + trailer -----------------------------------------------------------------
  const t = ctx.trailerInfo
  const extras =
    `/Root ${raizRef.toString()}` +
    (t.Info ? ` /Info ${t.Info.toString()}` : "") +
    (t.ID ? ` /ID ${t.ID.toString()}` : "") +
    ` /Prev ${estructura.prev}`

  const subsecciones = (nums: number[]) => {
    const orden = [...nums].sort((a, b) => a - b)
    const grupos: number[][] = []
    for (const n_ of orden) {
      const g = grupos[grupos.length - 1]
      if (g && g[g.length - 1] === n_ - 1) g.push(n_)
      else grupos.push([n_])
    }
    return grupos
  }

  const inicioXref = offset
  if (estructura.esStream) {
    // El original usa xref stream: el incremento también (PDF 1.5+).
    const xrefRef = ctx.nextRef()
    offsets.set(xrefRef.objectNumber, { offset: inicioXref, gen: 0 })
    const grupos = subsecciones(Array.from(offsets.keys()))
    const filas: Buffer[] = []
    for (const g of grupos) {
      for (const n_ of g) {
        const e = offsets.get(n_)!
        const fila = Buffer.alloc(7)
        fila[0] = 1
        fila.writeUInt32BE(e.offset, 1)
        fila.writeUInt16BE(e.gen, 5)
        filas.push(fila)
      }
    }
    const datos = Buffer.concat(filas)
    const index = grupos.map((g) => `${g[0]} ${g.length}`).join(" ")
    escribir(
      `${xrefRef.objectNumber} 0 obj\n<< /Type /XRef /Size ${ctx.largestObjectNumber + 1} ` +
        `/W [1 4 2] /Index [${index}] ${extras} /Length ${datos.length} >>\nstream\n`
    )
    escribir(datos)
    escribir("\nendstream\nendobj\n")
  } else {
    let tabla = "xref\n"
    for (const g of subsecciones(Array.from(offsets.keys()))) {
      tabla += `${g[0]} ${g.length}\n`
      for (const n_ of g) {
        const e = offsets.get(n_)!
        tabla += `${String(e.offset).padStart(10, "0")} ${String(e.gen).padStart(5, "0")} n \n`
      }
    }
    escribir(tabla)
    escribir(`trailer\n<< /Size ${ctx.largestObjectNumber + 1} ${extras} >>\n`)
  }
  escribir(`startxref\n${inicioXref}\n%%EOF\n`)

  const pdf = Buffer.concat([original, ...partes])

  // ByteRange real (mismo largo que el marcador, se rellena con espacios).
  const finContents = offContents + largoHex + 2
  const byteRange: [number, number, number, number] = [
    0,
    offContents,
    finContents,
    pdf.length - finContents,
  ]
  const texto = `[${byteRange.join(" ")}]`.padEnd(PH_BYTERANGE.length, " ")
  if (texto.length !== PH_BYTERANGE.length) {
    throw new FirmaError(
      "ESPACIO_INSUFICIENTE",
      "El PDF es demasiado grande para firmarse."
    )
  }
  pdf.write(texto, offByteRange, "latin1")

  return { pdf, byteRange, inicioContents: offContents, largoHex }
}

export function insertarFirma(prep: PdfPreparado, cms: Buffer): Buffer {
  const hex = cms.toString("hex")
  if (hex.length > prep.largoHex) {
    throw new FirmaError(
      "ESPACIO_INSUFICIENTE",
      "La firma no entra en el espacio reservado; aumente espacioFirma."
    )
  }
  prep.pdf.write(hex.padEnd(prep.largoHex, "0"), prep.inicioContents + 1, "latin1")
  return prep.pdf
}

export function bytesFirmados(prep: PdfPreparado): Buffer {
  const [a, b, c, d] = prep.byteRange
  return Buffer.concat([prep.pdf.subarray(a, a + b), prep.pdf.subarray(c, c + d)])
}
