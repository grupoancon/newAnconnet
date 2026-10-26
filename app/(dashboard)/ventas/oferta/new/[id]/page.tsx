import { OfertaCompraContent } from "./oferta-compra-content"

export default function OfertaCompraPage({ params }: { params: { id: string } }) {
  return <OfertaCompraContent id={params.id} />
}
