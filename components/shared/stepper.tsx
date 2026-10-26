import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type StepStatus = "done" | "current" | "upcoming"

export function Stepper({
  steps,
  currentIndex,
}: {
  steps: string[]
  currentIndex: number
}) {
  const progressPct = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0

  return (
    <div className="relative mb-4 [--inset:1rem] sm:[--inset:1.5rem]">
      <div className="bg-border absolute top-[15px] right-(--inset) left-(--inset) h-0.5 sm:top-[19px]" />
      <div
        className="bg-brand-gradient absolute top-[15px] left-(--inset) h-0.5 transition-all duration-300 sm:top-[19px]"
        style={{
          width: `calc(${progressPct}% * (100% - var(--inset) * 2) / 100%)`,
          maxWidth: "calc(100% - var(--inset) * 2)",
        }}
      />
      <div className="relative flex justify-between">
        {steps.map((label, index) => {
          const status: StepStatus =
            index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "upcoming"

          return (
            <div key={label} className="flex flex-col items-center gap-2 sm:w-28">
              {status === "done" && (
                <span className="bg-status-disponible flex size-8 items-center justify-center rounded-full text-white sm:size-9 sm:items-center">
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
              )}
              {status === "current" && (
                <span className="bg-brand-gradient shadow-brand ring-primary/20 flex size-8 items-center justify-center rounded-full text-sm font-extrabold text-white ring-4 sm:size-9 sm:items-center">
                  {index + 1}
                </span>
              )}
              {status === "upcoming" && (
                <span className="border-input text-muted-foreground flex size-8 items-center justify-center rounded-full border-[1.5px] bg-white text-sm font-bold sm:size-9 sm:items-center">
                  {index + 1}
                </span>
              )}
              <span
                className={cn(
                  "hidden text-center text-[11.5px] font-bold sm:block",
                  status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
      {/* Mobile: no entran todas las etiquetas — solo la del paso actual. */}
      <p className="mt-3 text-center text-xs font-bold sm:hidden">
        {steps[currentIndex]}
      </p>
    </div>
  )
}
