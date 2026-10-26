"use client"

import { useEffect, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
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
  eliminarPromocion,
  listarPromociones,
  type PromocionBackend,
} from "@/lib/api/ventas-api"
import { cn } from "@/lib/utils"

const TIPOS_EFECTO = ["porcentaje", "monto_fijo"]

type FormState = {
  nombre: string
  tipoEfecto: string
  valorEfecto: string
  fechaInicio: string
  fechaFin: string
}

const FORM_VACIO: FormState = {
  nombre: "",
  tipoEfecto: "porcentaje",
  valorEfecto: "",
  fechaInicio: "",
  fechaFin: "",
}

function formatearMoneda(valor: string | number | null | undefined): string {
  const numero = typeof valor === "string" ? parseFloat(valor) : valor
  if (numero == null || isNaN(numero)) return "—"
  return new Intl.NumberFormat("es-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)
}

export function PromocionesContent() {
  const toast = useToast()
  const [promociones, setPromociones] = useState<PromocionBackend[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [promoAEliminar, setPromoAEliminar] = useState<PromocionBackend | null>(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setError(null)
    try {
      const datos = await listarPromociones()
      setPromociones(datos)
    } catch (err) {
      setError(
        err instanceof VentasApiError
          ? err.message
          : "No se pudo conectar con el servidor"
      )
    }
  }

  function iniciarEdicion(promo: PromocionBackend) {
    setEditandoId(promo.id)
    setForm({
      nombre: promo.nombre ?? "",
      tipoEfecto: promo.tipo_efecto ?? "porcentaje",
      valorEfecto: promo.valor_efecto ?? "",
      fechaInicio: promo.fecha_inicio ?? "",
      fechaFin: promo.fecha_fin ?? "",
    })
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setForm(FORM_VACIO)
  }

  async function manejarGuardar() {
    if (!form.nombre || !form.valorEfecto) return
    setGuardando(true)
    try {
      const datos = {
        nombre: form.nombre,
        tipoEfecto: form.tipoEfecto,
        valorEfecto: Number(form.valorEfecto),
        fechaInicio: form.fechaInicio || undefined,
        fechaFin: form.fechaFin || undefined,
      }
      if (editandoId) {
        const actualizada = await actualizarPromocion(editandoId, datos)
        setPromociones((anterior) =>
          (anterior ?? []).map((p) => (p.id === editandoId ? actualizada : p))
        )
        toast({ variant: "success", description: "Promoción actualizada." })
      } else {
        const creada = await crearPromocion({ ...datos, activo: true })
        setPromociones((anterior) => [creada, ...(anterior ?? [])])
        toast({ variant: "success", description: "Promoción creada." })
      }
      cancelarEdicion()
    } catch (err) {
      toast({
        variant: "error",
        title: editandoId
          ? "No se pudo actualizar la promoción"
          : "No se pudo crear la promoción",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  async function manejarToggleActivo(promo: PromocionBackend) {
    try {
      const actualizada = await actualizarPromocion(promo.id, { activo: !promo.activo })
      setPromociones((anterior) =>
        (anterior ?? []).map((p) => (p.id === promo.id ? actualizada : p))
      )
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo actualizar la promoción",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    }
  }

  async function confirmarEliminar() {
    if (!promoAEliminar) return
    setEliminando(true)
    try {
      await eliminarPromocion(promoAEliminar.id)
      setPromociones((anterior) =>
        (anterior ?? []).filter((p) => p.id !== promoAEliminar.id)
      )
      if (editandoId === promoAEliminar.id) cancelarEdicion()
      toast({ variant: "success", description: "Promoción eliminada." })
      setPromoAEliminar(null)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar la promoción",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader eyebrow="Configuración" title="Promociones" />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border mb-5 rounded-lg border p-4 sm:mb-6 sm:p-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              {editandoId ? "Editar promoción" : "Nueva promoción"}
            </div>
            {editandoId && (
              <Button type="button" variant="ghost" size="sm" onClick={cancelarEdicion}>
                <X className="size-3.5" strokeWidth={1.8} />
                Cancelar edición
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2">
              <TextField
                label="Nombre"
                value={form.nombre}
                onChange={(v) => setForm((f) => ({ ...f, nombre: v }))}
              />
            </div>
            <SelectField
              label="Tipo de efecto"
              placeholder="Seleccione"
              options={TIPOS_EFECTO}
              value={form.tipoEfecto}
              onValueChange={(v) => setForm((f) => ({ ...f, tipoEfecto: v }))}
            />
            <TextField
              label={form.tipoEfecto === "porcentaje" ? "Valor (%)" : "Valor ($)"}
              type="number"
              value={form.valorEfecto}
              onChange={(v) => setForm((f) => ({ ...f, valorEfecto: v }))}
            />
            <TextField
              label="Vigente desde"
              type="date"
              value={form.fechaInicio}
              onChange={(v) => setForm((f) => ({ ...f, fechaInicio: v }))}
            />
            <TextField
              label="Vigente hasta"
              type="date"
              value={form.fechaFin}
              onChange={(v) => setForm((f) => ({ ...f, fechaFin: v }))}
            />
          </div>
          <div className="mt-3.5">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={guardando || !form.nombre || !form.valorEfecto}
              onClick={manejarGuardar}
            >
              <Plus className="size-3.5" strokeWidth={1.8} />
              {guardando
                ? "Guardando…"
                : editandoId
                  ? "Guardar cambios"
                  : "Crear promoción"}
            </Button>
          </div>
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border">
          {promociones === null ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState
                title="No se pudo cargar el catálogo"
                description={error}
                dashed
              />
            </div>
          ) : promociones.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Todavía no hay promociones"
                description="Crea la primera arriba."
                dashed
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla-apilada w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                    <th className="px-4.5 py-2.75 text-left">Nombre</th>
                    <th className="px-4.5 py-2.75 text-left">Tipo</th>
                    <th className="px-4.5 py-2.75 text-right">Valor</th>
                    <th className="px-4.5 py-2.75 text-left">Vigencia</th>
                    <th className="px-4.5 py-2.75 text-center">Activa</th>
                    <th className="px-2 py-2.75" />
                  </tr>
                </thead>
                <tbody>
                  {promociones.map((promo, index) => (
                    <tr
                      key={promo.id}
                      className={cn(
                        index < promociones.length - 1 && "border-border border-b",
                        editandoId === promo.id && "bg-accent/40"
                      )}
                    >
                      <td data-label="Nombre" className="px-4.5 py-2.5 font-semibold">
                        {promo.nombre ?? "—"}
                      </td>
                      <td
                        data-label="Tipo"
                        className="text-muted-foreground px-4.5 py-2.5"
                      >
                        {promo.tipo_efecto === "porcentaje" ? "Porcentaje" : "Monto fijo"}
                      </td>
                      <td
                        data-label="Valor"
                        className="px-4.5 py-2.5 text-right font-mono"
                      >
                        {promo.tipo_efecto === "porcentaje"
                          ? `${promo.valor_efecto ?? "—"}%`
                          : formatearMoneda(promo.valor_efecto)}
                      </td>
                      <td
                        data-label="Vigencia"
                        className="text-muted-foreground px-4.5 py-2.5"
                      >
                        {promo.fecha_inicio || promo.fecha_fin
                          ? `${promo.fecha_inicio ?? "…"} a ${promo.fecha_fin ?? "…"}`
                          : "Sin límite"}
                      </td>
                      <td data-label="Activa" className="px-4.5 py-2.5 text-center">
                        <Checkbox
                          checked={promo.activo}
                          onCheckedChange={() => manejarToggleActivo(promo)}
                        />
                      </td>
                      <td data-label="" className="justify-end px-2 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${promo.nombre}`}
                            onClick={() => iniciarEdicion(promo)}
                          >
                            <Pencil className="size-3.5" strokeWidth={1.8} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar ${promo.nombre}`}
                            onClick={() => setPromoAEliminar(promo)}
                          >
                            <Trash2
                              className="text-destructive size-3.5"
                              strokeWidth={1.8}
                            />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={promoAEliminar != null}
        onOpenChange={(valor) => !valor && setPromoAEliminar(null)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Eliminar promoción</SheetTitle>
            <SheetDescription>
              ¿Estás seguro de eliminar la promoción &ldquo;{promoAEliminar?.nombre}
              &rdquo;? Esta acción no se puede deshacer.
            </SheetDescription>
          </SheetHeader>

          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={eliminando}
              onClick={() => setPromoAEliminar(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={eliminando}
              onClick={confirmarEliminar}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
