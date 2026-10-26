import { requireUsuario } from "@/lib/auth/guard"

import { CotizacionContent } from "./cotizacion-content"

export default async function CotizacionPage({ params }: { params: { id: string } }) {
  await requireUsuario()

  return <CotizacionContent id={params.id} />
}
