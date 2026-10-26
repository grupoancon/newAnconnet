import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { DiagnosticoAppContent } from "./diagnostico-app-content"

export default async function DiagnosticoAppPage() {
  // Muestra datos de clientes y de sus dispositivos: permiso propio "app:diagnostico"
  // (el Administrador pasa por can(), pero el backend NO le da bypass — también
  // necesita el permiso asignado en /admin/roles para que carguen los datos).
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  if (!can(usuario, "app", "diagnostico")) {
    redirect("/sin-acceso?seccion=Diagnóstico de la app")
  }

  return <DiagnosticoAppContent />
}
