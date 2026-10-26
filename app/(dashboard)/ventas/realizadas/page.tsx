import { requirePermiso } from "@/lib/auth/guard"

import { VentasRealizadasContent } from "./ventas-realizadas-content"

// Solo gerencia/administración (mismo permiso que "Reporte de ventas"): lista las ventas
// de TODA la empresa. El asesor no entra acá — sus ventas las ve en "Mis ventas".
export default async function VentasRealizadasPage() {
  await requirePermiso("ventas:reporte", "Ventas realizadas")

  return <VentasRealizadasContent />
}
