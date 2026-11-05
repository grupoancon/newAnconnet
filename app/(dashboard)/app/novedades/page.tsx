import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { NovedadesContent } from "./novedades-content"

export default async function NovedadesAppPage() {
  // Permiso propio "app:novedades": el backend tampoco le da bypass al Administrador
  // (ver prisma/sql/permiso_app_novedades.sql).
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!can(usuario, "app", "novedades")) {
    redirect("/sin-acceso?seccion=Novedades de la app")
  }

  return <NovedadesContent />
}
