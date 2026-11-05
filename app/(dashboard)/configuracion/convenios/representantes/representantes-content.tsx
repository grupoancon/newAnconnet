"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Lock, Pencil, Plus, Trash2, Users } from "lucide-react"
import Link from "next/link"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
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
  DOCUMENTOS_FIRMA,
  actualizarRepresentanteConvenio,
  crearRepresentanteConvenio,
  eliminarRepresentanteConvenio,
  listarRepresentantesConvenio,
  representanteAplicaEn,
  type DocumentoFirma,
  type RepresentanteConvenio,
} from "@/lib/api/convenios-api"
import { VentasApiError } from "@/lib/api/ventas-api"
import { cn } from "@/lib/utils"

type Edicion = {
  id: number | null
  nombre: string
  cedula: string
  activo: boolean
  // Documentos en los que aparece; vacío = en todos.
  documentos: DocumentoFirma[]
}

const NUEVO: Edicion = { id: null, nombre: "", cedula: "", activo: true, documentos: [] }

// Documentos marcados de un representante (vacío si aparece en todos).
function documentosDe(rep: RepresentanteConvenio): DocumentoFirma[] {
  const todos = DOCUMENTOS_FIRMA.map((d) => d.valor)
  const marcados = todos.filter((d) => representanteAplicaEn(rep, d))
  return marcados.length === todos.length ? [] : marcados
}

function describirDocumentos(rep: RepresentanteConvenio): string {
  const marcados = documentosDe(rep)
  if (marcados.length === 0) return "Todos"
  return DOCUMENTOS_FIRMA.filter((d) => marcados.includes(d.valor))
    .map((d) => d.etiqueta)
    .join(", ")
}

