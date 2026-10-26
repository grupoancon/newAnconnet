import { OfertaImprimirContent } from "./oferta-imprimir-content"

export default function OfertaImprimirPage({ params }: { params: { id: string } }) {
  return <OfertaImprimirContent id={params.id} />
}
