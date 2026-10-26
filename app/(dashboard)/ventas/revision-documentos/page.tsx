import { requirePermiso } from "@/lib/auth/guard"

import { RevisionDocumentosContent } from "./revision-documentos-content"

export default async function RevisionDocumentosPage() {
  await requirePermiso("documentos:revisar", "Revisión de Documentos")

  return <RevisionDocumentosContent />
}
