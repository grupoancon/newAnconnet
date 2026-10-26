import { FinanciamientoImprimirContent } from "./financiamiento-imprimir-content"

export default function FinanciamientoImprimirPage({
  params,
}: {
  params: { id: string }
}) {
  return <FinanciamientoImprimirContent id={params.id} />
}
