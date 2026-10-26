import { requireUsuario } from "@/lib/auth/guard"

import { SelectorProyectosCotizacionContent } from "./selector-proyectos-content"

export default async function CotizacionesNuevaPage() {
  await requireUsuario()

  return <SelectorProyectosCotizacionContent />
}
