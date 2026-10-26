import { requirePermiso } from "@/lib/auth/guard"

import { NuevoProcesoContent } from "./nuevo-proceso-content"

export default async function NuevoProcesoPage() {
  await requirePermiso("ventas:nueva", "Nueva Venta")

  return <NuevoProcesoContent />
}
