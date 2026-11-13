// Firma electrónica de PDF con estándar PAdES (ETSI EN 319 142-1) — servicio reutilizable.
//
//   const { pdf } = await firmarPdf(bytesDelPdf)                     // con la config del .env
//   await firmarPdf("entrada.pdf", "salida.pdf", { visible: { pagina: "ultima" } })
//
// Nivel: PAdES-B-B (SHA-256 con RSA, cadena del .p12 incluida). Si FIRMA_TSA_URL está
// configurada se agrega sello de tiempo RFC 3161 → PAdES-B-T.
//
// SEGURIDAD: la ruta del .p12 y su contraseña se leen SOLO de variables de entorno
// (FIRMA_P12_PATH / FIRMA_P12_PASSWORD). La contraseña nunca se registra en logs ni se
// devuelve en errores.

import { readFile, stat, writeFile } from "node:fs/promises"

import { leerCertificadoGuardado } from "./almacen"
import {
  cargarCertificadoP12,
  type CertificadoFirma,
  type InfoCertificado,
} from "./certificado"
import { construirCmsPades } from "./cms"
import { FirmaError } from "./errores"
import { bytesFirmados, insertarFirma, prepararPdf, type PosicionFirma } from "./pdf"
import { obtenerSelloTiempo, type OpcionesTsa } from "./tsa"

export { FirmaError, type CodigoErrorFirma } from "./errores"
export type { InfoCertificado } from "./certificado"
export type { PosicionFirma } from "./pdf"

export type OpcionesFirma = {
  // Certificado. Si no se pasa, se usa FIRMA_P12_PATH / FIRMA_P12_PASSWORD.
  certificado?: { p12: Buffer; contrasena: string } | CertificadoFirma
  razon?: string
  ubicacion?: string
  contacto?: string
  // false = invisible. Un objeto = visible en esa posición (puntos PDF, origen abajo-izq).
  visible?: false | Partial<PosicionFirma>
  // null = sin sello de tiempo aunque haya FIRMA_TSA_URL.
  tsa?: (OpcionesTsa & { obligatoria?: boolean }) | null
  espacioFirma?: number
  fecha?: Date
  textoQr?: string
}

export type ResultadoFirma = {
  pdf: Buffer
  nivel: "PAdES-B-B" | "PAdES-B-T"
  firmante: InfoCertificado
  fecha: Date
}

const ZONA = "America/Guayaquil" // UTC-5 todo el año (sin horario de verano)

function partesFecha(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  ) as Record<string, string>
  return p
}

