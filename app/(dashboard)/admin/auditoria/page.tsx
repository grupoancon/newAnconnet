import { requirePermiso } from "@/lib/auth/guard"

import { AuditoriaContent } from "./auditoria-content"

export default async function AdminAuditoriaPage() {
  // El rol Administrador pasa siempre (bypass en can()); el resto necesita el permiso
  // puntual "auditoria:ver", que el backend vuelve a exigir en cada consulta.
  await requirePermiso("auditoria:ver", "Auditoría")

  return <AuditoriaContent />
}
