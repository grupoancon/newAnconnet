"use client"

import { useEffect, useRef, useState } from "react"
import { Clock } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HORAS = Array.from({ length: 24 }, (_, indice) => String(indice).padStart(2, "0"))
// Pasos de 5 minutos — más rápido de recorrer que los 60 valores completos, sin
// perder la precisión que sí hace falta acá (a diferencia de la fecha, donde un día
// entero alcanza).
const MINUTOS = Array.from({ length: 12 }, (_, indice) =>
  String(indice * 5).padStart(2, "0")
)

function Columna({
  valores,
  seleccionado,
  onSeleccionar,
}: {
  valores: string[]
  seleccionado: string
  onSeleccionar: (valor: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Al abrir, centra el valor ya elegido (o el primero) en vez de dejar la columna
  // arrancando siempre arriba del todo — mismo espíritu que el calendario, que salta
  // al mes de la fecha ya elegida.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(
      `[data-valor="${seleccionado || valores[0]}"]`
    )
    el?.scrollIntoView({ block: "center" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      className="border-border h-44 w-16 overflow-y-auto rounded-md border scroll-smooth"
    >
      {valores.map((valor) => (
        <button
          key={valor}
          type="button"
          data-valor={valor}
          onClick={() => onSeleccionar(valor)}
          className={cn(
            "flex w-full items-center justify-center py-1.5 text-sm font-semibold transition-colors",
            seleccionado === valor
              ? "bg-brand-gradient text-white"
              : "hover:bg-muted text-foreground"
          )}
        >
          {valor}
        </button>
      ))}
    </div>
  )
}

// Selector de hora práctico: dos columnas cortas (horas/minutos) con scroll
// independiente, en vez de un único SelectField con 96 opciones (00:00..23:45) que
// había que recorrer entero para llegar a una hora de la tarde. Mismo lenguaje visual
// que DatePickerField (trigger con ícono + Popover), pero de a un dígito por columna,
// como un selector de hora nativo de teléfono.
export function TimePickerField({
  label,
  value,
  onChange,
  placeholder = "Seleccione la hora",
}: {
  label?: string
  value: string
  onChange: (hora: string) => void
  placeholder?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [hora, setHora] = useState("")
  const [minuto, setMinuto] = useState("")

  useEffect(() => {
    if (!abierto) return
    const [h, m] = value ? value.split(":") : ["", ""]
    setHora(h ?? "")
    setMinuto(m ?? "")
  }, [abierto, value])

  function confirmar() {
    onChange(`${hora || "00"}:${minuto || "00"}`)
    setAbierto(false)
  }

  return (
    <div>
      {label ? (
        <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          {label}
        </label>
      ) : null}
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="border-input bg-card focus:border-primary focus:ring-ring/15 flex h-11 w-full items-center justify-between rounded-md border px-3.5 text-sm outline-none focus:ring-3"
          >
            <span className={cn(!value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <Clock className="text-muted-foreground size-4 shrink-0" strokeWidth={1.8} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto">
          <div className="flex flex-col p-3.5">
            <div className="mb-2.5 text-center text-sm font-bold">
              {hora || "--"}:{minuto || "--"}
            </div>
            <div className="flex gap-2">
              <Columna valores={HORAS} seleccionado={hora} onSeleccionar={setHora} />
              <Columna valores={MINUTOS} seleccionado={minuto} onSeleccionar={setMinuto} />
            </div>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              disabled={!hora || !minuto}
              onClick={confirmar}
            >
              Aceptar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
