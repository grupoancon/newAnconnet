// Tipos, catálogos y datos de ejemplo de "App → Gestión de usuarios" (usuarios de la app
// móvil de clientes). Réplica visual de pages/usuarios-app.tsx de la intranet anterior.
//
// PENDIENTE (conexión al backend): hoy la pantalla usa USUARIOS_EJEMPLO y
// PROCESOS_EJEMPLO. Los endpoints que usaba la intranet anterior (anconAPI) son:
//   GET    /auths/user/app-users                     → usuarios activos/inactivos
//   GET    /auths/user/app-users-deleted             → pestaña "Eliminados"
//   POST   /auths/user/register-app-user             → crear usuario / agregar lote
//   PATCH  /auths/user/app-users/:id                 → editar (y contraseña temporal)
//   DELETE /auths/user/app-users/:id                 → eliminar (pasa a "Eliminados")
//   POST   /auths/user/app-users-deleted/:id/restore → reactivar
//   POST   /users/force-logout                       → cerrar sesiones (con motivo)
//   POST   /users/lote-entregado                     → aviso push de lote entregado
//   GET    /saps/verifyOrderByLoteAndCedula/:lote/:cedula → validar orden SAP al agregar
// y la lista de procesos aprobados salía de un API route propio de esa intranet
// (pages/api/usuarios-app/procesos-aprobados.ts). Ojo: varias de esas rutas hoy son
// públicas en anconAPI (ver informe de seguridad) — protegerlas al conectarlas.

export type EstadoUsuarioApp = "activo" | "inactivo" | "archivado" | "eliminado"

