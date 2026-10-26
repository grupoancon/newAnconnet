// Wrappers tipados sobre el plugin `admin()` de Better Auth (`/api/auth/admin/*`), que
// es lo único que el backend real expone hoy para gestionar usuarios de intranet — no
// hay tablas relacionales de Role/Permission: `role` es un campo simple ("admin" | "user")
// y `permissions` es un string plano "modulo:accion,modulo:accion" en la fila del usuario.
// Todas las llamadas van con `credentials: "include"` (requieren sesión de administrador).

import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"

const AUTH_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/auth`

export class AdminApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
    this.code = code
  }
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${AUTH_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  } catch {
    throw new AdminApiError("No se pudo conectar con el servidor", 0)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const mensaje =
      cuerpo?.message ?? cuerpo?.error ?? response.statusText ?? "Error desconocido"
    throw new AdminApiError(mensaje, response.status, cuerpo?.code)
  }

  return cuerpo as T
}

export type UsuarioAdmin = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  role?: string | string[] | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: string | null
  twoFactorEnabled?: boolean | null
  permissions?: string | null
  activo?: boolean | null
  cargo?: string | null
  departamento?: string | null
  empresa?: string | null
  fechaIngreso?: string | null
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

// GET /api/auth/admin/list-users
export function listUsers(params?: {
  searchValue?: string
  searchField?: "email" | "name"
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: "asc" | "desc"
}) {
  const query = new URLSearchParams()
  if (params?.searchValue) query.set("searchValue", params.searchValue)
  if (params?.searchField) query.set("searchField", params.searchField)
  if (params?.limit != null) query.set("limit", String(params.limit))
  if (params?.offset != null) query.set("offset", String(params.offset))
  if (params?.sortBy) query.set("sortBy", params.sortBy)
  if (params?.sortDirection) query.set("sortDirection", params.sortDirection)

  const qs = query.toString()
  return adminFetch<{ users: UsuarioAdmin[]; total: number }>(
    `/admin/list-users${qs ? `?${qs}` : ""}`
  )
}

// POST /api/auth/admin/create-user
export function createUser(input: {
  email: string
  password: string
  name: string
  role?: string
  data?: Record<string, unknown>
}) {
  return adminFetch<{ user: UsuarioAdmin }>("/admin/create-user", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// POST /api/auth/admin/update-user — `data` acepta cualquier campo del usuario,
// incluido `permissions` (el string CSV completo, se reemplaza entero).
export function updateUser(userId: string, data: Record<string, unknown>) {
  return adminFetch<{ user: UsuarioAdmin }>("/admin/update-user", {
    method: "POST",
    body: JSON.stringify({ userId, data }),
  })
}

// POST /api/auth/admin/set-role
export function setRole(userId: string, role: string) {
  return adminFetch<{ user: UsuarioAdmin }>("/admin/set-role", {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  })
}

// POST /api/auth/admin/ban-user
export function banUser(userId: string, banReason?: string) {
  return adminFetch<{ user: UsuarioAdmin }>("/admin/ban-user", {
    method: "POST",
    body: JSON.stringify({ userId, banReason }),
  })
}

// POST /api/auth/admin/unban-user
export function unbanUser(userId: string) {
  return adminFetch<{ user: UsuarioAdmin }>("/admin/unban-user", {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
}

// POST /api/auth/admin/remove-user
export function removeUser(userId: string) {
  return adminFetch<{ success: boolean }>("/admin/remove-user", {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
}

// POST /api/auth/admin/set-user-password
export function setUserPassword(userId: string, newPassword: string) {
  return adminFetch<{ status: boolean }>("/admin/set-user-password", {
    method: "POST",
    body: JSON.stringify({ userId, newPassword }),
  })
}

// ── Sesiones de un usuario ──

export type SesionUsuario = {
  id: string
  // Token de la sesión: es lo que pide revoke-user-session.
  token: string
  userId: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  ipAddress?: string | null
  userAgent?: string | null
}

// POST /api/auth/admin/list-user-sessions
export function listUserSessions(userId: string) {
  return adminFetch<{ sessions: SesionUsuario[] }>("/admin/list-user-sessions", {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
}

// POST /api/auth/admin/revoke-user-session — cierra UNA sesión (la borra de la base).
export function revokeUserSession(sessionToken: string) {
  return adminFetch<{ success: boolean }>("/admin/revoke-user-session", {
    method: "POST",
    body: JSON.stringify({ sessionToken }),
  })
}

// POST /api/auth/admin/revoke-user-sessions — cierra todas las sesiones del usuario.
export function revokeUserSessions(userId: string) {
  return adminFetch<{ success: boolean }>("/admin/revoke-user-sessions", {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
}
