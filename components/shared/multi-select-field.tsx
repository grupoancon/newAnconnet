"use client"

import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Selector de multiples opciones sobre una lista fija (string[], igual que
// SelectField). El valor vive como string[] en el componente — quien lo consume
// decide como serializarlo (ej. value.join(",") para guardar en una columna de
// texto plano como cli_asesor).
export function MultiSelectField({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
  bloqueados = [],
}: {
  label?: string
  placeholder: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
  // Opciones que, si ya estan en `value`, no se pueden destildar desde este selector
  // (ej. el asesor logeado preseleccionado) — solo se pueden agregar mas, no quitar esa.
  bloqueados?: string[]
}) {
  function alternar(opcion: string) {
    if (bloqueados.includes(opcion)) return
    onChange(
      value.includes(opcion) ? value.filter((v) => v !== opcion) : [...value, opcion]
    )
  }

  return (
    <div>
      {label ? (
        <Label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          {label}
        </Label>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "border! border-solid! h-11! w-full! justify-between rounded-md! px-3.5! text-sm font-normal",
              className
            )}
          >
            <span
              className={cn("truncate", value.length === 0 && "text-muted-foreground")}
            >
              {value.length > 0 ? value.join(", ") : placeholder}
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {options.map((opcion) => (
            <DropdownMenuCheckboxItem
              key={opcion}
              checked={value.includes(opcion)}
              disabled={bloqueados.includes(opcion)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => alternar(opcion)}
            >
              {opcion}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
