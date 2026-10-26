import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type AlertVariant = "success" | "info" | "warning" | "error" | "brand"

const VARIANT_STYLES: Record<
  Exclude<AlertVariant, "brand">,
  { bg: string; border: string; title: string; body: string; icon: LucideIcon }
> = {
  success: {
    bg: "bg-status-disponible-bg",
    border: "border-status-disponible-border",
    title: "text-status-disponible-fg",
    body: "text-status-disponible-fg",
    icon: CheckCircle2,
  },
  info: {
    bg: "bg-status-hipotecado-bg",
    border: "border-status-hipotecado-border",
    title: "text-status-hipotecado-fg",
    body: "text-status-hipotecado-fg",
    icon: Info,
  },
  warning: {
    bg: "bg-status-reservado-bg",
    border: "border-status-reservado-border",
    title: "text-status-reservado-fg",
    body: "text-status-reservado-fg",
    icon: AlertTriangle,
  },
  error: {
    bg: "bg-status-bloqueado-bg",
    border: "border-status-bloqueado-border",
    title: "text-status-bloqueado-fg",
    body: "text-status-bloqueado-fg",
    icon: AlertCircle,
  },
}

const VARIANT_TITLE: Record<Exclude<AlertVariant, "brand">, string> = {
  success: "Éxito",
  info: "Información",
  warning: "Advertencia",
  error: "Error",
}

export function AlertBanner({
  variant,
  title,
  children,
  className,
}: {
  variant: AlertVariant
  title?: string
  children: React.ReactNode
  className?: string
}) {
  if (variant === "brand") {
    return (
      <div
        className={cn(
          "bg-brand-gradient rounded-md px-4 py-3 text-[12.5px] font-semibold text-white",
          className
        )}
      >
        {children}
      </div>
    )
  }

  const { bg, border, title: titleColor, body, icon: Icon } = VARIANT_STYLES[variant]

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-3",
        bg,
        border,
        className
      )}
    >
      <Icon className={cn("mt-0.5 size-[17px] shrink-0", titleColor)} strokeWidth={1.8} />
      <div>
        <div className={cn("text-[12.5px] font-bold", titleColor)}>
          {title ?? VARIANT_TITLE[variant]}
        </div>
        <div className={cn("text-xs", body)}>{children}</div>
      </div>
    </div>
  )
}
