// Verificación criptográfica de las firmas de un PDF (integridad + firma RSA). Se usa en
// las pruebas y sirve como chequeo rápido; NO valida la confianza de la cadena contra las
// raíces ecuatorianas ni revocación (eso lo hacen FirmaEC y Acrobat).

import { createHash, verify, X509Certificate } from "node:crypto"

import { bytesDe, emisorYSerie, hijos, leer, oidDe, valorDe } from "./der"
import { OID } from "./cms"

export type FirmaVerificada = {
  byteRange: [number, number, number, number]
  subFilter: string | null
  firmante: string | null
  digestCorrecto: boolean
  firmaCorrecta: boolean
  cubreTodoElDocumento: boolean
  tieneSigningCertificateV2: boolean
  tieneSelloTiempo: boolean
  cantidadCertificados: number
  valida: boolean
}

export function verificarFirmasPdf(pdfEntrada: Buffer | Uint8Array): FirmaVerificada[] {
  const pdf = Buffer.from(pdfEntrada)
  const texto = pdf.toString("latin1")
  const resultado: FirmaVerificada[] = []
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    const br = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as [
      number,
      number,
      number,
      number,
    ]
    const [a, b, c, d] = br
    const dic = texto.slice(Math.max(0, m.index - 2048), m.index + 256)
    const sub = /\/SubFilter\s*\/([A-Za-z0-9.]+)/.exec(
      dic.slice(dic.lastIndexOf("/Type"))
    )
    const base: FirmaVerificada = {
      byteRange: br,
      subFilter: sub?.[1] ?? null,
      firmante: null,
      digestCorrecto: false,
      firmaCorrecta: false,
      cubreTodoElDocumento: c + d === pdf.length,
      tieneSigningCertificateV2: false,
      tieneSelloTiempo: false,
      cantidadCertificados: 0,
      valida: false,
    }
    try {
      if (a !== 0 || b <= 0 || c <= b || c + d > pdf.length) throw new Error("byterange")
      const hex = texto.slice(b + 1, c - 1)
      const cms = Buffer.from(hex, "hex")
      const datos = Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)])

      const ci = leer(cms)
      const [tipo, explicito] = hijos(cms, ci)
      if (oidDe(cms, tipo!) !== OID.signedData) throw new Error("no signedData")
      const sd = hijos(cms, leer(cms, explicito!.inicioValor))
      const certsNodo = sd.find((n) => n.tag === 0xa0)
      const certs = certsNodo
        ? hijos(cms, certsNodo).map((n) => Buffer.from(bytesDe(cms, n)))
        : []
      base.cantidadCertificados = certs.length
      const signerInfos = sd[sd.length - 1]!
      const si = hijos(cms, hijos(cms, signerInfos)[0]!)
      const sid = si[1]!
      const [emisorSid, serieSid] = hijos(cms, sid)
      const firmadosNodo = si.find((n) => n.tag === 0xa0)!
      const firmaNodo = si.find((n, i) => n.tag === 0x04 && i > si.indexOf(firmadosNodo))!
      base.tieneSelloTiempo = si.some(
        (n) =>
          n.tag === 0xa1 &&
          hijos(cms, n).some(
            (at) => oidDe(cms, hijos(cms, at)[0]!) === OID.timeStampToken
          )
      )

      const certFirmante = certs.find((der) => {
        const { emisor, serie } = emisorYSerie(der)
        return (
          emisor.equals(bytesDe(cms, emisorSid!)) && serie.equals(valorDe(cms, serieSid!))
        )
      })
      if (!certFirmante) throw new Error("sin cert firmante")
      const x509 = new X509Certificate(certFirmante)
      base.firmante = /CN=([^\n]+)/.exec(x509.subject)?.[1] ?? x509.subject

      let digest: Buffer | null = null
      for (const at of hijos(cms, firmadosNodo)) {
        const [o, vals] = hijos(cms, at)
        const tipoAt = oidDe(cms, o!)
        if (tipoAt === OID.messageDigest)
          digest = Buffer.from(valorDe(cms, hijos(cms, vals!)[0]!))
        if (tipoAt === OID.signingCertificateV2) {
          // El hash del ESSCertIDv2 tiene que ser el del certificado firmante.
          const ess = hijos(cms, hijos(cms, hijos(cms, hijos(cms, vals!)[0]!)[0]!)[0]!)
          const hashNodo = ess.find((n) => n.tag === 0x04)!
          base.tieneSigningCertificateV2 = Buffer.from(valorDe(cms, hashNodo)).equals(
            createHash("sha256").update(certFirmante).digest()
          )
        }
      }
      base.digestCorrecto = Boolean(
        digest?.equals(createHash("sha256").update(datos).digest())
      )

      const setFirmado = Buffer.concat([
        Buffer.from([0x31]),
        bytesDe(cms, firmadosNodo).subarray(1),
      ])
      base.firmaCorrecta = verify(
        "sha256",
        setFirmado,
        x509.publicKey,
        valorDe(cms, firmaNodo)
      )
      base.valida = base.digestCorrecto && base.firmaCorrecta
    } catch {
      base.valida = false
    }
    resultado.push(base)
  }
  return resultado
}
