"use client"

import { useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ImagePlus,
  Images,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  actualizarNovedad,
  crearNovedad,
  eliminarNovedad,
  listarNovedades,
  NovedadesApiError,
  subirImagenNovedad,
} from "@/lib/api/novedades-api"

import {
  aFormulario,
  estadoDe,
  FORM_VACIO,
  hoyLocal,
  MAX_DESCRIPCION,
  MAX_GALERIA,
  MAX_TITULO,
  PROYECTOS,
  type EstadoNovedad,
  type Novedad,
  type NovedadForm,
} from "./datos"

const ESTADO: Record<EstadoNovedad, { label: string; variant: StatusVariant }> = {
  publicada: { label: "Publicada", variant: "aprobado" },
  programada: { label: "Programada", variant: "pendiente" },
  vencida: { label: "Vencida", variant: "bloqueado" },
  oculta: { label: "Oculta", variant: "pronto" },
}

function mensajeDeError(err: unknown): string {
  return err instanceof NovedadesApiError ? err.message : "No se pudo conectar con el servidor"
}

const nombreProyecto = (valor: string | null) =>
  PROYECTOS.find((p) => p.value === (valor ?? ""))?.label ?? valor ?? "Todos los clientes"

export function NovedadesContent() {
  const toast = useToast()
  const [novedades, setNovedades] = useState<Novedad[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  // null = cerrado; "nueva" = crear; Novedad = editar.
  const [editando, setEditando] = useState<Novedad | "nueva" | null>(null)
  const [porEliminar, setPorEliminar] = useState<Novedad | null>(null)

  useEffect(() => {
    let vigente = true
    setError(null)
    listarNovedades()
      .then((lista) => vigente && setNovedades(lista))
      .catch((err) => vigente && setError(mensajeDeError(err)))
    return () => {
      vigente = false
    }
  }, [recarga])

  async function cambiarVisibilidad(novedad: Novedad) {
    try {
      await actualizarNovedad(novedad.id, { activo: !novedad.activo })
      toast({
        variant: "success",
        description: novedad.activo ? "La novedad ya no se muestra en la app." : "La novedad vuelve a mostrarse.",
      })
      setRecarga((n) => n + 1)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    }
  }

  async function confirmarEliminar() {
    if (!porEliminar) return
    try {
      await eliminarNovedad(porEliminar.id)
      toast({ variant: "success", description: "Novedad eliminada." })
      setRecarga((n) => n + 1)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setPorEliminar(null)
    }
  }

  const hoy = hoyLocal()

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="App · Novedades"
            title="Novedades del Inicio"
            actions={
              <Button onClick={() => setEditando("nueva")}>
                <Plus className="size-4" strokeWidth={1.8} />
                Nueva novedad
              </Button>
            }
          />

          {error ? (
            <EmptyState title="No se pudieron cargar las novedades" description={error} />
          ) : !novedades ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : novedades.length === 0 ? (
            <EmptyState
              title="Todavía no hay novedades"
              description="Las que publiques aparecen en el Inicio de la app, en el orden que elijas."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
              {novedades.map((novedad) => {
                const estado = ESTADO[estadoDe(novedad, hoy)]
                return (
                  <li
                    key={novedad.id}
                    className="border-border flex flex-col overflow-hidden rounded-lg border"
                  >
                    <Portada imagen={novedad.imagenUrl} titulo={novedad.titulo} />
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge variant={estado.variant}>{estado.label}</StatusBadge>
                        <span className="text-muted-foreground text-xs">
                          {nombreProyecto(novedad.proyecto)} · Orden {novedad.orden}
                        </span>
                      </div>
                      <p className="text-[14px] leading-snug font-semibold">{novedad.titulo}</p>
                      {novedad.descripcion ? (
                        <p className="text-muted-foreground line-clamp-2 text-[13px]">
                          {novedad.descripcion}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground text-xs">
                        {rangoFechas(novedad)}
                        {novedad.galeria.length
                          ? ` · ${novedad.galeria.length} ${novedad.galeria.length === 1 ? "foto" : "fotos"} en la galería`
                          : ""}
                      </p>
                      <div className="mt-auto flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setEditando(novedad)}>
                          <Pencil className="size-3.5" strokeWidth={1.8} />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => cambiarVisibilidad(novedad)}>
                          {novedad.activo ? (
                            <EyeOff className="size-3.5" strokeWidth={1.8} />
                          ) : (
                            <Eye className="size-3.5" strokeWidth={1.8} />
                          )}
                          {novedad.activo ? "Ocultar" : "Mostrar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Eliminar"
                          className="text-destructive ml-auto"
                          onClick={() => setPorEliminar(novedad)}
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.8} />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <EditorNovedad
        novedad={editando}
        onCerrar={() => setEditando(null)}
        onGuardada={() => {
          setEditando(null)
          setRecarga((n) => n + 1)
        }}
      />

      <ConfirmDialog
        abierto={porEliminar !== null}
        titulo="¿Eliminar esta novedad?"
        descripcion={`"${porEliminar?.titulo ?? ""}" dejará de verse en la app y no se puede recuperar. Si solo quieres quitarla por un tiempo, usa Ocultar.`}
        textoConfirmar="Eliminar"
        destructivo
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
      />
    </div>
  )
}

function rangoFechas(n: Novedad): string {
  const fmt = (valor: string) =>
    new Date(`${valor.slice(0, 10)}T12:00:00`).toLocaleDateString("es-EC", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  if (n.publicarDesde && n.publicarHasta) return `Del ${fmt(n.publicarDesde)} al ${fmt(n.publicarHasta)}`
  if (n.publicarDesde) return `Desde el ${fmt(n.publicarDesde)}`
  if (n.publicarHasta) return `Hasta el ${fmt(n.publicarHasta)}`
  return "Sin fecha de fin"
}

function Portada({ imagen, titulo }: { imagen: string | null; titulo: string }) {
  return imagen ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imagen} alt={titulo} className="bg-muted aspect-[16/9] w-full object-cover" />
  ) : (
    <div className="bg-muted text-muted-foreground flex aspect-[16/9] w-full items-center justify-center">
      <Megaphone className="size-8" strokeWidth={1.4} />
    </div>
  )
}

function EditorNovedad({
  novedad,
  onCerrar,
  onGuardada,
}: {
  novedad: Novedad | "nueva" | null
  onCerrar: () => void
  onGuardada: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<NovedadForm>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [subiendoGaleria, setSubiendoGaleria] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (novedad === null) return
    setForm(novedad === "nueva" ? FORM_VACIO : aFormulario(novedad))
    setError(null)
  }, [novedad])

  const cambiar = <K extends keyof NovedadForm>(campo: K, valor: NovedadForm[K]) =>
    setForm((actual) => ({ ...actual, [campo]: valor }))

  async function elegirImagen(archivo: File | undefined) {
    if (!archivo) return
    setSubiendo(true)
    try {
      cambiar("imagenUrl", await subirImagenNovedad(archivo))
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setSubiendo(false)
      if (inputArchivo.current) inputArchivo.current.value = ""
    }
  }

  function validar(): string | null {
    if (form.titulo.trim().length < 3) return "El título debe tener al menos 3 caracteres."
    if (form.enlaceUrl && !/^https:\/\//i.test(form.enlaceUrl)) return "El enlace debe empezar con https://"
    if (form.enlaceUrl && !form.enlaceTexto.trim()) return "Escribe el texto del botón para el enlace."
    if (form.publicarDesde && form.publicarHasta && form.publicarHasta < form.publicarDesde) {
      return "La fecha de fin no puede ser anterior a la de inicio."
    }
    return null
  }

  async function guardar() {
    const problema = validar()
    setError(problema)
    if (problema || novedad === null) return
    setGuardando(true)
    try {
      if (novedad === "nueva") await crearNovedad(form)
      else await actualizarNovedad(novedad.id, form)
      toast({
        variant: "success",
        description: novedad === "nueva" ? "Novedad creada." : "Cambios guardados.",
      })
      onGuardada()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Sheet open={novedad !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>{novedad === "nueva" ? "Nueva novedad" : "Editar novedad"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <VistaPrevia form={form} />

          <div>
            <TextField
              label="Título"
              value={form.titulo}
              onChange={(v) => cambiar("titulo", v.slice(0, MAX_TITULO))}
              placeholder="Inauguramos la nueva piscina"
            />
            <p className="text-muted-foreground mt-1 text-right text-[11px]">
              {form.titulo.length}/{MAX_TITULO}
            </p>
          </div>

          <div>
            <label
              htmlFor="descripcion-novedad"
              className="text-muted-foreground mb-1.5 block text-xs font-semibold"
            >
              Descripción (opcional)
            </label>
            <Textarea
              id="descripcion-novedad"
              value={form.descripcion}
              onChange={(e) => cambiar("descripcion", e.target.value.slice(0, MAX_DESCRIPCION))}
              rows={Math.min(24, Math.max(6, form.descripcion.split("\n").length + 2))}
              placeholder="Se muestra al tocar la novedad. Puede ser tan largo como necesites, con párrafos separados por líneas en blanco."
              className="bg-card focus-visible:border-primary min-h-[160px] resize-y rounded-md px-3.5 py-2.5 leading-relaxed shadow-none"
            />
            <p className="text-muted-foreground mt-1 text-right text-[11px]">
              {form.descripcion.length.toLocaleString("es-EC")} caracteres
            </p>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-semibold">Imagen (opcional)</p>
            <input
              ref={inputArchivo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => elegirImagen(e.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={subiendo}
                onClick={() => inputArchivo.current?.click()}
              >
                {subiendo ? <Spinner /> : <ImagePlus className="size-4" strokeWidth={1.8} />}
                {form.imagenUrl ? "Cambiar imagen" : "Subir imagen"}
              </Button>
              {form.imagenUrl ? (
                <Button type="button" variant="outline" onClick={() => cambiar("imagenUrl", "")}>
                  <X className="size-4" strokeWidth={1.8} />
                  Quitar
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1.5 text-[11px]">
              JPG, PNG o WebP de hasta 5 MB. Se ve mejor horizontal, en proporción 16:9.
            </p>
          </div>

          <GaleriaEditor
            fotos={form.galeria}
            onChange={(galeria) => cambiar("galeria", galeria)}
            onSubiendo={setSubiendoGaleria}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              label="¿Quién la ve?"
              placeholder="Todos los clientes"
              opciones={PROYECTOS.map((p) => ({ value: p.value || "todos", label: p.label }))}
              value={form.proyecto || "todos"}
              onValueChange={(v) => cambiar("proyecto", v === "todos" ? "" : v)}
            />
            <TextField
              type="number"
              label="Orden (menor primero)"
              value={String(form.orden)}
              onChange={(v) => cambiar("orden", Math.max(0, Number(v) || 0))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <DatePickerField
                label="Publicar desde"
                value={form.publicarDesde}
                onChange={(v) => cambiar("publicarDesde", v)}
                placeholder="Desde hoy"
              />
              {form.publicarDesde ? (
                <button
                  type="button"
                  className="text-muted-foreground mt-1 text-[11px] underline"
                  onClick={() => cambiar("publicarDesde", "")}
                >
                  Quitar fecha
                </button>
              ) : null}
            </div>
            <div>
              <DatePickerField
                label="Publicar hasta"
                value={form.publicarHasta}
                onChange={(v) => cambiar("publicarHasta", v)}
                placeholder="Sin fecha de fin"
                fechaMinima={form.publicarDesde || undefined}
              />
              {form.publicarHasta ? (
                <button
                  type="button"
                  className="text-muted-foreground mt-1 text-[11px] underline"
                  onClick={() => cambiar("publicarHasta", "")}
                >
                  Quitar fecha
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              label="Enlace del botón (opcional)"
              value={form.enlaceUrl}
              onChange={(v) => cambiar("enlaceUrl", v.trim())}
              placeholder="https://grupoancon.com/…"
            />
            <TextField
              label="Texto del botón"
              value={form.enlaceTexto}
              onChange={(v) => cambiar("enlaceTexto", v.slice(0, 40))}
              placeholder="Ver más"
              disabled={!form.enlaceUrl}
            />
          </div>

          <div
            onClick={() => cambiar("activo", !form.activo)}
            className="flex cursor-pointer items-center gap-2.5 text-sm"
          >
            <Checkbox checked={form.activo} onCheckedChange={() => {}} aria-label="Visible en la app" />
            Visible en la app
          </div>

          {error ? (
            <p className="bg-status-bloqueado-bg text-status-bloqueado-fg rounded-md px-3 py-2.5 text-xs">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || subiendo || subiendoGaleria}>
              {guardando ? <Spinner /> : null}
              {novedad === "nueva" ? "Publicar" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Fotos adicionales que se ven dentro del detalle de la novedad. Se suben de a una
// (el endpoint recibe un archivo por vez) y se pueden quitar y reordenar.
function GaleriaEditor({
  fotos,
  onChange,
  onSubiendo,
}: {
  fotos: string[]
  onChange: (fotos: string[]) => void
  onSubiendo: (subiendo: boolean) => void
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [pendientes, setPendientes] = useState(0)
  // La lista cambia mientras se suben: se acumula sobre la última versión.
  const actuales = useRef(fotos)
  actuales.current = fotos

  async function subir(archivos: FileList | null) {
    const lista = Array.from(archivos ?? [])
    if (!lista.length) return
    const espacio = MAX_GALERIA - actuales.current.length
    if (espacio <= 0) {
      toast({ variant: "warning", description: `La galería admite hasta ${MAX_GALERIA} fotos.` })
      return
    }
    const elegidos = lista.slice(0, espacio)
    if (lista.length > espacio) {
      toast({
        variant: "warning",
        description: `Solo se agregarán ${espacio} ${espacio === 1 ? "foto" : "fotos"}: el máximo es ${MAX_GALERIA}.`,
      })
    }
    setPendientes(elegidos.length)
    onSubiendo(true)
    let fallidas = 0
    for (const archivo of elegidos) {
      try {
        const url = await subirImagenNovedad(archivo)
        onChange([...actuales.current, url])
        actuales.current = [...actuales.current, url]
      } catch (err) {
        fallidas += 1
        toast({ variant: "error", description: `${archivo.name}: ${mensajeDeError(err)}` })
      } finally {
        setPendientes((n) => n - 1)
      }
    }
    onSubiendo(false)
    if (input.current) input.current.value = ""
    if (!fallidas && elegidos.length > 1) {
      toast({ variant: "success", description: `${elegidos.length} fotos agregadas.` })
    }
  }

  const mover = (desde: number, hasta: number) => {
    if (hasta < 0 || hasta >= fotos.length) return
    const copia = [...fotos]
    const [foto] = copia.splice(desde, 1)
    copia.splice(hasta, 0, foto)
    onChange(copia)
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-semibold">
          Galería (opcional) · {fotos.length}/{MAX_GALERIA}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => subir(e.target.files)}
      />
      {fotos.length || pendientes ? (
        <ul className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((foto, i) => (
            <li key={`${foto}-${i}`} className="border-border group relative overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt={`Foto ${i + 1}`} className="bg-muted aspect-square w-full object-cover" />
              <button
                type="button"
                aria-label="Quitar foto"
                onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button
                  type="button"
                  aria-label="Mover a la izquierda"
                  disabled={i === 0}
                  onClick={() => mover(i, i - 1)}
                  className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-0"
                >
                  <ChevronLeft className="size-3.5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label="Mover a la derecha"
                  disabled={i === fotos.length - 1}
                  onClick={() => mover(i, i + 1)}
                  className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-0"
                >
                  <ChevronRight className="size-3.5" strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: pendientes }).map((_, i) => (
            <li
              key={`pendiente-${i}`}
              className="border-border bg-muted flex aspect-square items-center justify-center rounded-md border"
            >
              <Spinner />
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        variant="outline"
        disabled={pendientes > 0 || fotos.length >= MAX_GALERIA}
        onClick={() => input.current?.click()}
      >
        <Images className="size-4" strokeWidth={1.8} />
        {fotos.length ? "Agregar más fotos" : "Agregar fotos"}
      </Button>
      <p className="text-muted-foreground mt-1.5 text-[11px]">
        Puedes elegir varias a la vez. Se ven dentro de la novedad, en este orden.
      </p>
    </div>
  )
}

// Cómo se verá la tarjeta en el Inicio de la app.
function VistaPrevia({ form }: { form: NovedadForm }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-xs font-semibold">Vista previa en la app</p>
      <div className="relative mx-auto aspect-[16/10] w-full max-w-[340px] overflow-hidden rounded-[22px] bg-gradient-to-br from-rose-50 to-slate-100 shadow-sm">
        {form.imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.imagenUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-rose-300">
            <Megaphone className="size-10" strokeWidth={1.3} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
          <p className="line-clamp-2 text-[15px] leading-snug font-semibold text-white">
            {form.titulo || "Título de la novedad"}
          </p>
        </div>
      </div>
    </div>
  )
}
