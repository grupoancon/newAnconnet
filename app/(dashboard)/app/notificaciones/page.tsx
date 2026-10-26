import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"

import { NotificacionesAppContent } from "./notificaciones-app-content"

export default async function NotificacionesAppPage() {
  // Igual que en la intranet anterior (RoleLayout permissions={[0]}): solo
  // administradores. Cuando se conecte al backend, conviene un permiso propio
  // (ej. "app:notificaciones") en vez del rol.
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!usuario.roles.includes("Administrador")) {
    redirect("/sin-acceso?seccion=Notificaciones de la app")
  }

  return <NotificacionesAppContent />
}
