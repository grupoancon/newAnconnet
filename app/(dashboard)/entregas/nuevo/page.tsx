import { requirePermisoExplicito } from "@/lib/auth/guard"

import { NuevaEntregaContent } from "./nueva-entrega-content"

export default async function NuevaEntregaPage() {
  await requirePermisoExplicito("entregas:crear", "Nuevo proceso de entrega")

  return <NuevaEntregaContent />
}
