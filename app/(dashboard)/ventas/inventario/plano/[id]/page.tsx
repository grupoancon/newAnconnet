import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { PlanoEditorContent } from "./plano-editor-content"

export default async function PlanoProyectoPage({ params }: { params: { id: string } }) {
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  // Mismo permiso que gatea "Editar proyecto" en Gestión inventario — mapear lotes en
  // el plano es parte de esa misma edición.
  if (!can(usuario, "proyectos", "gestion")) {
    redirect("/sin-acceso?seccion=Inventario")
  }

  return <PlanoEditorContent idProyecto={+params.id} />
}
