// @vitest-environment node
//
// Pruebas de la firma PAdES con un certificado de PRUEBA generado al vuelo (nunca un
// certificado real). Ver scripts/generar-certificado-prueba.ts.

import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { jsPDF } from "jspdf"
import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

// Sin certificado guardado en la base: se usa el de las variables de entorno.
vi.mock("@/lib/db/client", () => ({
  prisma: { firmaCertificado: { findUnique: async () => null } },
}))

import { cargarCertificadoP12, type CertificadoFirma } from "@/lib/firma/certificado"
import { FirmaError, firmarPdf } from "@/lib/firma"
import { verificarFirmasPdf } from "@/lib/firma/verificar"
import { generarP12Prueba } from "@/scripts/generar-certificado-prueba"

const CONTRASENA = "clave-de-prueba-XYZ"

let p12: Buffer
let cert: CertificadoFirma
let dir: string

function pdfJs(paginas = 2): Buffer {
  const doc = new jsPDF()
  doc.text("Documento de prueba – ñandú", 20, 20)
  for (let i = 2; i <= paginas; i++) {
    doc.addPage()
    doc.text(`Página ${i}`, 20, 20)
  }
  return Buffer.from(doc.output("arraybuffer"))
}

async function pdfConXrefStream(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.addPage([595, 842]).drawText("Con object streams")
  return Buffer.from(await doc.save({ useObjectStreams: true }))
}

beforeAll(async () => {
  p12 = generarP12Prueba({ contrasena: CONTRASENA })
  cert = cargarCertificadoP12(p12, CONTRASENA)
  dir = await mkdtemp(path.join(tmpdir(), "firma-test-"))
}, 60_000)

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
})

describe("certificado .p12", () => {
  it("elige el certificado con clave privada y uso de firma, con su cadena", () => {
    expect(cert.info.nombre).toBe("FIRMANTE DE PRUEBA ÑANDÚ")
    expect(cert.info.usos).toEqual(
      expect.arrayContaining(["digitalSignature", "nonRepudiation"])
    )
    expect(cert.cadena).toHaveLength(2) // subordinada + raíz
  })

  it("contraseña incorrecta → error claro sin filtrar la contraseña", () => {
    try {
      cargarCertificadoP12(p12, "otra-clave")
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(FirmaError)
      expect((err as FirmaError).codigo).toBe("CONTRASENA_INCORRECTA")
      expect((err as Error).message).not.toContain("otra-clave")
      expect((err as Error).message).not.toContain(CONTRASENA)
    }
  })

  it("certificado vencido → CERTIFICADO_VENCIDO", () => {
    const vencido = generarP12Prueba({
      contrasena: CONTRASENA,
      vencido: true,
      conCertificadoCifrado: false,
    })
    expect(() => cargarCertificadoP12(vencido, CONTRASENA)).toThrowError(
      expect.objectContaining({ codigo: "CERTIFICADO_VENCIDO" })
    )
  }, 30_000)
})

