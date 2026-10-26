import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { requireUsuario } from "@/lib/auth/guard"

import { AdministrarReportesContent } from "./administrar-content"

export default async function AdministrarReportesPage() {
  const usuario = await requireUsuario()

  // Rol Administrador o permiso puntual "reportes:administrar". El backend vuelve a
  // exigirlo en cada operación; esto solo evita mostrar una pantalla que va a fallar.
  if (!can(usuario, "reportes", "administrar")) {
    redirect("/sin-acceso?seccion=Administrar%20reportes")
  }

  return <AdministrarReportesContent />
}
