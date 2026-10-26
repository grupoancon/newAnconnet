import { requirePermiso } from "@/lib/auth/guard"

import { LotesVendidosContent } from "./lotes-content"

export default async function LotesVendidosPage() {
  // Guard server-side: si no tiene el permiso, redirige a /sin-acceso por dentro.
  await requirePermiso("refinanciamiento:crear", "Refinanciamientos")

  return <LotesVendidosContent />
}
