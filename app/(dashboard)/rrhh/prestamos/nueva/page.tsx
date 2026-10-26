import { requireUsuario } from "@/lib/auth/guard"

import { NuevoPrestamoContent } from "./nuevo-prestamo-content"

export default async function NuevoPrestamoPage() {
  await requireUsuario()

  return <NuevoPrestamoContent />
}
