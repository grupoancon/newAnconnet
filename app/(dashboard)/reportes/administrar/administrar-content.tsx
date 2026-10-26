"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Copy, Pencil, Plus, Trash2, X } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { TextField } from "@/components/shared/text-field"
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
  ReportesApiError,
  actualizarDefinicion,
  crearDefinicion,
  eliminarDefinicion,
  listarDatasets,
  listarDefinicionesAdmin,
  type BloqueDefinicion,
  type DatasetCatalogo,
  type DefinicionReporte,
  type Visualizacion,
} from "@/lib/api/reportes-api"

const VISUALIZACIONES: Array<{ value: Visualizacion; label: string }> = [
  { value: "barras", label: "Barras" },
  { value: "tabla", label: "Tabla" },
  { value: "kpi", label: "Solo el total" },
]

const MAX_BLOQUES = 10

type Borrador = {
  id: string | null // null = reporte nuevo
  titulo: string
  descripcion: string
  activo: boolean
  bloques: BloqueDefinicion[]
}

function bloqueNuevo(datasets: DatasetCatalogo[], indice: number): BloqueDefinicion {
  const primero = datasets[0]
  return {
    id: `b${Date.now().toString(36)}${indice}`,
    titulo: primero?.titulo ?? "",
    dataset: primero?.id ?? "",
    visualizacion: "barras",
  }
}

