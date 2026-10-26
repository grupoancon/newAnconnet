import { requireUsuario } from "@/lib/auth/guard"

import { CotizacionImprimirContent } from "./cotizacion-imprimir-content"

export default async function CotizacionImprimirPage({
  params,
}: {
  params: { id: string }
}) {
  await requireUsuario()

  return <CotizacionImprimirContent id={params.id} />
}
