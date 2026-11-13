// Carga de un certificado de firma electrónica en formato PKCS#12 (.p12 / .pfx).
//
// Los .p12 ecuatorianos (BCE, Security Data, ANF, Uanataca, Consejo de la Judicatura…)
// a veces traen varios certificados: el del firmante, el de cifrado (otra clave) y los
// de las CA intermedias/raíz. Acá se elige automáticamente el que:
//   1. tiene la clave privada correspondiente dentro del .p12,
//   2. no es de una CA,
//   3. tiene keyUsage digitalSignature y/o nonRepudiation (se prefiere nonRepudiation),
// y se arma la cadena hasta la raíz con el resto de certificados del archivo.

import { createPrivateKey, type KeyObject } from "node:crypto"

import forge from "node-forge"

import { FirmaError } from "./errores"

export type InfoCertificado = {
  nombre: string // CN del titular
  identificacion: string | null // serialNumber del subject (cédula/RUC si la CA lo pone)
  emisor: string // CN (u O) de la CA emisora
  serie: string // número de serie en hex
  alias: string | null // friendlyName del .p12
  validoDesde: Date
  validoHasta: Date
  usos: string[]
}

export type CertificadoFirma = {
  clave: KeyObject
  certificado: Buffer // DER del certificado del firmante
  cadena: Buffer[] // DER de las CA (intermedias → raíz), sin el del firmante
  info: InfoCertificado
}

type Bolsa = {
  cert: forge.pki.Certificate
  alias: string | null
  localKeyId: string | null
}

// forge deja los atributos del nombre como "binary string": hay que decodificar según el
// tipo ASN.1 (los certificados ecuatorianos usan UTF8String para nombres con Ñ/tildes).
const attrTexto = (
  cert: forge.pki.Certificate,
  campo: "subject" | "issuer",
  nombre: string
) => {
  const f = cert[campo].getField(nombre) as {
    value?: string
    valueTagClass?: number
  } | null
  if (typeof f?.value !== "string") return null
  const crudo = Buffer.from(f.value, "binary")
  if (f.valueTagClass === forge.asn1.Type.UTF8) return crudo.toString("utf8")
  if (f.valueTagClass === forge.asn1.Type.BMPSTRING)
    return crudo.swap16().toString("utf16le")
  return f.value
}

function usosDe(cert: forge.pki.Certificate): string[] {
  const ku = cert.getExtension("keyUsage") as Record<string, unknown> | undefined
  if (!ku) return []
  return [
    "digitalSignature",
    "nonRepudiation",
    "keyEncipherment",
    "dataEncipherment",
    "keyAgreement",
    "keyCertSign",
    "cRLSign",
  ].filter((u) => ku[u] === true)
}

function esCa(cert: forge.pki.Certificate): boolean {
  const bc = cert.getExtension("basicConstraints") as { cA?: boolean } | undefined
  return bc?.cA === true
}

const derDe = (cert: forge.pki.Certificate) =>
  Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary")

function mismaClave(
  clave: forge.pki.rsa.PrivateKey,
  cert: forge.pki.Certificate
): boolean {
  const pub = cert.publicKey as forge.pki.rsa.PublicKey
  return Boolean(pub?.n && clave.n && pub.n.equals(clave.n))
}

function abrirP12(p12: Buffer, contrasena: string): forge.pkcs12.Pkcs12Pfx {
  let asn1: forge.asn1.Asn1
  try {
    asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.toString("binary")), false)
  } catch {
    throw new FirmaError(
      "CERTIFICADO_INVALIDO",
      "El archivo del certificado no es un PKCS#12 (.p12/.pfx) válido."
    )
  }
  try {
    return forge.pkcs12.pkcs12FromAsn1(asn1, false, contrasena)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : ""
    if (/password|MAC|decrypt|Too few bytes|Unparsed DER/i.test(mensaje)) {
      throw new FirmaError(
        "CONTRASENA_INCORRECTA",
        "La contraseña del certificado de firma es incorrecta."
      )
    }
    // Sin el mensaje original: podría contener datos internos del archivo.
    throw new FirmaError(
      "CERTIFICADO_INVALIDO",
      "No se pudo leer el certificado de firma (formato o algoritmo no soportado)."
    )
  }
}

function formatoFecha(d: Date) {
  return d.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })
}

