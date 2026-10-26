import { requireUsuario } from "@/lib/auth/guard"

import { LotesCotizacionContent } from "./lotes-content"

export default async function CotizacionesLotesPage() {
  await requireUsuario()

  return <LotesCotizacionContent />
}
