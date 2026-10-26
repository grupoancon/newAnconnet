import { redirect } from "next/navigation"

import { AppShell } from "@/components/shared/app-shell"
import { MantenimientoBanner } from "@/components/shared/mantenimiento-banner"
import { MantenimientoPantalla } from "@/components/shared/mantenimiento-pantalla"
import { MantenimientoWatcher } from "@/components/shared/mantenimiento-watcher"
import { ServidorNoDisponible } from "@/components/shared/servidor-no-disponible"
import { getCurrentUser, ServidorNoDisponibleError } from "@/lib/auth/session"
import { getEstadoMantenimiento, huellaMantenimiento } from "@/lib/mantenimiento/estado"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defensa en profundidad: el middleware ya filtra por cookie/rol, pero cada layout
  // protegido vuelve a resolver la sesion contra la base de datos antes de renderizar.
  let usuario: Awaited<ReturnType<typeof getCurrentUser>>
  let mantenimiento: Awaited<ReturnType<typeof getEstadoMantenimiento>>
  try {
    ;[usuario, mantenimiento] = await Promise.all([
      getCurrentUser(),
      getEstadoMantenimiento(),
    ])
  } catch (error) {
    // El backend no respondio: la sesion NO se cierra (ver ServidorNoDisponibleError).
    if (error instanceof ServidorNoDisponibleError) return <ServidorNoDisponible />
    throw error
  }

  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  // Modo mantenimiento (se activa en /configuracion/mantenimiento). En "bloqueo" nadie
  // salvo Administrador ve la intranet — si no, el admin también quedaría afuera y no
  // podría desactivarlo. El chequeo va acá y no en el middleware porque el edge no
  // puede consultar la BD.
  const esAdmin = usuario.roles.includes("Administrador")
  const huella = huellaMantenimiento(mantenimiento)
  const watcher = <MantenimientoWatcher huellaInicial={huella} />

  if (mantenimiento.activo && mantenimiento.modo === "bloqueo" && !esAdmin) {
    return (
      <>
        {watcher}
        <MantenimientoPantalla estado={mantenimiento} nombreUsuario={usuario.nombre} />
      </>
    )
  }

  const aviso = mantenimiento.activo ? (
    <MantenimientoBanner
      estado={mantenimiento}
      esAdminEnBloqueo={mantenimiento.modo === "bloqueo"}
    />
  ) : null

  return (
    <AppShell usuario={usuario} aviso={aviso}>
      {watcher}
      {children}
    </AppShell>
  )
}
