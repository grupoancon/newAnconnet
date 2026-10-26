import { cn } from "@/lib/utils"

export type RowActionVariant = "default" | "success" | "danger"

export function RowActionButton({
  icon,
  variant = "default",
  label,
  onClick,
}: {
  icon: React.ReactNode
  variant?: RowActionVariant
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-md border transition-colors",
        variant === "default" &&
          "border-border bg-card text-muted-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground",
        variant === "success" &&
          "bg-status-disponible border-transparent text-white hover:brightness-95",
        variant === "danger" &&
          "border-status-bloqueado-border bg-status-bloqueado-bg text-status-bloqueado-fg hover:brightness-95"
      )}
    >
      {icon}
    </button>
  )
}

export function RowActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>
}
