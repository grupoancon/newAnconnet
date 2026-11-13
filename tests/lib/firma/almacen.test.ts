// @vitest-environment node
//
// Certificado subido desde Configuración: se guarda cifrado (AES-256-GCM) y se usa para
// firmar. La base se simula en memoria; el .p12 es de PRUEBA.

import { jsPDF } from "jspdf"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { firmaHabilitada, firmarPdf } from "@/lib/firma"
import {
  activarFirma,
  estadoCertificadoGuardado,
  guardarCertificado,
  leerCertificadoGuardado,
} from "@/lib/firma/almacen"
import { cifrar, descifrar } from "@/lib/firma/cifrado"
import { verificarFirmasPdf } from "@/lib/firma/verificar"
import { generarP12Prueba } from "@/scripts/generar-certificado-prueba"

type Fila = Record<string, unknown> & { id: number; updatedAt: Date }
const tabla: { fila: Fila | null } = { fila: null }

vi.mock("@/lib/db/client", () => ({
  prisma: {
    firmaCertificado: {
      findUnique: async () => (tabla.fila ? { ...tabla.fila } : null),
      upsert: async ({ create, update }: { create: Fila; update: Partial<Fila> }) => {
        tabla.fila = tabla.fila
          ? { ...tabla.fila, ...update, updatedAt: new Date(Date.now() + 1) }
          : { ...create, updatedAt: new Date() }
        return tabla.fila
      },
      update: async ({ data }: { data: Partial<Fila> }) => {
        if (!tabla.fila) throw new Error("no existe")
        tabla.fila = { ...tabla.fila, ...data }
        return tabla.fila
      },
      deleteMany: async () => {
        tabla.fila = null
        return { count: 1 }
      },
    },
  },
}))

const CONTRASENA = "Secreta-Ñ-12345"
const usuario = { id: "u1", nombre: "Admin de prueba" }
let p12: Buffer

beforeAll(() => {
  p12 = generarP12Prueba({ contrasena: CONTRASENA })
}, 60_000)

beforeEach(() => {
  tabla.fila = null
  vi.stubEnv("FIRMA_CLAVE_MAESTRA", "clave-maestra-de-prueba-0123456789abcdef")
  vi.stubEnv("FIRMA_HABILITADA", "")
  vi.stubEnv("FIRMA_P12_PATH", "")
  vi.stubEnv("FIRMA_TSA_URL", "")
})

describe("cifrado", () => {
  it("ida y vuelta, y falla si cambia la clave maestra o se alteran los datos", () => {
    const blob = cifrar(Buffer.from("hola"), "ctx")
    expect(descifrar(blob, "ctx").toString()).toBe("hola")

    const alterado = Buffer.from(blob)
    alterado[alterado.length - 1]! ^= 1
    expect(() => descifrar(alterado, "ctx")).toThrowError(/descifrar/)

    vi.stubEnv("FIRMA_CLAVE_MAESTRA", "otra-clave-maestra-distinta-0123456789")
    expect(() => descifrar(blob, "ctx")).toThrowError(/FIRMA_CLAVE_MAESTRA cambió/)
  })

  it("exige FIRMA_CLAVE_MAESTRA de al menos 32 caracteres", () => {
    vi.stubEnv("FIRMA_CLAVE_MAESTRA", "corta")
    expect(() => cifrar(Buffer.from("x"), "ctx")).toThrowError(/FIRMA_CLAVE_MAESTRA/)
  })
})

describe("certificado guardado", () => {
  it("guarda el .p12 y la contraseña cifrados (nada en claro en la base)", async () => {
    await guardarCertificado({
      p12,
      contrasena: CONTRASENA,
      nombreArchivo: "firma.p12",
      usuario,
    })
    const blob = Buffer.from(tabla.fila!.contenidoCifrado as Uint8Array)
    expect(blob.includes(Buffer.from(CONTRASENA))).toBe(false)
    expect(blob.includes(p12.subarray(0, 64))).toBe(false)
    expect(blob.toString("latin1")).not.toContain(p12.toString("base64").slice(0, 40))
    // Ningún otro campo contiene la contraseña.
    const resto = JSON.stringify({ ...tabla.fila, contenidoCifrado: undefined })
    expect(resto).not.toContain(CONTRASENA)

    const estado = await estadoCertificadoGuardado()
    expect(estado).toMatchObject({
      cargado: true,
      activo: true,
      titular: "FIRMANTE DE PRUEBA ÑANDÚ",
    })
    expect(JSON.stringify(estado)).not.toContain(CONTRASENA)

    const leido = (await leerCertificadoGuardado())!.obtener()
    expect(leido.contrasena).toBe(CONTRASENA)
    expect(leido.p12.equals(p12)).toBe(true)
  })

  it("rechaza una contraseña incorrecta sin tocar lo guardado", async () => {
    await expect(
      guardarCertificado({ p12, contrasena: "mala", nombreArchivo: "x.p12", usuario })
    ).rejects.toMatchObject({ codigo: "CONTRASENA_INCORRECTA" })
    expect(tabla.fila).toBeNull()
  })

  it("rechaza un certificado vencido", async () => {
    const vencido = generarP12Prueba({
      contrasena: CONTRASENA,
      vencido: true,
      conCertificadoCifrado: false,
    })
    await expect(
      guardarCertificado({
        p12: vencido,
        contrasena: CONTRASENA,
        nombreArchivo: "v.p12",
        usuario,
      })
    ).rejects.toMatchObject({ codigo: "CERTIFICADO_VENCIDO" })
  }, 30_000)

  it("firmarPdf usa el certificado guardado y el interruptor activo manda", async () => {
    expect(await firmaHabilitada()).toBe(false) // sin certificado ni FIRMA_HABILITADA
    await guardarCertificado({
      p12,
      contrasena: CONTRASENA,
      nombreArchivo: "firma.p12",
      usuario,
    })
    expect(await firmaHabilitada()).toBe(true)

    const doc = new jsPDF()
    doc.text("Hola", 20, 20)
    const { pdf, firmante } = await firmarPdf(Buffer.from(doc.output("arraybuffer")))
    expect(firmante.nombre).toBe("FIRMANTE DE PRUEBA ÑANDÚ")
    expect(verificarFirmasPdf(pdf)[0]!.valida).toBe(true)

    await activarFirma(false)
    expect(await firmaHabilitada()).toBe(false)
  })
})
