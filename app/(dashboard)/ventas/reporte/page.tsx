import { requirePermiso } from "@/lib/auth/guard"

import { ReporteVentasContent } from "./reporte-ventas-content"

export default async function ReporteVentasPage() {
  await requirePermiso("ventas:reporte", "Reporte de ventas")

  return <ReporteVentasContent />
}
