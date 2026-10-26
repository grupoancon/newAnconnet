"use client"

import { PantallaError } from "@/components/shared/pantalla-error"

// Errores fuera del dashboard, o del propio layout del dashboard (que no puede atrapar
// app/(dashboard)/error.tsx porque ese archivo vive dentro de él). Pantalla completa:
// acá no hay shell.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <PantallaError error={error} reset={reset} pantallaCompleta />
}
