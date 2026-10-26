import { requirePermiso } from "@/lib/auth/guard"

import { DepositosContent } from "./depositos-content"

export default async function DepositosPage() {
  // Reemplaza al RoleLayout con roles numéricos [0, 18, 3, 9] del anconnet legacy.
  // "depositos:gestionar" (aprobar/devolver) se comprueba aparte dentro de la pantalla
  // con useCan.
  await requirePermiso("depositos:ver", "Registro de depósitos")

  return <DepositosContent />
}
