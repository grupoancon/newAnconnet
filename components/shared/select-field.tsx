"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GrupoOpciones, OpcionSelect } from "@/components/shared/select-options"
import { cn } from "@/lib/utils"

// Select real (Radix): abre/cierra con las animaciones de components/ui/select.tsx
// (data-open:animate-in/zoom-in-95, data-closed:animate-out/zoom-out-95).
//
// Acepta "options" (value === label, el caso comun) u "opciones" (value !== label, para
// catalogos como LUGARES_VENTA_OPCIONES donde el value guardado es un codigo corto de
// BD distinto del texto que ve el usuario) — "opciones" gana si vienen los dos. Mismo
// componente para los dos casos para no duplicar el h-11 y el estilo de label de este
// select en un componente aparte (ver CampoSelect, que resuelve lo mismo pero con otra
// altura/estilo, pensado para otros formularios).
//
// "grupos" es para catalogos con secciones (equivalente a <optgroup>, ej. "¿Cómo nos
// contactó?" con REDES SOCIALES / REFERIDOS / FERIAS / etc.) — gana sobre
// "options"/"opciones" si viene.
export function SelectField({
  label,
  placeholder,
  options,
  opciones,
  grupos,
  value,
  defaultValue,
  onValueChange,
  className,
}: {
  label?: string
  placeholder: string
  options?: string[]
  opciones?: OpcionSelect[]
  grupos?: GrupoOpciones[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}) {
  const items: OpcionSelect[] =
    opciones ?? (options ?? []).map((texto) => ({ value: texto, label: texto }))

  return (
    <div>
      {label ? (
        <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          {label}
        </label>
      ) : null}
      <Select value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
        <SelectTrigger
          className={cn(
            "border-input bg-card focus:border-primary focus:ring-ring/15 h-11! w-full! rounded-md! px-3.5! text-sm focus:ring-3",
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {grupos
            ? grupos.map((seccion) => (
                <SelectGroup key={seccion.grupo}>
                  <SelectLabel>{seccion.grupo}</SelectLabel>
                  {seccion.opciones.map((opcion) => (
                    <SelectItem key={opcion} value={opcion}>
                      {opcion}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            : items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function StaticField({
  label,
  value,
  mono = false,
  emphasis = false,
  className,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  emphasis?: boolean
  className?: string
}) {
  return (
    <div>
      <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
        {label}
      </label>
      <div
        className={cn(
          "border-border bg-muted/60 flex h-11 items-center rounded-md border px-3.5 text-sm",
          mono && "font-mono",
          emphasis && "font-bold",
          className
        )}
      >
        {value}
      </div>
    </div>
  )
}
