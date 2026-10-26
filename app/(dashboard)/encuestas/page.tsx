import { requireAlgunPermisoExplicito } from "@/lib/auth/guard"

import { EncuestasContent } from "./encuestas-content"

export default async function EncuestasPage() {
  await requireAlgunPermisoExplicito(["encuestas:ver", "encuestas:crear"], "Encuestas")

  return <EncuestasContent />
}
