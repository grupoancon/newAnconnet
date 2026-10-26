import { requirePermiso } from "@/lib/auth/guard"

import ProcesosContentPage from "./procesos-content"

export default async function ProcesosLotePage() {
  await requirePermiso("ventas:nueva", "Nueva Venta")

  return <ProcesosContentPage />
}
