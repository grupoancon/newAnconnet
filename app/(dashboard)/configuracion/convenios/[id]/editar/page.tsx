import { requirePermiso } from "@/lib/auth/guard"

import { EditarConvenioContent } from "./editar-convenio-content"

export default async function EditarConvenioPage({ params }: { params: { id: string } }) {
  await requirePermiso("convenios:gestionar", "Convenios")

  return <EditarConvenioContent id={params.id} />
}
