import { requirePermiso } from "@/lib/auth/guard"

import { RepresentantesContent } from "./representantes-content"

export default async function ConfiguracionRepresentantesPage() {
  await requirePermiso("convenios:gestionar", "Convenios")

  return <RepresentantesContent />
}
