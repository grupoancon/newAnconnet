"use client"

import { cn } from "@/lib/utils"

export type PillTabItem = {
  id: string
  label: string
}

export function PillTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: PillTabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-muted border-border inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-md border p-0.75",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "shrink-0 rounded-[7px] px-3.5 py-2 text-[12.5px] font-bold whitespace-nowrap transition-colors sm:px-4.5",
            value === tab.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
