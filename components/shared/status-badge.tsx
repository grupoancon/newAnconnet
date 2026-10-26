import { cn } from "@/lib/utils"

export type StatusVariant =
  | "disponible"
  | "reservado"
  | "bloqueado"
  | "hipotecado"
  | "aprobado"
  | "ingresado"
  | "pendiente"
  | "rechazado"
  | "nuevo"
  | "pronto"
  | "en-tramite"
  | "solicitado"

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  disponible: "bg-status-disponible-bg text-status-disponible-fg",
  aprobado: "bg-status-disponible-bg text-status-disponible-fg",
  reservado: "bg-status-reservado-bg text-status-reservado-fg",
  pendiente: "bg-status-reservado-bg text-status-reservado-fg",
  bloqueado: "bg-status-bloqueado-bg text-status-bloqueado-fg",
  rechazado: "bg-status-bloqueado-bg text-status-bloqueado-fg",
  hipotecado: "bg-status-hipotecado-bg text-status-hipotecado-fg",
  ingresado: "bg-status-hipotecado-bg text-status-hipotecado-fg",
  nuevo: "bg-brand-gradient text-primary-foreground",
  pronto: "bg-muted text-muted-foreground border border-border",
  "en-tramite": "bg-accent text-accent-foreground",
  solicitado: "bg-status-bloqueado-bg text-status-bloqueado-fg",
}

const VARIANT_LABEL: Record<StatusVariant, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  bloqueado: "Bloqueado",
  hipotecado: "Hipotecado",
  aprobado: "Aprobado",
  ingresado: "Ingresado",
  pendiente: "Pendiente",
  rechazado: "Rechazado",
  nuevo: "Nuevo",
  pronto: "Pronto",
  "en-tramite": "Nueva",
  solicitado: "Solicitado",
}

export function StatusBadge({
  variant,
  children,
  className,
  icon,
}: {
  variant: StatusVariant
  children?: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {icon}
      {children ?? VARIANT_LABEL[variant]}
    </span>
  )
}
