import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"

import { UsuariosAppContent } from "./usuarios-app-content"

export default async function UsuariosAppPage() {
  // Igual que en la intranet anterior (RoleLayout permissions={[0]}): solo
  // administradores. Cuando se conecte al backend, conviene un permiso propio
  // (ej. "app:usuarios") en vez del rol.
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!usuario.roles.includes("Administrador")) {
    redirect("/sin-acceso?seccion=Usuarios de la app")
  }

  return <UsuariosAppContent />
}
