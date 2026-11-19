import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { NotificacionesAppContent } from "./notificaciones-app-content"

export default async function NotificacionesAppPage() {
  // Mismo permiso que exige el backend (/app-notificaciones): "app:notificaciones".
  // El API no le da bypass al Administrador, por eso
  // prisma/sql/permiso_app_notificaciones.sql se lo asigna.
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!can(usuario, "app", "notificaciones")) {
    redirect("/sin-acceso?seccion=Notificaciones de la app")
  }

  return <NotificacionesAppContent />
}
