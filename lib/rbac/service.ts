import "server-only"

import { prisma } from "@/lib/db/client"

// Capa de gestión RBAC relacional. Fuente de verdad tanto para GESTIÓN como para
// ENFORCEMENT = las tablas relacionales (roles_app, permisos_app, roles_permisos_app,
// usuarios_roles_app, usuarios_permisos_app), editadas desde el panel admin y leídas en
// vivo por getPermisosEfectivosDeUsuario() — tanto este backend (lib/auth/session.ts)
// como el guard de anconAPI (lib/permisos-rbac.ts) consultan las mismas tablas contra la
// misma base. La columna `user.permissions` (string CSV) ya no se usa para nada.

export type PermisoRow = { id: string; recurso: string; accion: string }
export type RolRow = {
  id: string
  nombre: string
  descripcion: string | null
  permisoIds: string[]
  totalUsuarios: number
}

export async function listarPermisos(): Promise<PermisoRow[]> {
  return prisma.permiso.findMany({
    orderBy: [{ recurso: "asc" }, { accion: "asc" }],
    select: { id: true, recurso: true, accion: true },
  })
}

export async function listarRoles(): Promise<RolRow[]> {
  const roles = await prisma.rol.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      permisos: { select: { permisoId: true } },
      _count: { select: { usuarios: true } },
    },
  })
  return roles.map((rol) => ({
    id: rol.id,
    nombre: rol.nombre,
    descripcion: rol.descripcion,
    permisoIds: rol.permisos.map((p) => p.permisoId),
    totalUsuarios: rol._count.usuarios,
  }))
}

export async function crearPermiso(recurso: string, accion: string): Promise<PermisoRow> {
  return prisma.permiso.create({
    data: { recurso: recurso.trim().toLowerCase(), accion: accion.trim() },
    select: { id: true, recurso: true, accion: true },
  })
}

export async function eliminarPermiso(id: string): Promise<void> {
  // Quitarlo de todos los roles y overrides que lo referencian, y luego borrarlo (el FK
  // en cascada limpia las filas puente, pero igual hay que recompilar a los afectados
  // antes de que esa info desaparezca).
  const [rolesAfectados, overridesAfectados] = await Promise.all([
    prisma.rolPermiso.findMany({ where: { permisoId: id }, select: { rolId: true } }),
    prisma.usuarioPermiso.findMany({ where: { permisoId: id }, select: { usuarioId: true } }),
  ])
  await prisma.permiso.delete({ where: { id } })
  for (const { rolId } of rolesAfectados) {
    await recompilarUsuariosDeRol(rolId)
  }
  for (const { usuarioId } of overridesAfectados) {
    await recompilarPermisosUsuario(usuarioId)
  }
}

export async function crearRol(
  nombre: string,
  descripcion: string | null,
  permisoIds: string[]
): Promise<void> {
  await prisma.rol.create({
    data: {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      permisos: { create: permisoIds.map((permisoId) => ({ permisoId })) },
    },
  })
}

export async function renombrarRol(
  id: string,
  nombre: string,
  descripcion: string | null
): Promise<void> {
  await prisma.rol.update({
    where: { id },
    data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null },
  })
}

export async function eliminarRol(id: string): Promise<void> {
  const miembros = await prisma.usuarioRol.findMany({
    where: { rolId: id },
    select: { usuarioId: true },
  })
  await prisma.rol.delete({ where: { id } })
  for (const { usuarioId } of miembros) {
    await recompilarPermisosUsuario(usuarioId)
  }
}

export async function setPermisosDeRol(rolId: string, permisoIds: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.rolPermiso.deleteMany({ where: { rolId } }),
    prisma.rolPermiso.createMany({
      data: permisoIds.map((permisoId) => ({ rolId, permisoId })),
    }),
  ])
  await recompilarUsuariosDeRol(rolId)
}

// --- Overrides puntuales por usuario (conceder/denegar aparte de sus roles) ---

export type ModoOverride = "conceder" | "denegar"
export type OverrideRow = { permisoId: string; modo: ModoOverride }

export async function getOverridesDeUsuario(usuarioId: string): Promise<OverrideRow[]> {
  const filas = await prisma.usuarioPermiso.findMany({
    where: { usuarioId },
    select: { permisoId: true, modo: true },
  })
  return filas.map((f) => ({ permisoId: f.permisoId, modo: f.modo as ModoOverride }))
}

// modo = null -> vuelve a "heredado" (se borra el override, queda solo lo que dé el rol).
export async function setOverridePermiso(
  usuarioId: string,
  permisoId: string,
  modo: ModoOverride | null
): Promise<void> {
  if (modo === null) {
    await prisma.usuarioPermiso.deleteMany({ where: { usuarioId, permisoId } })
  } else {
    await prisma.usuarioPermiso.upsert({
      where: { usuarioId_permisoId: { usuarioId, permisoId } },
      update: { modo },
      create: { usuarioId, permisoId, modo },
    })
  }
  await recompilarPermisosUsuario(usuarioId)
}

export async function getRolesDeUsuario(usuarioId: string): Promise<string[]> {
  const filas = await prisma.usuarioRol.findMany({
    where: { usuarioId },
    select: { rolId: true },
  })
  return filas.map((f) => f.rolId)
}

