import "server-only"

import { prisma } from "@/lib/db/client"

export type ModoMantenimiento = "aviso" | "bloqueo"

export type EstadoMantenimiento = {
  activo: boolean
  modo: ModoMantenimiento
  mensaje: string
  actualizadoPor: string | null
  actualizadoEn: string | null
}

const ESTADO_INACTIVO: EstadoMantenimiento = {
  activo: false,
  modo: "aviso",
  mensaje: "",
  actualizadoPor: null,
  actualizadoEn: null,
}

// Se consulta en cada render del layout del dashboard. Si la tabla todavía no existe
// (o la BD falla) se asume "sin mantenimiento": un error acá no puede tirar abajo
// toda la intranet.
export async function getEstadoMantenimiento(): Promise<EstadoMantenimiento> {
  try {
    const fila = await prisma.mantenimiento.findUnique({ where: { id: 1 } })
    if (!fila) return ESTADO_INACTIVO
    return {
      activo: fila.activo,
      modo: fila.modo === "bloqueo" ? "bloqueo" : "aviso",
      mensaje: fila.mensaje?.trim() ?? "",
      actualizadoPor: fila.actualizadoPor,
      actualizadoEn: fila.updatedAt.toISOString(),
    }
  } catch (error) {
    console.error("[mantenimiento] no se pudo leer mantenimiento_app:", error)
    return ESTADO_INACTIVO
  }
}

// Huella para que el cliente detecte un cambio sin comparar campo por campo.
export function huellaMantenimiento(estado: EstadoMantenimiento): string {
  return estado.activo ? `${estado.modo}|${estado.mensaje}` : "inactivo"
}