export function cargarCertificadoP12(
  p12: Buffer,
  contrasena: string,
  ahora: Date = new Date()
): CertificadoFirma {
  const pfx = abrirP12(p12, contrasena)

  const bolsasCert =
    pfx.getBags({ bagType: forge.pki.oids.certBag! })[forge.pki.oids.certBag!] ?? []
  const certs: Bolsa[] = bolsasCert
    .filter((b) => b.cert)
    .map((b) => ({
      cert: b.cert!,
      alias: (b.attributes?.friendlyName?.[0] as string | undefined) ?? null,
      localKeyId: (b.attributes?.localKeyId?.[0] as string | undefined) ?? null,
    }))

  const claves = [
    ...(pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag! })[
      forge.pki.oids.pkcs8ShroudedKeyBag!
    ] ?? []),
    ...(pfx.getBags({ bagType: forge.pki.oids.keyBag! })[forge.pki.oids.keyBag!] ?? []),
  ]
    .map((b) => b.key as forge.pki.rsa.PrivateKey | undefined)
    .filter((k): k is forge.pki.rsa.PrivateKey => Boolean(k))

  if (claves.length === 0) {
    throw new FirmaError(
      "CERTIFICADO_SIN_CLAVE",
      "El certificado no contiene una clave privada RSA utilizable para firmar."
    )
  }

  // Candidatos: certificados con su clave privada en el archivo.
  const candidatos = certs
    .map((b) => ({ ...b, clave: claves.find((k) => mismaClave(k, b.cert)) }))
    .filter((c) => c.clave && !esCa(c.cert))
  if (candidatos.length === 0) {
    throw new FirmaError(
      "CERTIFICADO_SIN_CLAVE",
      "Ningún certificado del archivo corresponde a la clave privada incluida."
    )
  }

  const puntaje = (c: (typeof candidatos)[number]) => {
    const usos = usosDe(c.cert)
    let p = 0
    if (usos.includes("nonRepudiation")) p += 4
    if (usos.includes("digitalSignature")) p += 2
    if (usos.length === 0) p += 1 // sin keyUsage: cualquier uso
    const vigente =
      c.cert.validity.notBefore <= ahora && ahora <= c.cert.validity.notAfter
    if (vigente) p += 8
    return p
  }
  const aptos = candidatos.filter((c) => {
    const usos = usosDe(c.cert)
    return (
      usos.length === 0 ||
      usos.includes("digitalSignature") ||
      usos.includes("nonRepudiation")
    )
  })
  if (aptos.length === 0) {
    throw new FirmaError(
      "CERTIFICADO_INVALIDO",
      "El certificado no tiene el uso de clave 'firma digital / no repudio'."
    )
  }
  const elegido = [...aptos].sort((a, b) => puntaje(b) - puntaje(a))[0]!
  const cert = elegido.cert

  if (ahora < cert.validity.notBefore) {
    throw new FirmaError(
      "CERTIFICADO_NO_VIGENTE",
      `El certificado de firma aún no es válido (vigente desde ${formatoFecha(cert.validity.notBefore)}).`
    )
  }
  if (ahora > cert.validity.notAfter) {
    throw new FirmaError(
      "CERTIFICADO_VENCIDO",
      `El certificado de firma está vencido (venció el ${formatoFecha(cert.validity.notAfter)}).`
    )
  }

  // Cadena: subir por emisor hasta llegar a un autofirmado o quedarse sin certificados.
  const cadena: forge.pki.Certificate[] = []
  let actual = cert
  const usados = new Set<forge.pki.Certificate>([cert])
  for (;;) {
    if (actual.issuer.hash === actual.subject.hash) break
    const padre = certs.find(
      (b) => !usados.has(b.cert) && b.cert.subject.hash === actual.issuer.hash
    )
    if (!padre) break
    cadena.push(padre.cert)
    usados.add(padre.cert)
    actual = padre.cert
  }

  const info: InfoCertificado = {
    nombre: attrTexto(cert, "subject", "CN") ?? "(sin nombre)",
    identificacion: attrTexto(cert, "subject", "serialNumber"),
    emisor:
      attrTexto(cert, "issuer", "CN") ??
      attrTexto(cert, "issuer", "O") ??
      "(desconocido)",
    serie: cert.serialNumber,
    alias: elegido.alias,
    validoDesde: cert.validity.notBefore,
    validoHasta: cert.validity.notAfter,
    usos: usosDe(cert),
  }

  return {
    clave: createPrivateKey(forge.pki.privateKeyToPem(elegido.clave!)),
    certificado: derDe(cert),
    cadena: cadena.map(derDe),
    info,
  }
}
