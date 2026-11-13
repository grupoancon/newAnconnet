// Codificador / lector DER mínimo para armar la estructura CMS (CAdES) de la firma.
//
// Se hace a mano —en vez de usar el PKCS#7 de node-forge— porque PAdES exige atributos
// que forge no arma (signing-certificate-v2, sello de tiempo en los atributos no
// firmados) y porque necesitamos control byte a byte de lo que se firma.

import forge from "node-forge"

function longitud(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n])
  const bytes: number[] = []
  let resto = n
  while (resto > 0) {
    bytes.unshift(resto & 0xff)
    resto = Math.floor(resto / 256)
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

export function tlv(tag: number, contenido: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), longitud(contenido.length), contenido])
}

export const seq = (...partes: Buffer[]) => tlv(0x30, Buffer.concat(partes))

// SET OF en DER: los elementos van ordenados por su codificación.
export function setDe(...partes: Buffer[]): Buffer {
  const ordenadas = [...partes].sort(Buffer.compare)
  return tlv(0x31, Buffer.concat(ordenadas))
}

export const nulo = () => Buffer.from([0x05, 0x00])

export const octetos = (datos: Buffer) => tlv(0x04, datos)

export function oid(valor: string): Buffer {
  return tlv(0x06, Buffer.from(forge.asn1.oidToDer(valor).getBytes(), "binary"))
}

export function entero(valor: number | Buffer): Buffer {
  let bytes: Buffer
  if (typeof valor === "number") {
    const hex = valor.toString(16)
    bytes = Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex")
  } else {
    bytes = valor
  }
  // Entero positivo: si el bit alto está prendido hay que anteponer 0x00.
  if (bytes[0]! & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes])
  return tlv(0x02, bytes)
}

export const booleano = (v: boolean) => Buffer.from([0x01, 0x01, v ? 0xff : 0x00])

// [n] EXPLICIT / IMPLICIT construido.
export const contexto = (n: number, contenido: Buffer) => tlv(0xa0 + n, contenido)

export const algoritmo = (o: string, conNulo = true) =>
  conNulo ? seq(oid(o), nulo()) : seq(oid(o))

// --- Lectura ------------------------------------------------------------------------

export type Nodo = {
  tag: number
  inicio: number // offset del tag
  inicioValor: number
  fin: number // offset exclusivo
}

export function leer(buf: Buffer, offset = 0): Nodo {
  if (offset + 2 > buf.length) throw new Error("DER truncado")
  const tag = buf[offset]!
  let largo = buf[offset + 1]!
  let pos = offset + 2
  if (largo & 0x80) {
    const n = largo & 0x7f
    if (n === 0 || n > 4) throw new Error("Longitud DER no soportada")
    largo = 0
    for (let i = 0; i < n; i++) largo = largo * 256 + buf[pos + i]!
    pos += n
  }
  const fin = pos + largo
  if (fin > buf.length) throw new Error("DER truncado")
  return { tag, inicio: offset, inicioValor: pos, fin }
}

export function hijos(buf: Buffer, nodo: Nodo): Nodo[] {
  const lista: Nodo[] = []
  let pos = nodo.inicioValor
  while (pos < nodo.fin) {
    const h = leer(buf, pos)
    lista.push(h)
    pos = h.fin
  }
  return lista
}

export const bytesDe = (buf: Buffer, nodo: Nodo) => buf.subarray(nodo.inicio, nodo.fin)
export const valorDe = (buf: Buffer, nodo: Nodo) =>
  buf.subarray(nodo.inicioValor, nodo.fin)

export function oidDe(buf: Buffer, nodo: Nodo): string {
  return forge.asn1.derToOid(
    forge.util.createBuffer(valorDe(buf, nodo).toString("binary"))
  )
}

// Emisor y número de serie (bytes DER originales) de un certificado X.509.
export function emisorYSerie(certDer: Buffer): { emisor: Buffer; serie: Buffer } {
  const cert = leer(certDer)
  const tbs = hijos(certDer, leer(certDer, cert.inicioValor))
  let i = 0
  if (tbs[0]!.tag === 0xa0) i = 1 // [0] version
  const serie = tbs[i]!
  const emisor = tbs[i + 2]!
  return { emisor: bytesDe(certDer, emisor), serie: valorDe(certDer, serie) }
}
