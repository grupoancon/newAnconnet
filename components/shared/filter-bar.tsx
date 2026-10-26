import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-muted/60 border-border flex items-center gap-2.5 border-b px-4 py-3.5 sm:px-6",
        className
      )}
    >
      {children}
    </div>
  )
}

export function FilterSearchInput({
  placeholder,
  value,
  onChange,
  className,
}: {
  placeholder: string
  value?: string
  onChange?: (value: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-input bg-card flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-md border px-3 sm:w-65 sm:flex-none",
        className
      )}
    >
      <Search className="text-muted-foreground size-[15px] shrink-0" strokeWidth={1.7} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="text-foreground placeholder:text-muted-foreground w-full truncate bg-transparent text-[12.5px] outline-none"
      />
    </div>
  )
}

export function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-input bg-card flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-xs font-semibold">
      {children}
    </span>
  )
}
