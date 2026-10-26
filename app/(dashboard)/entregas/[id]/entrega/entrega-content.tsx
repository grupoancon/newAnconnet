"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { ArrowLeft, Camera, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "@/lib/navigation"

import { ComboboxField } from "@/components/shared/combobox-field"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { OpcionRevision } from "@/components/shared/opcion-revision"
import { PageHeader } from "@/components/shared/page-header"
import { useSession } from "@/components/shared/session-provider"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import {
  EntregasApiError,
  ITEMS_ENTREGA,
  ITEMS_PRE_ENTREGA,
  guardarEntrega,
  listarAsesoresVentasEntrega,
  obtenerEntrega,
  type AsesorOpcion,
  type ChecklistEntrega,
  type EntregaDetalle,
  type EstadoPaso,
  type ItemEntrega,
  type RevisionOfrecimiento,
} from "@/lib/api/entregas-api"

type Respuestas = Record<ItemEntrega, RevisionOfrecimiento | null>

const ESTADO_VARIANTE: Record<EstadoPaso, { variant: StatusVariant; label: string }> = {
  COMPLETO: { variant: "aprobado", label: "Completo" },
  PENDIENTE: { variant: "pronto", label: "Pendiente" },
  OBSERVACION: { variant: "rechazado", label: "Observación" },
}

const VACIAS: Respuestas = {
  limpieza: null,
  tanque: null,
  huerto: null,
  linderos: null,
  llave: null,
  naranjo: null,
  tarjeta: null,
  tag: null,
}

function formatearFecha(valor: string | null, hora?: string | null): string {
  if (!valor) return "Sin fecha"
  const [anio, mes, dia] = valor.split("-")
  return `${dia}/${mes}/${anio}${hora ? ` · ${hora}` : ""}`
}

function Dato({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[11px] font-semibold uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-semibold break-words">{children || "—"}</dd>
    </div>
  )
}

// Re-codifica la foto a JPEG (max. 1600 px de lado) antes de subirla: asegura un formato
// que el backend acepta (el selector del celular puede dar HEIC/WEBP) y baja el peso.
async function prepararFoto(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("El archivo debe ser una imagen.")
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(archivo)
  } catch {
    throw new Error(
      "No se pudo leer esa imagen: prueba con otra foto (algunos formatos, como HEIC, no son compatibles)."
    )
  }
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  const contexto = canvas.getContext("2d")
  if (!contexto) {
    bitmap.close()
    throw new Error("No se pudo procesar la imagen.")
  }
  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  )
  if (!blob) throw new Error("No se pudo procesar la imagen.")
  return new File([blob], `entrega-${Date.now()}.jpg`, { type: "image/jpeg" })
}

// "Por que" de cada punto: cuando difiere de la pre-entrega o esta en PD.
function preguntaDeMotivo(
  etiqueta: string,
  ahora: RevisionOfrecimiento | null,
  enPre: RevisionOfrecimiento | undefined
): string | null {
  if (!ahora || !enPre) return null
  if (ahora !== enPre) {
    return `En la pre-entrega estaba en ${enPre} y ahora es ${ahora}. ¿Por qué cambió?`
  }
  if (ahora === "PD") {
    return `¿Por qué ${etiqueta.toLowerCase()} está pendiente (PD)?`
  }
  return null
}

