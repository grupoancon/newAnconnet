import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { EncuestasAppContent } from "./encuestas-app-content"

export default async function EncuestasAppPage() {
  // Mismo permiso que exige el backend (/app-encuestas): "app:encuestas". El API no
  // le da bypass al Administrador, por eso prisma/sql/permiso_app_encuestas.sql se lo
  // asigna.
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!can(usuario, "app", "encuestas")) {
    redirect("/sin-acceso?seccion=Encuestas de la app")
  }

  return <EncuestasAppContent />
}
