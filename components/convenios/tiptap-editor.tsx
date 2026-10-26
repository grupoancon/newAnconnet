"use client"

import { useEffect, useState } from "react"
import { Color } from "@tiptap/extension-color"
import FontFamily from "@tiptap/extension-font-family"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  GitBranch,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Plus,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Variable,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { VariableDefinicion } from "@/lib/api/convenios-api"
import { limpiarHtmlDeWord } from "@/lib/limpiar-html-word"
import { cn } from "@/lib/utils"

import { FontSize } from "./font-size-extension"

const FUENTES = [
  { label: "Por defecto", value: "" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Sans", value: "Arial, sans-serif" },
  { label: "Monospace", value: "'Courier New', monospace" },
]

// En pt, no px — así coincide 1:1 con lo que espera Word (ver
// lib/limpiar-html-word.ts) y con cómo se habla de tamaño de letra en un documento
// legal ("letra 12"), en vez de un valor de pantalla como 16px.
const TAMAÑOS_FUENTE = ["8", "9", "10", "10.5", "11", "12", "13", "14", "16", "18", "20", "24"]

const COLORES = ["#0f172a", "#dc2626", "#2563eb", "#16a34a", "#a16207"]

function BotonToolbar({
  activo,
  disabled,
  onClick,
  label,
  children,
}: {
  activo?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "hover:bg-accent flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40",
        activo && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  )
}

// Acciones sobre la tabla donde está el cursor (agregar/quitar columnas y filas, combinar
// celdas, borrar la tabla). "Insertar tabla" arma 3x3 y de ahí se ajusta con estas acciones.
const ACCIONES_TABLA: {
  valor: string
  etiqueta: string
  ejecutar: (editor: Editor) => void
}[] = [
  { valor: "col-antes", etiqueta: "+ Columna izquierda", ejecutar: (e) => e.chain().focus().addColumnBefore().run() },
  { valor: "col-despues", etiqueta: "+ Columna derecha", ejecutar: (e) => e.chain().focus().addColumnAfter().run() },
  { valor: "col-borrar", etiqueta: "Quitar columna", ejecutar: (e) => e.chain().focus().deleteColumn().run() },
  { valor: "fila-antes", etiqueta: "+ Fila arriba", ejecutar: (e) => e.chain().focus().addRowBefore().run() },
  { valor: "fila-despues", etiqueta: "+ Fila abajo", ejecutar: (e) => e.chain().focus().addRowAfter().run() },
  { valor: "fila-borrar", etiqueta: "Quitar fila", ejecutar: (e) => e.chain().focus().deleteRow().run() },
  { valor: "combinar", etiqueta: "Combinar / dividir celdas", ejecutar: (e) => e.chain().focus().mergeOrSplit().run() },
  { valor: "encabezado", etiqueta: "Encabezado", ejecutar: (e) => e.chain().focus().toggleHeaderRow().run() },
  { valor: "tabla-borrar", etiqueta: "Quitar tabla", ejecutar: (e) => e.chain().focus().deleteTable().run() },
]

// Botones (no un <select>): un desplegable nativo le quita el foco al editor al abrirse y
// el cursor/selección dentro de la tabla se perdía antes de poder elegir una opción.
// Con onMouseDown preventDefault el clic no mueve el foco, así la acción se aplica sobre
// la celda donde estaba el cursor. Solo se muestra con el cursor dentro de una tabla.
function AccionesTabla({ editor }: { editor: Editor }) {
  if (!editor.isActive("table")) return null
  return (
    <div className="border-border flex w-full flex-wrap items-center gap-1 border-t pt-2">
      <span className="text-muted-foreground mr-1 text-[11px] font-semibold">Tabla:</span>
      {ACCIONES_TABLA.map((accion) => (
        <button
          key={accion.valor}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => accion.ejecutar(editor)}
          className={cn(
            "border-input bg-card hover:bg-accent h-7 rounded-md border px-2 text-[11px] font-medium transition-colors",
            accion.valor === "tabla-borrar" && "text-destructive"
          )}
        >
          {accion.etiqueta}
        </button>
      ))}
    </div>
  )
}

