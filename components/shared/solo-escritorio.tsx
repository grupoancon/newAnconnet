import { Monitor } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"

// Pantallas que solo se pueden usar en escritorio (ej. editores con tablas o plantillas
// largas). Por debajo de `lg` (el mismo corte que muestra el menu lateral) se reemplaza
// el contenido por un aviso, con un enlace para volver.
export function SoloEscritorio({
  children,
  volverHref,
  volverLabel = "Volver",
  titulo = "Solo disponible en escritorio",
  descripcion = "Esta sección no se puede usar desde el teléfono. Ábrela desde una computadora para continuar.",
}: {
  children: React.ReactNode
  volverHref?: string
  volverLabel?: string
  titulo?: string
  descripcion?: string
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-4 lg:hidden">
        <EmptyState
          className="w-full"
          icon={
            <Monitor className="text-muted-foreground size-[19px]" strokeWidth={1.7} />
          }
          title={titulo}
          description={descripcion}
        />
        {volverHref ? (
          <Button asChild variant="outline">
            <Link href={volverHref}>{volverLabel}</Link>
          </Button>
        ) : null}
      </div>
      <div className="hidden lg:block">{children}</div>
    </>
  )
}
