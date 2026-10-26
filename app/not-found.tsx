import Link from "next/link"

import { BrandMark } from "@/components/shared/brand-mark"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-10">
      <div className="w-full max-w-115 text-center">
        <div className="text-brand-gradient mb-1.5 font-mono text-[110px] leading-none font-bold">
          404
        </div>
        <h1 className="mb-2.5 text-2xl font-extrabold tracking-tight">
          No encontramos esta página
        </h1>
        <p className="text-muted-foreground mb-7 text-[14.5px] leading-[1.55]">
          El enlace puede estar roto o el recurso ya no existe. Verifica la dirección o
          vuelve al inicio.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="lg" asChild>
            <Link href="/">Volver atrás</Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/">
              <BrandMark className="size-4" />
              Ir al inicio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
