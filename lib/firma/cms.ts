// Estructura CMS SignedData "detached" con perfil CAdES-BES, que es lo que PAdES
// (SubFilter /ETSI.CAdES.detached) mete en /Contents de la firma del PDF.
//
// Atributos firmados (ETSI EN 319 122-1, nivel B-B):
//   - content-type            = id-data
//   - message-digest          = SHA-256 de los bytes cubiertos por /ByteRange
//   - signing-certificate-v2  = SHA-256 del certificado del firmante + emisor/serie
// PAdES NO permite el atributo signing-time: la hora va en /M del diccionario de firma.
// Para nivel B-T se agrega, como atributo NO firmado, el sello de tiempo (RFC 3161)
// sobre el valor de la firma.

import { createHash, sign } from "node:crypto"

import {
  algoritmo,
  contexto,
  emisorYSerie,
  entero,
  octetos,
  oid,
  seq,
  setDe,
  tlv,
} from "./der"
import type { CertificadoFirma } from "./certificado"

export const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  sha256: "2.16.840.1.101.3.4.2.1",
  rsaEncryption: "1.2.840.113549.1.1.1",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
  timeStampToken: "1.2.840.113549.1.9.16.2.14",
  tstInfo: "1.2.840.113549.1.9.16.1.4",
} as const

const sha256 = (datos: Buffer) => createHash("sha256").update(datos).digest()

const atributo = (tipo: string, ...valores: Buffer[]) => seq(oid(tipo), setDe(...valores))

export type ObtenerSello = (valorFirma: Buffer) => Promise<Buffer | null>

export async function construirCmsPades(
  datosFirmados: Buffer,
  cert: CertificadoFirma,
  obtenerSello?: ObtenerSello
): Promise<Buffer> {
  const { emisor, serie } = emisorYSerie(cert.certificado)

  // IssuerSerial de ESSCertIDv2: GeneralNames { [4] directoryName Name }.
  const issuerSerial = seq(seq(contexto(4, emisor)), entero(serie))
  const essCertIdV2 = seq(octetos(sha256(cert.certificado)), issuerSerial) // hash por defecto: SHA-256

  const atributosFirmados = [
    atributo(OID.contentType, oid(OID.data)),
    atributo(OID.messageDigest, octetos(sha256(datosFirmados))),
    atributo(OID.signingCertificateV2, seq(seq(essCertIdV2))),
  ]
  // Se firma la codificación DER como SET (tag 0x31)…
  const setFirmado = setDe(...atributosFirmados)
  const valorFirma = sign("sha256", setFirmado, cert.clave) // RSA PKCS#1 v1.5

  // …y en el SignerInfo va como [0] IMPLICIT (mismo contenido, tag 0xA0).
  const signedAttrs = Buffer.concat([Buffer.from([0xa0]), setFirmado.subarray(1)])

  const partesSigner: Buffer[] = [
    entero(1),
    seq(emisor, entero(serie)), // IssuerAndSerialNumber
    algoritmo(OID.sha256),
    signedAttrs,
    algoritmo(OID.rsaEncryption),
    octetos(valorFirma),
  ]

  if (obtenerSello) {
    const token = await obtenerSello(valorFirma)
    if (token) {
      const noFirmados = setDe(atributo(OID.timeStampToken, token))
      partesSigner.push(Buffer.concat([Buffer.from([0xa1]), noFirmados.subarray(1)]))
    }
  }

  const signerInfo = seq(...partesSigner)

  const certificados = tlv(0xa0, Buffer.concat([cert.certificado, ...cert.cadena]))

  const signedData = seq(
    entero(1),
    setDe(algoritmo(OID.sha256)),
    seq(oid(OID.data)), // detached: sin eContent
    certificados,
    setDe(signerInfo)
  )

  return seq(oid(OID.signedData), contexto(0, signedData))
}
