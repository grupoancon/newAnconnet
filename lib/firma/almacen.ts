// Certificado de firma subido desde Configuración → Firma electrónica.
//
// Se guarda en la tabla firma_certificado_app (una sola fila, id = 1). El .p12 y su
// contraseña van JUNTOS dentro de un único blob cifrado con AES-256-GCM (ver cifrado.ts);
// en claro solo quedan los datos públicos del certificado (titular, emisor, vigencia)
// para mostrarlos en pantalla. La contraseña nunca se devuelve al navegador.

import { cargarCertificadoP12, type InfoCertificado } from "./certificado"
import { cifrar, descifrar } from "./cifrado"
import { FirmaError } from "./errores"

const CONTEXTO = "firma_certificado_app:1"
export const MAX_BYTES_P12 = 512 * 1024

export type EstadoCertificadoGuardado = {
  cargado: boolean
  activo: boolean
  titular: string | null
  identificacion: string | null
  emisor: string | null
  serie: string | null
  validoDesde: string | null
  validoHasta: string | null
  nombreArchivo: string | null
  subidoPor: string | null
  actualizadoEn: string | null
}

// Import diferido: así lib/firma se puede usar (pruebas, comando por lote) sin Prisma.
async function db() {
  const { prisma } = await import("@/lib/db/client")
  return prisma
}

export async function estadoCertificadoGuardado(): Promise<EstadoCertificadoGuardado> {
  const fila = await (
    await db()
  ).firmaCertificado.findUnique({
    where: { id: 1 },
    select: {
      activo: true,
      titular: true,
      identificacion: true,
      emisor: true,
      serie: true,
      validoDesde: true,
      validoHasta: true,
      nombreArchivo: true,
      subidoPor: true,
      updatedAt: true,
      contenidoCifrado: false,
    },
  })
  return {
    cargado: Boolean(fila?.titular),
    activo: fila?.activo ?? false,
    titular: fila?.titular ?? null,
    identificacion: fila?.identificacion ?? null,
    emisor: fila?.emisor ?? null,
    serie: fila?.serie ?? null,
    validoDesde: fila?.validoDesde?.toISOString() ?? null,
    validoHasta: fila?.validoHasta?.toISOString() ?? null,
    nombreArchivo: fila?.nombreArchivo ?? null,
    subidoPor: fila?.subidoPor ?? null,
    actualizadoEn: fila?.updatedAt?.toISOString() ?? null,
  }
}

// Valida el .p12 con su contraseña (abre, elige certificado, revisa vigencia) y recién
// entonces lo guarda cifrado. Si algo falla no se toca lo que ya estaba guardado.
export async function guardarCertificado(entrada: {
  p12: Buffer
  contrasena: string
  nombreArchivo: string
  usuario: { id: string; nombre: string }
}): Promise<InfoCertificado> {
  if (entrada.p12.length === 0 || entrada.p12.length > MAX_BYTES_P12) {
    throw new FirmaError(
      "CERTIFICADO_INVALIDO",
      "El archivo debe ser un .p12/.pfx de hasta 512 KB."
    )
  }
  if (!entrada.contrasena) {
    throw new FirmaError(
      "CONTRASENA_INCORRECTA",
      "Ingrese la contraseña del certificado."
    )
  }
  const { info } = cargarCertificadoP12(entrada.p12, entrada.contrasena)

  const secreto = Buffer.from(
    JSON.stringify({
      p12: entrada.p12.toString("base64"),
      contrasena: entrada.contrasena,
    }),
    "utf8"
  )
  const contenidoCifrado = cifrar(secreto, CONTEXTO)
  secreto.fill(0)

  const datos = {
    contenidoCifrado: new Uint8Array(contenidoCifrado),
    titular: info.nombre.slice(0, 191),
    identificacion: info.identificacion?.slice(0, 64) ?? null,
    emisor: info.emisor.slice(0, 191),
    serie: info.serie.slice(0, 128),
    validoDesde: info.validoDesde,
    validoHasta: info.validoHasta,
    nombreArchivo: entrada.nombreArchivo.slice(0, 191),
    subidoPorId: entrada.usuario.id,
    subidoPor: entrada.usuario.nombre.slice(0, 191),
  }
  await (
    await db()
  ).firmaCertificado.upsert({
    where: { id: 1 },
    create: { id: 1, activo: true, ...datos },
    update: datos,
  })
  console.info(
    `[firma] Certificado de firma reemplazado por ${entrada.usuario.nombre} (${entrada.usuario.id}): ` +
      `CN="${info.nombre}" serie=${info.serie}`
  )
  return info
}

export async function activarFirma(activo: boolean): Promise<void> {
  await (await db()).firmaCertificado.update({ where: { id: 1 }, data: { activo } })
}

export async function eliminarCertificado(usuario: { id: string; nombre: string }) {
  await (await db()).firmaCertificado.deleteMany({ where: { id: 1 } })
  console.info(
    `[firma] Certificado de firma eliminado por ${usuario.nombre} (${usuario.id})`
  )
}

// Para firmar: devuelve el .p12 y la contraseña descifrados, o null si no hay ninguno
// guardado. `version` cambia cada vez que se sube otro certificado (sirve de caché).
export async function leerCertificadoGuardado(): Promise<{
  activo: boolean
  version: string
  obtener: () => { p12: Buffer; contrasena: string }
} | null> {
  const fila = await (
    await db()
  ).firmaCertificado.findUnique({
    where: { id: 1 },
    select: { activo: true, contenidoCifrado: true, updatedAt: true },
  })
  if (!fila?.contenidoCifrado) return null
  const blob = Buffer.from(fila.contenidoCifrado)
  return {
    activo: fila.activo,
    version: fila.updatedAt.toISOString(),
    obtener: () => {
      const claro = descifrar(blob, CONTEXTO)
      try {
        const { p12, contrasena } = JSON.parse(claro.toString("utf8")) as {
          p12: string
          contrasena: string
        }
        return { p12: Buffer.from(p12, "base64"), contrasena }
      } finally {
        claro.fill(0)
      }
    },
  }
}
