"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react"
import { useRouter } from "@/lib/navigation"
import { generarId } from "@/lib/utils"

import { useCan } from "@/components/shared/can"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  listarRepresentantesActivos,
  obtenerConvenioDeProceso,
  obtenerVariablesSeleccionDeProceso,
  type RepresentanteConvenio,
  type VariableDefinicion,
} from "@/lib/api/convenios-api"
import {
  VentasApiError,
  listarClientesExtra,
  obtenerOferta,
  obtenerProceso,
  type ClienteExtraBackend,
  type OfertaBackend,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"
import {
  aplicarFuenteBaseParaWord,
  decodificarComillasDeFuenteEnStyle,
  eliminarParrafosVaciosEnListasParaWord,
  aplicarAnchosDeColumnaParaWord,
  compactarTablasDeDocx,
  ALTO_PAGINA_DXA,
  ANCHO_PAGINA_DXA,
  limpiarHtmlDeWord,
  MARGEN_PAGINA_DXA,
  prepararListasAlfabeticasParaWord,
} from "@/lib/limpiar-html-word"

// Antes el texto legal completo (cláusulas, interpolación de titular/lote/proyecto)
// vivía hardcodeado acá mismo, duplicado como JSX + árbol docx Paragraph/TextRun. Ahora
// ese texto es una plantilla gestionada en Configuración > Convenios, asignada a un
// proyecto/lote y resuelta con datos reales de este proceso por el backend
// (GET /ventas/procesos/:id/convenio) — este componente solo la muestra y la exporta.
// El bloque de firmas SÍ sigue siendo una elección manual de este momento (no un campo
// de la plantilla, ver ConvenioForm/VariableManager): se arma acá con quien corresponda
// firmar este convenio en particular (titular, cónyuge, uno o más representantes de la
// empresa, o cualquier otro firmante libre) y se agrega después del cuerpo del convenio.

type TipoFirmante =
  "titular" | "extra" | "conyuge" | "apoderado" | "representante" | "libre"

type Firmante = {
  id: string
  tipo: TipoFirmante
  nombre: string
  cedula?: string
  // Segunda línea del bloque, debajo del nombre — para representantes es siempre el
  // nombre de la empresa (EMPRESA), nunca un texto de "en calidad de…" (se sacó por
  // pedido explícito). Para titular/cónyuge no hay segunda línea. Para "libre" es
  // opcional, lo que haya escrito el admin (ej. "Testigo").
  segundaLinea?: string
}

// Mismo nombre legal que ya usa el backend (ConveniosService, variable de sistema
// "empresa") — se repite acá porque este bloque de firmas es enteramente del lado del
// cliente, no pasa por el render de Handlebars.
const EMPRESA = "INMOCONSTRUCCIONES CIA. LTDA."

const FUENTE_DOCUMENTO = "'Times New Roman', Times, serif"

// Hoja A4 a 96 dpi (210 × 297 mm) con los mismos márgenes "Normal" (2,54 cm) y letra
// base (10 pt / título 15 pt) con los que se exporta el .docx — así la vista previa se
// ve como la hoja impresa.
const MM_A_PX = 96 / 25.4
const ALTO_HOJA_PX = 297 * MM_A_PX

// Arma el bloque de firmas como una tabla HTML (2 columnas por fila) — mismo HTML se usa
// para la vista previa en pantalla y para el .docx exportado, para que sean exactamente
// lo mismo (html-to-docx convierte tablas de forma confiable; un layout con flex/grid de
// CSS no se traduce bien a Word).
function bloqueFirmaHtml(firmantes: Firmante[]): string {
  if (firmantes.length === 0) return ""
  // Ancho fijo en px, NO porcentaje — un <td style="width:XX%"> hace que html-to-docx
  // arme un nombre de elemento XML inválido al calcular el ancho de columna en OOXML
  // ("InvalidCharacterError: Invalid XML name: @w"), aunque el HTML en sí sea válido y
  // se vea bien en pantalla. Confirmado reproduciendo el error de forma aislada contra
  // la librería. 250px x 2 columnas entra cómodo en el ancho de página de Word.
  // border:0px solid #ffffff (no "border:none"/"none" a secas) — html-to-docx SIEMPRE
  // dibuja un borde de tabla, sea cual sea el CSS que se le mande; "none"/"hidden"/
  // ancho 0 los ignora y deja el borde negro de fábrica. Confirmado probando la
  // librería de forma aislada: la única forma de que no se vea es ponerle el mismo
  // color que el fondo de la página (blanco) — sigue "existiendo" en el XML, pero
  // invisible. Por eso "las firmas salen como tabla" aunque en pantalla no se note.
  const SIN_BORDE = "border:0px solid #ffffff;"
  // La línea para firmar era un <div> vacío con solo border-top — html-to-docx no
  // dibuja bordes en NINGÚN elemento fuera de una tabla (ni <hr>, ni border en <p>/
  // <div>: confirmado, ambos se descartan en silencio, sin error). La única forma
  // confiable de que la línea aparezca tanto en pantalla como en el Word exportado es
  // como texto real (guiones bajos), no como borde.
  const LINEA_FIRMA = "_______________________________"
  const celda = (f: Firmante) =>
    `<td style="width:250px;padding:56px 16px 32px 16px;text-align:center;vertical-align:top;${SIN_BORDE}">` +
    `<div style="font-size:15px;">${LINEA_FIRMA}</div>` +
    `<div style="font-weight:bold;font-size:13px;">${f.nombre.toUpperCase()}</div>` +
    (f.cedula ? `<div style="font-size:12px;">C.I. ${f.cedula}</div>` : "") +
    (f.segundaLinea ? `<div style="font-size:12px;">${f.segundaLinea}</div>` : "") +
    `</td>`
  const filas: Firmante[][] = []
  for (let i = 0; i < firmantes.length; i += 2) filas.push(firmantes.slice(i, i + 2))
  const filasHtml = filas.map((fila) => `<tr>${fila.map(celda).join("")}</tr>`).join("")
  return `<table style="width:100%;border-collapse:collapse;margin-top:32px;${SIN_BORDE}"><tbody>${filasHtml}</tbody></table>`
}

export function ConvenioReporteContent({ id }: { id: string }) {
  const router = useRouter()
  const idNumero = Number(id)
  // Mismo criterio que licitud:imprimir (ver LicitudReporteContent): un permiso aparte
  // de "convenios:gestionar" (que es para administrar el catálogo de plantillas, no
  // para generar el convenio de un proceso real) — sin este permiso no se puede ni ver
  // ni descargar el convenio, se bloquea toda la pantalla más abajo.
  const puedeVer = useCan("convenios:imprimir")

  const [proceso, setProceso] = useState<ProcesoBackend | null>(null)
  const [oferta, setOferta] = useState<OfertaBackend | null>(null)
  const [clientesExtra, setClientesExtra] = useState<ClienteExtraBackend[]>([])
  const [html, setHtml] = useState<string | null>(null)
  const hojaRef = useRef<HTMLDivElement>(null)
  const [paginas, setPaginas] = useState(1)
  const [convenioNombre, setConvenioNombre] = useState<string | null>(null)
  const [representantes, setRepresentantes] = useState<RepresentanteConvenio[]>([])

  const [titularIncluido, setTitularIncluido] = useState(true)
  const [conyugeIncluido, setConyugeIncluido] = useState(true)
  const [apoderadoIncluido, setApoderadoIncluido] = useState(true)
  // Uno por cada cliente adicional del proceso (process_users rol="extra" — ej.
  // co-comprador) — todos incluidos por defecto, igual que titular/cónyuge.
  const [clientesExtraIncluidos, setClientesExtraIncluidos] = useState<
    Record<number, boolean>
  >({})
  const [firmantesExtra, setFirmantesExtra] = useState<Firmante[]>([])

  // El representante de la empresa siempre firma — no es opcional como titular/cónyuge,
  // solo se elige QUIÉN de la lista (ver representantes más abajo). Firmantes extra
  // (otro representante más, o alguien libre) sí son opcionales y se agregan aparte.
  const [repPrincipal, setRepPrincipal] = useState("")
  const [repExtraSeleccionado, setRepExtraSeleccionado] = useState("")
  const [libreNombre, setLibreNombre] = useState("")
  const [libreCargo, setLibreCargo] = useState("")
  const [libreCedula, setLibreCedula] = useState("")

  // Variables "selección manual" que el convenio asignado a este proceso necesita (ej.
  // "¿quién firma?") — el admin las definió en Configuración > Convenios con sus
  // opciones; acá solo se piden con un desplegable y se mandan al render, no se
  // resuelven solas como el resto de las variables (esas sí salen de BD).
  const [variablesSeleccion, setVariablesSeleccion] = useState<VariableDefinicion[]>([])
  const [selecciones, setSelecciones] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [regenerando, setRegenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)

  async function regenerarHtml(
    nuevasSelecciones: Record<string, string>,
    representante: string = repPrincipal
  ) {
    setRegenerando(true)
    try {
      const convenioData = await obtenerConvenioDeProceso(
        idNumero,
        nuevasSelecciones,
        representante
      )
      setHtml(convenioData.html)
      setConvenioNombre(convenioData.convenioNombre)
    } catch (err) {
      setError(
        err instanceof VentasApiError
          ? err.message
          : "No se pudo conectar con el servidor"
      )
    } finally {
      setRegenerando(false)
    }
  }

  function cambiarSeleccion(clave: string, valor: string) {
    const nuevasSelecciones = { ...selecciones, [clave]: valor }
    setSelecciones(nuevasSelecciones)
    regenerarHtml(nuevasSelecciones)
  }

  // El texto del convenio puede cambiar según quién firme por la empresa (variable
  // "representante_empresa"), así que al cambiar el representante principal se vuelve a
  // generar el documento.
  function cambiarRepresentante(nombre: string) {
    setRepPrincipal(nombre)
    if (html !== null) regenerarHtml(selecciones, nombre)
  }

  useEffect(() => {
    if (!idNumero || Number.isNaN(idNumero)) {
      setCargando(false)
      setError("Proceso inválido.")
      return
    }
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const [procesoData, variables, reps, ofertaData, extras] = await Promise.all([
          obtenerProceso(idNumero),
          obtenerVariablesSeleccionDeProceso(idNumero),
          listarRepresentantesActivos(),
          obtenerOferta(idNumero).catch(() => null),
          listarClientesExtra(idNumero).catch(() => []),
        ])
        if (cancelado) return
        setProceso(procesoData)
        setOferta(ofertaData)
        // Con apoderado cargado, firma él en lugar del comprador: el titular arranca
        // desmarcado (sigue la casilla por si igual tiene que firmar).
        setTitularIncluido(!ofertaData?.cli_representante?.trim())
        setClientesExtra(extras)
        setClientesExtraIncluidos(Object.fromEntries(extras.map((c) => [c.id, true])))
        setRepresentantes(reps)
        const repInicial = reps[0]?.nombre || ""
        setRepPrincipal((actual) => actual || repInicial)
        setVariablesSeleccion(variables)
        // Por defecto, la primera opción de cada variable de selección — mismo criterio
        // que usa el backend si no se manda ninguna.
        const seleccionesPorDefecto = Object.fromEntries(
          variables.map((v) => [v.clave, v.opciones?.[0]?.valor ?? ""])
        )
        setSelecciones(seleccionesPorDefecto)
        await regenerarHtml(seleccionesPorDefecto, repInicial)
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNumero])

  const codigoLote = proceso?.cli_lote ?? "—"
  const titular = proceso?.titular ?? null
  const tieneConyuge = Boolean(oferta?.cli_conyuName)
  const tieneApoderado = Boolean(oferta?.cli_representante?.trim())

  const firmantes = useMemo<Firmante[]>(() => {
    const lista: Firmante[] = []
    if (titularIncluido && titular?.nombre) {
      lista.push({
        id: "titular",
        tipo: "titular",
        nombre: titular.nombre,
        cedula: titular.identificacion ?? undefined,
      })
    }
    if (conyugeIncluido && tieneConyuge && oferta?.cli_conyuName) {
      lista.push({
        id: "conyuge",
        tipo: "conyuge",
        nombre: oferta.cli_conyuName,
        cedula: oferta.cli_conyuID ?? undefined,
      })
    }
    // Apoderado del cliente (paso "Apoderado" de la oferta, opcional) — firma en
    // representación del comprador, con la leyenda debajo del nombre.
    if (apoderadoIncluido && tieneApoderado && oferta?.cli_representante) {
      lista.push({
        id: "apoderado",
        tipo: "apoderado",
        nombre: oferta.cli_representante,
        cedula: oferta.cli_representanteID ?? undefined,
        segundaLinea: "Apoderado",
      })
    }
    // Clientes adicionales del proceso (co-compradores, process_users rol="extra") —
    // cada uno con su propio checkbox más abajo, igual que titular/cónyuge.
    for (const cliente of clientesExtra) {
      if (clientesExtraIncluidos[cliente.id] && cliente.nombre) {
        lista.push({
          id: `extra-${cliente.id}`,
          tipo: "extra",
          nombre: cliente.nombre,
          cedula: cliente.identificacion ?? undefined,
        })
      }
    }
    // El representante principal siempre firma (no tiene checkbox para sacarlo) —
    // mientras haya un nombre elegido, ya sea el que se autoseleccionó al cargar la
    // lista de representantes o el que el usuario haya cambiado a mano.
    if (repPrincipal) {
      lista.push({
        id: "rep-principal",
        tipo: "representante",
        nombre: repPrincipal,
        cedula:
          representantes.find((r) => r.nombre === repPrincipal)?.cedula ?? undefined,
        segundaLinea: EMPRESA,
      })
    }
    return [...lista, ...firmantesExtra]
  }, [
    titularIncluido,
    titular,
    conyugeIncluido,
    tieneConyuge,
    apoderadoIncluido,
    tieneApoderado,
    oferta,
    clientesExtra,
    clientesExtraIncluidos,
    repPrincipal,
    representantes,
    firmantesExtra,
  ])

  function alternarClienteExtra(idCliente: number, incluido: boolean) {
    setClientesExtraIncluidos((actual) => ({ ...actual, [idCliente]: incluido }))
  }

  function agregarRepresentanteExtra() {
    if (!repExtraSeleccionado) return
    setFirmantesExtra((actual) => [
      ...actual,
      {
        id: generarId(),
        tipo: "representante",
        nombre: repExtraSeleccionado,
        cedula:
          representantes.find((r) => r.nombre === repExtraSeleccionado)?.cedula ??
          undefined,
        segundaLinea: EMPRESA,
      },
    ])
    setRepExtraSeleccionado("")
  }

  function agregarLibre() {
    if (!libreNombre) return
    setFirmantesExtra((actual) => [
      ...actual,
      {
        id: generarId(),
        tipo: "libre",
        nombre: libreNombre,
        cedula: libreCedula || undefined,
        segundaLinea: libreCargo || undefined,
      },
    ])
    setLibreNombre("")
    setLibreCargo("")
    setLibreCedula("")
  }

  function quitarExtra(idFirmante: string) {
    setFirmantesExtra((actual) => actual.filter((f) => f.id !== idFirmante))
  }

  async function descargarWord() {
    if (!html) return
    setGenerando(true)
    try {
      // Import dinámico: html-to-docx solo se necesita al exportar, no en el render
      // inicial de la página.
      const HTMLtoDOCX = (await import("html-to-docx")).default
      // limpiarHtmlDeWord: por si el convenio se guardó con texto pegado directo de
      // Microsoft Word (el editor ya lo limpia al pegar de ahora en más, pero esto
      // cubre convenios guardados antes de ese cambio) — sin esto, html-to-docx tira
      // "Invalid XML name" con las etiquetas <w:.../<o:...> del portapapeles de Word.
      // decodificarComillasDeFuenteEnStyle: Tiptap SIEMPRE serializa un nombre de fuente
      // con espacios (ej. Times New Roman) con las comillas HTML-encodeadas (&quot;) —
      // pasa incluso si el admin nunca tocó el selector de fuente del editor. Sin esto,
      // html-to-docx recibe el nombre de fuente como basura y el documento cae a la
      // fuente por defecto de Word en cualquier texto donde se haya elegido una fuente
      // a mano (ver comentario completo en lib/limpiar-html-word.ts).
      // prepararListasAlfabeticasParaWord: agrega el CSS que html-to-docx sí respeta
      // para listas a,b,c — el atributo HTML type="a" (lo que renderiza el editor) lo
      // ignora por completo y exportaría todo como 1,2,3.
      // aplicarFuenteBaseParaWord: SIEMPRE al final — html-to-docx no hereda
      // font-family/font-size desde un <div> contenedor (confirmado probando la
      // librería de forma aislada), así que ponerla acá arriba en el <div> envolvente
      // no alcanza; hay que ponerla directo en cada párrafo/celda del documento ya
      // armado (cuerpo + firmas juntos).
      const htmlCompleto = aplicarFuenteBaseParaWord(
        aplicarAnchosDeColumnaParaWord(
          prepararListasAlfabeticasParaWord(
            eliminarParrafosVaciosEnListasParaWord(
              decodificarComillasDeFuenteEnStyle(
                limpiarHtmlDeWord(`${html}${bloqueFirmaHtml(firmantes)}`)
              )
            )
          )
        ),
        FUENTE_DOCUMENTO,
        10,
        15
      )
      // compactarTablasDeDocx: ver su comentario — html-to-docx deja filas infladas en
      // las tablas de datos y esto se corrige sobre el XML ya generado.
      const blob = await compactarTablasDeDocx(
        (await HTMLtoDOCX(htmlCompleto, null, {
          title: convenioNombre ?? "Convenio de compra",
          pageSize: { width: ANCHO_PAGINA_DXA, height: ALTO_PAGINA_DXA },
          // Márgenes "Normal" de Word: 2,54 cm (1440 twips) por los cuatro lados. El
          // default de html-to-docx es 3,17 cm a los lados, que Word muestra como
          // "Personalizados".
          margins: {
            top: MARGEN_PAGINA_DXA,
            right: MARGEN_PAGINA_DXA,
            bottom: MARGEN_PAGINA_DXA,
            left: MARGEN_PAGINA_DXA,
            header: 720,
            footer: 720,
            gutter: 0,
          },
        })) as Blob
      )
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement("a")
      enlace.href = url
      enlace.download = `convenio-${codigoLote}.docx`
      enlace.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerando(false)
    }
  }

  // Cuántas hojas A4 ocupa el contenido — la hoja crece de a páginas completas y se
  // marca dónde caería cada salto (aproximado: Word puede cortar unas líneas antes o
  // después según cómo parta los párrafos).
  useEffect(() => {
    const hoja = hojaRef.current
    if (!hoja) return
    const contenido = hoja.firstElementChild as HTMLElement | null
    if (!contenido) return
    const medir = () => {
      const alto = contenido.offsetHeight + 2 * 25.4 * MM_A_PX
      setPaginas(Math.max(1, Math.ceil(alto / ALTO_HOJA_PX)))
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(contenido)
    return () => observador.disconnect()
  }, [html])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        {!puedeVer ? (
          <EmptyState
            title="No tienes permiso para esta sección"
            description="No tenés el permiso necesario para ver ni descargar el convenio."
            dashed
          />
        ) : cargando ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error && !html ? (
          <EmptyState title="No se pudo cargar el convenio" description={error} />
        ) : (
          <>
            <div className="mb-4.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight sm:text-[22px]">
                  Convenio del lote{" "}
                  <span className="bg-accent text-accent-foreground rounded-md px-2.5 py-1 font-mono text-base">
                    {codigoLote}
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[13px]">
                  {convenioNombre}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2.5">
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                  <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                  Volver
                </Button>
                <Button
                  size="sm"
                  disabled={firmantes.length === 0 || generando || regenerando || !html}
                  className="bg-status-disponible text-white shadow-none hover:brightness-95"
                  onClick={descargarWord}
                >
                  <FileText className="size-3.5" strokeWidth={1.8} />
                  {generando ? "Generando..." : "Word"}
                </Button>
              </div>
            </div>

            {variablesSeleccion.length > 0 ? (
              <div className="bg-card border-border mb-4.5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border p-4">
                <span className="text-muted-foreground text-[11px] font-bold tracking-wide">
                  CONFIGURACIÓN
                </span>
                {variablesSeleccion.map((variable) => (
                  <div key={variable.clave} className="w-full sm:w-auto sm:min-w-56">
                    <SelectField
                      label={variable.etiqueta}
                      placeholder="Seleccione"
                      opciones={(variable.opciones ?? []).map((o) => ({
                        value: o.valor,
                        label: o.etiqueta,
                      }))}
                      value={selecciones[variable.clave] ?? ""}
                      onValueChange={(valor) => cambiarSeleccion(variable.clave, valor)}
                      className="h-9! w-full!"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="bg-card border-border mb-4.5 rounded-lg border p-4">
              <span className="text-muted-foreground mb-3 block text-[11px] font-bold tracking-wide">
                FIRMANTES
              </span>

              <div className="mb-3.5 flex flex-wrap gap-x-6 gap-y-2">
                {titular?.nombre ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={titularIncluido}
                      onCheckedChange={(v) => setTitularIncluido(Boolean(v))}
                    />
                    Comprador: <span className="font-semibold">{titular.nombre}</span>
                  </label>
                ) : null}
                {tieneConyuge && oferta?.cli_conyuName ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={conyugeIncluido}
                      onCheckedChange={(v) => setConyugeIncluido(Boolean(v))}
                    />
                    Cónyuge: <span className="font-semibold">{oferta.cli_conyuName}</span>
                  </label>
                ) : null}
                {tieneApoderado && oferta?.cli_representante ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={apoderadoIncluido}
                      onCheckedChange={(v) => setApoderadoIncluido(Boolean(v))}
                    />
                    Apoderado:{" "}
                    <span className="font-semibold">{oferta.cli_representante}</span>
                  </label>
                ) : null}
                {clientesExtra.map((cliente) =>
                  cliente.nombre ? (
                    <label key={cliente.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={clientesExtraIncluidos[cliente.id] ?? true}
                        onCheckedChange={(v) =>
                          alternarClienteExtra(cliente.id, Boolean(v))
                        }
                      />
                      Co-comprador:{" "}
                      <span className="font-semibold">{cliente.nombre}</span>
                    </label>
                  ) : null
                )}
              </div>

              <div className="mb-3 grid grid-cols-1 items-end gap-2.5 sm:grid-cols-2">
                <SelectField
                  label="Representante de la empresa (obligatorio)"
                  placeholder="Seleccione"
                  options={representantes.map((r) => r.nombre)}
                  value={repPrincipal}
                  onValueChange={cambiarRepresentante}
                  className="h-9! w-full!"
                />
                <div className="flex items-end gap-2.5">
                  <div className="flex-1">
                    <SelectField
                      label="Agregar otro representante (opcional)"
                      placeholder="Seleccione"
                      options={representantes.map((r) => r.nombre)}
                      value={repExtraSeleccionado}
                      onValueChange={setRepExtraSeleccionado}
                      className="h-9! w-full!"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!repExtraSeleccionado}
                    onClick={agregarRepresentanteExtra}
                  >
                    <Plus className="size-3.5" strokeWidth={1.8} />
                    Agregar
                  </Button>
                </div>
              </div>

              <div className="bg-muted/40 border-border mb-3 grid grid-cols-1 items-end gap-2.5 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <TextField
                  label="Firmante libre — nombre"
                  value={libreNombre}
                  onChange={setLibreNombre}
                />
                <TextField
                  label="Cargo (opcional)"
                  value={libreCargo}
                  onChange={setLibreCargo}
                />
                <TextField
                  label="Cédula (opcional)"
                  value={libreCedula}
                  onChange={setLibreCedula}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!libreNombre}
                  onClick={agregarLibre}
                >
                  <Plus className="size-3.5" strokeWidth={1.8} />
                  Agregar
                </Button>
              </div>

              {firmantesExtra.length > 0 ? (
                <div className="border-border divide-border divide-y rounded-md border">
                  {firmantesExtra.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="text-sm">
                        <span className="font-semibold">{f.nombre}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          —{" "}
                          {f.tipo === "representante"
                            ? "Representante adicional"
                            : f.segundaLinea || "Firmante libre"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar a ${f.nombre}`}
                        onClick={() => quitarExtra(f.id)}
                      >
                        <Trash2 className="text-destructive size-3.5" strokeWidth={1.8} />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Hoja A4 sobre un "escritorio" gris, como la vista de impresión. En
                mobile conserva su ancho real y se desliza en horizontal, en vez de
                reflujar y romper las firmas. */}
            <div className="bg-muted/70 border-border overflow-x-auto rounded-lg border px-4 py-8 sm:px-8">
              <div
                ref={hojaRef}
                className="relative mx-auto bg-white text-[10pt] leading-[1.6] text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)]"
                style={{
                  fontFamily: FUENTE_DOCUMENTO,
                  width: "210mm",
                  minHeight: `${paginas * ALTO_HOJA_PX}px`,
                  padding: "25.4mm",
                }}
              >
                <div>
                  {html ? (
                    <div
                      className="convenio-preview max-w-none [&_h1]:mb-4 [&_h1]:text-[15pt] [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-bold [&_li]:pl-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-10 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-10"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ) : null}
                  {firmantes.length > 0 ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: bloqueFirmaHtml(firmantes) }}
                    />
                  ) : (
                    <p className="mt-6 text-neutral-500">
                      Agrega al menos un firmante arriba para ver el bloque de firmas.
                    </p>
                  )}
                </div>

                {/* Dónde caería cada salto de hoja. */}
                {Array.from({ length: paginas - 1 }, (_, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 flex items-center"
                    style={{ top: `${(i + 1) * ALTO_HOJA_PX}px` }}
                  >
                    <div className="w-full border-t border-dashed border-neutral-300" />
                    <span className="absolute right-3 -translate-y-1/2 bg-white px-1.5 font-sans text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                      Página {i + 2}
                    </span>
                  </div>
                ))}

                {regenerando ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                    <Spinner />
                  </div>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-3 text-center text-[11px]">
                A4 · márgenes 2,54 cm · {paginas} {paginas === 1 ? "hoja" : "hojas"}{" "}
                (aprox.)
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
