import { cn } from "@/lib/utils"

export function CodeChip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "bg-accent text-accent-foreground rounded-md px-2.5 py-1 font-mono text-[13px] font-bold",
        className
      )}
    >
      {children}
    </span>
  )
}
