import { redirect } from "next/navigation"

import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"

import { InventarioContent } from "./inventario-content"

export default async function InventarioPage() {
  // El middleware ya filtro a nivel de ruta; esta verificacion server-side es la que
  // realmente autoriza el contenido de la pagina (igual que admin/usuarios/page.tsx).
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  // "inventario:gestion" (distinto de "inventario:ver", que gatea el catálogo de solo
  // lectura en /ventas/inventario/catalogo) — esta es la pantalla de edición de lotes y
  // proyectos.
  if (!can(usuario, "inventario", "gestion")) {
    redirect("/sin-acceso?seccion=Inventario")
  }

  return <InventarioContent />
}
