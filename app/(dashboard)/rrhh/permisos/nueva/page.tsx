import { requireUsuario } from "@/lib/auth/guard"

import { NuevoPermisoContent } from "./nuevo-permiso-content"

export default async function NuevoPermisoPage() {
  await requireUsuario()

  return <NuevoPermisoContent />
}
