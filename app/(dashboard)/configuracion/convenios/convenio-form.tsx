"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, Save } from "lucide-react"
import { useRouter } from "@/lib/navigation"
import { Controller, useForm, type FieldErrors } from "react-hook-form"

import { AsignacionPicker } from "@/components/convenios/asignacion-picker"
import { TiptapEditor } from "@/components/convenios/tiptap-editor"
import { VariableManager } from "@/components/convenios/variable-manager"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  actualizarConvenio,
  crearConvenio,
  previsualizarContenido,
  type ConvenioAsignacionBackend,
  type ConvenioConAsignaciones,
} from "@/lib/api/convenios-api"
import { VentasApiError } from "@/lib/api/ventas-api"
import { convenioSchema, type ConvenioInput } from "@/lib/validations/convenios"

// Recorre el objeto de errores de react-hook-form (que puede tener forma anidada de
// objeto O de array según el campo) y devuelve un mensaje legible por cada hoja con
// `.message` — sin asumir Array vs objeto plano en ningún nivel, así no importa cómo
// @hookform/resolvers termine armando la forma exacta para un campo en particular.
// Se salta "ref"/"type"/"types" a propósito: "ref" puede apuntar a un elemento del DOM
// (input real), y recorrerlo con Object.entries reventaría.
function aplanarErrores(errores: unknown, prefijo = ""): string[] {
  if (!errores || typeof errores !== "object") return []
  const mensajes: string[] = []
  for (const [clave, valor] of Object.entries(errores as Record<string, unknown>)) {
    if (clave === "ref" || clave === "type" || clave === "types") continue
    if (!valor || typeof valor !== "object") continue
    const nodo = valor as { message?: unknown }
    if (typeof nodo.message === "string" && nodo.message) {
      mensajes.push(`${prefijo}${clave}: ${nodo.message}`)
    }
    mensajes.push(...aplanarErrores(valor, `${prefijo}${clave}.`))
  }
  return mensajes
}

