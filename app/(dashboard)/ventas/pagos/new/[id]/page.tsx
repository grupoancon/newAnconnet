import { PagoContent } from "./pago-content"

export default function PagoPage({ params }: { params: { id: string } }) {
  return <PagoContent id={params.id} />
}
