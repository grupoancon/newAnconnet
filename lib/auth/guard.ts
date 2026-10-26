import "server-only"

import { redirect } from "next/navigation"

import { can, tienePermisoExplicito } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"
import type { AuthenticatedUser } from "@/types/auth"

// Guard de pagina: una linea al inicio de cualquier page/layout server component.
//
//   export default async function DashboardPage() {
//     const usuario = await requirePermiso("dashboard:all", "Dashboard")
//     ...
//   }
//
// Sin sesion -> /login. Con sesion pero sin el permiso -> /sin-acceso (pantalla de
// "no autorizado" con la seccion nombrada). El rol Administrador pasa siempre y
// "modulo:all" cubre cualquier accion del modulo (via can()).
export async function requirePermiso(
  permiso: `${string}:${string}`,
  seccion?: string
): Promise<AuthenticatedUser> {
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/login")
  }

  const [recurso, accion] = permiso.split(":")
  if (!can(usuario, recurso ?? "", accion ?? "")) {
    redirect(`/sin-acceso?seccion=${encodeURIComponent(seccion ?? permiso)}`)
  }

  return usuario
}

// Variante sin bypass de Administrador: el permiso tiene que estar asignado de verdad
// (rol u override). Ver tienePermisoExplicito.
export async function requirePermisoExplicito(
  permiso: `${string}:${string}`,
  seccion?: string
): Promise<AuthenticatedUser> {
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/login")
  }

  const [recurso, accion] = permiso.split(":")
  if (!tienePermisoExplicito(usuario, recurso ?? "", accion ?? "")) {
    redirect(`/sin-acceso?seccion=${encodeURIComponent(seccion ?? permiso)}`)
  }

  return usuario
}

// Igual que requirePermisoExplicito pero basta con UNO de los permisos listados.
export async function requireAlgunPermisoExplicito(
  permisos: `${string}:${string}`[],
  seccion?: string
): Promise<AuthenticatedUser> {
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/login")
  }

  const autorizado = permisos.some((permiso) => {
    const [recurso, accion] = permiso.split(":")
    return tienePermisoExplicito(usuario, recurso ?? "", accion ?? "")
  })
  if (!autorizado) {
    redirect(`/sin-acceso?seccion=${encodeURIComponent(seccion ?? permisos.join(", "))}`)
  }

  return usuario
}

// Variante sin permiso especifico: solo exige estar autenticado.
export async function requireUsuario(): Promise<AuthenticatedUser> {
  const usuario = await getCurrentUser()
  if (!usuario) {
    redirect("/login")
  }
  return usuario
}

// Variante "cualquiera de estos permisos" — para paginas compartidas entre dos roles
// con permisos distintos (ej. /ventas/procesos/documentos, que ve tanto el asesor con
// "ventas:nueva" como el revisor con "documentos:revisar"). Misma semantica de
// redireccion que requirePermiso, solo que basta con UNO de los permisos listados.
export async function requireAlgunPermiso(
  permisos: `${string}:${string}`[],
  seccion?: string
): Promise<AuthenticatedUser> {
  const usuario = await getCurrentUser()

  if (!usuario) {
    redirect("/login")
  }

  const autorizado = permisos.some((permiso) => {
    const [recurso, accion] = permiso.split(":")
    return can(usuario, recurso ?? "", accion ?? "")
  })
  if (!autorizado) {
    redirect(`/sin-acceso?seccion=${encodeURIComponent(seccion ?? permisos.join(", "))}`)
  }

  return usuario
}