export function ConvenioForm({ convenio }: { convenio?: ConvenioConAsignaciones }) {
  const router = useRouter()
  const toast = useToast()
  const [guardando, setGuardando] = useState(false)
  const [asignaciones, setAsignaciones] = useState<ConvenioAsignacionBackend[]>(
    convenio?.asignaciones ?? []
  )
  const [preview, setPreview] = useState<string | null>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [erroresValidacion, setErroresValidacion] = useState<string[]>([])

  const form = useForm<ConvenioInput>({
    resolver: zodResolver(convenioSchema),
    defaultValues: {
      nombre: convenio?.nombre ?? "",
      contenido: convenio?.contenido ?? "",
      variables: convenio?.variables ?? [],
      // El backend guarda `activo` como TINYINT(1) en MySQL — según cómo lo serialice
      // esa vuelta, puede llegar como 1/0 en vez de true/false real. El tipo de
      // ConvenioBackend dice "boolean" pero eso es solo la anotación de TypeScript, no
      // garantiza la forma real del JSON — Boolean(...) fuerza el booleano de JS de
      // verdad para que la validación de Zod (que exige boolean estricto) nunca la
      // rechace con "Invalid input" sin haberla tocado.
      activo: Boolean(convenio?.activo ?? true),
    },
  })

  async function onSubmit(values: ConvenioInput) {
    setGuardando(true)
    setErroresValidacion([])
    try {
      if (convenio) {
        await actualizarConvenio(convenio.id, values)
        toast({ variant: "success", description: "Convenio actualizado." })
      } else {
        const creado = await crearConvenio(values)
        toast({
          variant: "success",
          description: "Convenio creado. Ahora puedes asignarlo a un proyecto o lote.",
        })
        router.push(`/configuracion/convenios/${creado.id}/editar`)
        return
      }
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar el convenio",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  // Sin esto, un envío inválido (ej. una variable "Selección manual" a la que le falta
  // una opción) no hacía absolutamente nada visible al hacer clic en "Guardar cambios"
  // — react-hook-form bloquea el submit en silencio si la validación falla y no se le
  // pasa un manejador de error explícito. Este toast + los mensajes por variable de
  // abajo hacen que la falla nunca pase desapercibida.
  function onInvalid(errores: FieldErrors<ConvenioInput>) {
    const mensajes = aplanarErrores(errores)
    setErroresValidacion(mensajes)
    toast({
      variant: "error",
      title: "Revisa los campos marcados",
      description:
        mensajes[0] ?? "Hay datos incompletos o inválidos — no se guardó nada todavía.",
    })
  }

  async function verPreview() {
    setCargandoPreview(true)
    try {
      const { html } = await previsualizarContenido({
        contenido: form.getValues("contenido"),
        variables: form.getValues("variables"),
      })
      setPreview(html)
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo generar la vista previa",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setCargandoPreview(false)
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      className="space-y-5 pb-10"
      noValidate
    >
      {erroresValidacion.length > 0 ? (
        <div className="border-destructive/40 bg-destructive/10 rounded-lg border p-4">
          <div className="text-destructive mb-1.5 text-sm font-bold">
            No se guardó — revisa esto:
          </div>
          <ul className="text-destructive list-disc space-y-0.5 pl-5 text-xs">
            {erroresValidacion.map((mensaje, indice) => (
              <li key={indice}>{mensaje}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="bg-card border-border rounded-lg border p-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_auto]">
          <Controller
            name="nombre"
            control={form.control}
            render={({ field }) => (
              <TextField
                label="Nombre del convenio"
                placeholder="Ej. Convenio estándar Crédito directo"
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.nombre?.message}
              />
            )}
          />
          <div className="flex items-end gap-2 pb-0.5">
            <Controller
              name="activo"
              control={form.control}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value ?? true}
                    onCheckedChange={(valor) => field.onChange(Boolean(valor))}
                  />
                  Activo
                </label>
              )}
            />
          </div>
        </div>
      </div>

      <div className="bg-card border-border rounded-lg border p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="text-sm font-semibold">Variables</div>
        </div>
        <Controller
          name="variables"
          control={form.control}
          render={({ field }) => (
            <VariableManager variables={field.value} onChange={field.onChange} />
          )}
        />
        {form.formState.errors.variables?.message ? (
          <p className="text-destructive mt-2 text-xs font-medium">
            {form.formState.errors.variables.message}
          </p>
        ) : null}
        {/* Indexado con [indice] en vez de .map sobre errors.variables directamente:
            @hookform/resolvers arma este objeto con forma "array-like" (índices
            numéricos + .message propio), pero no siempre es un Array real — Array.isArray
            sobre él podía dar false y esconder el mensaje puntual de cada variable,
            dejando solo el toast genérico sin decir CUÁL variable está mal. */}
        {form.watch("variables").map((variable, indice) => {
          const errorVariable = form.formState.errors.variables?.[indice]
          const mensaje =
            errorVariable?.campo?.message ?? errorVariable?.opciones?.message
          if (!mensaje) return null
          return (
            <p key={indice} className="text-destructive mt-2 text-xs font-medium">
              {variable.etiqueta || `Variable #${indice + 1}`}: {mensaje}
            </p>
          )
        })}
      </div>

      <div className="bg-card border-border rounded-lg border p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="text-sm font-semibold">Contenido</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={verPreview}
            disabled={cargandoPreview}
          >
            <Eye className="size-3.5" strokeWidth={1.8} />
            {cargandoPreview ? "Generando…" : "Vista previa"}
          </Button>
        </div>
        <Controller
          name="contenido"
          control={form.control}
          render={({ field }) => (
            <TiptapEditor
              value={field.value}
              onChange={field.onChange}
              variables={form.watch("variables")}
            />
          )}
        />
        {form.formState.errors.contenido?.message ? (
          <p className="text-destructive mt-2 text-xs font-medium">
            {form.formState.errors.contenido.message}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="bg-card border-border rounded-lg border p-5">
          <div className="mb-3.5 text-sm font-semibold">
            Vista previa (valores de ejemplo, no reales)
          </div>
          <div
            className="convenio-preview prose-sm max-w-none rounded-md border border-dashed p-4"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      ) : null}

      {convenio ? (
        <div className="bg-card border-border rounded-lg border p-5">
          <div className="mb-3.5 text-sm font-semibold">Asignación a proyecto o lote</div>
          <AsignacionPicker
            convenioId={convenio.id}
            asignaciones={asignaciones}
            onAsignacionesChange={setAsignaciones}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Guarda el convenio primero para poder asignarlo a un proyecto o lote.
        </p>
      )}

      <div className="flex justify-end gap-2.5">
        <Button type="submit" disabled={guardando}>
          <Save className="size-3.5" strokeWidth={1.8} />
          {guardando ? "Guardando…" : convenio ? "Guardar cambios" : "Crear convenio"}
        </Button>
      </div>
    </form>
  )
}