export async function setRolesDeUsuario(usuarioId: string, rolIds: string[]): Promise<void> {
  await prisma.$transaction([
    prisma.usuarioRol.deleteMany({ where: { usuarioId } }),
    prisma.usuarioRol.createMany({
      data: rolIds.map((rolId) => ({ usuarioId, rolId })),
    }),
  ])
  await recompilarPermisosUsuario(usuarioId)
}

// --- Núcleo: permisos efectivos de un usuario (fuente de verdad de autorización) ---

export type PermisoEfectivo = { recurso: string; accion: string }

// Permisos efectivos de un usuario, calculados en vivo contra las tablas relacionales.
// Es lo que consume tanto el backend (NestJS, lib/permisos-rbac.ts) como getCurrentUser()
// en lib/auth/session.ts — ya no se lee/escribe user.permissions para autorizar.
//
//   efectivo = (union de permisos de sus roles) + concedidos_puntual - denegados_puntual
//
// Un "denegar" puntual gana siempre, incluso si un rol se lo daría — permite excepciones
// tipo "este vendedor no puede aprobar aunque el rol Asesor de Ventas sí lo permita".
export async function getPermisosEfectivosDeUsuario(
  usuarioId: string
): Promise<PermisoEfectivo[]> {
  const [roles, overrides] = await Promise.all([
    prisma.usuarioRol.findMany({
      where: { usuarioId },
      select: {
        rol: {
          select: {
            permisos: { select: { permiso: { select: { recurso: true, accion: true } } } },
          },
        },
      },
    }),
    prisma.usuarioPermiso.findMany({
      where: { usuarioId },
      select: { modo: true, permiso: { select: { recurso: true, accion: true } } },
    }),
  ])

  const efectivos = new Map<string, PermisoEfectivo>()
  for (const usuarioRol of roles) {
    for (const rolPermiso of usuarioRol.rol.permisos) {
      const p = rolPermiso.permiso
      efectivos.set(`${p.recurso}:${p.accion}`, p)
    }
  }
  for (const override of overrides) {
    const p = override.permiso
    const token = `${p.recurso}:${p.accion}`
    if (override.modo === "conceder") efectivos.set(token, p)
    else efectivos.delete(token)
  }
  return Array.from(efectivos.values())
}

// Version batched de getPermisosEfectivosDeUsuario para listas (ej. panel de usuarios):
// una sola consulta por tabla en vez de N+1. Devuelve { usuarioId: cantidadDePermisos }.
export async function contarPermisosEfectivosPorUsuario(
  usuarioIds: string[]
): Promise<Record<string, number>> {
  const conteos: Record<string, number> = {}
  if (usuarioIds.length === 0) return conteos

  const [roles, overrides] = await Promise.all([
    prisma.usuarioRol.findMany({
      where: { usuarioId: { in: usuarioIds } },
      select: {
        usuarioId: true,
        rol: { select: { permisos: { select: { permisoId: true } } } },
      },
    }),
    prisma.usuarioPermiso.findMany({
      where: { usuarioId: { in: usuarioIds } },
      select: { usuarioId: true, permisoId: true, modo: true },
    }),
  ])

  const porUsuario = new Map<string, Set<string>>()
  for (const id of usuarioIds) porUsuario.set(id, new Set())

  for (const usuarioRol of roles) {
    const set = porUsuario.get(usuarioRol.usuarioId)
    if (!set) continue
    for (const rolPermiso of usuarioRol.rol.permisos) set.add(rolPermiso.permisoId)
  }
  for (const override of overrides) {
    const set = porUsuario.get(override.usuarioId)
    if (!set) continue
    if (override.modo === "conceder") set.add(override.permisoId)
    else set.delete(override.permisoId)
  }

  porUsuario.forEach((set, id) => {
    conteos[id] = set.size
  })
  return conteos
}

// Devuelve el string plano que le corresponde a un usuario, SIN escribir. Útil para
// previsualizar sin efectos secundarios. Ya no se usa para autorizar ni para el conteo de
// display del panel admin (ver contarPermisosEfectivosPorUsuario) — queda como utilidad.
export async function compilarPermisosDeUsuario(usuarioId: string): Promise<string> {
  const permisos = await getPermisosEfectivosDeUsuario(usuarioId)
  return permisos.map((p) => `${p.recurso}:${p.accion}`).join(",")
}

// Escribe en user.permissions el resultado de compilarPermisosDeUsuario (roles + overrides).
// Es lo único que toca el string plano — y solo se llama desde acciones de gestión.
export async function recompilarPermisosUsuario(usuarioId: string): Promise<string> {
  const compilado = await compilarPermisosDeUsuario(usuarioId)
  await prisma.user.update({
    where: { id: usuarioId },
    data: { permissions: compilado },
  })
  return compilado
}

async function recompilarUsuariosDeRol(rolId: string): Promise<void> {
  const miembros = await prisma.usuarioRol.findMany({
    where: { rolId },
    select: { usuarioId: true },
  })
  for (const { usuarioId } of miembros) {
    await recompilarPermisosUsuario(usuarioId)
  }
}
