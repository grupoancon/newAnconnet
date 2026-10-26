"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-all duration-150",
        disabled && "cursor-not-allowed opacity-40",
        !disabled && "cursor-pointer active:scale-90",
        checked
          ? "bg-brand-gradient border-transparent shadow-sm"
          : "border-input bg-card hover:border-primary/60",
        className
      )}
    >
      <Check
        className={cn(
          "size-3 text-white transition-all duration-150",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
        strokeWidth={3}
      />
    </button>
  )
}
