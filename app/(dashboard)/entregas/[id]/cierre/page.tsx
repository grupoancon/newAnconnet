import { notFound } from "next/navigation"

import { requirePermisoExplicito } from "@/lib/auth/guard"

import { CierreContent } from "./cierre-content"

export default async function CierrePage({ params }: { params: { id: string } }) {
  await requirePermisoExplicito("entregas:cerrar", "Cierre de entregas")

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <CierreContent id={id} />
}
