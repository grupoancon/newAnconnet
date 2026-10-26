import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

export function EmptyState({
  icon,
  title,
  description,
  className,
  dashed = true,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  className?: string
  dashed?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg p-8 text-center",
        dashed ? "border-border border border-dashed" : "bg-card border-border border",
        className
      )}
    >
      <div className="bg-muted flex size-10 items-center justify-center rounded-full">
        {icon ?? (
          <Search className="text-muted-foreground size-[19px]" strokeWidth={1.7} />
        )}
      </div>
      <div className="text-sm font-bold">{title}</div>
      {description ? (
        <div className="text-muted-foreground text-[11.5px]">{description}</div>
      ) : null}
    </div>
  )
}
