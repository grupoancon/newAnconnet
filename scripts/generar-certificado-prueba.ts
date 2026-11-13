// Genera un certificado .p12 de PRUEBA (autofirmado por una CA de prueba) para probar la
// firma electrónica sin usar un certificado real. NUNCA usar en producción.
//
//   npx tsx scripts/generar-certificado-prueba.ts [salida.p12] [contraseña]
//
// Por defecto escribe ./certificados-firma/prueba.p12 (carpeta ignorada por git) con la
// contraseña "prueba123". Imita la estructura de un .p12 ecuatoriano: CA raíz + CA
// intermedia + certificado de firma (digitalSignature/nonRepudiation) + un segundo
// certificado SOLO de cifrado con otra clave, para probar la selección automática.

import { generateKeyPairSync } from "node:crypto"
import { chmod, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import forge from "node-forge"

type Par = { privateKey: forge.pki.rsa.PrivateKey; publicKey: forge.pki.rsa.PublicKey }

function parRsa(bits = 2048): Par {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: bits })
  const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString()
  const priv = forge.pki.privateKeyFromPem(pem) as forge.pki.rsa.PrivateKey
  return { privateKey: priv, publicKey: forge.pki.setRsaPublicKey(priv.n, priv.e) }
}

let serie = 1
function emitir(opts: {
  sujeto: forge.pki.CertificateField[]
  par: Par
  emisor?: { cert: forge.pki.Certificate; par: Par }
  ca?: boolean
  usos: Record<string, boolean>
  desde?: Date
  hasta?: Date
}): forge.pki.Certificate {
  const cert = forge.pki.createCertificate()
  cert.publicKey = opts.par.publicKey
  cert.serialNumber = (0x10000 + serie++).toString(16)
  cert.validity.notBefore = opts.desde ?? new Date(Date.now() - 24 * 3600_000)
  cert.validity.notAfter = opts.hasta ?? new Date(Date.now() + 2 * 365 * 24 * 3600_000)
  cert.setSubject(opts.sujeto)
  cert.setIssuer(opts.emisor ? opts.emisor.cert.subject.attributes : opts.sujeto)
  cert.setExtensions([
    { name: "basicConstraints", cA: Boolean(opts.ca), critical: true },
    { name: "keyUsage", critical: true, ...opts.usos },
    { name: "subjectKeyIdentifier" },
  ])
  cert.sign(opts.emisor?.par.privateKey ?? opts.par.privateKey, forge.md.sha256.create())
  return cert
}

export type OpcionesPrueba = {
  contrasena?: string
  nombre?: string
  vencido?: boolean
  conCertificadoCifrado?: boolean
}

export function generarP12Prueba(op: OpcionesPrueba = {}): Buffer {
  const contrasena = op.contrasena ?? "prueba123"
  const parRaiz = parRsa()
  const raiz = emitir({
    sujeto: [
      { shortName: "C", value: "EC" },
      { shortName: "O", value: "ENTIDAD DE CERTIFICACION DE PRUEBA" },
      { shortName: "CN", value: "AC RAIZ DE PRUEBA (NO VALIDA)" },
    ],
    par: parRaiz,
    ca: true,
    usos: { keyCertSign: true, cRLSign: true },
  })
  const parSub = parRsa()
  const sub = emitir({
    sujeto: [
      { shortName: "C", value: "EC" },
      { shortName: "O", value: "ENTIDAD DE CERTIFICACION DE PRUEBA" },
      { shortName: "CN", value: "AC SUBORDINADA DE PRUEBA (NO VALIDA)" },
    ],
    par: parSub,
    emisor: { cert: raiz, par: parRaiz },
    ca: true,
    usos: { keyCertSign: true, cRLSign: true },
  })
  const parFirma = parRsa()
  const ahora = Date.now()
  const firma = emitir({
    sujeto: [
      { shortName: "C", value: "EC" },
      { shortName: "L", value: "QUITO" },
      { name: "serialNumber", value: "0000000000" },
      {
        shortName: "CN",
        // UTF8String, como los certificados reales con tildes/ñ.
        value: op.nombre ?? "FIRMANTE DE PRUEBA ÑANDÚ",
        valueTagClass: forge.asn1.Type.UTF8 as unknown as forge.asn1.Class,
      },
    ],
    par: parFirma,
    emisor: { cert: sub, par: parSub },
    usos: { digitalSignature: true, nonRepudiation: true },
    ...(op.vencido
      ? {
          desde: new Date(ahora - 3 * 365 * 24 * 3600_000),
          hasta: new Date(ahora - 24 * 3600_000),
        }
      : {}),
  })

  const certs = [firma, sub, raiz]
  let claves: forge.pki.rsa.PrivateKey[] = [parFirma.privateKey]
  if (op.conCertificadoCifrado ?? true) {
    const parCifrado = parRsa()
    const cifrado = emitir({
      sujeto: [
        { shortName: "C", value: "EC" },
        { shortName: "CN", value: "FIRMANTE DE PRUEBA (CIFRADO)" },
      ],
      par: parCifrado,
      emisor: { cert: sub, par: parSub },
      usos: { keyEncipherment: true, dataEncipherment: true },
    })
    // El de cifrado va PRIMERO a propósito: la selección no debe depender del orden.
    certs.unshift(cifrado)
    claves = [parCifrado.privateKey, ...claves]
  }

  if (claves.length === 1) {
    const pfx = forge.pkcs12.toPkcs12Asn1(claves[0]!, certs, contrasena, {
      algorithm: "3des",
      friendlyName: "firma",
    })
    return Buffer.from(forge.asn1.toDer(pfx).getBytes(), "binary")
  }
  return combinarP12(claves, certs, contrasena)
}