export function EntregaContent({ id }: { id: number }) {
  const router = useRouter()
  const toast = useToast()
  const usuario = useSession()
  const [guardando, startGuardando] = useTransition()

  const [detalle, setDetalle] = useState<EntregaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [respuestas, setRespuestas] = useState<Respuestas>(VACIAS)
  const [motivos, setMotivos] = useState<Partial<Record<ItemEntrega, string>>>({})
  const [observacion, setObservacion] = useState("")
  // Quien hizo la entrega: el propio asesor asignado u otro asesor de ventas.
  const [quien, setQuien] = useState<"yo" | "otro">("yo")
  const [otroId, setOtroId] = useState("")
  const [asesoresVentas, setAsesoresVentas] = useState<AsesorOpcion[]>([])
  const [errorAsesores, setErrorAsesores] = useState<string | null>(null)
  // Foto nueva (aun sin subir) y su vista previa; si no hay, se muestra la ya guardada.
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  useEffect(() => {
    obtenerEntrega(id)
      .then((d) => {
        setDetalle(d)
        // Si la entrega ya se habia guardado (PD / observacion) se puede corregir.
        setRespuestas({ ...VACIAS, ...(d.entrega.items ?? {}) })
        setMotivos(d.entrega.motivos ?? {})
        setObservacion(d.entrega.observacion ?? "")
        const hizo = d.entrega.realizadaPorId
        if (hizo && hizo !== usuario.id) {
          setQuien("otro")
          setOtroId(hizo)
        }
      })
      .catch((err) =>
        setError(
          err instanceof EntregasApiError ? err.message : "No se pudo cargar el proceso"
        )
      )
  }, [id, usuario.id])

  useEffect(() => {
    listarAsesoresVentasEntrega()
      .then(setAsesoresVentas)
      .catch((err) => {
        setAsesoresVentas([])
        setErrorAsesores(
          err instanceof EntregasApiError
            ? err.message
            : "No se pudo cargar la lista de asesores"
        )
      })
  }, [])

  useEffect(() => {
    if (!foto) {
      setFotoPreview(null)
      return
    }
    const url = URL.createObjectURL(foto)
    setFotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return
    try {
      setFoto(await prepararFoto(archivo))
    } catch (err) {
      toast({
        variant: "error",
        title: "Foto no válida",
        description: err instanceof Error ? err.message : "Prueba con otra foto.",
      })
    }
  }

  const pre = detalle?.preEntrega.items ?? null
  const asignado = Boolean(detalle && detalle.asesorId === usuario.id)
  const bloqueada = Boolean(
    detalle && (detalle.cerrada || detalle.entrega.estado === "COMPLETO")
  )
  const puedeRegistrar = asignado && Boolean(pre) && !bloqueada

  const preguntas = Object.fromEntries(
    ITEMS_ENTREGA.map((item) => [
      item.id,
      preguntaDeMotivo(
        item.label,
        respuestas[item.id],
        // Solo los puntos que comparten checklist tienen valor en la pre-entrega.
        (pre as Partial<Record<ItemEntrega, RevisionOfrecimiento>> | null)?.[item.id]
      ),
    ])
  ) as Record<ItemEntrega, string | null>
  const fotoActual = fotoPreview ?? detalle?.entrega.fotoUrl ?? null
  const quienCompleto = quien === "yo" || Boolean(otroId)
  const completo = Object.values(respuestas).every((r) => r !== null)
  const faltanMotivos = ITEMS_ENTREGA.some(
    (item) => preguntas[item.id] && !motivos[item.id]?.trim()
  )

  function guardar() {
    if (!puedeRegistrar || !completo || faltanMotivos || !fotoActual || !quienCompleto)
      return
    startGuardando(async () => {
      try {
        const { estado } = await guardarEntrega(
          id,
          {
            items: respuestas as ChecklistEntrega,
            observacion: observacion.trim() || undefined,
            // Solo los motivos de los puntos que lo piden ahora.
            motivos: Object.fromEntries(
              ITEMS_ENTREGA.filter((item) => preguntas[item.id]).map((item) => [
                item.id,
                (motivos[item.id] ?? "").trim(),
              ])
            ),
            realizadaPorId: quien === "otro" ? otroId : undefined,
          },
          foto
        )
        toast({
          variant: "success",
          description: `Entrega registrada (${ESTADO_VARIANTE[estado].label.toLowerCase()}).`,
        })
        router.push("/entregas")
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo guardar la entrega",
          description:
            err instanceof EntregasApiError ? err.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow={`Entregas · Proceso #${id}`}
            title="Entrega"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/entregas">
                  <ArrowLeft className="size-3.5" strokeWidth={2} />
                  Volver
                </Link>
              </Button>
            }
          />

          {detalle === null && !error ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : error || !detalle ? (
            <div className="p-6">
              <EmptyState
                title="No se pudo cargar"
                description={error ?? undefined}
                dashed
              />
            </div>
          ) : (
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_380px]">
              <div className="space-y-5">
                {!asignado ? (
                  <div className="bg-status-bloqueado-bg text-status-bloqueado-fg rounded-md px-4 py-3 text-[13px] font-semibold">
                    Solo el asesor asignado ({detalle.asesor ?? "—"}) puede registrar la
                    entrega.
                  </div>
                ) : !pre ? (
                  <div className="bg-status-reservado-bg text-status-reservado-fg rounded-md px-4 py-3 text-[13px] font-semibold">
                    La pre-entrega aún no está registrada: se necesita para poder
                    registrar la entrega.
                  </div>
                ) : bloqueada ? (
                  <div className="bg-status-reservado-bg text-status-reservado-fg rounded-md px-4 py-3 text-[13px] font-semibold">
                    La entrega ya fue realizada: solo se puede consultar.
                  </div>
                ) : null}

                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Checklist de entrega
                  </label>
                  <div className="border-border space-y-4 rounded-md border p-4">
                    {ITEMS_ENTREGA.map((item) => (
                      <fieldset
                        key={item.id}
                        disabled={!puedeRegistrar}
                        className="space-y-2 disabled:opacity-60"
                      >
                        <OpcionRevision
                          label={item.label}
                          value={respuestas[item.id]}
                          onChange={(valor) =>
                            setRespuestas((prev) => ({ ...prev, [item.id]: valor }))
                          }
                        />
                        {preguntas[item.id] ? (
                          <TextField
                            label={`${preguntas[item.id]} *`}
                            placeholder="Escribe el motivo"
                            value={motivos[item.id] ?? ""}
                            onChange={(texto) =>
                              setMotivos((prev) => ({ ...prev, [item.id]: texto }))
                            }
                          />
                        ) : null}
                      </fieldset>
                    ))}
                    <p className="text-muted-foreground text-[11px]">
                      SI · NO · PD (pendiente) · NA (no aplica). Todos los puntos son
                      obligatorios. Cada punto distinto al de la pre-entrega, o en PD,
                      pide el motivo. Con algún PD la entrega queda pendiente y con algún
                      NO queda con observación.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    ¿Quién realizó la entrega? *
                  </label>
                  <fieldset
                    disabled={!puedeRegistrar}
                    className="border-border space-y-3 rounded-md border p-4 disabled:opacity-60"
                  >
                    <div role="radiogroup" className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: "yo", label: "La hice yo" },
                          { id: "otro", label: "La hizo otro asesor" },
                        ] as const
                      ).map((opcion) => (
                        <button
                          key={opcion.id}
                          type="button"
                          role="radio"
                          aria-checked={quien === opcion.id}
                          onClick={() => setQuien(opcion.id)}
                          className={cn(
                            "rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
                            quien === opcion.id
                              ? "bg-brand-gradient border-transparent text-white"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {opcion.label}
                        </button>
                      ))}
                    </div>
                    {quien === "otro" ? (
                      <ComboboxField
                        label="Asesor que realizó la entrega *"
                        placeholder="Selecciona el asesor"
                        searchPlaceholder="Buscar asesor…"
                        emptyMessage={
                          errorAsesores ??
                          "No hay otros usuarios con el rol Asesor de Ventas."
                        }
                        options={asesoresVentas
                          .filter((a) => a.id !== usuario.id)
                          .map((a) => ({ value: a.id, label: a.name }))}
                        value={otroId}
                        onChange={setOtroId}
                      />
                    ) : null}
                  </fieldset>
                </div>

                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Foto de la entrega *
                  </label>
                  <input
                    ref={inputFoto}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      elegirFoto(e.target.files?.[0])
                      e.target.value = ""
                    }}
                  />
                  {fotoActual ? (
                    <div className="border-border relative w-fit overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fotoActual}
                        alt="Foto de la entrega"
                        className="max-h-72 max-w-full object-contain"
                      />
                      {puedeRegistrar ? (
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => inputFoto.current?.click()}
                          >
                            <Camera className="size-3" strokeWidth={2} />
                            Cambiar
                          </Button>
                          {foto ? (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              aria-label="Quitar la foto nueva"
                              onClick={() => setFoto(null)}
                            >
                              <X className="size-3" strokeWidth={2} />
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!puedeRegistrar}
                      onClick={() => inputFoto.current?.click()}
                      className="border-border text-muted-foreground hover:bg-muted flex h-32 w-full items-center justify-center gap-2 rounded-md border border-dashed text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Camera className="size-5" strokeWidth={1.8} />
                      Tomar o subir foto
                    </button>
                  )}
                  {puedeRegistrar && !fotoActual ? (
                    <p className="text-muted-foreground mt-1.5 text-[11px]">
                      Obligatoria para guardar la entrega.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Observaciones
                  </label>
                  <Textarea
                    rows={4}
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    disabled={!puedeRegistrar}
                    placeholder="Escriba las observaciones de la entrega…"
                    className="border-input bg-card focus-visible:border-primary focus-visible:ring-ring/15 w-full rounded-md border px-3.5 py-2.5 text-sm shadow-none focus-visible:ring-3"
                  />
                </div>

                {detalle.entrega.registradoPor ? (
                  <p className="text-muted-foreground text-xs">
                    Última actualización de {detalle.entrega.registradoPor} el{" "}
                    {formatearFecha(detalle.entrega.fecha)}.
                  </p>
                ) : null}

                {puedeRegistrar ? (
                  <Button
                    size="lg"
                    onClick={guardar}
                    disabled={
                      guardando ||
                      !completo ||
                      faltanMotivos ||
                      !fotoActual ||
                      !quienCompleto
                    }
                  >
                    {guardando ? "Guardando…" : "Guardar entrega"}
                  </Button>
                ) : null}
              </div>

              <aside className="space-y-4">
                <div className="border-border bg-muted/30 rounded-lg border p-5">
                  <h2 className="mb-4 text-[15px] font-extrabold">
                    Información del proceso
                  </h2>
                  <dl className="space-y-3.5">
                    <Dato label="Cliente">{detalle.cliente}</Dato>
                    <div className="grid grid-cols-2 gap-3.5">
                      <Dato label="Lote">
                        <span className="font-mono">{detalle.lote}</span>
                      </Dato>
                      <Dato label="Proyecto">{detalle.proyecto}</Dato>
                    </div>
                    <Dato label="Asesor asignado">{detalle.asesor}</Dato>
                    <Dato label="Fecha de entrega">
                      {formatearFecha(detalle.fechaPlanificada, detalle.hora)}
                    </Dato>
                    <Dato label="Tipo de financiamiento">
                      {detalle.tipoFinanciamiento}
                    </Dato>
                    <Dato label="Ofrecimientos (oferta)">
                      {detalle.ofrecimientos.length ? (
                        <ul className="list-disc pl-4">
                          {detalle.ofrecimientos.map((o) => (
                            <li key={o}>{o}</li>
                          ))}
                        </ul>
                      ) : null}
                    </Dato>
                    <Dato label="Revisión de ofrecimientos">
                      Huerto {detalle.revision.huerto ?? "—"} · Tanque{" "}
                      {detalle.revision.tanque ?? "—"} · Tag {detalle.revision.tag ?? "—"}
                    </Dato>
                  </dl>
                </div>

                <div className="border-border bg-muted/30 rounded-lg border p-5">
                  <h2 className="mb-4 text-[15px] font-extrabold">
                    Observaciones del proceso
                  </h2>
                  <dl className="space-y-3.5">
                    <Dato label="Comentario">{detalle.comentario}</Dato>
                    <Dato label="Trabajos extra">{detalle.trabajosExtra}</Dato>
                  </dl>
                </div>

                <div className="border-border bg-muted/30 rounded-lg border p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h2 className="text-[15px] font-extrabold">Pre-entrega</h2>
                    <StatusBadge
                      variant={ESTADO_VARIANTE[detalle.preEntrega.estado].variant}
                    >
                      {ESTADO_VARIANTE[detalle.preEntrega.estado].label}
                    </StatusBadge>
                  </div>
                  {pre ? (
                    <div className="space-y-3.5">
                      <ul className="divide-border divide-y text-[13px]">
                        {ITEMS_PRE_ENTREGA.map((item) => (
                          <li key={item.id} className="flex justify-between py-1.5">
                            <span className="font-semibold">{item.label}</span>
                            <span className="font-bold">{pre[item.id]}</span>
                          </li>
                        ))}
                      </ul>
                      <dl>
                        <Dato label="Observaciones de la pre-entrega">
                          {detalle.preEntrega.observacion}
                        </Dato>
                      </dl>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[13px]">
                      Pendiente: aún no se ha registrado la pre-entrega.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
