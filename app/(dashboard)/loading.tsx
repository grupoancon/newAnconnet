import { Spinner } from "@/components/shared/spinner"

// Se muestra al instante mientras carga la página a la que se navegó (el shell —menú
// y marco— se mantiene). Sin esto la pantalla anterior queda congelada hasta que la
// nueva está lista.
export default function DashboardLoading() {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner />
      <p className="text-muted-foreground text-xs font-medium">Cargando…</p>
    </div>
  )
}
