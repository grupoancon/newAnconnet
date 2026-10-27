import "server-only"

import { cookies } from "next/headers"

import { BETTER_AUTH_COOKIE_NAME } from "@/lib/auth/config"
import { prisma } from "@/lib/db/client"
import { getPermisosEfectivosDeUsuario } from "@/lib/rbac/service"
import type { AuthenticatedUser } from "@/types/auth"

// Ver tambien middleware.ts, que hace el mismo checkeo de presencia del cookie de
// Better Auth en el edge. Aqui si se valida de verdad, contra el backend.
// Esto corre en el servidor de Next, no en el navegador: con la API detrás de Nginx
// (NEXT_PUBLIC_API_URL="/backend", relativa) un fetch desde Node no sabe a qué host
// ir y fallaba siempre — cada página mostraba "El servidor no está disponible". Por eso
// usa API_INTERNAL_URL (ej. http://127.0.0.1:4001, directo sin pasar por Nginx).
const BETTER_AUTH_BASE_URL = `${process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/auth`

// Tiempo maximo para que el backend conteste /get-session. Sin esto, con la API colgada
// (no caida, sino sin responder) cada navegacion se quedaba esperando indefinidamente.
const TIMEOUT_GET_SESSION_MS = 8_000

// La sesion no se pudo verificar porque el backend (o la base de datos) no respondio —
// NO significa que la sesion sea invalida. Quien llame a getCurrentUser() tiene que
// tratarlo distinto de un `null`: un `null` cierra la sesion (borra la cookie, ver
// /api/auth/clear-session), esto no — antes se trataban igual, y una caida de la API de
// dos minutos dejaba fuera a todo el que cambiara de pagina en ese momento.
export class ServidorNoDisponibleError extends Error {
  constructor(causa?: unknown) {
    super("No se pudo verificar la sesion: el servidor no respondio.", { cause: causa })
    this.name = "ServidorNoDisponibleError"
  }
}

// Sesion real: valida la cookie de Better Auth contra el backend (GET /get-session,
// reenviando las cookies del request entrante — nunca se confia en la sola presencia
// de la cookie para esto, a diferencia del checkeo rapido de middleware.ts).
// Devuelve null solo cuando el backend CONTESTO que la sesion no es valida; si no se
// pudo preguntar (red, timeout, error 5xx, base de datos caida) lanza
// ServidorNoDisponibleError.
async function getCurrentUserBetterAuth(): Promise<AuthenticatedUser | null> {
  const cookieStore = cookies()
  if (!cookieStore.has(BETTER_AUTH_COOKIE_NAME)) return null

  let respuesta: Response
  try {
    respuesta = await fetch(`${BETTER_AUTH_BASE_URL}/get-session`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_GET_SESSION_MS),
    })
  } catch (error) {
    throw new ServidorNoDisponibleError(error)
  }

  if (respuesta.status >= 500) throw new ServidorNoDisponibleError(respuesta.status)
  // 4xx: el backend contesto y rechazo la sesion (vencida, revocada, cookie invalida).
  if (!respuesta.ok) return null

  let datos: {
    user?: {
      id: string
      email: string
      name: string
      role?: string | string[] | null
      activo?: boolean
    }
  } | null
  try {
    datos = await respuesta.json()
  } catch (error) {
    throw new ServidorNoDisponibleError(error)
  }

  // Better Auth contesta 200 con cuerpo null cuando la sesion no existe o vencio.
  if (!datos?.user) return null
  if (datos.user.activo === false) return null

  try {
    // "Administrador" viene del campo binario admin/no-admin de Better Auth (el que
    // realmente le da acceso al plugin admin del backend). Los DEMAS roles vienen de las
    // tablas relacionales (roles_app via usuarios_roles_app) — sin esta consulta, un rol
    // asignado desde el panel (ej. "Asesor de Ventas") nunca aparecia aca, y por lo tanto
    // ni <Can>/requirePermiso ni el filtro por rol del sidebar lo reconocian.
    const rolesRelacionales = await prisma.usuarioRol.findMany({
      where: { usuarioId: datos.user.id },
      select: { rol: { select: { nombre: true } } },
    })
    const nombresRolesRelacionales = rolesRelacionales.map((ur) => ur.rol.nombre)

    const rolCrudo = Array.isArray(datos.user.role) ? datos.user.role[0] : datos.user.role
    const esAdminBetterAuth = rolCrudo === "admin"

    const roles = Array.from(
      new Set([
        ...(esAdminBetterAuth ? ["Administrador"] : []),
        ...nombresRolesRelacionales,
      ])
    )
    if (roles.length === 0) roles.push("Colaborador")

    return {
      id: datos.user.id,
      email: datos.user.email,
      nombre: datos.user.name,
      roles,
      permisos: await getPermisosEfectivosDeUsuario(datos.user.id),
    }
  } catch (error) {
    // La sesion es valida pero no se pudieron leer roles/permisos (base de datos sin
    // responder) — tampoco es motivo para cerrar la sesion.
    throw new ServidorNoDisponibleError(error)
  }
}

// Unica fuente de verdad de "quien es el usuario actual": la sesion de Better Auth
// (anconAPI). El login propio de esta app (JWT con jose + password argon2) se quito —
// la pantalla de login ya solo usaba Better Auth.
// null = no hay sesion valida (hay que volver a iniciar sesion). Lanza
// ServidorNoDisponibleError si no se pudo verificar — ver esa clase.
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  return getCurrentUserBetterAuth()
}
