"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/auth/session"
import {
  activarFirma,
  eliminarCertificado,
  estadoCertificadoGuardado,
  guardarCertificado,
  MAX_BYTES_P12,
  type EstadoCertificadoGuardado,
} from "@/lib/firma/almacen"
import { claveMaestraConfigurada } from "@/lib/firma/cifrado"
import { FirmaError } from "@/lib/firma/errores"

type Resultado =
  { ok: true; estado: EstadoCertificadoGuardado } | { ok: false; error: string }

const RUTA = "/configuracion/firma-electronica"

async function soloAdministrador() {
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.roles.includes("Administrador")) return null
  return usuario
}

// Mensaje para la pantalla: los de FirmaError ya son aptos (nunca llevan la contraseña);
// cualquier otro error se reemplaza por uno genérico.
function mensajeDe(err: unknown, porDefecto: string): string {
  if (err instanceof FirmaError) return err.message
  console.error(
    `[firma] ${porDefecto}: ${err instanceof Error ? err.message.split("\n")[0] : ""}`
  )
  return porDefecto
}

export async function accionSubirCertificado(formData: FormData): Promise<Resultado> {
  const usuario = await soloAdministrador()
  if (!usuario) return { ok: false, error: "No autorizado" }
  if (!claveMaestraConfigurada()) {
    return {
      ok: false,
      error:
        "El servidor no tiene FIRMA_CLAVE_MAESTRA configurada; sin ella no se puede guardar el certificado cifrado.",
    }
  }

  const archivo = formData.get("archivo")
  const contrasena = formData.get("contrasena")
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "Seleccione el archivo .p12 o .pfx." }
  }
  if (!/\.(p12|pfx)$/i.test(archivo.name)) {
    return { ok: false, error: "El archivo debe tener extensión .p12 o .pfx." }
  }
  if (archivo.size > MAX_BYTES_P12) {
    return { ok: false, error: "El archivo es demasiado grande (máximo 512 KB)." }
  }
  if (typeof contrasena !== "string" || contrasena === "") {
    return { ok: false, error: "Ingrese la contraseña del certificado." }
  }

  try {
    await guardarCertificado({
      p12: Buffer.from(await archivo.arrayBuffer()),
      contrasena,
      nombreArchivo: archivo.name,
      usuario: { id: usuario.id, nombre: usuario.nombre ?? usuario.email },
    })
    revalidatePath(RUTA)
    return { ok: true, estado: await estadoCertificadoGuardado() }
  } catch (err) {
    return { ok: false, error: mensajeDe(err, "No se pudo guardar el certificado.") }
  }
}

export async function accionActivarFirma(activo: boolean): Promise<Resultado> {
  const usuario = await soloAdministrador()
  if (!usuario) return { ok: false, error: "No autorizado" }
  try {
    await activarFirma(activo)
    console.info(
      `[firma] Firma automática ${activo ? "activada" : "desactivada"} por ${usuario.nombre ?? usuario.email}`
    )
    revalidatePath(RUTA)
    return { ok: true, estado: await estadoCertificadoGuardado() }
  } catch (err) {
    return {
      ok: false,
      error: mensajeDe(err, "No se pudo cambiar el estado de la firma."),
    }
  }
}

export async function accionEliminarCertificado(): Promise<Resultado> {
  const usuario = await soloAdministrador()
  if (!usuario) return { ok: false, error: "No autorizado" }
  try {
    await eliminarCertificado({ id: usuario.id, nombre: usuario.nombre ?? usuario.email })
    revalidatePath(RUTA)
    return { ok: true, estado: await estadoCertificadoGuardado() }
  } catch (err) {
    return { ok: false, error: mensajeDe(err, "No se pudo eliminar el certificado.") }
  }
}
