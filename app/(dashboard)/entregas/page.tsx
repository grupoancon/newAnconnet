import { requireAlgunPermisoExplicito } from "@/lib/auth/guard"

import { EntregasContent } from "./entregas-content"

export default async function EntregasPage() {
  await requireAlgunPermisoExplicito(
    ["entregas:ver", "entregas:entregar", "entregas:cerrar"],
    "Entregas"
  )

  return <EntregasContent />
}
