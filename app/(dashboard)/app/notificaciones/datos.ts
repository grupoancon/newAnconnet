// Tipos y catálogos de "App → Notificaciones" (push a la app móvil de clientes). Los
// datos vienen de newApi (/app-notificaciones, permiso app:notificaciones) — ver
// lib/api/app-notificaciones-api.ts. El envío real lo hace el worker de anconAPI.

export type TipoNotificacion = "individual" | "global" | "segmentada"

export type EstadoNotificacion =
  "programada" | "enviada" | "parcial" | "fallo" | "cancelada" | "vencida"

export type Notificacion = {
  id: number
  titulo: string
  contenido: string
  tipo: TipoNotificacion
  estado: EstadoNotificacion
  url: string | null
  imagen: string | null
  fechaEnviar: string | null
  fechaEnvio: string | null
  creadaEn: string
  destinatarios: number
  // Cédula destino (individual) y criterio del segmento (segmentada).
  userId: string | null
  segmento: Record<string, unknown> | null
}

export type EnvioNotificacion = {
  id: string
  // Cédula del cliente, o "*" cuando fue a todos los usuarios.
  userId: string
  enviadoEn: string | null
}

// Pantallas de la app que se abren al tocar la notificación.
export const DESTINOS_APP = [
  { value: "ninguno", label: "Ninguno (solo abre la app)" },
  { value: "/tabs/notification", label: "Bandeja de notificaciones" },
  { value: "/tabs/payments", label: "Pagos" },
  { value: "/tabs/home", label: "Inicio" },
  { value: "/tabs/properties", label: "Reservas" },
]

export const TIPO_LABELS: Record<TipoNotificacion, string> = {
  individual: "Un usuario",
  global: "Todos",
  segmentada: "Segmento",
}

export const ESTADO_LABELS: Record<EstadoNotificacion, string> = {
  programada: "Programada",
  enviada: "Enviada",
  parcial: "Parcial",
  fallo: "Falló",
  cancelada: "Cancelada",
  vencida: "Vencida",
}
