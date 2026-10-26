import { FinanciamientoContent } from "./financiamiento-content"

export default function FinanciamientoPage({ params }: { params: { id: string } }) {
  return <FinanciamientoContent id={params.id} />
}
