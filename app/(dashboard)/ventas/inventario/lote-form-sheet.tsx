"use client"

import { useEffect, useState, useTransition } from "react"

import { CampoSelect } from "@/components/shared/campo-select"
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
  ESTADOS_LOTE,
  InventarioApiError,
  actualizarLote,
  crearLote,
  listarProyectos,
  type LoteInventario,
  type ProyectoInventario,
} from "@/lib/api/inventario-api"

function Campo({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
        {label}
      </label>
      <input
        {...props}
        className="border-input bg-card focus:border-primary focus:ring-ring/15 disabled:bg-muted disabled:text-muted-foreground h-11 w-full rounded-md border px-3.5 text-sm outline-none focus:ring-3"
      />
    </div>
  )
}

const ESTADO_OPCIONES = ESTADOS_LOTE.map((estado) => ({ ...estado }))

export function LoteFormSheet({
  lote,
  open,
  onOpenChange,
  onGuardado,
}: {
  lote: LoteInventario | null // null = crear
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuardado: (lote: LoteInventario) => void
}) {
  const toast = useToast()
  const esEdicion = Boolean(lote)
  const [codigo, setCodigo] = useState("")
  const [sufijoCodigo, setSufijoCodigo] = useState("")
  const [idProyecto, setIdProyecto] = useState("")
  const [estado, setEstado] = useState<string>("LIBRE")
  const [numFac, setNumFac] = useState("")
  const [anioFac, setAnioFac] = useState("")
  const [areaUtil, setAreaUtil] = useState("")
  const [areaProteccion, setAreaProteccion] = useState("")
  const [pvp, setPvp] = useState("")
  const [costo, setCosto] = useState("")
  const [isSaving, startSaving] = useTransition()
  const [proyectos, setProyectos] = useState<ProyectoInventario[]>([])
  const [cargandoProyectos, setCargandoProyectos] = useState(false)

  // La nomenclatura del proyecto ("F-", "G-"...) es siempre el prefijo del codigo del
  // lote — se fija sola al elegir proyecto y no se deja editar, para que nadie escriba
  // un codigo que no calce con el proyecto seleccionado.
  const prefijo = proyectos.find((p) => String(p.id) === idProyecto)?.nomenclatura ?? ""

  useEffect(() => {
    if (!open) return
    setCodigo(lote?.codigo ?? "")
    setSufijoCodigo("")
    setIdProyecto(lote?.id_proyecto != null ? String(lote.id_proyecto) : "")
    setEstado("LIBRE")
    setNumFac(lote?.numFac ?? "")
    setAnioFac(lote?.anioFac ?? "")
    setAreaUtil(lote?.areaUtil ?? "")
    setAreaProteccion(lote?.areaProtec ?? "")
    setPvp(lote?.pvp ?? "")
    setCosto(lote?.costo ?? "")
  }, [open, lote])

  useEffect(() => {
    if (!open) return
    setCargandoProyectos(true)
    listarProyectos()
      .then(setProyectos)
      .catch(() => setProyectos([]))
      .finally(() => setCargandoProyectos(false))
  }, [open])

  const puedeGuardar = esEdicion
    ? idProyecto.trim().length > 0
    : idProyecto.trim().length > 0 && sufijoCodigo.trim().length > 0

  function numeroOUndefined(valor: string): number | undefined {
    const numero = parseFloat(valor)
    return isNaN(numero) ? undefined : numero
  }

  function guardar() {
    const idProyectoNumero = parseInt(idProyecto, 10)
    if (isNaN(idProyectoNumero)) return
    startSaving(async () => {
      try {
        if (esEdicion && lote) {
          const loteActualizado = await actualizarLote(lote.codigo, {
            id_proyecto: idProyectoNumero,
            numFac: numFac.trim(),
            anioFac: anioFac.trim(),
            areaUtil: numeroOUndefined(areaUtil),
            areaProtec: numeroOUndefined(areaProteccion),
            pvp: numeroOUndefined(pvp),
            costo: numeroOUndefined(costo),
          })
          toast({ variant: "success", description: "Lote actualizado." })
          onGuardado(loteActualizado)
        } else {
          const loteCreado = await crearLote({
            codigo: `${prefijo}${sufijoCodigo.trim()}`,
            id_proyecto: idProyectoNumero,
            estado: estado as (typeof ESTADOS_LOTE)[number]["value"],
            numFac: numFac.trim(),
            anioFac: anioFac.trim(),
            areaUtil: numeroOUndefined(areaUtil),
            areaProtec: numeroOUndefined(areaProteccion),
            pvp: numeroOUndefined(pvp),
            costo: numeroOUndefined(costo),
          })
          toast({ variant: "success", description: "Lote creado." })
          onGuardado(loteCreado)
        }
        onOpenChange(false)
      } catch (error) {
        toast({
          variant: "error",
          title: esEdicion ? "No se pudo actualizar" : "No se pudo crear",
          description:
            error instanceof InventarioApiError ? error.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>{esEdicion ? "Editar lote" : "Nuevo lote"}</SheetTitle>
          <SheetDescription>
            {esEdicion
              ? "Actualiza los datos de este lote. Para cambiar el estado usa la acción “Cambiar estado”."
              : "Da de alta un lote nuevo en el inventario."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <CampoSelect
              label="Proyecto"
              value={idProyecto}
              onChange={setIdProyecto}
              opciones={proyectos.map((p) => ({
                value: String(p.id),
                label: `${p.nombre} (${p.nomenclatura})`,
              }))}
              placeholder={cargandoProyectos ? "Cargando…" : "Seleccionar proyecto…"}
            />

            {esEdicion ? (
              <Campo label="Código del lote" value={codigo} disabled readOnly />
            ) : (
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                  Código del lote
                </label>
                <div className="border-input bg-card focus-within:border-primary focus-within:ring-ring/15 has-[:disabled]:bg-muted flex h-11 w-full items-center rounded-md border px-3.5 focus-within:ring-3">
                  {prefijo ? (
                    <span className="font-mono text-sm font-bold select-none">
                      {prefijo}
                    </span>
                  ) : null}
                  <input
                    value={sufijoCodigo}
                    onChange={(event) => setSufijoCodigo(event.target.value)}
                    disabled={!prefijo}
                    placeholder={prefijo ? "M2-01" : "Elige un proyecto primero"}
                    className="text-foreground placeholder:text-muted-foreground h-full w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:font-normal"
                  />
                </div>
              </div>
            )}
          </div>

          {!esEdicion ? (
            <CampoSelect
              label="Estado inicial"
              value={estado}
              onChange={setEstado}
              opciones={ESTADO_OPCIONES}
            />
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <Campo
              label="Área útil (m²)"
              type="number"
              value={areaUtil}
              onChange={(event) => setAreaUtil(event.target.value)}
            />
            <Campo
              label="Área protección"
              type="number"
              value={areaProteccion}
              onChange={(event) => setAreaProteccion(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Precio (PVP)"
              type="number"
              value={pvp}
              onChange={(event) => setPvp(event.target.value)}
            />
            <Campo
              label="Costo"
              type="number"
              value={costo}
              onChange={(event) => setCosto(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Número de factura"
              value={numFac}
              onChange={(event) => setNumFac(event.target.value)}
            />
            <Campo
              label="Año de factura"
              value={anioFac}
              onChange={(event) => setAnioFac(event.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!puedeGuardar || isSaving} onClick={guardar}>
            {isSaving ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear lote"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
