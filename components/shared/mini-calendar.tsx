"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

const DIAS = ["D", "L", "M", "M", "J", "V", "S"]

export type CalendarDay = {
  day: number
  hasEvent?: boolean
}

export function MiniCalendar({
  monthLabel,
  leadingBlanks,
  days,
  selectedDay,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  footer,
  className,
}: {
  monthLabel: string
  leadingBlanks: number
  days: CalendarDay[]
  selectedDay?: number
  onSelectDay?: (day: number) => void
  onPrevMonth?: () => void
  onNextMonth?: () => void
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-card border-border flex flex-col rounded-lg border p-4 lg:p-4.5",
        className
      )}
    >
      <div className="mb-3.5 flex items-center justify-between">
        <div className="text-sm font-bold">{monthLabel}</div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onPrevMonth?.()}
            className="border-border flex size-[26px] items-center justify-center rounded-md border"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="text-muted-foreground size-3.5" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => onNextMonth?.()}
            className="border-border flex size-[26px] items-center justify-center rounded-md border"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="text-muted-foreground size-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className="text-muted-foreground mb-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold">
        {DIAS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="text-foreground grid flex-1 grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map(({ day, hasEvent }) => {
          const isSelected = day === selectedDay
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay?.(day)}
              className="relative flex items-center justify-center py-1.5"
            >
              <span
                className={cn(
                  "flex size-[26px] items-center justify-center rounded-full transition-colors",
                  isSelected && "bg-brand-gradient font-bold text-white",
                  !isSelected && "hover:bg-muted"
                )}
              >
                {day}
              </span>
              {hasEvent && !isSelected ? (
                <span className="bg-status-disponible absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full" />
              ) : null}
            </button>
          )
        })}
      </div>
      {footer ? (
        <div className="border-border mt-3 flex gap-2 border-t pt-3">{footer}</div>
      ) : null}
    </div>
  )
}
