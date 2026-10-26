"use client"

import { PantallaError } from "@/components/shared/pantalla-error"

// Errores de cualquier pantalla del dashboard — se muestra dentro del shell (menú y
// marco se mantienen), en lugar de la página.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PantallaError error={error} reset={reset} />
}
