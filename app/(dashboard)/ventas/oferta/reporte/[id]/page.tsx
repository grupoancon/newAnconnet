import { OfertaReporteContent } from "./oferta-reporte-content"

export default function OfertaReportePage({ params }: { params: { id: string } }) {
  return <OfertaReporteContent id={params.id} />
}