function Toolbar({ editor, variables }: { editor: Editor; variables: VariableDefinicion[] }) {
  return (
    <div className="border-border bg-muted/40 flex flex-wrap items-center gap-1 border-b p-2">
      <BotonToolbar
        label="Negrita"
        activo={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Itálica"
        activo={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Subrayado"
        activo={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-3.5" strokeWidth={2} />
      </BotonToolbar>

      <span className="bg-border mx-1 h-5 w-px" />

      <select
        aria-label="Encabezado"
        className="border-input bg-card h-8 rounded-md border px-1.5 text-xs"
        value={
          editor.isActive("heading", { level: 1 })
            ? "h1"
            : editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
                ? "h3"
                : "p"
        }
        onChange={(event) => {
          const valor = event.target.value
          if (valor === "p") editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: Number(valor.slice(1)) as 1 | 2 | 3 }).run()
        }}
      >
        <option value="p">Párrafo</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
      </select>

      <select
        aria-label="Fuente"
        className="border-input bg-card h-8 rounded-md border px-1.5 text-xs"
        onChange={(event) => {
          const valor = event.target.value
          if (valor) editor.chain().focus().setFontFamily(valor).run()
          else editor.chain().focus().unsetFontFamily().run()
        }}
      >
        {FUENTES.map((fuente) => (
          <option key={fuente.value} value={fuente.value}>
            {fuente.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Tamaño de letra"
        className="border-input bg-card h-8 rounded-md border px-1.5 text-xs"
        value={editor.getAttributes("textStyle").fontSize?.replace("pt", "") ?? ""}
        onChange={(event) => {
          const valor = event.target.value
          if (valor) editor.chain().focus().setFontSize(`${valor}pt`).run()
          else editor.chain().focus().unsetFontSize().run()
        }}
      >
        <option value="">Tamaño</option>
        {TAMAÑOS_FUENTE.map((tamaño) => (
          <option key={tamaño} value={tamaño}>
            {tamaño}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-0.5">
        {COLORES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Color ${color}`}
            className="size-5 rounded-full border"
            style={{ backgroundColor: color }}
            onClick={() => editor.chain().focus().setColor(color).run()}
          />
        ))}
      </div>

      <span className="bg-border mx-1 h-5 w-px" />

      <BotonToolbar
        label="Alinear a la izquierda"
        activo={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Centrar"
        activo={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Alinear a la derecha"
        activo={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Justificar"
        activo={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify className="size-3.5" strokeWidth={2} />
      </BotonToolbar>

      <span className="bg-border mx-1 h-5 w-px" />

      <BotonToolbar
        label="Lista con viñetas"
        activo={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Lista numerada (1, 2, 3)"
        activo={editor.isActive("orderedList") && editor.getAttributes("orderedList").type !== "a"}
        onClick={() => {
          // "type" es un atributo nativo de <ol> (OrderedList ya lo trae de fábrica en
          // Tiptap) — reusar el mismo toggle de lista para números y letras, solo
          // cambiando `type`, en vez de dos nodos de lista distintos.
          const yaEsNumerada = editor.isActive("orderedList") && editor.getAttributes("orderedList").type !== "a"
          if (yaEsNumerada) {
            editor.chain().focus().toggleOrderedList().run()
            return
          }
          if (!editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run()
          editor.chain().focus().updateAttributes("orderedList", { type: null }).run()
        }}
      >
        <ListOrdered className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Lista alfabética (a, b, c)"
        activo={editor.isActive("orderedList", { type: "a" })}
        onClick={() => {
          const yaEsAlfabetica = editor.isActive("orderedList", { type: "a" })
          if (yaEsAlfabetica) {
            editor.chain().focus().toggleOrderedList().run()
            return
          }
          if (!editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run()
          editor.chain().focus().updateAttributes("orderedList", { type: "a" }).run()
        }}
      >
        <span className="text-[11px] font-bold">abc</span>
      </BotonToolbar>
      <BotonToolbar
        label="Insertar tabla de datos (Lote / Superficie / Observación)"
        onClick={() => {
          // Tabla de datos del lote (LOTE / SUPERFICIE / OBSERVACION): 2 columnas, sin
          // encabezado, etiquetas ya escritas en la primera y la segunda vacía para poner
          // las variables o el texto. Medidas tomadas de la tabla real en Word (Disposición
          // de tabla): columna larga 11,25 cm = 425 px y corta 3,72 cm = 141 px (96 dpi,
          // 1 cm = 37,8 px). Para otras filas/columnas usa los botones de "Tabla:" que
          // aparecen con el cursor dentro.
          const fila = (etiqueta: string) =>
            `<tr><td colwidth="141"><p>${etiqueta}</p></td><td colwidth="425"><p></p></td></tr>`
          editor
            .chain()
            .focus()
            .insertContent(
              `<table><tbody>${fila("LOTE:")}${fila("SUPERFICIE:")}${fila("OBSERVACION:")}</tbody></table><p></p>`
            )
            .run()
        }}
      >
        <TableIcon className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      <BotonToolbar
        label="Insertar enlace"
        activo={editor.isActive("link")}
        onClick={() => {
          const url = window.prompt("URL del enlace")
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
      >
        <LinkIcon className="size-3.5" strokeWidth={2} />
      </BotonToolbar>

      <span className="bg-border mx-1 h-5 w-px" />

      <div className="relative">
        <select
          aria-label="Insertar variable"
          disabled={variables.length === 0}
          className="border-input bg-card h-8 rounded-md border py-0 pr-1.5 pl-6 text-xs disabled:opacity-50"
          value=""
          onChange={(event) => {
            const clave = event.target.value
            if (clave) editor.chain().focus().insertContent(`{{${clave}}}`).run()
          }}
        >
          <option value="" disabled>
            {variables.length === 0 ? "Sin variables" : "Insertar variable…"}
          </option>
          {variables.map((variable) => (
            <option key={variable.clave} value={variable.clave}>
              {variable.etiqueta}
            </option>
          ))}
        </select>
        <Variable className="text-muted-foreground pointer-events-none absolute top-1/2 left-1.5 size-3.5 -translate-y-1/2" strokeWidth={2} />
      </div>

      <InsertarCondicion editor={editor} variables={variables} />

      <AccionesTabla editor={editor} />
    </div>
  )
}

// Estilo "código" para las líneas {{#if}}/{{else}}/{{/if}} insertadas — para que se
// distingan del resto del texto y quien edita no las borre por accidente. Son texto
// plano igual que las variables, no un nodo Tiptap especial.
const ESTILO_MARCADOR = "font-family:ui-monospace,monospace;color:#94a3b8;font-size:12px"

// Arma el esqueleto {{#if}}/{{else if}}/…/{{else}}/{{/if}} eligiendo la variable de un
// desplegable, para que nadie tenga que escribir la sintaxis de Handlebars a mano.
// Soporta 2 variantes (sí/no, como antes) o más — ej. "EL FUTURO ADQUIRIENTE" (soltero)
// / "LOS FUTUROS ADQUIRIENTES" (casado) / una tercera variante (unión libre), las 3
// comparando la misma variable (ej. titular → estado_civil) contra valores distintos.
// Funciona con CUALQUIER variable, no solo "Selección manual": si es de "Selección
// manual" cada valor se elige de sus opciones (desplegable); si es una variable atada a
// BD (ej. titular → sexo/estado_civil) no hay una lista fija de valores posibles, así
// que se escribe a mano (ej. "MASCULINO", "SOLTERO/A"). El control SIEMPRE se muestra,
// deshabilitado con una pista si todavía no hay ninguna variable creada, para que se
// pueda descubrir (antes desaparecía del todo).
function InsertarCondicion({ editor, variables }: { editor: Editor; variables: VariableDefinicion[] }) {
  const [abierto, setAbierto] = useState(false)
  const [clave, setClave] = useState("")
  // Un valor por variante EXPLÍCITA — siempre hay una rama final {{else}} implícita
  // ("cualquier otro caso") que no necesita valor, así que 1 variante acá ya arma un
  // if/else normal de 2 ramas; 2+ arma if/else if/…/else.
  const [valores, setValores] = useState<string[]>([""])
  const sinVariables = variables.length === 0

  const variableElegida = variables.find((v) => v.clave === clave)
  const esSeleccion = variableElegida?.entidad === "seleccion"
  const opciones = variableElegida?.opciones ?? []

  function limpiar() {
    setAbierto(false)
    setClave("")
    setValores([""])
  }

  function actualizarValor(indice: number, valor: string) {
    setValores((actual) => actual.map((v, i) => (i === indice ? valor : v)))
  }

  function insertar() {
    const valoresValidos = valores.filter((v) => v)
    if (!clave || valoresValidos.length === 0) return
    const bloques = valoresValidos
      .map((valor, indice) => {
        const apertura = indice === 0 ? "#if" : "else if"
        return (
          `<p style="${ESTILO_MARCADOR}">{{${apertura} (eq ${clave} "${valor}")}}</p>` +
          `<p>[Texto variante ${indice + 1}]</p>`
        )
      })
      .join("")
    editor
      .chain()
      .focus()
      .insertContent(
        bloques +
          `<p style="${ESTILO_MARCADOR}">{{else}}</p>` +
          `<p>[Texto en cualquier otro caso]</p>` +
          `<p style="${ESTILO_MARCADOR}">{{/if}}</p>`
      )
      .run()
    limpiar()
  }

  // Un botón deshabilitado con pointer-events-none (ver BotonToolbar) no dispara hover
  // en la mayoría de los navegadores, así que un `title` ahí no se vería nunca — por
  // eso, sin ninguna variable creada, se muestra un texto explicativo en su lugar en vez
  // de controles deshabilitados silenciosos.
  if (sinVariables) {
    return (
      <>
        <span className="bg-border mx-1 h-5 w-px" />
        <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <GitBranch className="size-3.5 shrink-0" strokeWidth={1.8} />
          Para insertar una condición, agrega arriba al menos una variable.
        </span>
      </>
    )
  }

  return (
    <>
      <span className="bg-border mx-1 h-5 w-px" />
      <BotonToolbar label="Insertar condición" activo={abierto} onClick={() => setAbierto((v) => !v)}>
        <GitBranch className="size-3.5" strokeWidth={2} />
      </BotonToolbar>
      {abierto ? (
        <div className="border-border bg-muted/40 mt-2 w-full space-y-2.5 rounded-md border p-3">
          <select
            aria-label="Variable de condición"
            className="border-input bg-card h-8 w-full rounded-md border px-1.5 text-xs sm:w-64"
            value={clave}
            onChange={(event) => {
              setClave(event.target.value)
              setValores([""])
            }}
          >
            <option value="" disabled>
              Condición sobre…
            </option>
            {variables.map((variable) => (
              <option key={variable.clave} value={variable.clave}>
                {variable.etiqueta}
              </option>
            ))}
          </select>

          {valores.map((valor, indice) => (
            <div key={indice} className="flex items-center gap-2">
              <span className="text-muted-foreground w-20 shrink-0 text-[11px] font-semibold">
                Variante {indice + 1}
              </span>
              {esSeleccion ? (
                <select
                  aria-label={`Valor de la variante ${indice + 1}`}
                  className="border-input bg-card h-8 flex-1 rounded-md border px-1.5 text-xs"
                  value={valor}
                  onChange={(event) => actualizarValor(indice, event.target.value)}
                  disabled={!clave}
                >
                  <option value="" disabled>
                    es…
                  </option>
                  {opciones.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={`Valor de la variante ${indice + 1}`}
                  placeholder='es… (ej. SOLTERO/A)'
                  className="border-input bg-card h-8 flex-1 rounded-md border px-1.5 text-xs"
                  value={valor}
                  onChange={(event) => actualizarValor(indice, event.target.value)}
                  disabled={!clave}
                />
              )}
              {valores.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar variante ${indice + 1}`}
                  onClick={() => setValores((actual) => actual.filter((_, i) => i !== indice))}
                >
                  <Trash2 className="text-destructive size-3.5" strokeWidth={1.8} />
                </Button>
              ) : null}
            </div>
          ))}
          <span className="text-muted-foreground block text-[11px]">
            + una variante final &ldquo;en cualquier otro caso&rdquo;, siempre incluida.
          </span>

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!clave}
              onClick={() => setValores((actual) => [...actual, ""])}
            >
              <Plus className="size-3.5" strokeWidth={1.8} />
              Agregar variante
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!clave || valores.every((v) => !v)}
                onClick={insertar}
              >
                Insertar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

// Componente controlado: `value`/`onChange` son el HTML del documento (editor.getHTML()).
// Las variables se insertan como texto plano {{clave}} — no como nodo Tiptap custom — para
// coincidir 1:1 con lo que Handlebars espera del lado del backend (anconAPI), sin ningún
// paso de serialización intermedio.
export function TiptapEditor({
  value,
  onChange,
  variables,
  disabled,
}: {
  value: string
  onChange: (html: string) => void
  variables: VariableDefinicion[]
  disabled?: boolean
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Escribe el texto del convenio…" }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      // Limpia la basura de Microsoft Word (comentarios MSO, <style> con @page/
      // @font-face, tags <w:.../<o:.../<v:...>) del HTML del portapapeles ANTES de que
      // ProseMirror lo parsee — evita que quede guardada en `contenido` y rompa la
      // exportación a Word más adelante (ver limpiarHtmlDeWord).
      transformPastedHTML: (html) => limpiarHtmlDeWord(html),
      handleDOMEvents: {
        // Clic sobre la barra de scroll horizontal de una tabla: el target es el
        // contenedor `.tableWrapper`, no una celda. Sin esto, el plugin de redimensionado
        // de columnas (resizable:true) trata ese mousedown como "arrastrar el borde de la
        // columna" si antes el mouse pasó cerca del borde derecho de la tabla — y al
        // arrastrar la barra hacia la derecha en realidad ensancha la última columna: la
        // tabla crece, la barra "se regresa" a la izquierda y nunca llega al final.
        // Devolver true corta el handler del plugin; el scroll nativo no se afecta.
        mousedown: (_view, event) => {
          const objetivo = event.target
          return (
            objetivo instanceof HTMLElement && objetivo.classList.contains("tableWrapper")
          )
        },
      },
      attributes: {
        // "tiptap-convenio" habilita las reglas de arrastre de columna en
        // app/globals.css (el handle, el cursor col-resize, table-layout:fixed) — sin
        // esas reglas el arrastre de @tiptap/extension-table (resizable:true) queda
        // técnicamente activo pero invisible/imposible de agarrar con el mouse.
        class:
          "tiptap-convenio min-h-[420px] px-5 py-4 text-sm outline-none " +
          "[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold " +
          "[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold " +
          "[&_h3]:mt-2 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-bold " +
          "[&_p]:mb-2.5 [&_p]:leading-relaxed " +
          "[&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-10 [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-10 [&_li]:pl-1 " +
          "[&_a]:text-primary [&_a]:underline " +
          "[&_table]:table-fixed",
      },
    },
  })

  // Resincroniza el contenido externo (ej. al cambiar de convenio en la página de
  // edición) sin pisar la posición del cursor mientras el usuario escribe.
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  if (!editor) return null

  return (
    <div className="border-input bg-card overflow-hidden rounded-lg border">
      <Toolbar editor={editor} variables={variables} />
      <EditorContent editor={editor} />
    </div>
  )
}
