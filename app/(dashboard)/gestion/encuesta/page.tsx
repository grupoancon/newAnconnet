"use client"

import { useState } from "react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { RatingScale } from "@/components/shared/rating-scale"

const NIVELES = [
  { color: "bg-status-bloqueado", label: "1: Muy insatisfecho" },
  { color: "bg-primary", label: "2: Insatisfecho" },
  { color: "bg-status-reservado", label: "3: Neutral" },
  { color: "bg-lime-500", label: "4: Satisfecho" },
  { color: "bg-status-disponible", label: "5: Muy satisfecho" },
]

const PREGUNTAS = [
  "¿Cómo califica la atención y el acompañamiento de su asesor?",
  "¿Qué tan clara fue la información sobre el proyecto y las formas de pago propuestas?",
  "¿Qué tan claros fueron los requisitos y documentos solicitados?",
]

export default function EncuestaPage() {
  const [respuestas, setRespuestas] = useState<Record<number, number>>({})
  const progreso = Object.keys(respuestas).length

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="bg-brand-gradient-banner h-1.25" />
          <div className="flex items-start justify-between px-7.5 py-6.5">
            <div>
              <h1 className="mb-1.5 text-[23px] font-extrabold tracking-tight">
                Encuesta de atención
              </h1>
              <p className="text-muted-foreground text-[13.5px]">
                Tu opinión nos ayuda a brindarte un mejor servicio.
              </p>
            </div>
            <span className="bg-accent text-accent-foreground rounded-full px-3.5 py-1.75 text-[12.5px] font-bold whitespace-nowrap">
              {progreso} de {PREGUNTAS.length} respondidas
            </span>
          </div>
          <div className="flex flex-wrap gap-5 px-7.5 pb-5.5">
            {NIVELES.map((nivel) => (
              <span
                key={nivel.label}
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
              >
                <span className={`size-2.25 rounded-full ${nivel.color}`} />
                {nivel.label}
              </span>
            ))}
          </div>
          <div className="border-border border-t" />
          <div className="flex flex-col gap-4 px-7.5 py-6.5">
            {PREGUNTAS.map((pregunta, index) => (
              <RatingScale
                key={pregunta}
                numero={index + 1}
                pregunta={pregunta}
                onChange={(valor) =>
                  setRespuestas((actual) => ({ ...actual, [index]: valor }))
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