// Arma un PFX con varias claves: forge.pkcs12.toPkcs12Asn1 solo admite una, así que se
// toman los SafeContents de cada PFX generado y se juntan en un AuthenticatedSafe nuevo.
function combinarP12(
  claves: forge.pki.rsa.PrivateKey[],
  certs: forge.pki.Certificate[],
  contrasena: string
): Buffer {
  const asn1 = forge.asn1
  const safes: forge.asn1.Asn1[] = []
  claves.forEach((k, i) => {
    const pfx = forge.pkcs12.toPkcs12Asn1(
      k,
      i === 0 ? [certs[0]!] : certs.slice(1),
      contrasena,
      {
        algorithm: "3des",
        friendlyName: i === 0 ? "cifrado" : "firma",
        useMac: false,
      }
    ) as forge.asn1.Asn1
    // PFX → authSafe ContentInfo → [0] → OCTET STRING → AuthenticatedSafe (SEQ de ContentInfo)
    const authSafe = (pfx.value as forge.asn1.Asn1[])[1]!
    const octetos = (
      (authSafe.value as forge.asn1.Asn1[])[1]!.value as forge.asn1.Asn1[]
    )[0]!
    const contenido = asn1.fromDer(octetos.value as string)
    safes.push(...(contenido.value as forge.asn1.Asn1[]))
  })
  const authSafeDer = asn1
    .toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, safes))
    .getBytes()

  // MAC (HMAC-SHA1, como forge y la mayoría de .p12).
  const salt = forge.random.getBytesSync(8)
  const iter = 2048
  const clave = forge.pkcs12.generateKey(
    contrasena,
    forge.util.createBuffer(salt),
    3,
    iter,
    20
  )
  const hmac = forge.hmac.create()
  hmac.start("sha1", clave)
  hmac.update(authSafeDer)
  const mac = hmac.getMac().getBytes()

  const pfx = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(
      asn1.Class.UNIVERSAL,
      asn1.Type.INTEGER,
      false,
      asn1.integerToDer(3).getBytes()
    ),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        asn1.oidToDer(forge.pki.oids.data!).getBytes()
      ),
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, authSafeDer),
      ]),
    ]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          asn1.create(
            asn1.Class.UNIVERSAL,
            asn1.Type.OID,
            false,
            asn1.oidToDer(forge.pki.oids.sha1!).getBytes()
          ),
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""),
        ]),
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, mac),
      ]),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, salt),
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.INTEGER,
        false,
        asn1.integerToDer(iter).getBytes()
      ),
    ]),
  ])
  return Buffer.from(asn1.toDer(pfx).getBytes(), "binary")
}

async function main() {
  const salida = path.resolve(process.argv[2] ?? "certificados-firma/prueba.p12")
  const contrasena = process.argv[3] ?? "prueba123"
  await mkdir(path.dirname(salida), { recursive: true })
  await writeFile(salida, generarP12Prueba({ contrasena }))
  await chmod(salida, 0o600)
  console.log(`Certificado de PRUEBA generado en ${salida} (permisos 600).`)
  console.log(
    "No es válido legalmente; FirmaEC/Acrobat lo mostrarán como 'no confiable'."
  )
}

if (process.argv[1] && /generar-certificado-prueba/.test(process.argv[1])) {
  void main()
}
