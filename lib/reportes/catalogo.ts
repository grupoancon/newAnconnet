// Catálogo de reportes de la página unificada /reportes. Cada reporte tiene SU permiso
// (`reportes:<id>`) y la página solo muestra los que el usuario tiene asignados.
//
// El acceso es EXPLÍCITO (tienePermisoExplicito): ni el rol Administrador ve un reporte
// que no le hayan asignado — un admin con 2 permisos ve 2 reportes, no todos. Es la
// diferencia con el resto de la app, donde el Administrador pasa siempre.
//
// Para agregar un reporte:
//   1. Agregar su entrada aquí (id + permiso).
//   2. Crear el componente y registrarlo en app/(dashboard)/reportes/reportes-content.tsx.
//   3. Crear el permiso `reportes:<id>` (agregar el id a REPORTES en
//      anconAPI/add_reportes_permisos.js y correr `node add_reportes_permisos.js`) y
//      asignarlo al usuario/rol desde admin/usuarios o admin/roles.
// Si el reporte consulta endpoints con guard propio en anconAPI, ese guard también debe
// aceptar `reportes:<id>` (ver reporte-ventas en ventas.controller.ts).

import { tienePermisoExplicito } from "@/lib/auth/rbac"
import type { AuthenticatedUser } from "@/types/auth"

export type ReporteDefinicion = {
  id: string
  titulo: string
  descripcion: string
  permiso: `reportes:${string}`
}

export const REPORTES: ReporteDefinicion[] = [
  {
    id: "ventas",
    titulo: "Reporte de ventas",
    descripcion: "Procesos de venta por proyecto, asesor, estado y rango de fechas.",
    permiso: "reportes:ventas",
  },
  {
    id: "administrativo",
    titulo: "Reporte administrativo",
    descripcion: "Ventas y retiros por proyecto, por año.",
    permiso: "reportes:administrativo",
  },
  {
    id: "depositos",
    titulo: "Reporte de depósitos",
    descripcion: "Depósitos registrados por estado, cliente, lote y monto.",
    permiso: "reportes:depositos",
  },
]

export const PERMISOS_REPORTES = REPORTES.map((reporte) => reporte.permiso)

export function reportesPermitidos(usuario: AuthenticatedUser): ReporteDefinicion[] {
  return REPORTES.filter((reporte) => {
    const [recurso, accion] = reporte.permiso.split(":")
    return tienePermisoExplicito(usuario, recurso ?? "", accion ?? "")
  })
}
