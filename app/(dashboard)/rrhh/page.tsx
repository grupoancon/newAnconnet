"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { useCan } from "@/components/shared/can"
import { PillTabs } from "@/components/shared/pill-tabs"
import { ColaboradoresTab } from "./colaboradores-tab"
import { DocumentosTab } from "./documentos-tab"
import { PermisosTab } from "./permisos-tab"
import { PrestamosTab } from "./prestamos-tab"
import { VacacionesTab } from "./vacaciones-tab"

const TABS = [
  { id: "vacaciones", label: "Vacaciones" },
  { id: "permisos", label: "Permisos" },
  { id: "prestamos", label: "Préstamos" },
  { id: "usuarios", label: "Usuarios", requierePermiso: "rrhh:gestionar" },
  { id: "documentos", label: "Documentos" },
]

// Las cinco pestañas ya son funcionales — cada colaborador crea y ve solo lo suyo
// (ver PermisosTab/PrestamosTab/VacacionesTab); editar/eliminar/aprobar/administrar
// (incl. "Usuarios", el saldo de vacaciones de cada quien) exige el permiso puntual
// "rrhh:gestionar". El `?tab=` en la URL deja que una notificación ("Ya puedes elegir
// tus vacaciones") abra directo en la pestaña correcta.
export default function RrhhPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState("vacaciones")
  const puedeGestionar = useCan("rrhh:gestionar")

  // "Usuarios" solo aparece para quien tiene rrhh:gestionar.
  const tabs = TABS.filter((t) => !t.requierePermiso || puedeGestionar).map(
    ({ id, label }) => ({ id, label })
  )

  useEffect(() => {
    const tabInicial = searchParams.get("tab")
    if (tabInicial && tabs.some((t) => t.id === tabInicial)) {
      setTab(tabInicial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tituloTab = tabs.find((t) => t.id === tab)?.label ?? ""

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <PillTabs className="mb-4 sm:mb-5.5" value={tab} onChange={setTab} tabs={tabs} />

        <h1 className="text-accent-foreground mb-5 text-xl font-extrabold tracking-tight sm:text-[22px]">
          {tituloTab}
        </h1>

        {tab === "permisos" ? (
          <PermisosTab />
        ) : tab === "prestamos" ? (
          <PrestamosTab />
        ) : tab === "usuarios" && puedeGestionar ? (
          <ColaboradoresTab />
        ) : tab === "documentos" ? (
          <DocumentosTab />
        ) : (
          <VacacionesTab />
        )}
      </div>
    </div>
  )
}
