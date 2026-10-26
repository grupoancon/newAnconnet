"use client"

import { cn } from "@/lib/utils"

export type OpcionRevisionValor = "SI" | "NO" | "PD" | "NA"

const OPCIONES: OpcionRevisionValor[] = ["SI", "NO", "PD", "NA"]

// Fila de checklist con una sola opcion posible: SI · NO · PD (pendiente) · NA (no
// aplica). Mismo patron visual en el formulario de nuevo proceso y en la pre-entrega.
export function OpcionRevision({
  label,
  value,
  onChange,
}: {
  label: string
  value: OpcionRevisionValor | null
  onChange: (valor: OpcionRevisionValor) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
        {OPCIONES.map((opcion) => {
          const activo = value === opcion
          return (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(opcion)}
              className={cn(
                "h-8 w-11 rounded-md border text-xs font-bold transition-colors",
                activo
                  ? "bg-brand-gradient border-transparent text-white"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {opcion}
            </button>
          )
        })}
      </div>
    </div>
  )
}
