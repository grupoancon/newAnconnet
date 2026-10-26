// Tipos, catálogos y datos de ejemplo de "App → Notificaciones" (push a la app móvil de
// clientes). Réplica visual de pages/notificaciones.tsx de la intranet anterior.
//
// PENDIENTE (conexión al backend): hoy la pantalla usa HISTORIAL_EJEMPLO y
// ENVIOS_EJEMPLO. Los endpoints que usaba la intranet anterior (anconAPI) son:
//   GET    /notifications/history?limit=50&estado=… → historial ({ data: Notificacion[] })
//   GET    /notifications/history/:id               → detalle ({ sends: EnvioNotificacion[] })
//   POST   /notifications                           → enviar o programar (body: ver
//          armarCuerpoEnvio en notificaciones-app-content.tsx)
//   POST   /notifications/:id/send-now              → enviar ya una programada
//   DELETE /notifications/:id                       → cancelar una programada
// Ojo: el backend responde 200 con { success: false } cuando no pudo hacer la acción.
// Varias de estas rutas hoy son públicas en anconAPI (ver informe de seguridad).

export type TipoNotificacion = "individual" | "global" | "segmentada"

export type EstadoNotificacion =
  | "programada"
  | "enviada"
  | "parcial"
  | "fallo"
  | "cancelada"
  | "vencida"

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

export const HISTORIAL_EJEMPLO: Notificacion[] = [
  {
    id: 58,
    titulo: "Recordatorio de cuota de noviembre",
    contenido: "Tu cuota vence el 5 de noviembre. Paga a tiempo y evita recargos.",
    tipo: "segmentada",
    estado: "programada",
    url: "/tabs/payments",
    imagen: null,
    fechaEnviar: "2026-11-01T09:00:00",
    fechaEnvio: null,
    creadaEn: "2026-10-15T08:30:00",
    destinatarios: 0,
  },
  {
    id: 57,
    titulo: "Pago confirmado",
    contenido: "Tu cuota de octubre fue registrada correctamente. ¡Gracias!",
    tipo: "individual",
    estado: "enviada",
    url: "/tabs/payments",
    imagen: null,
    fechaEnviar: null,
    fechaEnvio: "2026-10-14T16:12:00",
    creadaEn: "2026-10-14T16:12:00",
    destinatarios: 1,
  },
  {
    id: 56,
    titulo: "Nuevas áreas sociales en Mirador del Lago",
    contenido: "Ya puedes reservar la nueva zona BBQ desde la app.",
    tipo: "segmentada",
    estado: "parcial",
    url: "/tabs/properties",
    imagen: "https://ejemplo.com/bbq.jpg",
    fechaEnviar: null,
    fechaEnvio: "2026-10-10T10:00:00",
    creadaEn: "2026-10-10T09:55:00",
    destinatarios: 42,
  },
  {
    id: 55,
    titulo: "Mantenimiento programado",
    contenido: "La app estará en mantenimiento el sábado de 22:00 a 23:00.",
    tipo: "global",
    estado: "enviada",
    url: null,
    imagen: null,
    fechaEnviar: "2026-10-04T18:00:00",
    fechaEnvio: "2026-10-04T18:00:00",
    creadaEn: "2026-10-03T12:00:00",
    destinatarios: 318,
  },
  {
    id: 54,
    titulo: "Tienes cuotas pendientes",
    contenido: "Registramos valores vencidos en tu lote. Revisa tu estado de cuenta.",
    tipo: "segmentada",
    estado: "fallo",
    url: "/tabs/payments",
    imagen: null,
    fechaEnviar: null,
    fechaEnvio: "2026-09-30T09:00:00",
    creadaEn: "2026-09-30T08:58:00",
    destinatarios: 0,
  },
  {
    id: 53,
    titulo: "Feriado de octubre",
    contenido: "Nuestras oficinas no atenderán el lunes por feriado nacional.",
    tipo: "global",
    estado: "cancelada",
    url: null,
    imagen: null,
    fechaEnviar: "2026-10-09T08:00:00",
    fechaEnvio: null,
    creadaEn: "2026-09-28T15:20:00",
    destinatarios: 0,
  },
]

export const ENVIOS_EJEMPLO: EnvioNotificacion[] = [
  { id: "e1", userId: "1723456789", enviadoEn: "2026-10-10T10:00:04" },
  { id: "e2", userId: "0918273645", enviadoEn: "2026-10-10T10:00:04" },
  { id: "e3", userId: "1102938475", enviadoEn: "2026-10-10T10:00:05" },
  { id: "e4", userId: "0956473829", enviadoEn: null },
]
