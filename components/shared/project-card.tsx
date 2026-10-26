"use client"

import Image from "next/image"
import { useRouter } from "@/lib/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ProjectBadgeTone = "green" | "red" | "blue" | "gray"

const BADGE_TONE_CLASSES: Record<ProjectBadgeTone, string> = {
  green: "text-status-disponible-fg",
  red: "text-status-bloqueado-fg",
  blue: "text-status-hipotecado-fg",
  gray: "text-muted-foreground",
}

export function ProjectCard({
  name,
  description,
  imageSrc,
  logoSrc,
  gradientClassName,
  badge,
  badgeTone = "red",
  href = "/ventas/lotes",
}: {
  name: string
  description: string
  // Foto real del proyecto (public/images/proyectos/...). Si no se pasa, se usa el
  // fondo degradado como placeholder para que la tarjeta no se vea rota.
  imageSrc?: string
  // Logo/isotipo del proyecto (PNG transparente) superpuesto sobre la foto.
  // Si no se pasa, se muestra el nombre en texto blanco en su lugar.
  logoSrc?: string
  gradientClassName?: string
  badge?: string
  badgeTone?: ProjectBadgeTone
  href?: string
}) {
  const router = useRouter()

  return (
    <div className="bg-card border-border group overflow-hidden rounded-lg border shadow-sm transition-all duration-250 hover:-translate-y-1 hover:shadow-lg">
      <div
        className={cn(
          "relative flex h-32.5 items-end overflow-hidden p-3.5",
          !imageSrc && gradientClassName
        )}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            // Fotos subidas desde Gestión de inventario (S3) o la vista previa local
            // (blob:) no pasan por el optimizador de Next, que solo acepta dominios
            // registrados en next.config; las de /public sí se optimizan.
            unoptimized={!imageSrc.startsWith("/")}
          />
        ) : null}

        {/* Degradado negro de abajo (más opaco) hacia arriba (transparente) para que el
            nombre del proyecto se lea sobre cualquier foto. */}
        {imageSrc ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/30 to-transparent"
          />
        ) : null}

        {badge ? (
          <span
            className={cn(
              "absolute top-3 left-3 z-10 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold tracking-wide",
              BADGE_TONE_CLASSES[badgeTone]
            )}
          >
            {badge}
          </span>
        ) : null}

        {logoSrc ? (
          <div className="relative z-10 h-14 w-44">
            <Image src={logoSrc} alt={name} fill className="object-contain object-left" />
          </div>
        ) : (
          <span className="relative z-10 text-xl font-extrabold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
            {name}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-muted-foreground mb-3.5 min-h-9.5 text-[12.5px] leading-[1.5]">
          {description}
        </p>
        <Button onClick={() => router.push(href)} className="w-full">
          Ingresar
        </Button>
      </div>
    </div>
  )
}
