import { requirePermiso } from "@/lib/auth/guard"

import { MisVentasContent } from "./mis-ventas-content"

export default async function MisVentasPage() {
  await requirePermiso("ventas:crear", "Mis ventas")

  return <MisVentasContent />
}
