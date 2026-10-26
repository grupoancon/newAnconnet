"use client"

import { AppTopbar } from "@/components/shared/app-topbar"
import { useSession } from "@/components/shared/session-provider"

export function DashboardTopbar({ actions }: { actions?: React.ReactNode }) {
  const usuario = useSession()
  return <AppTopbar nombre={usuario.nombre} actions={actions} />
}
