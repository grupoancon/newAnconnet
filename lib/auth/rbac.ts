import type { AuthenticatedUser } from "@/types/auth"

export type PermisoContexto = {
  // id del usuario que creo el recurso sobre el que se ejecuta la accion.
  // Permite expresar separacion de funciones (ej. no aprobar lo que uno mismo creo).
  creadoPorId?: string
}

// Verificacion real de permisos: debe llamarse siempre en servidor antes de ejecutar
// cualquier server action o route handler. La UI (<Can>) solo oculta/deshabilita,
// nunca sustituye esta verificacion.
export function can(
  usuario: AuthenticatedUser,
  recurso: string,
  accion: string,
  contexto?: PermisoContexto
): boolean {
  if (accion === "aprobar" && contexto?.creadoPorId !== undefined) {
    const esElMismoUsuario = contexto.creadoPorId === usuario.id
    if (esElMismoUsuario) return false
  }

  // El rol Administrador (role === "admin" en Better Auth) es "acceso total": pasa
  // cualquier verificacion de permiso sin necesitar tokens individuales. La separacion
  // de funciones de arriba (no aprobar lo propio) aplica incluso para admins.
  if (usuario.roles.includes("Administrador")) return true

  // "modulo:all" (formato real que guarda Better Auth) da acceso a cualquier accion
  // sobre ese modulo, ademas del match exacto "modulo:accion".
  return usuario.permisos.some(
    (permiso) =>
      permiso.recurso === recurso &&
      (permiso.accion === accion || permiso.accion === "all")
  )
}

// Igual que can() pero SIN el bypass del rol Administrador: exige el permiso en los
// permisos efectivos del usuario (roles + overrides). Para modulos cuyo backend valida
// el permiso en vivo sin bypass (ej. Entregas): con can() un admin vería pantallas que
// luego fallan con 403 al guardar.
export function tienePermisoExplicito(
  usuario: AuthenticatedUser,
  recurso: string,
  accion: string
): boolean {
  return usuario.permisos.some(
    (permiso) =>
      permiso.recurso === recurso &&
      (permiso.accion === accion || permiso.accion === "all")
  )
}

export class PermisoDenegadoError extends Error {
  constructor(recurso: string, accion: string) {
    super(`No autorizado para "${accion}" sobre "${recurso}"`)
    this.name = "PermisoDenegadoError"
  }
}

// Para usar al inicio de un server action / route handler: lanza si no hay permiso.
export function assertCan(
  usuario: AuthenticatedUser,
  recurso: string,
  accion: string,
  contexto?: PermisoContexto
): void {
  if (!can(usuario, recurso, accion, contexto)) {
    throw new PermisoDenegadoError(recurso, accion)
  }
}
