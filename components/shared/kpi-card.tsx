import { cn } from "@/lib/utils"

export type KpiTrend = "up" | "down" | "neutral"

export function KpiCard({
  label,
  value,
  trend,
  trendLabel,
  icon,
  accentClassName,
  className,
}: {
  label: string
  value: React.ReactNode
  trend?: KpiTrend
  trendLabel?: string
  icon?: React.ReactNode
  accentClassName?: string
  className?: string
}) {
  const trendColor =
    trend === "up"
      ? "text-status-disponible-fg"
      : trend === "down"
        ? "text-status-bloqueado-fg"
        : "text-muted-foreground"

  return (
    <div
      className={cn(
        "bg-card border-border rounded-lg border p-4",
        accentClassName && ["border-l-[3px]", accentClassName],
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground mb-2 text-[11.5px] font-semibold print:mb-0.5! print:text-[12px]!">
            {label}
          </div>
          <div className="font-mono text-[23px] leading-none font-semibold tracking-tight print:text-[12px]!">
            {value}
          </div>
          {trendLabel ? (
            <div className={cn("mt-1.5 text-[11px] font-semibold", trendColor)}>
              {trend === "up" ? "▲ " : null}
              {trendLabel}
            </div>
          ) : null}
        </div>
        {icon ? (
          <div className="bg-accent flex size-9 shrink-0 items-center justify-center rounded-md">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  )
}
