import { RefinanciamientoImprimirContent } from "./refinanciamiento-imprimir-content"

export default function RefinanciamientoImprimirPage({
  params,
}: {
  params: { id: string }
}) {
  return <RefinanciamientoImprimirContent id={params.id} />
}
