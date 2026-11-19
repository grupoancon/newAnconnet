import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { SesionesContent } from "./sesiones-content"

export default async function SesionesAppPage() {
  // Muestra datos de clientes y sus dispositivos: mismo permiso que Diagnóstico
  // ("app:diagnostico"; el backend no le da bypass al Administrador).
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!can(usuario, "app", "diagnostico")) {
    redirect("/sin-acceso?seccion=Sesiones de la app")
  }

  return <SesionesContent />
}
