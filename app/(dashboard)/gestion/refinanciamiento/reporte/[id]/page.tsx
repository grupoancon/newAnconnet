import { RefinanciamientoReporteContent } from "./refinanciamiento-reporte-content"

export default function RefinanciamientoReportePage({
  params,
}: {
  params: { id: string }
}) {
  return <RefinanciamientoReporteContent id={params.id} />
}
