"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ComboboxField } from "@/components/shared/combobox-field"
import type { OpcionSelect } from "@/components/shared/select-options"

// Con más opciones que esto se usa el combo con buscador: en el teléfono la lista del
// Select no se podía desplazar con el dedo (sobre todo dentro de un Sheet), y una lista
// larga (ej. los lotes de un proyecto) igual se busca mejor escribiendo.
const MAX_OPCIONES_SIN_BUSCADOR = 12

// Select controlado donde el valor guardado puede ser distinto del texto que ve el
// usuario (p. ej. columnas cortas en la BD) — ver componentes/shared/select-options.ts
// para los catalogos de OpcionSelect ya definidos (SEXOS_OPCIONES, etc).
export function CampoSelect({
  label,
  value,
  onChange,
  opciones,
  placeholder,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  opciones: OpcionSelect[]
  placeholder?: string
}) {
  if (opciones.length > MAX_OPCIONES_SIN_BUSCADOR) {
    return (
      <ComboboxField
        label={label}
        placeholder={placeholder ?? "Seleccionar…"}
        options={opciones}
        value={value}
        onChange={onChange}
      />
    )
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder ?? "Seleccionar…"} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
