"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Copy, Lock, Plus, Trash2 } from "lucide-react"

import { SelectField } from "@/components/shared/select-field"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  crearEncuestaApp,
  editarEncuestaApp,
  preguntasParaGuardar,
} from "@/lib/api/app-encuestas-api"
import { cn } from "@/lib/utils"

import {
  ESTADO_ENCUESTA_LABELS,
  LIMITES,
  TIPO_PREGUNTA_LABELS,
  esSeleccion,
  preguntaVacia,
  problemaEnPreguntas,
  type EncuestaDetalle,
  type EstadoEncuesta,
  type Pregunta,
  type TipoPregunta,
} from "./datos"
import { VistaPreviaApp } from "./vista-previa-app"

function mensajeDeError(err: unknown): string {
  return err instanceof Error ? err.message : "Ocurrió un error inesperado."
}

// Crear (encuesta = null) o editar una encuesta. Si ya tiene asignaciones, las
// preguntas quedan bloqueadas (el backend también lo impide): cambiarlas alteraría el
// sentido de respuestas ya dadas — para eso está "Duplicar".
export function EditorEncuestaSheet({
  abierto,
  encuesta,
  onOpenChange,
  onGuardada,
}: {
  abierto: boolean
  encuesta: EncuestaDetalle | null
  onOpenChange: (open: boolean) => void
  onGuardada: (encuesta: EncuestaDetalle) => void
}) {
  const toast = useToast()
  const editando = encuesta !== null
  const preguntasBloqueadas = encuesta?.tieneAsignaciones ?? false

  const [titulo, setTitulo] = useState("")
  const [etiqueta, setEtiqueta] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [estado, setEstado] = useState<EstadoEncuesta>("draft")
  const [preguntas, setPreguntas] = useState<Pregunta[]>([preguntaVacia()])
  const [guardando, setGuardando] = useState(false)
  const [intentoGuardar, setIntentoGuardar] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setIntentoGuardar(false)
    setTitulo(encuesta?.titulo ?? "")
    setEtiqueta(encuesta?.etiquetaInterna ?? "")
    setDescripcion(encuesta?.descripcion ?? "")
    setEstado(encuesta?.estado ?? "draft")
    setPreguntas(
      encuesta
        ? encuesta.preguntas.map((p) => ({
            type: p.type,
            text: p.text,
            required: p.required,
            config: p.config,
            options: p.options.map((o) => ({ label: o.label })),
          }))
        : [preguntaVacia()]
    )
  }, [abierto, encuesta])

  const problema = !titulo.trim()
    ? "Escribe el título de la encuesta."
    : preguntasBloqueadas
      ? null
      : problemaEnPreguntas(preguntas)

  function actualizar(indice: number, cambios: Partial<Pregunta>) {
    setPreguntas((actual) =>
      actual.map((p, i) => (i === indice ? { ...p, ...cambios } : p))
    )
  }

  function mover(indice: number, delta: -1 | 1) {
    setPreguntas((actual) => {
      const destino = indice + delta
      if (destino < 0 || destino >= actual.length) return actual
      const copia = actual.slice()
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
  }

  function cambiarTipo(indice: number, tipo: TipoPregunta) {
    const actual = preguntas[indice]
    actualizar(indice, {
      type: tipo,
      options: esSeleccion(tipo)
        ? actual.options.length > 0
          ? actual.options
          : [{ label: "" }, { label: "" }]
        : [],
      config: esSeleccion(tipo) ? actual.config : null,
    })
  }

  async function guardar() {
    setIntentoGuardar(true)
    if (problema) return
    setGuardando(true)
    try {
      const base = {
        title: titulo.trim(),
        description: descripcion.trim() || null,
        internal_label: etiqueta.trim() || null,
        status: estado,
      }
      const guardada = editando
        ? await editarEncuestaApp(encuesta.id, {
            ...base,
            ...(preguntasBloqueadas
              ? {}
              : { questions: preguntasParaGuardar(preguntas) }),
          })
        : await crearEncuestaApp({ ...base, questions: preguntasParaGuardar(preguntas) })
      toast({
        variant: "success",
        description: editando ? "Encuesta actualizada." : "Encuesta creada.",
      })
      onGuardada(guardada)
      onOpenChange(false)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Sheet open={abierto} onOpenChange={onOpenChange}>
      <SheetContent
        // El Sheet trae data-[side=right]:w-3/4 y sm:max-w-sm, que le ganan a un
        // sm:max-w-* simple: hay que pisarlos con el mismo prefijo data-[side=right].
        // La vista previa va al lado solo si el PANEL es ancho (container query), no
        // según el ancho de la pantalla.
        className="@container/editor gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:xl:max-w-[1100px]"
      >
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>{editando ? "Editar encuesta" : "Nueva encuesta"}</SheetTitle>
          <SheetDescription>
            Encuesta para los usuarios de la app. No afecta la encuesta de calidad del
            proceso de venta.
          </SheetDescription>
        </SheetHeader>

        {/* Formulario a la izquierda y, en pantallas anchas, la vista previa de la
            app a la derecha (fija mientras se baja por las preguntas). En pantallas
            angostas la vista previa va al final. */}
        <div className="grid grid-cols-1 @[54rem]/editor:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  label="Título (lo ve el usuario)"
                  value={titulo}
                  onChange={(v) => setTitulo(v.slice(0, LIMITES.titulo))}
                  placeholder="Satisfacción con el proceso de soporte"
                  error={intentoGuardar && !titulo.trim() ? "Escribe el título." : null}
                />
              </div>
              <TextField
                label="Subtítulo interno (opcional)"
                value={etiqueta}
                onChange={(v) => setEtiqueta(v.slice(0, LIMITES.etiquetaInterna))}
                placeholder="Ej: V2 - primer ingreso"
                hint="Solo se ve en la intranet, nunca en la app."
              />
              <SelectField
                label="Estado"
                placeholder="Estado"
                opciones={(Object.keys(ESTADO_ENCUESTA_LABELS) as EstadoEncuesta[]).map(
                  (e) => ({ value: e, label: ESTADO_ENCUESTA_LABELS[e] })
                )}
                value={estado}
                onValueChange={(v) => setEstado(v as EstadoEncuesta)}
              />
              <div className="sm:col-span-2">
                <label
                  htmlFor="descripcion-encuesta"
                  className="text-muted-foreground mb-1.5 block text-xs font-semibold"
                >
                  Mensaje para el usuario (opcional)
                </label>
                <Textarea
                  id="descripcion-encuesta"
                  value={descripcion}
                  onChange={(e) =>
                    setDescripcion(e.target.value.slice(0, LIMITES.descripcion))
                  }
                  placeholder="Ayúdanos a mejorar contándonos tu experiencia."
                  className="bg-card focus-visible:border-primary min-h-[72px] rounded-md px-3.5 py-2.5 shadow-none"
                />
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Aparece en el aviso y en la pantalla de la encuesta dentro de la app.
                </p>
              </div>
            </div>

            <div className="border-border border-t pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                  Preguntas ({preguntas.length})
                </p>
              </div>

              {preguntasBloqueadas ? (
                <div className="space-y-2">
                  <p className="bg-status-reservado-bg text-status-reservado-fg flex items-start gap-2 rounded-md px-3 py-2.5 text-xs">
                    <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} />
                    Esta encuesta ya fue asignada, así que sus preguntas no se pueden
                    cambiar. Usa “Duplicar” para crear una nueva versión con cambios.
                  </p>
                  <ol className="space-y-1.5">
                    {encuesta?.preguntas.map((p, i) => (
                      <li
                        key={p.id}
                        className="bg-muted/60 border-border rounded-md border px-3 py-2 text-[13px]"
                      >
                        {i + 1}. {p.text}
                        <span className="text-muted-foreground ml-1.5 text-[11px]">
                          · {TIPO_PREGUNTA_LABELS[p.type]}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  {preguntas.map((p, i) => (
                    <EditorPregunta
                      key={i}
                      numero={i + 1}
                      pregunta={p}
                      total={preguntas.length}
                      marcarErrores={intentoGuardar}
                      onCambio={(c) => actualizar(i, c)}
                      onTipo={(t) => cambiarTipo(i, t)}
                      onMover={(d) => mover(i, d)}
                      onDuplicar={() =>
                        setPreguntas((actual) => [
                          ...actual.slice(0, i + 1),
                          {
                            ...p,
                            text: "",
                            options: p.options.map((o) => ({ label: o.label })),
                          },
                          ...actual.slice(i + 1),
                        ])
                      }
                      onEliminar={() =>
                        setPreguntas((actual) => actual.filter((_, j) => j !== i))
                      }
                    />
                  ))}
                  <button
                    type="button"
                    disabled={preguntas.length >= LIMITES.preguntas}
                    onClick={() => setPreguntas((actual) => [...actual, preguntaVacia()])}
                    className="border-border text-muted-foreground hover:border-primary hover:text-primary flex w-full items-center justify-center gap-1.5 rounded-md border-2 border-dashed py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-40"
                  >
                    <Plus className="size-4" strokeWidth={1.8} />
                    Agregar pregunta
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className="bg-muted/40 border-border border-t p-5 @[54rem]/editor:border-t-0 @[54rem]/editor:border-l">
            <div className="@[54rem]/editor:sticky @[54rem]/editor:top-5">
              <p className="text-muted-foreground mb-3 text-center text-xs font-bold tracking-wide uppercase">
                Vista previa en la app
              </p>
              <VistaPreviaApp
                titulo={titulo}
                descripcion={descripcion}
                preguntas={preguntas}
              />
            </div>
          </aside>
        </div>

        <SheetFooter className="border-border bg-card sticky bottom-0 flex-row items-center justify-between gap-2 border-t p-4">
          <p className="text-destructive min-w-0 flex-1 truncate text-xs">
            {intentoGuardar ? problema : null}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={guardando} onClick={() => void guardar()}>
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear encuesta"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function EditorPregunta({
  numero,
  pregunta,
  total,
  marcarErrores,
  onCambio,
  onTipo,
  onMover,
  onDuplicar,
  onEliminar,
}: {
  numero: number
  pregunta: Pregunta
  total: number
  marcarErrores: boolean
  onCambio: (cambios: Partial<Pregunta>) => void
  onTipo: (tipo: TipoPregunta) => void
  onMover: (delta: -1 | 1) => void
  onDuplicar: () => void
  onEliminar: () => void
}) {
  const opcionesLlenas = pregunta.options.filter((o) => o.label.trim()).length
  const faltaTexto = marcarErrores && !pregunta.text.trim()
  const faltanOpciones = esSeleccion(pregunta.type) && opcionesLlenas < 2

  function cambiarOpcion(indice: number, label: string) {
    onCambio({
      options: pregunta.options.map((o, i) => (i === indice ? { label } : o)),
    })
  }

  return (
    <div className="bg-muted/40 border-border rounded-lg border p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="bg-brand-gradient flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold text-white">
          {numero}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <BotonIcono
            etiqueta="Subir"
            disabled={numero === 1}
            onClick={() => onMover(-1)}
          >
            <ArrowUp className="size-3.5" strokeWidth={1.8} />
          </BotonIcono>
          <BotonIcono
            etiqueta="Bajar"
            disabled={numero === total}
            onClick={() => onMover(1)}
          >
            <ArrowDown className="size-3.5" strokeWidth={1.8} />
          </BotonIcono>
          <BotonIcono etiqueta="Duplicar pregunta" onClick={onDuplicar}>
            <Copy className="size-3.5" strokeWidth={1.8} />
          </BotonIcono>
          <BotonIcono
            etiqueta="Eliminar pregunta"
            disabled={total === 1}
            onClick={onEliminar}
            peligro
          >
            <Trash2 className="size-3.5" strokeWidth={1.8} />
          </BotonIcono>
        </div>
      </div>

      <Input
        value={pregunta.text}
        onChange={(e) => onCambio({ text: e.target.value.slice(0, LIMITES.pregunta) })}
        placeholder={`Escribe la pregunta ${numero}`}
        aria-invalid={faltaTexto}
        className={cn("bg-card", faltaTexto && "border-destructive")}
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SelectField
            placeholder="Tipo de respuesta"
            opciones={(Object.keys(TIPO_PREGUNTA_LABELS) as TipoPregunta[]).map((t) => ({
              value: t,
              label: TIPO_PREGUNTA_LABELS[t],
            }))}
            value={pregunta.type}
            onValueChange={(v) => onTipo(v as TipoPregunta)}
          />
        </div>
        <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs font-semibold">
          <Checkbox
            checked={pregunta.required}
            onCheckedChange={(v) => onCambio({ required: v === true })}
          />
          Obligatoria
        </label>
      </div>

      {esSeleccion(pregunta.type) ? (
        <div className="border-border mt-3 space-y-1.5 border-l-2 pl-3">
          {pregunta.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={cn(
                  "border-muted-foreground/50 size-3.5 shrink-0 border",
                  pregunta.type === "single_choice" ? "rounded-full" : "rounded-[3px]"
                )}
              />
              <Input
                value={o.label}
                onChange={(e) => cambiarOpcion(i, e.target.value.slice(0, 255))}
                placeholder={`Opción ${i + 1}`}
                className="bg-card h-8"
              />
              <BotonIcono
                etiqueta="Quitar opción"
                onClick={() =>
                  onCambio({ options: pregunta.options.filter((_, j) => j !== i) })
                }
                peligro
              >
                <Trash2 className="size-3.5" strokeWidth={1.8} />
              </BotonIcono>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={pregunta.options.length >= LIMITES.opciones}
              onClick={() => onCambio({ options: [...pregunta.options, { label: "" }] })}
              className="text-primary flex items-center gap-1 text-xs font-semibold disabled:opacity-40"
            >
              <Plus className="size-3.5" strokeWidth={2} /> Agregar opción
            </button>
            <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={pregunta.config?.allow_other === true}
                onCheckedChange={(v) =>
                  onCambio({ config: v === true ? { allow_other: true } : null })
                }
              />
              Agregar opción “Otro” (texto libre)
            </label>
          </div>
          {marcarErrores && faltanOpciones ? (
            <p className="text-destructive text-[11px]">Necesita al menos 2 opciones.</p>
          ) : null}
        </div>
      ) : pregunta.type === "rating" ? (
        <div className="mt-3 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <span
              key={v}
              className="border-border bg-card text-muted-foreground flex size-7 items-center justify-center rounded-md border text-xs font-semibold"
            >
              {v}
            </span>
          ))}
          <span className="text-muted-foreground ml-1 self-center text-[11px]">
            1 = muy insatisfecho · 5 = muy satisfecho
          </span>
        </div>
      ) : null}
    </div>
  )
}

function BotonIcono({
  etiqueta,
  onClick,
  disabled,
  peligro,
  children,
}: {
  etiqueta: string
  onClick: () => void
  disabled?: boolean
  peligro?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-muted-foreground flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        peligro
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
