import { requireUsuario } from "@/lib/auth/guard"

import { CotizacionReporteContent } from "./cotizacion-reporte-content"

export default async function CotizacionReportePage({
  params,
}: {
  params: { id: string }
}) {
  await requireUsuario()

  return <CotizacionReporteContent id={params.id} />
}