export function AdministrarReportesContent() {
  const toast = useToast()
  const [definiciones, setDefiniciones] = useState<DefinicionReporte[]>([])
  const [datasets, setDatasets] = useState<DatasetCatalogo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [defs, ds] = await Promise.all([listarDefinicionesAdmin(), listarDatasets()])
      setDefiniciones(defs)
      setDatasets(ds)
      setError(null)
    } catch (err) {
      setError(
        err instanceof ReportesApiError
          ? err.message
          : "No se pudo cargar la información."
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  function nuevo() {
    setBorrador({
      id: null,
      titulo: "",
      descripcion: "",
      activo: true,
      bloques: [bloqueNuevo(datasets, 0)],
    })
  }

  function editar(def: DefinicionReporte) {
    setBorrador({
      id: def.id,
      titulo: def.titulo,
      descripcion: def.descripcion,
      activo: def.activo,
      bloques: def.bloques.map((b) => ({ ...b })),
    })
  }

  function cambiarBloque(indice: number, cambios: Partial<BloqueDefinicion>) {
    setBorrador((previo) =>
      previo
        ? {
            ...previo,
            bloques: previo.bloques.map((b, i) =>
              i === indice ? { ...b, ...cambios } : b
            ),
          }
        : previo
    )
  }

  async function guardar() {
    if (!borrador || guardando) return
    setGuardando(true)
    try {
      const entrada = {
        titulo: borrador.titulo,
        descripcion: borrador.descripcion,
        bloques: borrador.bloques,
        activo: borrador.activo,
      }
      if (borrador.id) {
        await actualizarDefinicion(borrador.id, entrada)
        toast({ variant: "success", description: "Reporte actualizado" })
      } else {
        const creado = await crearDefinicion(entrada)
        toast({
          variant: "success",
          title: "Reporte creado",
          description: `Ahora concede el permiso reportes:${creado.slug} a quien deba verlo.`,
          duracionMs: 8000,
        })
      }
      setBorrador(null)
      await cargar()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof ReportesApiError ? err.message : "No se pudo guardar el reporte",
      })
    } finally {
      setGuardando(false)
    }
  }

  async function alternarActivo(def: DefinicionReporte) {
    try {
      await actualizarDefinicion(def.id, {
        titulo: def.titulo,
        descripcion: def.descripcion,
        bloques: def.bloques,
        activo: !def.activo,
      })
      await cargar()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof ReportesApiError ? err.message : "No se pudo actualizar",
      })
    }
  }

  async function eliminar(def: DefinicionReporte) {
    const confirmado = window.confirm(
      `¿Eliminar "${def.titulo}"? También se quita el permiso reportes:${def.slug} a todos los que lo tengan. Esta acción no se puede deshacer.`
    )
    if (!confirmado) return
    try {
      await eliminarDefinicion(def.id)
      toast({ variant: "success", description: "Reporte eliminado" })
      await cargar()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof ReportesApiError ? err.message : "No se pudo eliminar",
      })
    }
  }

  async function copiarPermiso(slug: string) {
    try {
      await navigator.clipboard.writeText(`reportes:${slug}`)
      toast({ variant: "info", description: `Copiado: reportes:${slug}` })
    } catch {
      toast({ variant: "warning", description: `Permiso: reportes:${slug}` })
    }
  }

  const opcionesDataset = datasets.map((d) => ({ value: d.id, label: d.titulo }))
  const borradorValido =
    !!borrador &&
    borrador.titulo.trim().length >= 3 &&
    borrador.bloques.length > 0 &&
    borrador.bloques.every((b) => b.dataset && b.visualizacion)

  return (
    // data-audit-ignore: la administración no llena la auditoría de clics de formulario.
    <div className="flex h-full flex-col" data-audit-ignore>
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button
              asChild
              variant="outline"
              size="icon-lg"
              aria-label="Volver a reportes"
            >
              <Link href="/reportes">
                <ArrowLeft />
              </Link>
            </Button>
            <div>
              <h1 className="mb-1 text-2xl font-extrabold tracking-tight">
                Administrar reportes
              </h1>
              <p className="text-muted-foreground text-[13.5px]">
                Crea reportes combinando fuentes de datos. Cada uno genera su permiso para
                concederlo desde Admin → Usuarios.
              </p>
            </div>
          </div>
          <Button type="button" onClick={nuevo} disabled={datasets.length === 0}>
            <Plus /> Nuevo reporte
          </Button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-17.5">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState dashed={false} title="No se pudo cargar" description={error} />
        ) : definiciones.length === 0 ? (
          <EmptyState
            dashed={false}
            className="py-17.5"
            title="Aún no hay reportes creados"
            description="Crea el primero con «Nuevo reporte». Los reportes programados (ventas, administrativo, depósitos) no aparecen aquí."
          />
        ) : (
          <div className="bg-card border-border divide-border divide-y overflow-hidden rounded-lg border">
            {definiciones.map((def) => (
              <div
                key={def.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{def.titulo}</span>
                    <StatusBadge variant={def.activo ? "aprobado" : "pronto"}>
                      {def.activo ? "Activo" : "Inactivo"}
                    </StatusBadge>
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-[12px]">
                    <span>
                      {def.bloques.length} bloque{def.bloques.length === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarPermiso(def.slug)}
                      className="hover:text-foreground inline-flex items-center gap-1 font-mono"
                      title="Copiar el permiso"
                    >
                      reportes:{def.slug} <Copy className="size-3" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => alternarActivo(def)}
                  >
                    {def.activo ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => editar(def)}
                  >
                    <Pencil /> Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => eliminar(def)}
                  >
                    <Trash2 /> Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={!!borrador}
        onOpenChange={(abierto) => !abierto && !guardando && setBorrador(null)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>{borrador?.id ? "Editar reporte" : "Nuevo reporte"}</SheetTitle>
            <SheetDescription>
              {borrador?.id
                ? "El permiso del reporte no cambia al editarlo."
                : "Al guardar se crea el permiso reportes:<nombre>, que concedes desde Admin → Usuarios."}
            </SheetDescription>
          </SheetHeader>

          {borrador && (
            <div className="flex flex-col gap-4 p-5">
              <TextField
                label="TÍTULO"
                placeholder="Ej. Resumen comercial"
                value={borrador.titulo}
                onChange={(valor) => setBorrador({ ...borrador, titulo: valor })}
              />
              <TextField
                label="DESCRIPCIÓN"
                placeholder="Qué muestra este reporte"
                value={borrador.descripcion}
                onChange={(valor) => setBorrador({ ...borrador, descripcion: valor })}
              />

              <div className="flex flex-col gap-3">
                <span className="text-muted-foreground text-xs font-semibold">
                  BLOQUES
                </span>
                {borrador.bloques.map((bloque, indice) => (
                  <div
                    key={bloque.id}
                    className="bg-muted border-border flex flex-col gap-3 rounded-lg border p-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold">Bloque {indice + 1}</span>
                      {borrador.bloques.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Quitar bloque ${indice + 1}`}
                          className="text-status-bloqueado-fg"
                          onClick={() =>
                            setBorrador({
                              ...borrador,
                              bloques: borrador.bloques.filter((_, i) => i !== indice),
                            })
                          }
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    <TextField
                      label="TÍTULO DEL BLOQUE"
                      value={bloque.titulo}
                      onChange={(valor) => cambiarBloque(indice, { titulo: valor })}
                    />
                    <SelectField
                      label="FUENTE DE DATOS"
                      placeholder="Seleccione"
                      opciones={opcionesDataset}
                      value={bloque.dataset}
                      onValueChange={(valor) => {
                        const ds = datasets.find((d) => d.id === valor)
                        cambiarBloque(indice, {
                          dataset: valor,
                          // Si el título era el de la fuente anterior, sigue a la nueva.
                          titulo:
                            !bloque.titulo ||
                            bloque.titulo ===
                              datasets.find((d) => d.id === bloque.dataset)?.titulo
                              ? (ds?.titulo ?? bloque.titulo)
                              : bloque.titulo,
                        })
                      }}
                    />
                    <p className="text-muted-foreground -mt-1 text-[11.5px]">
                      {datasets.find((d) => d.id === bloque.dataset)?.descripcion}
                    </p>
                    <SelectField
                      label="VISUALIZACIÓN"
                      placeholder="Seleccione"
                      opciones={VISUALIZACIONES}
                      value={bloque.visualizacion}
                      onValueChange={(valor) =>
                        cambiarBloque(indice, { visualizacion: valor as Visualizacion })
                      }
                    />
                  </div>
                ))}

                {borrador.bloques.length < MAX_BLOQUES && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setBorrador({
                        ...borrador,
                        bloques: [
                          ...borrador.bloques,
                          bloqueNuevo(datasets, borrador.bloques.length),
                        ],
                      })
                    }
                  >
                    <Plus /> Agregar bloque
                  </Button>
                )}
              </div>
            </div>
          )}

          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => setBorrador(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!borradorValido || guardando}
              onClick={guardar}
            >
              {guardando ? "Guardando…" : "Guardar reporte"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
