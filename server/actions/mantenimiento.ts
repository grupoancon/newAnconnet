"use server"

import { getCurrentUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db/client"
import { MAX_MENSAJE_MANTENIMIENTO } from "@/lib/mantenimiento/constantes"
import {
  getEstadoMantenimiento,
  huellaMantenimiento,
  type EstadoMantenimiento,
  type ModoMantenimiento,
} from "@/lib/mantenimiento/estado"

// Usada por MantenimientoWatcher para enterarse de un cambio sin recargar: el layout
// del dashboard no se vuelve a renderizar en navegaciones del lado del cliente.
export async function accionHuellaMantenimiento(): Promise<string | null> {
  const usuario = await getCurrentUser()
  if (!usuario) return null
  return huellaMantenimiento(await getEstadoMantenimiento())
}

export async function accionObtenerMantenimiento(): Promise<
  { ok: true; estado: EstadoMantenimiento } | { ok: false; error: string }
> {
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.roles.includes("Administrador")) {
    return { ok: false, error: "No autorizado" }
  }
  return { ok: true, estado: await getEstadoMantenimiento() }
}

export async function accionGuardarMantenimiento(input: {
  activo: boolean
  modo: ModoMantenimiento
  mensaje: string
}): Promise<{ ok: true; estado: EstadoMantenimiento } | { ok: false; error: string }> {
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.roles.includes("Administrador")) {
    return { ok: false, error: "No autorizado" }
  }

  const modo: ModoMantenimiento = input.modo === "bloqueo" ? "bloqueo" : "aviso"
  const mensaje = input.mensaje.trim()
  if (mensaje.length > MAX_MENSAJE_MANTENIMIENTO) {
    return {
      ok: false,
      error: `El mensaje no puede pasar de ${MAX_MENSAJE_MANTENIMIENTO} caracteres.`,
    }
  }

  const datos = {
    activo: input.activo,
    modo,
    mensaje: mensaje || null,
    actualizadoPorId: usuario.id,
    actualizadoPor: usuario.nombre,
  }

  try {
    await prisma.mantenimiento.upsert({
      where: { id: 1 },
      update: datos,
      create: { id: 1, ...datos },
    })
  } catch (error) {
    console.error("[mantenimiento] no se pudo guardar:", error)
    return {
      ok: false,
      error:
        "No se pudo guardar. Verifica que exista la tabla mantenimiento_app (prisma/sql/mantenimiento_app.sql).",
    }
  }

  return { ok: true, estado: await getEstadoMantenimiento() }
}
