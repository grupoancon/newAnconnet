"use client"

import { Fragment, useMemo, useState } from "react"
import { Check, ChevronDown, Plus, Search } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { EtiquetaCampo } from "@/components/shared/etiqueta-campo"

export type ComboboxOption = {
  value: string
  label: string
  // Texto adicional que tambien cuenta para el filtro de busqueda pero no se muestra
  // (ej. el pais para un combo de nacionalidad, buscable aunque la opcion muestre el
  // gentilicio).
  keywords?: string
  // Categoría: si las opciones la traen, la lista se muestra agrupada con un título por
  // categoría, y buscar el nombre de la categoría muestra todas sus opciones.
  group?: string
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

// Select con busqueda en vivo sobre una lista larga de opciones (ej. nacionalidades),
// donde un <select> nativo o el CampoSelect/SelectField de esta app se vuelven
// impracticos de recorrer a mano. Construido con Popover + input propio (sin cmdk) para
// no sumar una dependencia nueva solo para esto.
export function ComboboxField({
  label,
  placeholder,
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin resultados.",
  options,
  value,
  onChange,
  className,
  permitirAgregar = false,
}: {
  label?: string
  placeholder: string
  searchPlaceholder?: string
  emptyMessage?: string
  options: ComboboxOption[]
  value?: string
  onChange: (value: string) => void
  className?: string
  // Si la búsqueda no coincide con ninguna opción, ofrece "Agregar «texto»" y lo usa
  // como valor tal cual (un valor que no está en `options` igual se muestra).
  permitirAgregar?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState("")

  const seleccionada = options.find((opcion) => opcion.value === value)
  const etiquetaSeleccionada =
    seleccionada?.label ?? (permitirAgregar && value ? value : undefined)

  const opcionesFiltradas = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    if (!termino) return options
    return options.filter((opcion) =>
      normalizar(
        `${opcion.label} ${opcion.keywords ?? ""} ${opcion.group ?? ""}`
      ).includes(termino)
    )
  }, [options, busqueda])

  const textoNuevo = busqueda.trim()
  const puedeAgregar =
    permitirAgregar &&
    textoNuevo.length > 0 &&
    !options.some((opcion) => normalizar(opcion.value) === normalizar(textoNuevo))

  function elegir(valor: string) {
    onChange(valor)
    setOpen(false)
    setBusqueda("")
  }

  return (
    <div>
      {label ? (
        <Label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          <EtiquetaCampo>{label}</EtiquetaCampo>
        </Label>
      ) : null}
      {/* modal: dentro de un Sheet/Dialog, el bloqueo de scroll del Sheet se tragaba el
        arrastre táctil sobre la lista (que va en un portal fuera del Sheet) y en el
        teléfono no se podía bajar. Con modal el popover tiene su propio bloqueo, que sí
        deja desplazar su contenido. */}
      <Popover
        modal
        open={open}
        onOpenChange={(siguiente) => {
          setOpen(siguiente)
          if (!siguiente) setBusqueda("")
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "border-input bg-card focus:border-primary focus:ring-ring/15 flex h-11 w-full items-center justify-between rounded-md border px-3.5 text-sm outline-none focus:ring-3",
              className
            )}
          >
            <span
              className={cn("truncate", !etiquetaSeleccionada && "text-muted-foreground")}
            >
              {etiquetaSeleccionada ?? placeholder}
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="border-border flex items-center gap-2 border-b px-3 py-2.5">
            <Search
              className="text-muted-foreground size-3.5 shrink-0"
              strokeWidth={1.8}
            />
            <input
              autoFocus
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder={searchPlaceholder}
              className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
            {puedeAgregar && (
              <button
                type="button"
                onClick={() => elegir(textoNuevo)}
                className="hover:bg-accent hover:text-accent-foreground text-primary flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-sm font-semibold"
              >
                <Plus className="size-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">Agregar «{textoNuevo}»</span>
              </button>
            )}
            {opcionesFiltradas.length === 0 ? (
              puedeAgregar ? null : (
                <div className="text-muted-foreground px-2.5 py-3 text-center text-sm">
                  {emptyMessage}
                </div>
              )
            ) : (
              opcionesFiltradas.map((opcion, index) => (
                <Fragment key={`${opcion.value}::${index}`}>
                  {opcion.group &&
                    opcion.group !== opcionesFiltradas[index - 1]?.group && (
                      <div className="text-muted-foreground px-2.5 pt-2.5 pb-1 text-[11px] font-bold tracking-wide uppercase">
                        {opcion.group}
                      </div>
                    )}
                  <button
                    type="button"
                    onClick={() => elegir(opcion.value)}
                    className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-sm"
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        opcion.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{opcion.label}</span>
                  </button>
                </Fragment>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
