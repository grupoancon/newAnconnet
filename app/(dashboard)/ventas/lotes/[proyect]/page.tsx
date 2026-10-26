import { requirePermiso } from "@/lib/auth/guard"

import { InventarioLotesContent } from "./lotes-content"

export default async function InventarioLotesPage() {
  // Guard server-side: si no tiene el permiso, redirige a /sin-acceso por dentro.
  // El contenido interactivo (useState/useRouter) vive en el Client Component aparte.
  await requirePermiso("ventas:nueva", "Nueva Venta")

  return <InventarioLotesContent />
}
