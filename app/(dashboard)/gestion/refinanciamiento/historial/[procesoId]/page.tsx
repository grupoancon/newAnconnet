import { requirePermiso } from "@/lib/auth/guard"

import { HistorialRefinanciamientosContent } from "./historial-content"

export default async function HistorialRefinanciamientosPage({
  params,
}: {
  params: { procesoId: string }
}) {
  // Guard server-side: si no tiene el permiso, redirige a /sin-acceso por dentro.
  await requirePermiso("refinanciamiento:crear", "Refinanciamientos")

  return <HistorialRefinanciamientosContent procesoId={params.procesoId} />
}
