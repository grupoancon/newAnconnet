"use server"

import { getCurrentUser } from "@/lib/auth/session"
import {
  contarPermisosEfectivosPorUsuario,
  crearPermiso,
  crearRol,
  eliminarPermiso,
  eliminarRol,
  getOverridesDeUsuario,
  getRolesDeUsuario,
  listarPermisos,
  listarRoles,
  renombrarRol,
  setOverridePermiso,
  setPermisosDeRol,
  setRolesDeUsuario,
  type ModoOverride,
  type OverrideRow,
  type PermisoRow,
  type RolRow,
} from "@/lib/rbac/service"

// Todas las acciones de gestión RBAC exigen ser Administrador. La verificación es
// server-side (no confía en la UI) — el rol viene de la sesión real de Better Auth.
async function assertAdmin(): Promise<void> {
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.roles.includes("Administrador")) {
    throw new Error("No autorizado")
  }
}

type Resultado = { ok: true } | { ok: false; error: string }

async function ejecutar(fn: () => Promise<void>): Promise<Resultado> {
  try {
    await assertAdmin()
    await fn()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" }
  }
}

export async function accionListarDatos(): Promise<
  { ok: true; roles: RolRow[]; permisos: PermisoRow[] } | { ok: false; error: string }
> {
  try {
    await assertAdmin()
    const [roles, permisos] = await Promise.all([listarRoles(), listarPermisos()])
    return { ok: true, roles, permisos }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" }
  }
}

export async function accionCrearRol(
  nombre: string,
  descripcion: string | null,
  permisoIds: string[]
): Promise<Resultado> {
  return ejecutar(() => crearRol(nombre, descripcion, permisoIds))
}

export async function accionRenombrarRol(
  id: string,
  nombre: string,
  descripcion: string | null
): Promise<Resultado> {
  return ejecutar(() => renombrarRol(id, nombre, descripcion))
}

export async function accionEliminarRol(id: string): Promise<Resultado> {
  return ejecutar(() => eliminarRol(id))
}

export async function accionSetPermisosDeRol(
  rolId: string,
  permisoIds: string[]
): Promise<Resultado> {
  return ejecutar(() => setPermisosDeRol(rolId, permisoIds))
}

export async function accionCrearPermiso(recurso: string, accion: string): Promise<Resultado> {
  return ejecutar(async () => {
    await crearPermiso(recurso, accion)
  })
}

export async function accionEliminarPermiso(id: string): Promise<Resultado> {
  return ejecutar(() => eliminarPermiso(id))
}

// Conteo de permisos efectivos para una lista de usuarios (ej. la tabla del panel de
// usuarios) en una sola consulta batched, en vez de N llamadas individuales.
export async function accionContarPermisosDeUsuarios(
  usuarioIds: string[]
): Promise<{ ok: true; conteos: Record<string, number> } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const conteos = await contarPermisosEfectivosPorUsuario(usuarioIds)
    return { ok: true, conteos }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" }
  }
}

export async function accionGetRolesDeUsuario(
  usuarioId: string
): Promise<{ ok: true; rolIds: string[] } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const rolIds = await getRolesDeUsuario(usuarioId)
    return { ok: true, rolIds }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" }
  }
}

// Asignar roles a un usuario RECOMPILA su string plano (union de los permisos de esos
// roles) — es lo que el backend ejecuta. Reemplaza los permisos ad-hoc que tuviera.
export async function accionSetRolesDeUsuario(
  usuarioId: string,
  rolIds: string[]
): Promise<Resultado> {
  return ejecutar(() => setRolesDeUsuario(usuarioId, rolIds))
}

export async function accionGetOverridesDeUsuario(
  usuarioId: string
): Promise<{ ok: true; overrides: OverrideRow[] } | { ok: false; error: string }> {
  try {
    await assertAdmin()
    const overrides = await getOverridesDeUsuario(usuarioId)
    return { ok: true, overrides }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" }
  }
}

// Concede/deniega un permiso puntual a un usuario (aparte de sus roles) y recompila su
// string. `modo: null` vuelve el permiso a "heredado" (borra el override).
export async function accionSetOverridePermiso(
  usuarioId: string,
  permisoId: string,
  modo: ModoOverride | null
): Promise<Resultado> {
  return ejecutar(() => setOverridePermiso(usuarioId, permisoId, modo))
}