export type UsuarioApp = {
  id: string
  nombre: string
  cedula: string
  email: string
  telefono: string
  estado: EstadoUsuarioApp
  rol: "cliente" | "admin"
  fechaCreacion: string
  lotes: string[]
  proyecto: string
  documentNumber: string
  ultimaConexion: string | null
  // Lotes G-/F- deben estar registrados también en el sistema de reservas.
  requiereReservas: boolean
  enReservas: boolean | null
  fechaEliminacion?: string | null
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
  fechaCreacion: string
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

export const PROYECTOS_EJEMPLO = ["Jardines del Valle", "Mirador del Lago", "El Edén"]

export const USUARIOS_EJEMPLO: UsuarioApp[] = [
  {
    id: "u1",
    nombre: "María Fernanda López",
    cedula: "1723456789",
    email: "mflopez@gmail.com",
    telefono: "0991234567",
    estado: "activo",
    rol: "cliente",
    fechaCreacion: "2026-08-04T10:20:00",
    lotes: ["JV-A12"],
    proyecto: "Jardines del Valle",
    documentNumber: "OV-10452",
    ultimaConexion: "2026-10-14T18:42:00",
    requiereReservas: false,
    enReservas: null,
  },
  {
    id: "u2",
    nombre: "Carlos Andrés Mendoza",
    cedula: "0918273645",
    email: "camendoza@hotmail.com",
    telefono: "0987654321",
    estado: "activo",
    rol: "cliente",
    fechaCreacion: "2026-08-11T09:05:00",
    lotes: ["G-104", "G-105"],
    proyecto: "Mirador del Lago",
    documentNumber: "OV-10478",
    ultimaConexion: "2026-10-15T08:10:00",
    requiereReservas: true,
    enReservas: true,
  },
  {
    id: "u3",
    nombre: "Andrea Paola Vera",
    cedula: "1309876543",
    email: "apvera@outlook.com",
    telefono: "0961122334",
    estado: "activo",
    rol: "cliente",
    fechaCreacion: "2026-08-19T15:30:00",
    lotes: ["F-021"],
    proyecto: "El Edén",
    documentNumber: "OV-10503",
    ultimaConexion: "2026-10-02T12:00:00",
    requiereReservas: true,
    enReservas: false,
  },
  {
    id: "u4",
    nombre: "José Luis Andrade",
    cedula: "1712233445",
    email: "jlandrade@gmail.com",
    telefono: "0995566778",
    estado: "inactivo",
    rol: "cliente",
    fechaCreacion: "2026-08-25T11:45:00",
    lotes: ["JV-C03"],
    proyecto: "Jardines del Valle",
    documentNumber: "OV-10517",
    ultimaConexion: "2026-09-01T20:15:00",
    requiereReservas: false,
    enReservas: null,
  },
  {
    id: "u5",
    nombre: "Gabriela Torres Ruiz",
    cedula: "0923344556",
    email: "gtorres@gmail.com",
    telefono: "0974455667",
    estado: "activo",
    rol: "admin",
    fechaCreacion: "2026-09-02T08:00:00",
    lotes: ["ML-B07"],
    proyecto: "Mirador del Lago",
    documentNumber: "OV-10530",
    ultimaConexion: "2026-10-15T07:55:00",
    requiereReservas: false,
    enReservas: null,
  },
  {
    id: "u6",
    nombre: "Luis Miguel Paredes",
    cedula: "1755667788",
    email: "lmparedes@yahoo.com",
    telefono: "0983344556",
    estado: "archivado",
    rol: "cliente",
    fechaCreacion: "2026-09-09T16:20:00",
    lotes: ["E-210"],
    proyecto: "El Edén",
    documentNumber: "OV-10544",
    ultimaConexion: null,
    requiereReservas: false,
    enReservas: null,
  },
  {
    id: "u7",
    nombre: "Diana Carolina Salazar",
    cedula: "1102938475",
    email: "dcsalazar@gmail.com",
    telefono: "0969988776",
    estado: "activo",
    rol: "cliente",
    fechaCreacion: "2026-09-15T13:10:00",
    lotes: ["G-118"],
    proyecto: "Mirador del Lago",
    documentNumber: "OV-10561",
    ultimaConexion: "2026-10-13T21:30:00",
    requiereReservas: true,
    enReservas: true,
  },
  {
    id: "u8",
    nombre: "Pedro Xavier Cedeño",
    cedula: "1310293847",
    email: "pxcedeno@gmail.com",
    telefono: "0951237894",
    estado: "activo",
    rol: "cliente",
    fechaCreacion: "2026-09-28T10:00:00",
    lotes: ["JV-D15"],
    proyecto: "Jardines del Valle",
    documentNumber: "OV-10589",
    ultimaConexion: "2026-10-10T09:25:00",
    requiereReservas: false,
    enReservas: null,
  },
  {
    id: "u9",
    nombre: "Verónica Isabel Núñez",
    cedula: "0956473829",
    email: "vinunez@hotmail.com",
    telefono: "0998877665",
    estado: "activo",
    rol: "cliente",
    fechaCreacion: "2026-10-06T17:40:00",
    lotes: ["F-033"],
    proyecto: "El Edén",
    documentNumber: "OV-10612",
    ultimaConexion: "2026-10-14T11:05:00",
    requiereReservas: true,
    enReservas: false,
  },
]

export const USUARIOS_ELIMINADOS_EJEMPLO: UsuarioApp[] = [
  {
    id: "d1",
    nombre: "Ricardo Esteban Mora",
    cedula: "1711992233",
    email: "remora@gmail.com",
    telefono: "0991112233",
    estado: "eliminado",
    rol: "cliente",
    fechaCreacion: "2026-08-07T09:30:00",
    lotes: ["JV-B09"],
    proyecto: "Jardines del Valle",
    documentNumber: "OV-10460",
    ultimaConexion: "2026-09-20T10:00:00",
    requiereReservas: false,
    enReservas: null,
    fechaEliminacion: "2026-10-01T15:00:00",
  },
  {
    id: "d2",
    nombre: "Sofía Alejandra Ríos",
    cedula: "0928374651",
    email: "sarios@outlook.com",
    telefono: "0976655443",
    estado: "eliminado",
    rol: "cliente",
    fechaCreacion: "2026-08-30T14:15:00",
    lotes: ["G-122"],
    proyecto: "Mirador del Lago",
    documentNumber: "OV-10521",
    ultimaConexion: "2026-09-10T19:45:00",
    requiereReservas: true,
    enReservas: true,
    fechaEliminacion: "2026-10-09T11:20:00",
  },
]

export const PROCESOS_EJEMPLO: ProcesoAprobado[] = [
  {
    processId: 412,
    cliente: "Fernando José Castillo",
    cedula: "1714455667",
    email: "fjcastillo@gmail.com",
    celular: "0992233445",
    lote: "JV-E04",
    asesor: "Juan Carlos Proaño",
    fechaCreacion: "2026-10-08T10:15:00",
  },
  {
    processId: 418,
    cliente: "Carlos Andrés Mendoza",
    cedula: "0918273645",
    email: "camendoza@hotmail.com",
    celular: "0987654321",
    lote: "G-131",
    asesor: "Ana María Ruiz",
    fechaCreacion: "2026-10-11T16:40:00",
  },
  {
    processId: 421,
    cliente: "Lucía Valentina Herrera",
    cedula: "0912345678",
    email: "lvherrera@gmail.com",
    celular: "0965544332",
    lote: "E-305",
    asesor: "Juan Carlos Proaño",
    fechaCreacion: "2026-10-13T09:00:00",
  },
]
