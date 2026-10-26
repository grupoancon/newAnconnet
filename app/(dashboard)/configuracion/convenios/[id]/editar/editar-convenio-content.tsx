"use client"

import { useEffect, useState } from "react"
import { Lock } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { SoloEscritorio } from "@/components/shared/solo-escritorio"
import { Spinner } from "@/components/shared/spinner"
import { obtenerConvenio, type ConvenioConAsignaciones } from "@/lib/api/convenios-api"
import { VentasApiError } from "@/lib/api/ventas-api"

import { ConvenioForm } from "../../convenio-form"

export function EditarConvenioContent({ id }: { id: string }) {
  const [convenio, setConvenio] = useState<ConvenioConAsignaciones | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)

  useEffect(() => {
    obtenerConvenio(Number(id))
      .then(setConvenio)
      .catch((err) => {
        if (err instanceof VentasApiError && err.status === 403) {
          setSinPermiso(true)
        } else {
          setError(
            err instanceof VentasApiError
              ? err.message
              : "No se pudo conectar con el servidor"
          )
        }
      })
  }, [id])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader
        eyebrow="Configuración / Convenios"
        title={convenio?.nombre ?? "Editar convenio"}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mx-auto max-w-4xl">
          <SoloEscritorio
            volverHref="/configuracion/convenios"
            volverLabel="Volver a convenios"
            descripcion="El editor de plantillas de convenio solo se puede usar desde una computadora."
          >
            {sinPermiso ? (
              <EmptyState
                icon={
                  <Lock className="text-muted-foreground size-[19px]" strokeWidth={1.7} />
                }
                title="No tienes permiso para esta sección"
                description='Pídele a un administrador que te otorgue el permiso "convenios:gestionar".'
                dashed
              />
            ) : error ? (
              <EmptyState
                title="No se pudo cargar el convenio"
                description={error}
                dashed
              />
            ) : !convenio ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />
              </div>
            ) : (
              <ConvenioForm convenio={convenio} />
            )}
          </SoloEscritorio>
        </div>
      </div>
    </div>
  )
}
