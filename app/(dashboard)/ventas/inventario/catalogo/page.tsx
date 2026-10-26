import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { InventarioCatalogoContent } from "./catalogo-content"

export default async function InventarioCatalogoPage() {
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  // "inventario:ver" (distinto de "inventario:gestion", que gatea la edición en
  // "Gestión inventario") — así se le puede dar a un rol acceso a este catálogo de solo
  // lectura sin darle también la pantalla de edición.
  if (!can(usuario, "inventario", "ver")) {
    redirect("/sin-acceso?seccion=Inventario")
  }

  return <InventarioCatalogoContent />
}
