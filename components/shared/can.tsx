"use client"

import { useSession } from "@/components/shared/session-provider"
import { can, tienePermisoExplicito } from "@/lib/auth/rbac"

// Formato "modulo:accion", ej. "dashboard:all", "ventas:crear".
export type Permiso = `${string}:${string}`

// Hook para logica condicional en componentes cliente (deshabilitar botones, ocultar
// columnas, etc.): const puedeVer = useCan("dashboard:all")
//
// Con `explicito` no aplica el bypass del rol Administrador (ver tienePermisoExplicito).
export function useCan(permiso: Permiso, explicito = false): boolean {
  const usuario = useSession()
  const [recurso, accion] = permiso.split(":")
  return explicito
    ? tienePermisoExplicito(usuario, recurso ?? "", accion ?? "")
    : can(usuario, recurso ?? "", accion ?? "")
}

type CanProps = {
  permiso: Permiso
  children: React.ReactNode
  fallback?: React.ReactNode
  explicito?: boolean
}

// Renderiza children solo si el usuario logeado tiene el permiso (respeta el wildcard
// "modulo:all" y el bypass del rol Administrador, via can()). Solo oculta UI: la
// verificacion que realmente importa se hace siempre en servidor (requirePermiso /
// assertCan) — esto es UX, no seguridad.
export function Can({ permiso, children, fallback = null, explicito = false }: CanProps) {
  const autorizado = useCan(permiso, explicito)
  return autorizado ? <>{children}</> : <>{fallback}</>
}
