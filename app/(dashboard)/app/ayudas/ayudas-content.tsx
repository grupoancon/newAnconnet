"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, PlayCircle, Plus, Trash2 } from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  actualizarVideoAyuda,
  crearVideoAyuda,
  eliminarVideoAyuda,
  listarVideosAyuda,
  VideosAyudaApiError,
} from "@/lib/api/videos-ayuda-api"

import {
  aFormulario,
  FORM_VACIO,
  MAX_DESCRIPCION,
  MAX_TITULO,
  miniatura,
  youtubeIdDe,
  type VideoAyuda,
  type VideoAyudaForm,
} from "./datos"

function mensajeDeError(err: unknown): string {
  return err instanceof VideosAyudaApiError ? err.message : "No se pudo conectar con el servidor"
}

export function AyudasContent() {
  const toast = useToast()
  const [videos, setVideos] = useState<VideoAyuda[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  // null = cerrado; "nuevo" = crear; VideoAyuda = editar.
  const [editando, setEditando] = useState<VideoAyuda | "nuevo" | null>(null)
  const [porEliminar, setPorEliminar] = useState<VideoAyuda | null>(null)
  const [moviendo, setMoviendo] = useState(false)

  useEffect(() => {
    let vigente = true
    setError(null)
    listarVideosAyuda()
      .then((lista) => vigente && setVideos(lista))
      .catch((err) => vigente && setError(mensajeDeError(err)))
    return () => {
      vigente = false
    }
  }, [recarga])

  async function cambiarVisibilidad(video: VideoAyuda) {
    try {
      await actualizarVideoAyuda(video.id, { activo: !video.activo })
      toast({
        variant: "success",
        description: video.activo ? "El video ya no se muestra en la app." : "El video vuelve a mostrarse.",
      })
      setRecarga((n) => n + 1)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    }
  }

  // Reordena la lista y guarda como orden la posición de cada video (0, 1, 2…),
  // solo en los que cambiaron.
  async function mover(desde: number, hasta: number) {
    if (!videos || hasta < 0 || hasta >= videos.length) return
    const nueva = [...videos]
    const [video] = nueva.splice(desde, 1)
    nueva.splice(hasta, 0, video)
    setVideos(nueva.map((v, i) => ({ ...v, orden: i })))
    setMoviendo(true)
    try {
      await Promise.all(
        nueva.map((v, i) => (v.orden === i ? null : actualizarVideoAyuda(v.id, { orden: i }))),
      )
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
      setRecarga((n) => n + 1)
    } finally {
      setMoviendo(false)
    }
  }

  async function confirmarEliminar() {
    if (!porEliminar) return
    try {
      await eliminarVideoAyuda(porEliminar.id)
      toast({ variant: "success", description: "Video eliminado." })
      setRecarga((n) => n + 1)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setPorEliminar(null)
    }
  }

  // Los nuevos van al final de la lista.
  const siguienteOrden = videos?.length ? Math.max(...videos.map((v) => v.orden)) + 1 : 0

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="App · Ayuda"
            title="Videos de ayuda"
            actions={
              <Button onClick={() => setEditando("nuevo")}>
                <Plus className="size-4" strokeWidth={1.8} />
                Agregar video
              </Button>
            }
          />

          {error ? (
            <EmptyState title="No se pudieron cargar los videos" description={error} />
          ) : !videos ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : videos.length === 0 ? (
            <EmptyState
              title="Todavía no hay videos de ayuda"
              description="Sube el video a YouTube (público o no listado), pega aquí su link y la app lo reproducirá en la sección Ayuda."
            />
          ) : (
            <ol className="divide-border divide-y">
              {videos.map((video, i) => (
                <li key={video.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex shrink-0 flex-row gap-1 sm:flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Subir"
                      disabled={i === 0 || moviendo}
                      onClick={() => mover(i, i - 1)}
                    >
                      <ArrowUp className="size-3.5" strokeWidth={1.8} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Bajar"
                      disabled={i === videos.length - 1 || moviendo}
                      onClick={() => mover(i, i + 1)}
                    >
                      <ArrowDown className="size-3.5" strokeWidth={1.8} />
                    </Button>
                  </div>

                  <a
                    href={video.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block w-full shrink-0 overflow-hidden rounded-md sm:w-40"
                    aria-label={`Ver "${video.titulo}" en YouTube`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={miniatura(video.youtubeId)}
                      alt=""
                      className={`bg-muted aspect-video w-full object-cover ${video.activo ? "" : "opacity-50"}`}
                    />
                    <PlayCircle
                      className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                      strokeWidth={1.5}
                    />
                  </a>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusBadge variant={video.activo ? "aprobado" : "pronto"}>
                        {video.activo ? "Visible" : "Oculto"}
                      </StatusBadge>
                      <span className="text-muted-foreground text-xs">Posición {i + 1}</span>
                    </div>
                    <p className="text-[14px] leading-snug font-semibold">{video.titulo}</p>
                    {video.descripcion ? (
                      <p className="text-muted-foreground line-clamp-2 text-[13px]">{video.descripcion}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditando(video)}>
                      <Pencil className="size-3.5" strokeWidth={1.8} />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => cambiarVisibilidad(video)}>
                      {video.activo ? (
                        <EyeOff className="size-3.5" strokeWidth={1.8} />
                      ) : (
                        <Eye className="size-3.5" strokeWidth={1.8} />
                      )}
                      {video.activo ? "Ocultar" : "Mostrar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Eliminar"
                      className="text-destructive"
                      onClick={() => setPorEliminar(video)}
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.8} />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <EditorVideo
        video={editando}
        siguienteOrden={siguienteOrden}
        onCerrar={() => setEditando(null)}
        onGuardado={() => {
          setEditando(null)
          setRecarga((n) => n + 1)
        }}
      />

      <ConfirmDialog
        abierto={porEliminar !== null}
        titulo="¿Eliminar este video?"
        descripcion={`"${porEliminar?.titulo ?? ""}" dejará de verse en la app. El video sigue en YouTube; si solo quieres quitarlo por un tiempo, usa Ocultar.`}
        textoConfirmar="Eliminar"
        destructivo
        onConfirmar={confirmarEliminar}
        onCancelar={() => setPorEliminar(null)}
      />
    </div>
  )
}

function EditorVideo({
  video,
  siguienteOrden,
  onCerrar,
  onGuardado,
}: {
  video: VideoAyuda | "nuevo" | null
  siguienteOrden: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<VideoAyudaForm>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (video === null) return
    setForm(video === "nuevo" ? { ...FORM_VACIO, orden: siguienteOrden } : aFormulario(video))
    setError(null)
    // siguienteOrden solo importa al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video])

  const cambiar = <K extends keyof VideoAyudaForm>(campo: K, valor: VideoAyudaForm[K]) =>
    setForm((actual) => ({ ...actual, [campo]: valor }))

  const youtubeId = youtubeIdDe(form.youtubeUrl)

  function validar(): string | null {
    if (!form.youtubeUrl.trim()) return "Pega el link del video de YouTube."
    if (!youtubeId) return "El link no es de un video de YouTube. Cópialo con el botón Compartir del video."
    if (form.titulo.trim().length < 3) return "El título debe tener al menos 3 caracteres."
    return null
  }

  async function guardar() {
    const problema = validar()
    setError(problema)
    if (problema || video === null) return
    setGuardando(true)
    try {
      if (video === "nuevo") await crearVideoAyuda(form)
      else await actualizarVideoAyuda(video.id, form)
      toast({ variant: "success", description: video === "nuevo" ? "Video agregado." : "Cambios guardados." })
      onGuardado()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Sheet open={video !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>{video === "nuevo" ? "Agregar video de ayuda" : "Editar video de ayuda"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <div>
            <TextField
              label="Link de YouTube"
              value={form.youtubeUrl}
              onChange={(v) => cambiar("youtubeUrl", v.trim())}
              placeholder="https://youtu.be/…"
            />
            <p className="text-muted-foreground mt-1.5 text-[11px]">
              En YouTube: Compartir → Copiar. El video debe ser público o no listado (no privado) y
              tener activada la opción &quot;Permitir inserción&quot;.
            </p>
          </div>

          <VistaPrevia youtubeId={youtubeId} hayLink={!!form.youtubeUrl} />

          <div>
            <TextField
              label="Título"
              value={form.titulo}
              onChange={(v) => cambiar("titulo", v.slice(0, MAX_TITULO))}
              placeholder="Cómo subir tu pago"
            />
            <p className="text-muted-foreground mt-1 text-right text-[11px]">
              {form.titulo.length}/{MAX_TITULO}
            </p>
          </div>

          <div>
            <TextField
              label="Descripción corta (opcional)"
              value={form.descripcion}
              onChange={(v) => cambiar("descripcion", v.slice(0, MAX_DESCRIPCION))}
              placeholder="Sube tu comprobante y registra el pago desde la app."
            />
            <p className="text-muted-foreground mt-1 text-right text-[11px]">
              {form.descripcion.length}/{MAX_DESCRIPCION} · Se ve debajo del título en la app.
            </p>
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
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? <Spinner /> : null}
              {video === "nuevo" ? "Agregar" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// El mismo reproductor que usa la app: si aquí se ve, en la app también.
function VistaPrevia({ youtubeId, hayLink }: { youtubeId: string | null; hayLink: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-xs font-semibold">Vista previa</p>
      {youtubeId ? (
        <iframe
          key={youtubeId}
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&playsinline=1`}
          title="Vista previa del video"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video w-full rounded-md border-0 bg-black"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md px-6 text-center text-xs">
          <PlayCircle className="size-8" strokeWidth={1.3} />
          {hayLink ? "Ese link no es de un video de YouTube." : "Pega el link para ver el video aquí."}
        </div>
      )}
    </div>
  )
}
