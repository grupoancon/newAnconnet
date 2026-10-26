import { cn } from "@/lib/utils"

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-border border-t-primary inline-block size-8 animate-spin rounded-full border-[3px]",
        className
      )}
      role="status"
      aria-label="Cargando"
    />
  )
}

export function DotsPulse({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="bg-primary size-1.5 animate-pulse rounded-full" />
      <span className="bg-primary size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
      <span className="bg-primary size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
    </span>
  )
}
