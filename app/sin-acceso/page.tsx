import { Lock } from "lucide-react"
import { redirect } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth/session"

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("")
}

export default async function SinAccesoPage({
  searchParams,
}: {
  searchParams: { seccion?: string }
}) {
  const usuario = await getCurrentUser()
  if (!usuario) {
    redirect("/api/auth/clear-session")
  }

  const seccion = searchParams.seccion ?? "esta sección"

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-10">
      <div className="bg-card w-full max-w-115 rounded-xl p-10 pb-9 text-center shadow-lg">
        <div className="bg-status-bloqueado-bg mx-auto mb-5.5 flex size-16 items-center justify-center rounded-2xl">
          <Lock className="text-status-bloqueado-fg size-[30px]" strokeWidth={1.8} />
        </div>
        <h1 className="mb-2 text-[22px] font-extrabold tracking-tight">
          No tienes acceso a esta sección
        </h1>
        <p className="text-muted-foreground mb-5.5 text-sm leading-[1.55]">
          Tu rol actual no incluye permisos para ver{" "}
          <b className="text-foreground">{seccion}</b>. Si crees que es un error, contacta
          a un administrador.
        </p>
        <div className="bg-muted border-border mb-6.5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-semibold">
          <span className="bg-brand-gradient flex size-6.5 items-center justify-center rounded-md text-[11px] font-extrabold text-white">
            {iniciales(usuario.nombre)}
          </span>
          Conectado como{" "}
          <b className="text-foreground">{usuario.roles[0] ?? "sin rol"}</b>
        </div>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/">Ir al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
