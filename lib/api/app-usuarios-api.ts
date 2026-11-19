// Usuarios de la app móvil (`/app-usuarios`, `/users/force-logout` y
// `/users/lote-entregado` en newApi). Exigen sesión de intranet + el permiso
// app:usuarios (ver prisma/sql/permiso_app_usuarios.sql).
import { avisarSiSesionVencida } from "@/lib/api/sesion-vencida"
import type {
  ProcesoAprobado,
  SesionUsuarioApp,
  UsuarioApp,
} from "@/app/(dashboard)/app/usuarios/datos"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
const TIMEOUT_MS = 60_000

export class UsuariosAppApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "UsuariosAppApiError"
    this.status = status
  }
}

async function usuariosFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
      credentials: "include",
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new UsuariosAppApiError("El servidor tardó demasiado en responder", 0)
    }
    throw new UsuariosAppApiError("No se pudo conectar con el servidor", 0)
  } finally {
    clearTimeout(timeoutId)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    avisarSiSesionVencida(response.status)
    const detalle = Array.isArray(cuerpo?.message) ? cuerpo.message.join(". ") : cuerpo?.message
    const mensaje =
      response.status === 403
        ? "No tienes el permiso app:usuarios para gestionar los usuarios de la app."
        : response.status === 404 && !detalle
          ? "El backend no tiene el módulo de usuarios de la app (falta desplegar newApi)."
          : (detalle ?? response.statusText ?? "Error desconocido")
    throw new UsuariosAppApiError(mensaje, response.status)
  }
  // /users/* responde 200 con { success: false, message } cuando no pudo hacerlo.
  if (cuerpo && cuerpo.success === false) {
    throw new UsuariosAppApiError(cuerpo.message || "No se pudo completar la acción", 200)
  }
  return cuerpo as T
}

export type VerificacionProceso = {
  proceso: ProcesoAprobado
  docEntry: number | null
  docNum: number | null
  aviso: string | null
  lotesExistentes: string[]
}

export type ResultadoAlta = {
  esNuevo: boolean
  enReservas: boolean | null
  whatsappEnviado: boolean
  aviso: string | null
}

export type CambiosUsuarioApp = {
  nombre: string
  cedula: string
  email: string
  telefono: string
  rol: string
  estado: string
  generateTempPassword?: boolean
  tempPassword?: string
}

export function listarUsuariosApp(): Promise<UsuarioApp[]> {
  return usuariosFetch("/app-usuarios")
}

export function listarUsuariosAppEliminados(): Promise<UsuarioApp[]> {
  return usuariosFetch("/app-usuarios/eliminados")
}

export function listarProcesosAprobados(): Promise<ProcesoAprobado[]> {
  return usuariosFetch("/app-usuarios/procesos-aprobados")
}

// Valida en SAP que el lote tenga orden de venta y que sea de este cliente.
export function verificarProcesoAprobado(processId: number): Promise<VerificacionProceso> {
  return usuariosFetch(`/app-usuarios/procesos-aprobados/${processId}/verificar`)
}

export function crearUsuarioApp(datos: {
  processId: number
  tempPassword: string
}): Promise<ResultadoAlta> {
  return usuariosFetch("/app-usuarios", { method: "POST", body: JSON.stringify(datos) })
}

export function actualizarUsuarioApp(
  id: string,
  cambios: CambiosUsuarioApp
): Promise<{ tempPassword: string | null }> {
  return usuariosFetch(`/app-usuarios/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  })
}

export function eliminarUsuarioApp(id: string): Promise<unknown> {
  return usuariosFetch(`/app-usuarios/${encodeURIComponent(id)}`, { method: "DELETE" })
}

export function reactivarUsuarioApp(id: string): Promise<unknown> {
  return usuariosFetch(`/app-usuarios/eliminados/${encodeURIComponent(id)}/reactivar`, {
    method: "POST",
  })
}

// Sin sessionID, el API cierra TODAS las sesiones del usuario (por cédula).
export function cerrarSesionesUsuarioApp(datos: {
  cedula: string
  reason: string
  lote?: string
  fecha?: string
}): Promise<unknown> {
  return usuariosFetch("/users/force-logout", {
    method: "POST",
    body: JSON.stringify({ ...datos, sessionID: "" }),
  })
}

// Solo la notificación push de "lote entregado"; no cierra la sesión.
export function avisarLoteEntregado(datos: {
  cedula: string
  lote: string
  fecha: string
}): Promise<unknown> {
  return usuariosFetch("/users/lote-entregado", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// Sesiones abiertas del usuario, con el dispositivo desde donde entró.
export function listarSesionesUsuarioApp(id: string): Promise<SesionUsuarioApp[]> {
  return usuariosFetch(`/app-usuarios/${encodeURIComponent(id)}/sesiones`)
}

// Cierra UNA sesión (un dispositivo) del usuario, con el motivo que verá en la app.
export function cerrarSesionUsuarioApp(
  id: string,
  sessionId: string,
  datos: { reason: string; lote?: string; fecha?: string }
): Promise<unknown> {
  return usuariosFetch(
    `/app-usuarios/${encodeURIComponent(id)}/sesiones/${encodeURIComponent(sessionId)}/cerrar`,
    { method: "POST", body: JSON.stringify(datos) }
  )
}
