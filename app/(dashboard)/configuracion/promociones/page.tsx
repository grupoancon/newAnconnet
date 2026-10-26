import { requirePermiso } from "@/lib/auth/guard"

import { PromocionesContent } from "./promociones-content"

export default async function ConfiguracionPromocionesPage() {
  // El middleware ya no exige rol Administrador para /configuracion (ver
  // middleware.ts) — esta es la verificación real: cualquiera con el permiso puntual
  // "promociones:gestionar" entra, sea o no Administrador.
  await requirePermiso("promociones:gestionar", "Promociones")

  return <PromocionesContent />
}
