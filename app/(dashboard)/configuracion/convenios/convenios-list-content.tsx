"use client"

import { useEffect, useState } from "react"
import { FileText, Lock, Pencil, Plus, Trash2, Users } from "lucide-react"
import Link from "next/link"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Spinner } from "@/components/shared/spinner"
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
  eliminarConvenio,
  listarConvenios,
  type ConvenioBackend,
} from "@/lib/api/convenios-api"
import { VentasApiError } from "@/lib/api/ventas-api"
import { cn } from "@/lib/utils"

export function ConveniosListContent() {
  const toast = useToast()
  const [convenios, setConvenios] = useState<ConvenioBackend[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [aEliminar, setAEliminar] = useState<ConvenioBackend | null>(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setError(null)
    setSinPermiso(false)
    try {
      setConvenios(await listarConvenios())
    } catch (err) {
      // El guard de la página ya exige "convenios:gestionar" para entrar, pero el
      // backend vuelve a chequearlo en vivo por cada request — si el permiso se quitó
      // después de haber entrado a la página (o el rol nunca lo tuvo asignado del todo
      // lado, solo a nivel de página), esta llamada vuelve con 403. Sin este chequeo
      // explícito, "convenios" se quedaba en null para siempre y la pantalla mostraba
      // el spinner de carga sin fin en vez del mensaje de error.
      if (err instanceof VentasApiError && err.status === 403) {
        setSinPermiso(true)
      } else {
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      }
    }
  }

  async function confirmarEliminar() {
    if (!aEliminar) return
    setEliminando(true)
    try {
      await eliminarConvenio(aEliminar.id)
      setConvenios((anterior) => (anterior ?? []).filter((c) => c.id !== aEliminar.id))
      toast({ variant: "success", description: "Convenio eliminado." })
      setAEliminar(null)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar el convenio",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader
        eyebrow="Configuración"
        title="Convenios"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/configuracion/convenios/representantes">
                <Users className="size-3.5" strokeWidth={1.8} />
                Representantes
              </Link>
            </Button>
            <Button asChild>
              <Link href="/configuracion/convenios/nuevo">
                <Plus className="size-3.5" strokeWidth={1.8} />
                Nuevo convenio
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          {sinPermiso ? (
            <div className="p-6">
              <EmptyState
                icon={
                  <Lock className="text-muted-foreground size-[19px]" strokeWidth={1.7} />
                }
                title="No tienes permiso para esta sección"
                description='Pídele a un administrador que te otorgue el permiso "convenios:gestionar" desde Admin > Roles y permisos.'
                dashed
              />
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState
                title="No se pudo cargar el catálogo"
                description={error}
                dashed
              />
            </div>
          ) : convenios === null ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : convenios.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={
                  <FileText
                    className="text-muted-foreground size-[19px]"
                    strokeWidth={1.7}
                  />
                }
                title="Todavía no hay convenios"
                description="Crea la primera plantilla con el botón de arriba."
                dashed
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla-apilada w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                    <th className="px-4.5 py-2.75 text-left">Nombre</th>
                    <th className="px-4.5 py-2.75 text-left">Variables</th>
                    <th className="px-4.5 py-2.75 text-center">Activo</th>
                    <th className="px-4.5 py-2.75 text-left">Actualizado</th>
                    <th className="px-2 py-2.75" />
                  </tr>
                </thead>
                <tbody>
                  {convenios.map((convenio, index) => (
                    <tr
                      key={convenio.id}
                      className={cn(
                        index < convenios.length - 1 && "border-border border-b"
                      )}
                    >
                      <td data-label="Nombre" className="px-4.5 py-2.5 font-semibold">
                        {convenio.nombre}
                      </td>
                      <td
                        data-label="Variables"
                        className="text-muted-foreground px-4.5 py-2.5"
                      >
                        {convenio.variables.length} variable
                        {convenio.variables.length === 1 ? "" : "s"}
                      </td>
                      <td data-label="Activo" className="px-4.5 py-2.5 text-center">
                        {convenio.activo ? (
                          <span className="text-primary text-xs font-semibold">Sí</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                      <td
                        data-label="Actualizado"
                        className="text-muted-foreground px-4.5 py-2.5"
                      >
                        {new Date(convenio.updated_at).toLocaleDateString("es-EC")}
                      </td>
                      <td data-label="" className="justify-end px-2 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${convenio.nombre}`}
                          >
                            <Link href={`/configuracion/convenios/${convenio.id}/editar`}>
                              <Pencil className="size-3.5" strokeWidth={1.8} />
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar ${convenio.nombre}`}
                            onClick={() => setAEliminar(convenio)}
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
        open={aEliminar != null}
        onOpenChange={(valor) => !valor && setAEliminar(null)}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Eliminar convenio</SheetTitle>
            <SheetDescription>
              ¿Estás seguro de eliminar &ldquo;{aEliminar?.nombre}&rdquo;? Se quitarán
              también sus asignaciones a proyectos/lotes. Esta acción no se puede
              deshacer.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={eliminando}
              onClick={() => setAEliminar(null)}
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
