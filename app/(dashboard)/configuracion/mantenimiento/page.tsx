import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { getEstadoMantenimiento } from "@/lib/mantenimiento/estado"

import { MantenimientoContent } from "./mantenimiento-content"

export default async function ConfiguracionMantenimientoPage() {
  // Solo Administrador: es el único rol que sigue entrando con la intranet bloqueada,
  // así que es el único que puede volver a desbloquearla.
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.roles.includes("Administrador")) {
    redirect("/")
  }

  const estado = await getEstadoMantenimiento()
  return <MantenimientoContent estadoInicial={estado} />
}
