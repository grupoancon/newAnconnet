import { requirePermiso } from "@/lib/auth/guard"

import { RolesContent } from "./roles-content"

export default async function AdminRolesPage() {
  // El middleware ya filtro a nivel de ruta; esta verificacion server-side es la que
  // realmente autoriza el contenido. El rol Administrador pasa siempre (bypass en can());
  // cualquier otro usuario necesita el permiso puntual "admin:user".
  await requirePermiso("admin:user", "Roles y permisos")

  return <RolesContent />
}
