import { notFound } from "next/navigation"

import { requirePermisoExplicito } from "@/lib/auth/guard"

import { PreEntregaContent } from "./pre-entrega-content"

export default async function PreEntregaPage({ params }: { params: { id: string } }) {
  await requirePermisoExplicito("entregas:pre_entrega", "Pre-entrega")

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <PreEntregaContent id={id} />
}
