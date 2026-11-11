import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type StepStatus = "done" | "incomplete" | "current" | "upcoming"

// `completos` (opcional): si viene, los pasos ya vistos (hasta `visitadoHasta`) se
// pintan según tengan o no sus campos obligatorios — verde con ✓ completo, naranja
// incompleto — en vez de "verde por haber pasado". `onStepClick` deja saltar a un paso;
// `puedeIrA` (opcional) decide a cuáles se puede saltar (los demás quedan deshabilitados).
export function Stepper({
  steps,
  currentIndex,
  completos,
  visitadoHasta,
  onStepClick,
  puedeIrA,
}: {
  steps: string[]
  currentIndex: number
  completos?: boolean[]
  visitadoHasta?: number
  onStepClick?: (index: number) => void
  puedeIrA?: (index: number) => boolean
}) {
  const progressPct = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0
  const hastaVisto = Math.max(visitadoHasta ?? currentIndex, currentIndex)

  function estadoDe(index: number): StepStatus {
    if (index === currentIndex) return "current"
    if (completos) {
      if (index > hastaVisto) return "upcoming"
      return completos[index] ? "done" : "incomplete"
    }
    return index < currentIndex ? "done" : "upcoming"
  }

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
          const status = estadoDe(index)
          const contenido = (
            <>
              {status === "done" && (
                <span className="bg-status-disponible flex size-8 items-center justify-center rounded-full text-white sm:size-9 sm:items-center">
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
              )}
              {status === "incomplete" && (
                <span
                  title="Faltan campos obligatorios"
                  className="bg-status-reservado flex size-8 items-center justify-center rounded-full text-sm font-extrabold text-white sm:size-9 sm:items-center"
                >
                  {index + 1}
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
                  status === "upcoming" && "text-muted-foreground",
                  status === "incomplete" && "text-status-reservado-fg",
                  (status === "done" || status === "current") && "text-foreground"
                )}
              >
                {label}
              </span>
            </>
          )

          const habilitado = index !== currentIndex && (puedeIrA?.(index) ?? true)
          return onStepClick ? (
            <button
              key={label}
              type="button"
              disabled={!habilitado}
              onClick={() => onStepClick(index)}
              aria-current={status === "current" ? "step" : undefined}
              aria-label={`Ir al paso ${index + 1}: ${label}${status === "incomplete" ? " (faltan campos obligatorios)" : ""}`}
              className="focus-visible:ring-ring flex cursor-pointer flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-2 disabled:cursor-default sm:w-28 [&:not(:disabled)]:hover:opacity-80"
            >
              {contenido}
            </button>
          ) : (
            <div key={label} className="flex flex-col items-center gap-2 sm:w-28">
              {contenido}
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
