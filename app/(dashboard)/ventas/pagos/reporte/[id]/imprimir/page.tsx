import { PagoImprimirContent } from "./pago-imprimir-content"

export default function PagoImprimirPage({ params }: { params: { id: string } }) {
  return <PagoImprimirContent id={params.id} />
}
