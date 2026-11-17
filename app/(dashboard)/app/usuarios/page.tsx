import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { UsuariosAppContent } from "./usuarios-app-content"

export default async function UsuariosAppPage() {
  // Mismo permiso que exige el backend (/app-usuarios, /users/force-logout,
  // /users/lote-entregado): "app:usuarios". El API no le da bypass al Administrador,
  // por eso prisma/sql/permiso_app_usuarios.sql se lo asigna.
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!can(usuario, "app", "usuarios")) {
    redirect("/sin-acceso?seccion=Usuarios de la app")
  }

  return <UsuariosAppContent />
}
