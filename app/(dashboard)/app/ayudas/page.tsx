import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { AyudasContent } from "./ayudas-content"

export default async function AyudasAppPage() {
  // Permiso propio "app:ayudas": el backend tampoco le da bypass al Administrador
  // (ver prisma/sql/permiso_app_ayudas.sql).
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!can(usuario, "app", "ayudas")) {
    redirect("/sin-acceso?seccion=Videos de ayuda de la app")
  }

  return <AyudasContent />
}
