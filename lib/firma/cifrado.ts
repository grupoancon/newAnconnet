// Cifrado en reposo del certificado de firma (.p12 + contraseña) con AES-256-GCM.
//
// La clave maestra sale de FIRMA_CLAVE_MAESTRA (entorno del servidor), NUNCA de la base
// de datos: si estuviera junto a los datos cifrados, quien lea la base (que además se
// comparte con anconAPI) podría descifrar el certificado. Generarla con:
//
//   openssl rand -base64 32
//
// Formato del blob: [1 byte versión][12 bytes IV][16 bytes tag GCM][texto cifrado]

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

import { FirmaError } from "./errores"

const VERSION = 1
const SAL = "anconnet-firma-certificado-v1"
const MIN_LARGO = 32

let cacheClave: { secreto: string; clave: Buffer } | null = null

export function claveMaestraConfigurada(): boolean {
  return (process.env.FIRMA_CLAVE_MAESTRA?.trim().length ?? 0) >= MIN_LARGO
}

function claveMaestra(): Buffer {
  const secreto = process.env.FIRMA_CLAVE_MAESTRA?.trim() ?? ""
  if (secreto.length < MIN_LARGO) {
    throw new FirmaError(
      "CONFIGURACION_INCOMPLETA",
      "Falta FIRMA_CLAVE_MAESTRA en el servidor (mínimo 32 caracteres; genérela con: openssl rand -base64 32)."
    )
  }
  if (cacheClave?.secreto !== secreto) {
    // scrypt: aunque el secreto no sea exactamente 32 bytes aleatorios, la clave AES sí.
    cacheClave = { secreto, clave: scryptSync(secreto, SAL, 32) }
  }
  return cacheClave.clave
}

export function cifrar(datos: Buffer, contexto: string): Buffer {
  const iv = randomBytes(12)
  const cifrador = createCipheriv("aes-256-gcm", claveMaestra(), iv)
  cifrador.setAAD(Buffer.from(contexto, "utf8"))
  const cifrado = Buffer.concat([cifrador.update(datos), cifrador.final()])
  return Buffer.concat([Buffer.from([VERSION]), iv, cifrador.getAuthTag(), cifrado])
}

export function descifrar(blob: Buffer, contexto: string): Buffer {
  if (blob.length < 29 || blob[0] !== VERSION) {
    throw new FirmaError("CERTIFICADO_INVALIDO", "El certificado guardado está dañado.")
  }
  try {
    const descifrador = createDecipheriv(
      "aes-256-gcm",
      claveMaestra(),
      blob.subarray(1, 13)
    )
    descifrador.setAAD(Buffer.from(contexto, "utf8"))
    descifrador.setAuthTag(blob.subarray(13, 29))
    return Buffer.concat([descifrador.update(blob.subarray(29)), descifrador.final()])
  } catch {
    throw new FirmaError(
      "CERTIFICADO_INVALIDO",
      "No se pudo descifrar el certificado guardado: FIRMA_CLAVE_MAESTRA cambió o los datos fueron alterados. Vuelva a subir el certificado."
    )
  }
}
