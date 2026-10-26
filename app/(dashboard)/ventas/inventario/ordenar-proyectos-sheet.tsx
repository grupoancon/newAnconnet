"use client"

import { useEffect, useState, useTransition } from "react"
import { ArrowDown, ArrowUp, ChevronsUp, GripVertical } from "lucide-react"

import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  InventarioApiError,
  ordenarProyectos,
  type ProyectoInventario,
} from "@/lib/api/inventario-api"
import { cn } from "@/lib/utils"

function mover<T>(lista: T[], desde: number, hasta: number): T[] {
  const copia = [...lista]
  const [item] = copia.splice(desde, 1)
  copia.splice(hasta, 0, item!)
  return copia
}

// Orden en que se muestran los proyectos en Nueva Venta, el catálogo y esta pantalla.
// Se reordena arrastrando (mouse) o con las flechas (teclado / celular).
export function OrdenarProyectosSheet({
  open,
  onOpenChange,
  proyectos,
  onGuardado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  proyectos: ProyectoInventario[]
  onGuardado: (proyectos: ProyectoInventario[]) => void
}) {
  const toast = useToast()
  const [lista, setLista] = useState<ProyectoInventario[]>([])
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (open) setLista(proyectos)
  }, [open, proyectos])

  const huboCambios = lista.some((p, i) => p.id !== proyectos[i]?.id)

  function guardar() {
    startSaving(async () => {
      try {
        const ordenados = await ordenarProyectos(lista.map((p) => p.id))
        toast({ variant: "success", description: "Orden de proyectos guardado." })
        onGuardado(ordenados)
        onOpenChange(false)
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo guardar el orden",
          description: err instanceof InventarioApiError ? err.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Ordenar proyectos</SheetTitle>
          <SheetDescription>
            Así se mostrarán en Nueva Venta y en el catálogo. Arrastra cada proyecto o usa
            las flechas.
          </SheetDescription>
        </SheetHeader>

        <ol className="space-y-1.5 p-4">
          {lista.map((proyecto, indice) => (
            <li
              key={proyecto.id}
              draggable
              onDragStart={(event) => {
                setArrastrando(indice)
                event.dataTransfer.effectAllowed = "move"
              }}
              onDragOver={(event) => {
                event.preventDefault()
                if (arrastrando === null || arrastrando === indice) return
                setLista((actual) => mover(actual, arrastrando, indice))
                setArrastrando(indice)
              }}
              onDragEnd={() => setArrastrando(null)}
              className={cn(
                "bg-card border-border flex items-center gap-2 rounded-md border py-2 pr-2 pl-1.5 transition-shadow",
                arrastrando === indice && "border-primary shadow-md"
              )}
            >
              <GripVertical
                className="text-muted-foreground size-4 shrink-0 cursor-grab active:cursor-grabbing"
                strokeWidth={1.8}
                aria-hidden
              />
              <span className="bg-accent text-accent-foreground flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[11.5px] font-bold">
                {indice + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{proyecto.nombre}</p>
                <p className="text-muted-foreground font-mono text-[11px]">
                  {proyecto.nomenclatura}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Mover ${proyecto.nombre} al primer lugar`}
                  title="Mover al primer lugar"
                  disabled={indice === 0}
                  onClick={() => setLista((actual) => mover(actual, indice, 0))}
                >
                  <ChevronsUp className="size-3.5" strokeWidth={1.8} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Subir ${proyecto.nombre}`}
                  disabled={indice === 0}
                  onClick={() => setLista((actual) => mover(actual, indice, indice - 1))}
                >
                  <ArrowUp className="size-3.5" strokeWidth={1.8} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Bajar ${proyecto.nombre}`}
                  disabled={indice === lista.length - 1}
                  onClick={() => setLista((actual) => mover(actual, indice, indice + 1))}
                >
                  <ArrowDown className="size-3.5" strokeWidth={1.8} />
                </Button>
              </div>
            </li>
          ))}
        </ol>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!huboCambios || isSaving} onClick={guardar}>
            {isSaving ? "Guardando..." : "Guardar orden"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
