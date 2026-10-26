import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { PageHeader } from "@/components/shared/page-header"
import { SoloEscritorio } from "@/components/shared/solo-escritorio"
import { requirePermiso } from "@/lib/auth/guard"

import { ConvenioForm } from "../convenio-form"

export default async function NuevoConvenioPage() {
  await requirePermiso("convenios:gestionar", "Convenios")

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader eyebrow="Configuración / Convenios" title="Nuevo convenio" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mx-auto max-w-4xl">
          <SoloEscritorio
            volverHref="/configuracion/convenios"
            volverLabel="Volver a convenios"
          >
            <ConvenioForm />
          </SoloEscritorio>
        </div>
      </div>
    </div>
  )
}
