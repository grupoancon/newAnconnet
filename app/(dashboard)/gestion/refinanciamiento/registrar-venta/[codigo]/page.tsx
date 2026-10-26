import { requirePermiso } from "@/lib/auth/guard"

import { RegistrarVentaHistoricaContent } from "./registrar-venta-content"

export default async function RegistrarVentaHistoricaPage({
  params,
}: {
  params: { codigo: string }
}) {
  // Guard server-side: si no tiene el permiso, redirige a /sin-acceso por dentro.
  await requirePermiso("refinanciamiento:crear", "Refinanciamientos")

  return <RegistrarVentaHistoricaContent codigo={params.codigo} />
}
