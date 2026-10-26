import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type SalesBarDatum = {
  label: string
  heightPct: number
  value: number
  highlighted?: boolean
}

export function SalesBarChart({
  data,
  className,
}: {
  data: SalesBarDatum[]
  className?: string
}) {
  return (
    <div className={cn("flex h-36 items-end gap-3", className)}>
      {data.map((d) => (
        <div
          key={d.label}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "min-h-1 w-full rounded-t-[6px]",
                  d.highlighted ? "bg-brand-gradient" : "bg-accent"
                )}
                style={{ height: `${d.heightPct}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {d.value} {d.value === 1 ? "venta" : "ventas"} · {d.label}
            </TooltipContent>
          </Tooltip>
          <span
            className={cn(
              "text-[10px]",
              d.highlighted ? "text-foreground font-bold" : "text-muted-foreground"
            )}
          >
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}