// Administra la lista de personas que firman por la empresa (convenio, oferta,
// financiamiento y refinanciamiento). No son usuarios del sistema: solo un nombre (que
// se imprime y se compara en {{#if (eq representante "Nombre")}}), su cédula (se
// imprime en la firma), si está activo y en qué documentos aparece.
export function RepresentantesContent() {
  const toast = useToast()
  const [lista, setLista] = useState<RepresentanteConvenio[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sinPermiso, setSinPermiso] = useState(false)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState<RepresentanteConvenio | null>(null)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setError(null)
    setSinPermiso(false)
    try {
      setLista(await listarRepresentantesConvenio())
    } catch (err) {
      if (err instanceof VentasApiError && err.status === 403) setSinPermiso(true)
      else
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
    }
  }

  async function guardar() {
    if (!edicion) return
    const nombre = edicion.nombre.trim()
    if (!nombre) {
      toast({ variant: "error", description: "El nombre es obligatorio." })
      return
    }
    setGuardando(true)
    try {
      const datos = {
        nombre,
        cedula: edicion.cedula.trim(),
        activo: edicion.activo,
        // Todos marcados = igual que ninguno: aparece en todos (se guarda null).
        documentos:
          edicion.documentos.length === 0 ||
          edicion.documentos.length === DOCUMENTOS_FIRMA.length
            ? null
            : edicion.documentos,
      }
      if (edicion.id == null) await crearRepresentanteConvenio(datos)
      else await actualizarRepresentanteConvenio(edicion.id, datos)
      toast({ variant: "success", description: "Representante guardado." })
      setEdicion(null)
      await cargar()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarEliminar() {
    if (!aEliminar) return
    setEliminando(true)
    try {
      await eliminarRepresentanteConvenio(aEliminar.id)
      setLista((anterior) => (anterior ?? []).filter((r) => r.id !== aEliminar.id))
      toast({ variant: "success", description: "Representante eliminado." })
      setAEliminar(null)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
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
        eyebrow="Configuración · Convenios"
        title="Representantes de la empresa"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/configuracion/convenios">
                <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                Convenios
              </Link>
            </Button>
            <Button type="button" onClick={() => setEdicion(NUEVO)}>
              <Plus className="size-3.5" strokeWidth={1.8} />
              Nuevo representante
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <p className="text-muted-foreground mb-3.5 text-xs">
          Personas que pueden firmar por la empresa en el convenio, la oferta de compra,
          el financiamiento y el refinanciamiento. No son usuarios del sistema. En
          &ldquo;Aparece en&rdquo; eliges en cuáles de esos documentos se puede elegir a cada
          uno. En el contenido del convenio, usa el nombre exacto con{" "}
          <code>{'{{#if (eq representante "Nombre Apellido")}}'}</code>.
        </p>

        <div className="bg-card border-border overflow-hidden rounded-lg border">
          {sinPermiso ? (
            <div className="p-6">
              <EmptyState
                icon={<Lock className="text-muted-foreground size-[19px]" strokeWidth={1.7} />}
                title="No tienes permiso para esta sección"
                description='Pídele a un administrador el permiso "convenios:gestionar".'
                dashed
              />
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState title="No se pudo cargar la lista" description={error} dashed />
            </div>
          ) : lista === null ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : lista.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Users className="text-muted-foreground size-[19px]" strokeWidth={1.7} />}
                title="Todavía no hay representantes"
                description="Agrega a quienes firman por la empresa con el botón de arriba."
                dashed
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla-apilada w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                    <th className="px-4.5 py-2.75 text-left">Nombre</th>
                    <th className="px-4.5 py-2.75 text-left">Cédula</th>
                    <th className="px-4.5 py-2.75 text-left">Aparece en</th>
                    <th className="px-4.5 py-2.75 text-center">Activo</th>
                    <th className="px-2 py-2.75" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((rep, index) => (
                    <tr
                      key={rep.id}
                      className={cn(index < lista.length - 1 && "border-border border-b")}
                    >
                      <td data-label="Nombre" className="px-4.5 py-2.5 font-semibold">
                        {rep.nombre}
                      </td>
                      <td data-label="Cédula" className="text-muted-foreground px-4.5 py-2.5">
                        {rep.cedula || "—"}
                      </td>
                      <td
                        data-label="Aparece en"
                        className="text-muted-foreground px-4.5 py-2.5"
                      >
                        {describirDocumentos(rep)}
                      </td>
                      <td data-label="Activo" className="px-4.5 py-2.5 text-center">
                        {rep.activo ? (
                          <span className="text-primary text-xs font-semibold">Sí</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                      <td data-label="" className="justify-end px-2 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${rep.nombre}`}
                            onClick={() =>
                              setEdicion({
                                id: rep.id,
                                nombre: rep.nombre,
                                cedula: rep.cedula ?? "",
                                activo: rep.activo,
                                documentos: documentosDe(rep),
                              })
                            }
                          >
                            <Pencil className="size-3.5" strokeWidth={1.8} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar ${rep.nombre}`}
                            onClick={() => setAEliminar(rep)}
                          >
                            <Trash2 className="text-destructive size-3.5" strokeWidth={1.8} />
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

      <Sheet open={edicion != null} onOpenChange={(abierto) => !abierto && setEdicion(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>
              {edicion?.id == null ? "Nuevo representante" : "Editar representante"}
            </SheetTitle>
            <SheetDescription>
              El nombre y la cédula se imprimen en el bloque de firmas de los documentos
              en los que aparece.
            </SheetDescription>
          </SheetHeader>
          {edicion ? (
            <div className="space-y-3.5 p-5">
              <TextField
                label="Nombre completo"
                value={edicion.nombre}
                onChange={(nombre) => setEdicion({ ...edicion, nombre })}
              />
              <TextField
                label="Cédula"
                placeholder="Ej. 0102030405"
                value={edicion.cedula}
                onChange={(cedula) => setEdicion({ ...edicion, cedula })}
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={edicion.activo}
                  onCheckedChange={(valor) =>
                    setEdicion({ ...edicion, activo: valor === true })
                  }
                />
                Activo (aparece en los selectores de firma)
              </label>
              <div className="border-border space-y-2 border-t pt-3.5">
                <div className="text-sm font-semibold">Aparece en</div>
                <p className="text-muted-foreground text-xs">
                  Marca solo los documentos en los que puede firmar. Si no marcas
                  ninguno, aparece en todos.
                </p>
                {DOCUMENTOS_FIRMA.map((documento) => (
                  <label
                    key={documento.valor}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={edicion.documentos.includes(documento.valor)}
                      onCheckedChange={(valor) =>
                        setEdicion({
                          ...edicion,
                          documentos:
                            valor === true
                              ? [...edicion.documentos, documento.valor]
                              : edicion.documentos.filter((d) => d !== documento.valor),
                        })
                      }
                    />
                    {documento.etiqueta}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => setEdicion(null)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={guardando} onClick={guardar}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={aEliminar != null} onOpenChange={(abierto) => !abierto && setAEliminar(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Eliminar representante</SheetTitle>
            <SheetDescription>
              ¿Eliminar a &ldquo;{aEliminar?.nombre}&rdquo;? Si solo quieres que deje de
              aparecer en el selector, mejor desmárcalo como activo.
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
