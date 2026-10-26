import { notFound } from "next/navigation"

import { requirePermisoExplicito } from "@/lib/auth/guard"

import { EntregaContent } from "./entrega-content"

export default async function EntregaPage({ params }: { params: { id: string } }) {
  await requirePermisoExplicito("entregas:entregar", "Entrega")

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <EntregaContent id={id} />
}
