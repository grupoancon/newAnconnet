import { LicitudReporteContent } from "./licitud-reporte-content"

export default function LicitudReportePage({ params }: { params: { id: string } }) {
  return <LicitudReporteContent id={params.id} />
}
