import { requireAlgunPermiso } from "@/lib/auth/guard"

import { DocumentosProcesoContent } from "./documentos-content"

// Pantalla compartida: la usa tanto el asesor que creo el proceso ("ventas:nueva")
// como quien revisa documentacion ("documentos:revisar") — el acceso real a los
// documentos de ESTE proceso puntual (creador o revisor) lo valida el backend, esto
// solo exige tener alguno de los dos permisos para entrar a la seccion.
export default async function DocumentosProcesoPage() {
  await requireAlgunPermiso(
    ["ventas:nueva", "documentos:revisar"],
    "Documentos del proceso"
  )

  return <DocumentosProcesoContent />
}
