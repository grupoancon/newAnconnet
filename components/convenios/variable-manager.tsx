"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { TextField } from "@/components/shared/text-field"
import { Button } from "@/components/ui/button"
import {
  obtenerCatalogoVariables,
  type EntidadVariable,
  type OpcionSeleccion,
  type VariableDefinicion,
} from "@/lib/api/convenios-api"

const ETIQUETAS_ENTIDAD: Record<EntidadVariable, string> = {
  proyecto: "Proyecto",
  inventario: "Lote (inventario)",
  titular: "Cliente / titular",
  conyuge: "Cónyuge",
  apoderado: "Apoderado",
  financiamiento: "Financiamiento",
  oferta: "Oferta",
  proceso: "Proceso de venta",
  sistema: "Sistema",
  seleccion: "Selección manual (se elige al generar)",
}

function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function claveSugerida(entidad: EntidadVariable, campo: string): string {
  return slugificar(`${entidad}_${campo}`)
}

// Gestor de variables de un convenio: agregar/quitar libremente (ningún campo fijo).
// Dos formas de resolver el valor: atada a un campo real de BD elegido de un catálogo
// curado (nunca texto libre — ver CATALOGO_VARIABLES en anconAPI), o "selección
// manual": quien genera el convenio real elige entre opciones definidas acá (ej. "firma
// normal" vs. "firma por apoderado"), útil para que un párrafo entero cambie según esa
// elección con {{#if (eq clave "valor")}}...{{else}}...{{/if}} en el editor.
export function VariableManager({
  variables,
  onChange,
}: {
  variables: VariableDefinicion[]
  onChange: (variables: VariableDefinicion[]) => void
}) {
  const [catalogo, setCatalogo] = useState<Record<
    Exclude<EntidadVariable, "seleccion">,
    string[]
  > | null>(null)
  const [entidad, setEntidad] = useState<EntidadVariable>("proyecto")
  const [campo, setCampo] = useState("")
  const [etiqueta, setEtiqueta] = useState("")
  const [clave, setClave] = useState("")
  const [claveTocadaAMano, setClaveTocadaAMano] = useState(false)
  const [opciones, setOpciones] = useState<OpcionSeleccion[]>([])

  useEffect(() => {
    obtenerCatalogoVariables()
      .then(setCatalogo)
      .catch(() => setCatalogo(null))
  }, [])

  const esSeleccion = entidad === "seleccion"
  const camposDisponibles = !esSeleccion ? (catalogo?.[entidad] ?? []) : []
  const opcionesValidas = opciones.filter((o) => o.valor && o.etiqueta)

  function limpiarFormulario() {
    setCampo("")
    setEtiqueta("")
    setClave("")
    setClaveTocadaAMano(false)
    setOpciones([])
  }

  function agregar() {
    if (!clave || !etiqueta) return
    if (variables.some((v) => v.clave === clave)) return
    if (esSeleccion) {
      if (opcionesValidas.length < 2) return
      onChange([...variables, { clave, etiqueta, entidad, opciones: opcionesValidas }])
    } else {
      if (!campo) return
      onChange([...variables, { clave, etiqueta, entidad, campo }])
    }
    limpiarFormulario()
  }

  function quitar(claveAQuitar: string) {
    onChange(variables.filter((v) => v.clave !== claveAQuitar))
  }

  function agregarOpcion() {
    setOpciones((actual) => [...actual, { valor: "", etiqueta: "" }])
  }

  function actualizarOpcion(indice: number, campoOpcion: keyof OpcionSeleccion, valor: string) {
    setOpciones((actual) =>
      actual.map((o, i) => (i === indice ? { ...o, [campoOpcion]: valor } : o))
    )
  }

  function quitarOpcion(indice: number) {
    setOpciones((actual) => actual.filter((_, i) => i !== indice))
  }

  const puedeAgregar = esSeleccion
    ? Boolean(clave && etiqueta && opcionesValidas.length >= 2)
    : Boolean(campo && clave && etiqueta)

  return (
    <div className="space-y-3.5">
      {variables.length > 0 ? (
        <div className="border-border divide-border divide-y rounded-lg border">
          {variables.map((variable) => (
            <div key={variable.clave} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{variable.etiqueta}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {`{{${variable.clave}}}`} · {ETIQUETAS_ENTIDAD[variable.entidad]}
                  {variable.entidad === "seleccion"
                    ? ` → ${(variable.opciones ?? []).map((o) => o.etiqueta).join(" / ")}`
                    : ` → ${variable.campo}`}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar variable ${variable.etiqueta}`}
                onClick={() => quitar(variable.clave)}
              >
                <Trash2 className="text-destructive size-3.5" strokeWidth={1.8} />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">Todavía no agregaste ninguna variable.</p>
      )}

      <div className="bg-muted/40 border-border space-y-3 rounded-lg border p-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">Entidad</label>
            <select
              className="border-input bg-card h-11 w-full rounded-md border px-3 text-sm"
              value={entidad}
              onChange={(event) => {
                setEntidad(event.target.value as EntidadVariable)
                setCampo("")
                setOpciones([])
                if (!claveTocadaAMano) setClave("")
              }}
            >
              {Object.entries(ETIQUETAS_ENTIDAD).map(([valor, etiquetaEntidad]) => (
                <option key={valor} value={valor}>
                  {etiquetaEntidad}
                </option>
              ))}
            </select>
          </div>

          {esSeleccion ? (
            <TextField
              label="Etiqueta"
              placeholder="Ej. ¿Quién firma?"
              value={etiqueta}
              onChange={(valor) => {
                setEtiqueta(valor)
                if (!claveTocadaAMano) setClave(slugificar(valor))
              }}
            />
          ) : (
            <>
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">Campo</label>
                <select
                  className="border-input bg-card h-11 w-full rounded-md border px-3 text-sm"
                  value={campo}
                  onChange={(event) => {
                    const nuevoCampo = event.target.value
                    setCampo(nuevoCampo)
                    if (!claveTocadaAMano) setClave(nuevoCampo ? claveSugerida(entidad, nuevoCampo) : "")
                  }}
                  disabled={!catalogo}
                >
                  <option value="">Seleccione</option>
                  {camposDisponibles.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                label="Etiqueta"
                placeholder="Ej. Nombre del cliente"
                value={etiqueta}
                onChange={setEtiqueta}
              />
            </>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="Clave {{…}}"
                value={clave}
                onChange={(valor) => {
                  setClave(valor)
                  setClaveTocadaAMano(true)
                }}
              />
            </div>
            {!esSeleccion ? (
              <Button type="button" size="icon" disabled={!puedeAgregar} onClick={agregar}>
                <Plus className="size-4" strokeWidth={2} />
              </Button>
            ) : null}
          </div>
        </div>

        {esSeleccion ? (
          <div className="border-border bg-card space-y-2 rounded-md border border-dashed p-3">
            <div className="text-muted-foreground text-xs font-semibold">
              Opciones (mínimo 2) — quien genere el convenio elegirá una de estas
            </div>
            {opciones.map((opcion, indice) => (
              <div key={indice} className="flex items-center gap-2">
                <input
                  className="border-input bg-card h-9 flex-1 rounded-md border px-2.5 text-sm"
                  placeholder="Valor interno (ej. apoderado)"
                  value={opcion.valor}
                  onChange={(event) => actualizarOpcion(indice, "valor", event.target.value)}
                />
                <input
                  className="border-input bg-card h-9 flex-1 rounded-md border px-2.5 text-sm"
                  placeholder="Texto en el desplegable (ej. Por apoderado)"
                  value={opcion.etiqueta}
                  onChange={(event) => actualizarOpcion(indice, "etiqueta", event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar opción"
                  onClick={() => quitarOpcion(indice)}
                >
                  <Trash2 className="text-destructive size-3.5" strokeWidth={1.8} />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <Button type="button" variant="outline" size="sm" onClick={agregarOpcion}>
                <Plus className="size-3.5" strokeWidth={1.8} />
                Agregar opción
              </Button>
              <Button type="button" size="sm" disabled={!puedeAgregar} onClick={agregar}>
                <Plus className="size-3.5" strokeWidth={1.8} />
                Agregar variable
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
