import { requirePermiso } from "@/lib/auth/guard"

import { ConveniosListContent } from "./convenios-list-content"

export default async function ConfiguracionConveniosPage() {
  await requirePermiso("convenios:gestionar", "Convenios")

  return <ConveniosListContent />
}
