import { ConvenioReporteContent } from "./convenio-reporte-content"

export default function ConvenioReportePage({ params }: { params: { id: string } }) {
  return <ConvenioReporteContent id={params.id} />
}
