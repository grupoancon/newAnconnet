import { requireUsuario } from "@/lib/auth/guard"

import { CotizacionesContent } from "./cotizaciones-content"

// Sin requirePermiso a propósito — "accesos todos sin restricciones", solo hace
// falta estar logeado.
export default async function CotizacionesPage() {
  await requireUsuario()

  return <CotizacionesContent />
}