describe("firmarPdf", () => {
  it("produce una firma PAdES criptográficamente válida que cubre todo el documento", async () => {
    const { pdf, nivel } = await firmarPdf(pdfJs(), {
      certificado: cert,
      razon: "Prueba",
      tsa: null,
    })
    expect(nivel).toBe("PAdES-B-B")
    const [firma, ...resto] = verificarFirmasPdf(pdf)
    expect(resto).toHaveLength(0)
    expect(firma).toMatchObject({
      subFilter: "ETSI.CAdES.detached",
      digestCorrecto: true,
      firmaCorrecta: true,
      cubreTodoElDocumento: true,
      tieneSigningCertificateV2: true,
      cantidadCertificados: 3,
      valida: true,
      firmante: "FIRMANTE DE PRUEBA ÑANDÚ",
    })
    // Sigue siendo un PDF legible con las mismas páginas.
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(2)
  })

  it("detecta si el documento se modificó después de firmarse", async () => {
    const { pdf } = await firmarPdf(pdfJs(), { certificado: cert, tsa: null })
    const alterado = Buffer.from(pdf)
    const pos = alterado.indexOf("Documento de prueba")
    // Cambia un byte dentro del contenido (stream sin comprimir de jsPDF).
    if (pos > 0) alterado[pos] = "X".charCodeAt(0)
    else alterado[200] = alterado[200]! ^ 0xff
    const [firma] = verificarFirmasPdf(alterado)
    expect(firma!.digestCorrecto).toBe(false)
    expect(firma!.valida).toBe(false)

    // Agregar bytes al final también se detecta (la firma ya no cubre todo).
    const extendido = Buffer.concat([pdf, Buffer.from("\n% agregado\n")])
    expect(verificarFirmasPdf(extendido)[0]!.cubreTodoElDocumento).toBe(false)
  })

  it("firma dos veces (incremental) y ambas firmas siguen válidas", async () => {
    const original = pdfJs()
    const primera = await firmarPdf(original, {
      certificado: cert,
      razon: "Primer firmante",
      visible: { pagina: "ultima" },
      tsa: null,
    })
    const segunda = await firmarPdf(primera.pdf, {
      certificado: cert,
      razon: "Segundo firmante",
      visible: { pagina: 1, x: 40, y: 40 },
      tsa: null,
    })
    // La segunda firma solo agrega bytes al final.
    expect(segunda.pdf.subarray(0, primera.pdf.length).equals(primera.pdf)).toBe(true)

    const firmas = verificarFirmasPdf(segunda.pdf)
    expect(firmas).toHaveLength(2)
    expect(firmas.every((f) => f.valida)).toBe(true)
    expect(firmas[0]!.cubreTodoElDocumento).toBe(false) // cubre su revisión
    expect(firmas[0]!.byteRange[2] + firmas[0]!.byteRange[3]).toBe(primera.pdf.length)
    expect(firmas[1]!.cubreTodoElDocumento).toBe(true)

    // Dos campos de firma distintos en el AcroForm, con SigFlags 3.
    const doc = await PDFDocument.load(segunda.pdf)
    const acro = doc.catalog.lookup(PDFName.of("AcroForm"), PDFDict)
    expect(acro.lookup(PDFName.of("Fields"), PDFArray).size()).toBe(2)
    expect(acro.get(PDFName.of("SigFlags"))?.toString()).toBe("3")
  })

  it("firma visible: widget con rectángulo y apariencia en la página pedida", async () => {
    const { pdf } = await firmarPdf(pdfJs(3), {
      certificado: cert,
      razon: "Visto bueno",
      ubicacion: "Quito",
      visible: { pagina: 2, x: 100, y: 120, ancho: 240, alto: 80 },
      tsa: null,
    })
    const doc = await PDFDocument.load(pdf)
    const annots = doc.getPage(1).node.lookup(PDFName.of("Annots"), PDFArray)
    const widget = annots.lookup(0, PDFDict)
    expect(widget.get(PDFName.of("Rect"))?.toString()).toBe("[ 100 120 340 200 ]")
    expect(widget.lookup(PDFName.of("AP"), PDFDict).get(PDFName.of("N"))).toBeDefined()
    expect(verificarFirmasPdf(pdf)[0]!.valida).toBe(true)
  })

  it("funciona con PDF que usan xref stream / object streams", async () => {
    const base = await pdfConXrefStream()
    const una = await firmarPdf(base, {
      certificado: cert,
      visible: { pagina: "primera" },
      tsa: null,
    })
    const dos = await firmarPdf(una.pdf, { certificado: cert, tsa: null })
    const firmas = verificarFirmasPdf(dos.pdf)
    expect(firmas.map((f) => f.valida)).toEqual([true, true])
    expect((await PDFDocument.load(dos.pdf)).getPageCount()).toBe(1)
  })

  it("lee el certificado desde variables de entorno y escribe la salida", async () => {
    const ruta = path.join(dir, "prueba.p12")
    await writeFile(ruta, p12)
    await chmod(ruta, 0o600)
    const entrada = path.join(dir, "entrada.pdf")
    const salida = path.join(dir, "salida.pdf")
    await writeFile(entrada, pdfJs())
    vi.stubEnv("FIRMA_P12_PATH", ruta)
    vi.stubEnv("FIRMA_P12_PASSWORD", CONTRASENA)
    vi.stubEnv("FIRMA_TSA_URL", "")
    const log = vi.spyOn(console, "info")
    try {
      await firmarPdf(entrada, salida)
      expect(verificarFirmasPdf(await readFile(salida))[0]!.valida).toBe(true)
      const registrado = log.mock.calls.flat().join(" ")
      expect(registrado).toContain("FIRMANTE DE PRUEBA")
      expect(registrado).not.toContain(CONTRASENA)
    } finally {
      vi.unstubAllEnvs()
      log.mockRestore()
    }
  })

  it("errores claros: PDF corrupto, PDF protegido, página inexistente", async () => {
    await expect(
      firmarPdf(Buffer.from("no soy un pdf"), { certificado: cert })
    ).rejects.toMatchObject({
      codigo: "PDF_CORRUPTO",
    })
    const truncado = pdfJs().subarray(0, 300)
    await expect(firmarPdf(truncado, { certificado: cert })).rejects.toMatchObject({
      codigo: "PDF_CORRUPTO",
    })

    // Simula un PDF cifrado agregando /Encrypt al trailer.
    const cifrado = Buffer.from(
      pdfJs().toString("latin1").replace("trailer\n<<", "trailer\n<<\n/Encrypt 1 0 R"),
      "latin1"
    )
    await expect(
      firmarPdf(cifrado, { certificado: cert, tsa: null })
    ).rejects.toMatchObject({
      codigo: "PDF_PROTEGIDO",
    })

    await expect(
      firmarPdf(pdfJs(2), { certificado: cert, visible: { pagina: 9 }, tsa: null })
    ).rejects.toMatchObject({ codigo: "PAGINA_INVALIDA" })
  })
})
