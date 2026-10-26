import { can } from "@/lib/auth/rbac"
import { requireUsuario } from "@/lib/auth/guard"
import { reportesPermitidos } from "@/lib/reportes/catalogo"

import { ReportesContent } from "./reportes-content"

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: { r?: string }
}) {
  // La página la ve cualquier usuario logueado; lo que se restringe es cada reporte.
  const usuario = await requireUsuario()

  // Se filtra en servidor: al cliente solo llegan los reportes permitidos, así que ni
  // el listado ni el componente de un reporte ajeno se exponen. Con ninguno, la página
  // muestra un estado vacío en vez de redirigir.
  const permitidos = reportesPermitidos(usuario)

  return (
    <ReportesContent
      reportes={permitidos.map(({ id, titulo, descripcion }) => ({
        id,
        titulo,
        descripcion,
      }))}
      inicial={searchParams.r}
      puedeAdministrar={can(usuario, "reportes", "administrar")}
    />
  )
}
