"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { ImagePlus, Plus, Trash2 } from "lucide-react"
import { generarId } from "@/lib/utils"

import { CampoSelect } from "@/components/shared/campo-select"
import { ProjectCard } from "@/components/shared/project-card"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ESTADOS_PROYECTO,
  InventarioApiError,
  actualizarProyecto,
  crearProyecto,
  obtenerProyecto,
  subirImagenProyecto,
  type ProyectoInventario,
} from "@/lib/api/inventario-api"

import { DESCRIPCION_DEFECTO, vitrinaDeProyecto } from "../../proyectos/vitrina-proyecto"

const MAX_DESCRIPCION = 300
const MAX_FOTO_MB = 8

// Un componente de alícuota en edición dentro de este formulario — `id` es solo para
// el key de React (no se manda al backend), ver ComponenteAlicuota en inventario-api.ts
// para la forma real que se guarda. `fechaInicio` vacío = se cobra desde siempre.
type ComponenteAlicuotaForm = {
  id: string
  nombre: string
  valor: string
  fechaInicio: string
}

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

const ESTADO_OPCIONES = ESTADOS_PROYECTO.map((estado) => ({ ...estado }))

export function ProyectoFormSheet({
  proyecto,
  open,
  onOpenChange,
  onGuardado,
}: {
  proyecto: ProyectoInventario | null // null = crear
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuardado: (proyecto: ProyectoInventario) => void
}) {
  const toast = useToast()
  const esEdicion = Boolean(proyecto)
  const [cargando, setCargando] = useState(false)
  const [nombre, setNombre] = useState("")
  const [nomenclatura, setNomenclatura] = useState("")
  const [direccion, setDireccion] = useState("")
  const [etapa, setEtapa] = useState("")
  // Ya no es un campo del formulario: el backend lo calcula solo (lotes del proyecto
  // menos los que ya están en estado "convenio", ver InventarioService.stockDeProyecto)
  // — acá solo se guarda para mostrarlo de referencia mientras se edita.
  const [stockActual, setStockActual] = useState<number | null>(null)
  const [escritura, setEscritura] = useState("")
  const [componentesAlicuota, setComponentesAlicuota] = useState<
    ComponenteAlicuotaForm[]
  >([])
  const [fechaEntrega, setFechaEntrega] = useState("")
  const [estado, setEstado] = useState<string>("ACTIVO")
  // Tarjeta del proyecto en Nueva Venta / catálogo.
  const [descripcion, setDescripcion] = useState("")
  const [imagenGuardada, setImagenGuardada] = useState<string | null>(null)
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null)
  const [vistaFoto, setVistaFoto] = useState<string | null>(null)
  const [quitarFoto, setQuitarFoto] = useState(false)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const [isSaving, startSaving] = useTransition()

  // URL local (blob:) para previsualizar la foto elegida; se libera al cambiarla.
  useEffect(() => {
    if (!archivoFoto) {
      setVistaFoto(null)
      return
    }
    const url = URL.createObjectURL(archivoFoto)
    setVistaFoto(url)
    return () => URL.revokeObjectURL(url)
  }, [archivoFoto])

  // En edicion se pide el detalle fresco a GET /inventarios/proyectos/:id en vez de
  // confiar en la fila de la tabla, que puede venir de un fetch de hace rato.
  useEffect(() => {
    if (!open) return
    if (!proyecto) {
      setNombre("")
      setNomenclatura("")
      setDireccion("")
      setEtapa("")
      setStockActual(null)
      setEscritura("")
      // Proyecto nuevo: arranca con 1 componente por defecto — es el caso común (la
      // mayoría de los proyectos solo necesitan un cargo de alícuota).
      setComponentesAlicuota([
        { id: generarId(), nombre: "Alicuota", valor: "", fechaInicio: "" },
      ])
      setFechaEntrega("")
      setEstado("ACTIVO")
      setDescripcion("")
      setImagenGuardada(null)
      setArchivoFoto(null)
      setQuitarFoto(false)
      return
    }
    setArchivoFoto(null)
    setQuitarFoto(false)
    setCargando(true)
    obtenerProyecto(proyecto.id)
      .then((datos) => {
        setNombre(datos.nombre)
        setNomenclatura(datos.nomenclatura)
        setDireccion(datos.direccion ?? "")
        setEtapa(String(datos.etapa))
        setStockActual(datos.stock)
        setEscritura(String(datos.escritura))
        setComponentesAlicuota(
          datos.componentesAlicuota.length > 0
            ? datos.componentesAlicuota.map((c) => ({
                id: generarId(),
                nombre: c.nombre,
                valor: String(c.valor),
                fechaInicio: c.fechaInicio ?? "",
              }))
            : [
                {
                  id: generarId(),
                  nombre: "Alicuota",
                  valor: "",
                  fechaInicio: "",
                },
              ]
        )
        setFechaEntrega(datos.fecha_entrega?.slice(0, 10) ?? "")
        setEstado(datos.estado.trim() || "ACTIVO")
        setDescripcion(datos.descripcion ?? "")
        setImagenGuardada(datos.imagen_url ?? null)
      })
      .catch((err) => {
        toast({
          variant: "error",
          title: "No se pudo cargar el proyecto",
          description:
            err instanceof InventarioApiError ? err.message : "Intenta de nuevo.",
        })
      })
      .finally(() => setCargando(false))
  }, [open, proyecto, toast])

  const puedeGuardar =
    !cargando &&
    nombre.trim().length > 0 &&
    nomenclatura.trim().length > 0 &&
    direccion.trim().length > 0

  function numero(valor: string): number {
    const parsed = parseFloat(valor)
    return isNaN(parsed) ? 0 : parsed
  }

  function agregarComponenteAlicuota() {
    setComponentesAlicuota((anterior) => [
      ...anterior,
      { id: generarId(), nombre: "", valor: "", fechaInicio: "" },
    ])
  }

  function actualizarComponenteAlicuota(
    id: string,
    campo: "nombre" | "valor" | "fechaInicio",
    valor: string
  ) {
    setComponentesAlicuota((anterior) =>
      anterior.map((c) => (c.id === id ? { ...c, [campo]: valor } : c))
    )
  }

  function quitarComponenteAlicuota(id: string) {
    setComponentesAlicuota((anterior) => anterior.filter((c) => c.id !== id))
  }

  function elegirFoto(archivo: File | undefined) {
    if (!archivo) return
    if (!archivo.type.startsWith("image/")) {
      toast({ variant: "error", description: "Elige una imagen (JPG, PNG o WebP)." })
      return
    }
    if (archivo.size > MAX_FOTO_MB * 1024 * 1024) {
      toast({
        variant: "error",
        description: `La foto no puede pesar más de ${MAX_FOTO_MB} MB.`,
      })
      return
    }
    setArchivoFoto(archivo)
    setQuitarFoto(false)
  }

  // Foto que se ve ahora en el formulario: la recién elegida, la guardada (si no se
  // quitó) o ninguna.
  const fotoActual = vistaFoto ?? (quitarFoto ? null : imagenGuardada)
  // Vista previa con la misma lógica que la tarjeta real: sin foto/descripción propias
  // cae a la vitrina por defecto de ese proyecto.
  const vitrinaPrevia = vitrinaDeProyecto({
    // Proyecto nuevo: sin stock todavía → sin pastilla (ni AGOTADO ni ÚLTIMOS LOTES).
    ...(proyecto ?? ({} as ProyectoInventario)),
    nombre: nombre.trim() || "Nombre del proyecto",
    descripcion,
    imagen_url: fotoActual,
  })

  function guardar() {
    startSaving(async () => {
      try {
        const datos = {
          nombre: nombre.trim(),
          nomenclatura: nomenclatura.trim(),
          direccion: direccion.trim(),
          etapa: numero(etapa),
          escritura: numero(escritura),
          componentesAlicuota: componentesAlicuota
            .map((c) => ({
              nombre: c.nombre.trim(),
              valor: numero(c.valor),
              fechaInicio: c.fechaInicio || null,
            }))
            .filter((c) => c.nombre.length > 0),
          // Sin fecha → null: la columna es DATE y MySQL rechaza '' (ER_TRUNCATED_WRONG_VALUE).
          fecha_entrega: fechaEntrega || null,
          estado: estado as (typeof ESTADOS_PROYECTO)[number]["value"],
          descripcion: descripcion.trim() || null,
          ...(quitarFoto && !archivoFoto ? { imagen_url: null } : {}),
        }
        let guardado =
          esEdicion && proyecto
            ? await actualizarProyecto(proyecto.id, datos)
            : await crearProyecto(datos)

        // La foto se sube aparte (multipart), ya con el id del proyecto. Si falla, el
        // proyecto igual quedó guardado: se avisa sin presentarlo como error total.
        if (archivoFoto) {
          try {
            guardado = await subirImagenProyecto(guardado.id, archivoFoto)
          } catch (error) {
            toast({
              variant: "error",
              title: "El proyecto se guardó, pero la foto no se pudo subir",
              description:
                error instanceof InventarioApiError ? error.message : "Intenta de nuevo.",
            })
            onGuardado(guardado)
            onOpenChange(false)
            return
          }
        }

        toast({
          variant: "success",
          description: esEdicion ? "Proyecto actualizado." : "Proyecto creado.",
        })
        onGuardado(guardado)
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
          <SheetTitle>{esEdicion ? "Editar proyecto" : "Nuevo proyecto"}</SheetTitle>
          <SheetDescription>
            {esEdicion
              ? "Actualiza los datos de este proyecto."
              : "Da de alta un proyecto nuevo."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Nombre"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              disabled={cargando}
            />
            <Campo
              label="Nomenclatura"
              value={nomenclatura}
              onChange={(event) => setNomenclatura(event.target.value)}
              placeholder="G-"
              disabled={cargando}
            />
          </div>

          <Campo
            label="Dirección"
            value={direccion}
            onChange={(event) => setDireccion(event.target.value)}
            placeholder="Dirección del inmueble"
            disabled={cargando}
          />

          <section className="border-border space-y-3 rounded-md border p-3.5">
            <div>
              <p className="text-sm font-semibold">Tarjeta en Nueva Venta</p>
              <p className="text-muted-foreground text-xs">
                Foto y texto que ven los asesores al elegir el proyecto.
              </p>
            </div>

            <div className="pointer-events-none">
              <ProjectCard
                name={nombre.trim() || "Nombre del proyecto"}
                description={vitrinaPrevia.description}
                imageSrc={vitrinaPrevia.imageSrc}
                gradientClassName={vitrinaPrevia.gradientClassName}
                badge={vitrinaPrevia.badge}
                badgeTone={vitrinaPrevia.badgeTone}
              />
            </div>

            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                elegirFoto(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cargando}
                onClick={() => inputFotoRef.current?.click()}
              >
                <ImagePlus className="size-3.5" strokeWidth={1.8} />
                {fotoActual ? "Cambiar foto" : "Subir foto"}
              </Button>
              {fotoActual ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cargando}
                  onClick={() => {
                    setArchivoFoto(null)
                    setQuitarFoto(true)
                  }}
                >
                  <Trash2 className="text-destructive size-3.5" strokeWidth={1.8} />
                  Quitar foto
                </Button>
              ) : null}
              <span className="text-muted-foreground text-[11px]">
                JPG, PNG o WebP · máx. {MAX_FOTO_MB} MB · horizontal
              </span>
            </div>

            <div>
              <label
                htmlFor="descripcion-proyecto"
                className="text-muted-foreground mb-1.5 block text-xs font-semibold"
              >
                Descripción
              </label>
              <Textarea
                id="descripcion-proyecto"
                value={descripcion}
                disabled={cargando}
                onChange={(event) =>
                  setDescripcion(event.target.value.slice(0, MAX_DESCRIPCION))
                }
                placeholder={DESCRIPCION_DEFECTO}
                className="bg-card focus-visible:border-primary min-h-[72px] rounded-md px-3.5 py-2.5 shadow-none"
              />
              <p className="text-muted-foreground mt-1 text-right text-[11px]">
                {descripcion.length}/{MAX_DESCRIPCION}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              label="Etapa"
              type="number"
              value={etapa}
              onChange={(event) => setEtapa(event.target.value)}
              disabled={cargando}
            />
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Stock
              </label>
              <div className="bg-muted text-muted-foreground flex h-11 w-full items-center rounded-md px-3.5 text-sm">
                {esEdicion ? (stockActual ?? "—") : "Se calcula al agregar lotes"}
              </div>
            </div>
          </div>

          <Campo
            label="Escritura"
            type="number"
            value={escritura}
            onChange={(event) => setEscritura(event.target.value)}
            disabled={cargando}
          />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-muted-foreground block text-xs font-semibold">
                Alícuota
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cargando}
                onClick={agregarComponenteAlicuota}
              >
                <Plus className="size-3.5" strokeWidth={1.8} />
                Agregar componente
              </Button>
            </div>
            {/* La mayoría de los proyectos solo necesitan 1 componente (ej. "Alicuota"),
                pero algunos (ej. Perla Verde) cobran varios cargos con nombre propio por
                separado ("Alicuota MZ y Serv. Generales", "Alicuota parques comunales") —
                cada uno se muestra en su propia columna en la tabla de financiamiento. */}
            <div className="flex flex-col gap-3">
              {componentesAlicuota.map((componente) => (
                <div
                  key={componente.id}
                  className="border-border flex flex-col gap-2 rounded-md border p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Nombre (ej. Alicuota)"
                      value={componente.nombre}
                      disabled={cargando}
                      onChange={(event) =>
                        actualizarComponenteAlicuota(
                          componente.id,
                          "nombre",
                          event.target.value
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar componente"
                      disabled={cargando}
                      onClick={() => quitarComponenteAlicuota(componente.id)}
                    >
                      <Trash2 className="text-destructive size-4" strokeWidth={1.8} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[11px]">
                        Valor
                      </label>
                      <Input
                        type="number"
                        value={componente.valor}
                        disabled={cargando}
                        onChange={(event) =>
                          actualizarComponenteAlicuota(
                            componente.id,
                            "valor",
                            event.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground mb-1 block text-[11px]">
                        Fecha de inicio (opcional)
                      </label>
                      <Input
                        type="date"
                        value={componente.fechaInicio}
                        disabled={cargando}
                        onChange={(event) =>
                          actualizarComponenteAlicuota(
                            componente.id,
                            "fechaInicio",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Campo
            label="Fecha de entrega"
            type="date"
            value={fechaEntrega}
            onChange={(event) => setFechaEntrega(event.target.value)}
            disabled={cargando}
          />

          <CampoSelect
            label="Estado"
            value={estado}
            onChange={setEstado}
            opciones={ESTADO_OPCIONES}
          />
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!puedeGuardar || isSaving} onClick={guardar}>
            {isSaving ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