export function formatearFechas(d: Date) {
  const p = partesFecha(d)
  return {
    pdf: `D:${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}-05'00'`,
    visible: `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second} (GMT-5)`,
    iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-05:00`,
  }
}

// --- Configuración desde el entorno -------------------------------------------------

const verdadero = (v: string | undefined) => /^(1|true|si|sí|yes)$/i.test(v?.trim() ?? "")
const numero = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// Certificado subido desde Configuración (si la tabla todavía no existe o la base no
// responde, se sigue con el de las variables de entorno).
async function certificadoGuardado() {
  try {
    return await leerCertificadoGuardado()
  } catch (err) {
    console.warn(
      `[firma] No se pudo leer el certificado guardado en la base: ${err instanceof Error ? err.message.split("\n")[0] : "error"}`
    )
    return null
  }
}

// Si hay un certificado subido desde Configuración manda su interruptor "activo"; si no,
// FIRMA_HABILITADA del entorno.
export async function firmaHabilitada(): Promise<boolean> {
  const guardado = await certificadoGuardado()
  if (guardado) return guardado.activo
  return verdadero(process.env.FIRMA_HABILITADA)
}

export function opcionesDesdeEntorno(): OpcionesFirma {
  const e = process.env
  const pagina = e.FIRMA_PAGINA?.trim() || "ultima"
  return {
    razon: e.FIRMA_RAZON || undefined,
    ubicacion: e.FIRMA_UBICACION || undefined,
    contacto: e.FIRMA_CONTACTO || undefined,
    visible: verdadero(e.FIRMA_VISIBLE)
      ? {
          pagina: pagina === "primera" || pagina === "ultima" ? pagina : Number(pagina),
          x: numero(e.FIRMA_X),
          y: numero(e.FIRMA_Y),
          ancho: numero(e.FIRMA_ANCHO),
          alto: numero(e.FIRMA_ALTO),
        }
      : false,
    tsa: e.FIRMA_TSA_URL
      ? {
          url: e.FIRMA_TSA_URL,
          usuario: e.FIRMA_TSA_USUARIO || undefined,
          clave: e.FIRMA_TSA_CLAVE || undefined,
          obligatoria: verdadero(e.FIRMA_TSA_OBLIGATORIA),
        }
      : null,
  }
}

// Caché del certificado ya abierto (se invalida si cambia el archivo).
let cache: { clave: string; cert: CertificadoFirma } | null = null

export async function certificadoDesdeEntorno(
  ahora = new Date()
): Promise<CertificadoFirma> {
  const ruta = process.env.FIRMA_P12_PATH?.trim()
  const contrasena = process.env.FIRMA_P12_PASSWORD
  if (!ruta || contrasena === undefined || contrasena === "") {
    throw new FirmaError(
      "CONFIGURACION_INCOMPLETA",
      "Falta configurar FIRMA_P12_PATH y/o FIRMA_P12_PASSWORD en el servidor."
    )
  }
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(ruta)
  } catch {
    throw new FirmaError(
      "CERTIFICADO_NO_ENCONTRADO",
      "No se encontró el archivo del certificado de firma configurado en FIRMA_P12_PATH."
    )
  }
  if (process.platform !== "win32" && (info.mode & 0o077) !== 0) {
    console.warn(
      "[firma] ADVERTENCIA: el archivo .p12 es legible por otros usuarios del sistema. " +
        "Restrinja los permisos con: chmod 600 <archivo>.p12"
    )
  }
  const clave = `${ruta}:${info.mtimeMs}:${info.size}`
  if (cache?.clave === clave) {
    validarVigencia(cache.cert.info, ahora)
    return cache.cert
  }
  const cert = cargarCertificadoP12(await readFile(ruta), contrasena, ahora)
  registrarCertificado(cert.info)
  cache = { clave, cert }
  return cert
}

// Certificado a usar: el subido desde Configuración (cifrado en la base) o, si no hay,
// el de FIRMA_P12_PATH / FIRMA_P12_PASSWORD.
export async function certificadoConfigurado(
  ahora = new Date()
): Promise<CertificadoFirma> {
  const guardado = await certificadoGuardado()
  if (!guardado) return certificadoDesdeEntorno(ahora)
  const clave = `db:${guardado.version}`
  if (cache?.clave === clave) {
    validarVigencia(cache.cert.info, ahora)
    return cache.cert
  }
  const { p12, contrasena } = guardado.obtener()
  const cert = cargarCertificadoP12(p12, contrasena, ahora)
  registrarCertificado(cert.info)
  cache = { clave, cert }
  return cert
}

function validarVigencia(info: InfoCertificado, ahora: Date) {
  if (ahora > info.validoHasta) {
    cache = null
    throw new FirmaError(
      "CERTIFICADO_VENCIDO",
      `El certificado de firma está vencido (venció el ${info.validoHasta.toLocaleDateString("es-EC", { timeZone: ZONA })}).`
    )
  }
}

function registrarCertificado(info: InfoCertificado) {
  console.info(
    `[firma] Certificado seleccionado: CN="${info.nombre}" emisor="${info.emisor}" ` +
      `serie=${info.serie} alias=${info.alias ?? "-"} usos=${info.usos.join(",") || "-"} ` +
      `vence=${info.validoHasta.toISOString()}`
  )
}

// --- Firma ------------------------------------------------------------------------

export async function firmarPdf(
  entrada: Buffer | Uint8Array | string,
  salida?: string | OpcionesFirma,
  opciones: OpcionesFirma = {}
): Promise<ResultadoFirma> {
  if (typeof salida === "object") {
    opciones = salida
    salida = undefined
  }
  const fecha = opciones.fecha ?? new Date()

  let original: Buffer
  if (typeof entrada === "string") {
    try {
      original = await readFile(entrada)
    } catch {
      throw new FirmaError("PDF_CORRUPTO", "No se pudo leer el PDF de entrada.")
    }
  } else {
    original = Buffer.from(entrada)
  }

  let cert: CertificadoFirma
  if (!opciones.certificado) cert = await certificadoConfigurado(fecha)
  else if ("p12" in opciones.certificado) {
    cert = cargarCertificadoP12(
      opciones.certificado.p12,
      opciones.certificado.contrasena,
      fecha
    )
    registrarCertificado(cert.info)
  } else {
    cert = opciones.certificado
    validarVigencia(cert.info, fecha)
  }

  const tsa = opciones.tsa === undefined ? opcionesDesdeEntorno().tsa : opciones.tsa
  const fechas = formatearFechas(fecha)

  const tamCadena = [cert.certificado, ...cert.cadena].reduce((s, c) => s + c.length, 0)
  const espacioFirma =
    opciones.espacioFirma ??
    Math.ceil((tamCadena + 4096 + (tsa ? 16384 : 0)) / 1024) * 1024

  const visible = opciones.visible
    ? {
        posicion: { pagina: "ultima" as const, ...opciones.visible },
        datos: {
          nombre: cert.info.nombre,
          fecha: fechas.visible,
          fechaIso: fechas.iso,
          razon: opciones.razon,
          ubicacion: opciones.ubicacion,
          textoQr: opciones.textoQr,
        },
      }
    : undefined

  const prep = await prepararPdf(original, {
    fechaPdf: fechas.pdf,
    razon: opciones.razon,
    ubicacion: opciones.ubicacion,
    contacto: opciones.contacto,
    espacioFirma,
    visible,
  })

  let conSello = false
  const cms = await construirCmsPades(
    bytesFirmados(prep),
    cert,
    tsa
      ? async (valorFirma) => {
          try {
            const token = await obtenerSelloTiempo(valorFirma, tsa)
            conSello = true
            return token
          } catch (err) {
            if (tsa.obligatoria) throw err
            console.warn(
              `[firma] Sin sello de tiempo (se firma en nivel B-B): ${err instanceof Error ? err.message : "error"}`
            )
            return null
          }
        }
      : undefined
  )

  const pdf = insertarFirma(prep, cms)
  if (typeof salida === "string") await writeFile(salida, pdf)

  console.info(
    `[firma] PDF firmado (${conSello ? "PAdES-B-T" : "PAdES-B-B"}) por "${cert.info.nombre}", ${pdf.length} bytes`
  )
  return { pdf, nivel: conSello ? "PAdES-B-T" : "PAdES-B-B", firmante: cert.info, fecha }
}
