import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { UsuariosContent } from "./usuarios-content"

export default async function AdminUsuariosPage() {
  // El middleware ya filtro a nivel de ruta; esta verificacion server-side es la que
  // realmente autoriza el contenido de la pagina. Entra tanto el rol Administrador
  // (acceso total) como quien tenga el permiso puntual "admin:user" sin ser admin.
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!usuario.roles.includes("Administrador") && !can(usuario, "admin", "user")) {
    redirect("/sin-acceso?seccion=Usuarios")
  }

  return <UsuariosContent />
}
