import { requirePermiso } from "@/lib/auth/guard"

import { VentasUrgentesContent } from "./ventas-urgentes-content"

export default async function VentasUrgentesPage() {
  await requirePermiso("venta:urgente", "Ventas urgentes")

  return <VentasUrgentesContent />
}
