import { requireUsuario } from "@/lib/auth/guard"

import { NuevaVacacionContent } from "./nueva-vacacion-content"

export default async function NuevaVacacionPage() {
  await requireUsuario()

  return <NuevaVacacionContent />
}
