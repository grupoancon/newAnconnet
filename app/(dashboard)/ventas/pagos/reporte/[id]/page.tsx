import { PagoReporteContent } from "./pago-reporte-content"

export default function PagoReportePage({ params }: { params: { id: string } }) {
  return <PagoReporteContent id={params.id} />
}
