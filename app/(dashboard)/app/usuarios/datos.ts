// Tipos y catálogos de "App → Gestión de usuarios" (usuarios de la app móvil de
// clientes). Los datos vienen de newApi: /app-usuarios (listado, alta, edición,
// eliminar/reactivar, procesos aprobados), /users/force-logout y
// /users/lote-entregado — ver lib/api/app-usuarios-api.ts. Todas exigen el permiso
// app:usuarios.

export type EstadoUsuarioApp = "activo" | "inactivo" | "archivado" | "eliminado"

export type UsuarioApp = {
  id: string
  nombre: string
  cedula: string
  email: string
  telefono: string
  estado: EstadoUsuarioApp
  rol: "cliente" | "admin"
  fechaCreacion: string | null
  lotes: string[]
  proyecto: string
  documentNumber: string
  ultimaConexion: string | null
  // Lotes G-/F- deben estar registrados también en el sistema de reservas.
  requiereReservas: boolean
  enReservas: boolean | null
  fechaEliminacion?: string | null
  // Tiene una contraseña temporal sin cambiar (pedida por correo desde la app o
  // generada desde aquí). La clave inicial (su cédula) no cuenta.
  passwordTemporalPendiente: boolean
  // Envíos de contraseña temporal al correo pedidos desde la app (últimos 90 días).
  resetCorreo: { ultima: string; total: number } | null
  sesionesAbiertas: number
}

// Sesión abierta de un usuario en la app (un dispositivo).
export type SesionUsuarioApp = {
  sessionId: string
  dispositivo: string | null
  sistema: string | null
  ip: string | null
  ubicacion: string | null
  metodo: string | null
  iniciada: string
  ultimoUso: string | null
}

// Venta nueva aprobada, candidata a tener usuario en la app.
export type ProcesoAprobado = {
  processId: number
  cliente: string
  cedula: string
  email: string
  celular: string
  lote: string
  asesor: string
  fechaCreacion: string | null
}

export const ESTADO_LABELS: Record<EstadoUsuarioApp, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  archivado: "Archivado",
  eliminado: "Eliminado",
}

export const ESTADOS_EDITABLES: EstadoUsuarioApp[] = ["activo", "inactivo", "archivado"]
export const ROLES_APP = ["cliente", "admin"] as const

// Códigos que entiende el API (/users/force-logout → `reason`) y la app.
export const MOTIVOS_CIERRE_SESION = [
  { value: "LOTE_ENTREGADO", label: "Lote entregado a administración" },
  { value: "LOTE_RETIRADO", label: "Lote retirado" },
  { value: "USUARIO_RETIRADO", label: "Usuario retirado" },
  { value: "PASSWORD_CHANGED", label: "Cambio de contraseña (seguridad)" },
  { value: "SUSPICIOUS_ACTIVITY", label: "Actividad sospechosa (seguridad)" },
]
