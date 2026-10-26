import { RefinanciamientoContent } from "./refinanciamiento-content"

export default function RefinanciamientoPage({ params }: { params: { id: string } }) {
  return <RefinanciamientoContent id={params.id} />
}
