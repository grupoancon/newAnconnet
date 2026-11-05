"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"

import { MultiSelectField } from "@/components/shared/multi-select-field"
import { SelectField } from "@/components/shared/select-field"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  VentasApiError,
  actualizarPromocion,
  crearPromocion,
  listarPromociones,
  type PromocionBackend,
} from "@/lib/api/ventas-api"
import { describirCondicionesPromocion } from "@/lib/promociones"

const TIPOS_EFECTO = ["porcentaje", "monto_fijo"]

// Mismas opciones que Configuración → Promociones ("Crédito BIESS (Sin Interés)"
// solo existe en Refinanciamiento, que comparte este catálogo).
const TIPOS_FINANCIAMIENTO_PROMOCION = [
  "Crédito directo",
  "Crédito BIESS",
  "Contado",
  "Mixto",
  "Crédito BIESS (Sin Interés)",
]

// Panel de gestión de promociones — crear nuevas y togglear activo/fechas de las ya
// existentes. Catálogo compartido con financiamiento-content.tsx (el mismo motor de
// descuentos configurables); vive aparte para no mezclar "elegir una promo para este
// refinanciamiento" con "administrar el catálogo de promos".
export function PromocionesSheet({
  abierto,
  onCerrar,
  onCambio,
}: {
  abierto: boolean
  onCerrar: () => void
  onCambio: () => void
}) {
  const toast = useToast()
  const [promociones, setPromociones] = useState<PromocionBackend[]>([])
  const [cargando, setCargando] = useState(false)

  const [nombre, setNombre] = useState("")
  const [tipoEfecto, setTipoEfecto] = useState("porcentaje")
  const [valorEfecto, setValorEfecto] = useState("")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  // Condiciones para aplicarla (vacío = sin restricción, ver lib/promociones.ts).
  const [tiposFinanciamiento, setTiposFinanciamiento] = useState<string[]>([])
  const [abonoInicialMinimo, setAbonoInicialMinimo] = useState("")
  const [permiteRepartido, setPermiteRepartido] = useState(true)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let cancelado = false
    setCargando(true)
    listarPromociones()
      .then((datos) => {
        if (!cancelado) setPromociones(datos)
      })
      .catch(() => {
        if (!cancelado) setPromociones([])
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [abierto])

  async function manejarToggleActivo(promo: PromocionBackend) {
    try {
      const actualizada = await actualizarPromocion(promo.id, { activo: !promo.activo })
      setPromociones((anterior) =>
        anterior.map((p) => (p.id === promo.id ? actualizada : p))
      )
      onCambio()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo actualizar la promoción",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    }
  }

  async function manejarCrear() {
    if (!nombre || !valorEfecto) return
    setCreando(true)
    try {
      const creada = await crearPromocion({
        nombre,
        tipoEfecto,
        valorEfecto: Number(valorEfecto),
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        activo: true,
        tiposFinanciamiento,
        abonoInicialMinimo: Number(abonoInicialMinimo) || null,
        permiteAbonoRepartido: permiteRepartido,
      })
      setPromociones((anterior) => [creada, ...anterior])
      setNombre("")
      setValorEfecto("")
      setFechaInicio("")
      setFechaFin("")
      setTiposFinanciamiento([])
      setAbonoInicialMinimo("")
      setPermiteRepartido(true)
      toast({ variant: "success", description: "Promoción creada." })
      onCambio()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo crear la promoción",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setCreando(false)
    }
  }

  return (
    <Sheet open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Promociones</SheetTitle>
          <SheetDescription>
            Activa o desactiva promociones, y define en qué fechas y con qué
            condiciones aplican.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 p-5">
          <div className="border-border flex flex-col gap-3 rounded-md border p-4">
            <div className="text-sm font-semibold">Nueva promoción</div>
            <TextField label="Nombre" value={nombre} onChange={setNombre} />
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label="Tipo de efecto"
                placeholder="Seleccione"
                options={TIPOS_EFECTO}
                value={tipoEfecto}
                onValueChange={setTipoEfecto}
              />
              <TextField
                label={tipoEfecto === "porcentaje" ? "Valor (%)" : "Valor ($)"}
                type="number"
                value={valorEfecto}
                onChange={setValorEfecto}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField
                label="Vigente desde"
                type="date"
                value={fechaInicio}
                onChange={setFechaInicio}
              />
              <TextField
                label="Vigente hasta"
                type="date"
                value={fechaFin}
                onChange={setFechaFin}
              />
            </div>
            <div className="text-muted-foreground pt-1 text-xs font-semibold">
              Condiciones (opcional, todas las que llenes se exigen a la vez)
            </div>
            <MultiSelectField
              label="Solo para estos tipos de financiamiento"
              placeholder="Cualquier tipo"
              options={TIPOS_FINANCIAMIENTO_PROMOCION}
              value={tiposFinanciamiento}
              onChange={setTiposFinanciamiento}
            />
            <TextField
              label="Abono inicial mínimo ($)"
              type="number"
              placeholder="Sin mínimo"
              value={abonoInicialMinimo}
              onChange={setAbonoInicialMinimo}
            />
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={permiteRepartido}
                onCheckedChange={(v) => setPermiteRepartido(v === true)}
              />
              <span>
                Aplica si el abono inicial se reparte en varias fechas
                <span className="text-muted-foreground block text-xs">
                  Desmárcalo si solo aplica con el abono inicial en una sola fecha.
                </span>
              </span>
            </label>
            <Button
              size="sm"
              disabled={creando || !nombre || !valorEfecto}
              onClick={manejarCrear}
            >
              <Plus className="size-3.5" strokeWidth={1.8} />
              Crear promoción
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold">Catálogo</div>
            {cargando ? (
              <div className="text-muted-foreground text-sm">Cargando…</div>
            ) : promociones.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No hay promociones creadas.
              </div>
            ) : (
              promociones.map((promo) => (
                <label
                  key={promo.id}
                  className="border-border flex cursor-pointer items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <div className="text-sm font-semibold">{promo.nombre}</div>
                    <div className="text-muted-foreground text-xs">
                      {promo.tipo_efecto === "porcentaje"
                        ? `${promo.valor_efecto}%`
                        : `$${promo.valor_efecto}`}
                      {(promo.fecha_inicio || promo.fecha_fin) &&
                        ` · ${promo.fecha_inicio ?? "…"} a ${promo.fecha_fin ?? "…"}`}
                    </div>
                    {describirCondicionesPromocion(promo) && (
                      <div className="text-muted-foreground text-xs">
                        {describirCondicionesPromocion(promo)}
                      </div>
                    )}
                  </div>
                  <Checkbox
                    checked={promo.activo}
                    onCheckedChange={() => manejarToggleActivo(promo)}
                  />
                </label>
              ))
            )}
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
