import { FinanciamientoReporteContent } from "./financiamiento-reporte-content"

export default function FinanciamientoReportePage({
  params,
}: {
  params: { id: string }
}) {
  return <FinanciamientoReporteContent id={params.id} />
}
