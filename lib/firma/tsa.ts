// Cliente RFC 3161 (Time-Stamp Protocol) para obtener el sello de tiempo de la firma
// (nivel PAdES-B-T). Es opcional: solo se usa si FIRMA_TSA_URL está configurada.

import { createHash, randomBytes } from "node:crypto"

import {
  algoritmo,
  booleano,
  entero,
  hijos,
  leer,
  octetos,
  seq,
  valorDe,
  bytesDe,
  oidDe,
} from "./der"
import { OID } from "./cms"
import { FirmaError } from "./errores"

export type OpcionesTsa = {
  url: string
  usuario?: string
  clave?: string
  timeoutMs?: number
}

// Extrae del TimeStampToken el messageImprint y el nonce del TSTInfo para comprobar que
// el sello corresponde a lo que pedimos.
function leerTstInfo(token: Buffer): { hash: Buffer; nonce: Buffer | null } {
  const ci = leer(token)
  const [tipo, explicito] = hijos(token, ci)
  if (!tipo || oidDe(token, tipo) !== OID.signedData || !explicito)
    throw new Error("token")
  const sd = leer(token, explicito.inicioValor)
  const partes = hijos(token, sd)
  const encap = partes[2]!
  const [eType, eContent] = hijos(token, encap)
  if (!eType || oidDe(token, eType) !== OID.tstInfo || !eContent)
    throw new Error("tstinfo")
  const octeto = leer(token, eContent.inicioValor)
  const tst = Buffer.from(valorDe(token, octeto))
  const campos = hijos(tst, leer(tst))
  // TSTInfo: version, policy, messageImprint, serialNumber, genTime, [accuracy], [ordering], [nonce]…
  const imprint = hijos(tst, campos[2]!)
  const hash = Buffer.from(valorDe(tst, imprint[1]!))
  const nonceNodo = campos.slice(5).find((c) => c.tag === 0x02)
  return { hash, nonce: nonceNodo ? Buffer.from(valorDe(tst, nonceNodo)) : null }
}

export async function obtenerSelloTiempo(
  datos: Buffer,
  opciones: OpcionesTsa
): Promise<Buffer> {
  const hash = createHash("sha256").update(datos).digest()
  const nonce = randomBytes(8)
  nonce[0] = (nonce[0]! & 0x7f) | 0x40 // positivo y sin ceros a la izquierda (DER mínimo)
  const solicitud = seq(
    entero(1),
    seq(algoritmo(OID.sha256), octetos(hash)),
    entero(nonce),
    booleano(true) // certReq: que incluya su certificado
  )

  const headers: Record<string, string> = {
    "Content-Type": "application/timestamp-query",
  }
  if (opciones.usuario) {
    headers.Authorization =
      "Basic " +
      Buffer.from(`${opciones.usuario}:${opciones.clave ?? ""}`).toString("base64")
  }

  let respuesta: Response
  try {
    respuesta = await fetch(opciones.url, {
      method: "POST",
      headers,
      body: new Uint8Array(solicitud),
      signal: AbortSignal.timeout(opciones.timeoutMs ?? 15_000),
    })
  } catch {
    throw new FirmaError(
      "TSA_ERROR",
      "No se pudo conectar con el servidor de sello de tiempo."
    )
  }
  if (!respuesta.ok) {
    throw new FirmaError(
      "TSA_ERROR",
      `El servidor de sello de tiempo respondió con error (HTTP ${respuesta.status}).`
    )
  }

  try {
    const cuerpo = Buffer.from(await respuesta.arrayBuffer())
    const resp = leer(cuerpo)
    const [estado, token] = hijos(cuerpo, resp)
    const codigo = valorDe(cuerpo, hijos(cuerpo, estado!)[0]!)
    const status = codigo.readUIntBE(0, codigo.length)
    if (status > 1 || !token) throw new Error(`status ${status}`) // 0 granted, 1 grantedWithMods
    const tokenDer = Buffer.from(bytesDe(cuerpo, token))
    const tst = leerTstInfo(tokenDer)
    if (!tst.hash.equals(hash)) throw new Error("imprint")
    if (tst.nonce && !tst.nonce.equals(nonce)) {
      throw new Error("nonce")
    }
    return tokenDer
  } catch (err) {
    if (err instanceof FirmaError) throw err
    throw new FirmaError(
      "TSA_ERROR",
      "La respuesta del servidor de sello de tiempo no es válida."
    )
  }
}
