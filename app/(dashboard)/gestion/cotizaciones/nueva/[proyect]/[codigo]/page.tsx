import { requireUsuario } from "@/lib/auth/guard"

import { DatosClienteCotizacionContent } from "./datos-cliente-content"

export default async function CotizacionesDatosClientePage({
  params,
}: {
  params: { proyect: string; codigo: string }
}) {
  await requireUsuario()

  return (
    <DatosClienteCotizacionContent
      idProyecto={params.proyect}
      codigo={decodeURIComponent(params.codigo)}
    />
  )
}
