"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

const NIVEL_COLORS = [
  "bg-status-bloqueado text-white",
  "bg-primary text-white",
  "bg-status-reservado text-white",
  "bg-lime-500 text-white",
  "bg-status-disponible text-white",
]

export function RatingScale({
  numero,
  pregunta,
  onChange,
}: {
  numero: number
  pregunta: string
  onChange?: (valor: number) => void
}) {
  const [seleccion, setSeleccion] = useState<number | null>(null)

  return (
    <div className="border-border rounded-lg border p-5.5">
      <div className="mb-4.5 flex items-center gap-3">
        <span className="bg-brand-gradient flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-extrabold text-white">
          {numero}
        </span>
        <span className="text-[15.5px] font-bold">{pregunta}</span>
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {[1, 2, 3, 4, 5].map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => {
              setSeleccion(valor)
              onChange?.(valor)
            }}
            className={cn(
              "border-input rounded-md border py-2.5 text-sm font-bold transition-colors",
              seleccion === valor ? NIVEL_COLORS[valor - 1] : "bg-card hover:bg-muted"
            )}
          >
            {valor}
          </button>
        ))}
      </div>
    </div>
  )
}
