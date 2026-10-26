// Pegar texto copiado de Microsoft Word (muy esperable en un editor de convenios
// legales) trae en el HTML del portapapeles comentarios condicionales de MSO, bloques
// <style> con reglas @page/@font-face propias de Word, y tags con namespace propio
// (<w:sdt>, <o:p>, <v:shape>, etc.) — el navegador los deja pasar tal cual dentro de un
// contentEditable. ProseMirror (Tiptap) descarta la mayoría por no estar en su schema,
// pero algunos fragmentos (texto dentro de esos tags, o el propio tag mal cerrado)
// pueden colarse igual. html-to-docx los interpreta como nombres de elemento/atributo
// XML inválidos y tira "InvalidCharacterError: Invalid XML name" al exportar. Se usa
// tanto al pegar en el editor (para no guardar la basura en `contenido` desde el
// principio) como antes de exportar a Word (para limpiar convenios que ya se guardaron
// con esto adentro, sin que el admin tenga que volver a pegar el texto).
export function limpiarHtmlDeWord(html: string): string {
  return html
    .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(?:o|v|w|m):[a-zA-Z0-9]+(?:\s[^>]*)?>/gi, "")
    .replace(/\s(?:xmlns|xml):[a-zA-Z0-9]+="[^"]*"/gi, "")
    .replace(/mso-[a-zA-Z-]+\s*:[^;"]*;?/gi, "")
    .replace(/\sclass="Mso[a-zA-Z]*"/gi, "")
}

// Un nombre de fuente con espacios (ej. "Times New Roman") SIEMPRE sale con comillas
// dobles HTML-encodeadas (&quot;) en el HTML que produce Tiptap — no importa si el
// admin nunca tocó el selector de fuente del editor (ver FUENTES en tiptap-editor.tsx)
// o si el valor que se le pasa a setFontFamily ya viene sin comillas: confirmado
// corriendo un editor Tiptap real (headless, con jsdom) y mirando el HTML que devuelve
// editor.getHTML() — ProseMirror renormaliza el nombre de fuente internamente antes de
// serializar, sea cual sea el string original. html-to-docx NO decodifica esas
// entidades: el nombre de fuente le queda como basura literal ("&quot;Times New
// Roman&quot;"), así que el documento exportado caía a la fuente por defecto de Word en
// vez de Times New Roman — sin ningún error visible, por eso costó tanto encontrarlo.
// La solución es decodificar &quot; de vuelta a comilla simple, pero SOLO dentro de
// atributos style="..." (nunca en el texto visible del documento, donde un &quot; puede
// ser una comilla real que el admin escribió a propósito).
export function decodificarComillasDeFuenteEnStyle(html: string): string {
  return html.replace(/style="([^"]*)"/g, (_match, contenido: string) => {
    return `style="${contenido.replace(/&quot;/g, "'")}"`
  })
}

// El editor Tiptap arma una lista alfabética como <ol type="a">, que los navegadores
// (y por lo tanto la vista previa en pantalla) renderizan bien de fábrica — pero
// html-to-docx ignora por completo el atributo HTML `type`: exporta TODAS las listas
// ordenadas como números (1, 2, 3), venga o no con type="a". Sí respeta la propiedad
// CSS `list-style-type` en el propio <ol> (confirmado probando la librería de forma
// aislada), así que antes de exportar hay que agregarla a mano a cada <ol type="a">.
// Solo corre en el navegador (usa el DOM) — descargarWord ya solo se llama ahí.
// IMPORTANTE: acá y en aplicarFuenteBaseParaWord se escribe el atributo `style` como
// string CRUDO (getAttribute/setAttribute), nunca con `elemento.style.propiedad = ...`
// — ese setter pasa por el CSSOM del navegador, que tiene el mismo problema de
// renormalizar comillas descrito arriba.
function tieneDeclaracion(elemento: HTMLElement, propiedad: string): boolean {
  return new RegExp(`(^|;)\\s*${propiedad}\\s*:`, "i").test(elemento.getAttribute("style") ?? "")
}

function agregarDeclaracion(elemento: HTMLElement, declaracion: string): void {
  const actual = elemento.getAttribute("style") ?? ""
  elemento.setAttribute("style", actual ? `${actual};${declaracion}` : declaracion)
}

// Cuando un ítem de lista lleva {{#if}}/{{else}}/{{/if}} cada marcador vive en su propio
// <p> (Tiptap pone el texto de una línea suelta en un párrafo): al renderizar la rama
// elegida, los marcadores quedan como <p></p> vacíos dentro del <li>. html-to-docx toma
// el PRIMER párrafo del <li> como el texto del ítem — si es uno vacío, el ítem sale en
// blanco ("b." sin texto) y el contenido real se pierde. Se quitan los párrafos vacíos
// (sin texto ni imágenes) dentro de cada <li>; si todos estuvieran vacíos se deja uno.
export function eliminarParrafosVaciosEnListasParaWord(html: string): string {
  const contenedor = document.createElement("div")
  contenedor.innerHTML = html
  contenedor.querySelectorAll("li").forEach((item) => {
    const parrafos = Array.from(item.children).filter((hijo) => hijo.tagName === "P")
    const estaVacio = (p: Element) => !p.textContent?.trim() && !p.querySelector("img")
    const conTexto = parrafos.filter((p) => !estaVacio(p))
    if (conTexto.length === 0) return
    parrafos.filter(estaVacio).forEach((p) => p.remove())
  })
  return contenedor.innerHTML
}

export function prepararListasAlfabeticasParaWord(html: string): string {
  const contenedor = document.createElement("div")
  contenedor.innerHTML = html
  contenedor.querySelectorAll('ol[type="a"]').forEach((ol) => {
    agregarDeclaracion(ol as HTMLElement, "list-style-type:lower-alpha")
  })
  return contenedor.innerHTML
}

// Tiptap guarda el ancho de cada columna en el atributo `colwidth` (px) de la celda, que
// html-to-docx ignora — sin esto, toda tabla sale con columnas iguales en Word, sin
// importar cómo se hayan arrastrado en el editor. html-to-docx sí lee `width` en px
// puesto en el style de la celda (en % revienta con "Invalid XML name: @w", ver el
// comentario de bloqueFirmaHtml en convenio-reporte-content.tsx).
export function aplicarAnchosDeColumnaParaWord(html: string): string {
  const contenedor = document.createElement("div")
  contenedor.innerHTML = html
  contenedor.querySelectorAll("td[colwidth], th[colwidth]").forEach((celda) => {
    const ancho = Number.parseInt((celda.getAttribute("colwidth") ?? "").split(",")[0] ?? "", 10)
    const elemento = celda as HTMLElement
    if (Number.isFinite(ancho) && ancho > 0 && !tieneDeclaracion(elemento, "width")) {
      agregarDeclaracion(elemento, `width:${ancho}px`)
    }
    celda.removeAttribute("colwidth")
  })
  return contenedor.innerHTML
}

// Hoja A4 (21 x 29,7 cm) con márgenes "Normal" de Word (2,54 cm). El ancho útil para
// texto es lo que tiene que ocupar una tabla para que su borde derecho coincida con el
// borde derecho de los párrafos.
export const MARGEN_PAGINA_DXA = 1440
export const ANCHO_PAGINA_DXA = 11906
export const ALTO_PAGINA_DXA = 16838
const ANCHO_TEXTO_DXA = ANCHO_PAGINA_DXA - 2 * MARGEN_PAGINA_DXA

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

// "Tabla normal" de Word (sin estilo de tabla): html-to-docx no declara ningún estilo de
// tabla en styles.xml, así que Word improvisa uno. Se declara el estándar de Word.
const ESTILO_TABLA_NORMAL =
  '<w:style w:type="table" w:default="1" w:styleId="TableNormal">' +
  '<w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/>' +
  '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar>' +
  '<w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
  '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/>' +
  "</w:tblCellMar></w:tblPr></w:style>"

// 0,28 cm = 159 twips (1 cm = 566,93 twips): alto mínimo de fila, igual que la tabla de
// referencia en Word — el alto real lo da el texto.
const ALTO_FILA = '<w:trHeight w:val="159" w:hRule="atLeast"/>'

const BORDE_TABLA = (lado: string) =>
  `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`

// Propiedades de tabla "sin formato": alineada a la izquierda (no centrada), sin
// espaciado entre celdas, bordes negros finos puestos directo (no por estilo) y
// márgenes de celda como los de una tabla hecha a mano en Word.
const TBLPR_SIN_FORMATO =
  "<w:tblPr>" +
  '<w:tblW w:w="0" w:type="auto"/>' +
  // Sangría = margen izquierdo de la celda (108 dxa): sin esto Word saca el borde de la
  // tabla hacia el margen para alinear el TEXTO de la celda con el del párrafo, y el
  // borde queda montado afuera del bloque de texto. Con la sangría, el borde coincide
  // con el borde izquierdo de los párrafos.
  '<w:tblInd w:w="108" w:type="dxa"/>' +
  "<w:tblBorders>" +
  ["top", "left", "bottom", "right", "insideH", "insideV"].map(BORDE_TABLA).join("") +
  "</w:tblBorders>" +
  '<w:tblLayout w:type="autofit"/>' +
  '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
  '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>' +
  "</w:tblPr>"

// html-to-docx NO respeta los márgenes de un <p> (ni margin:0): cada párrafo hereda el
// espaciado de docDefaults (6 pt después), y a cada tabla le pone un estilo propio
// (centrada, con espaciado entre celdas y bordes doble capa) distinto al de una tabla
// común de Word. Solo se puede corregir en el XML ya generado. Dentro de las tablas con
// borde visible: tabla "sin formato" (ver TBLPR_SIN_FORMATO), bordes solo a nivel de
// tabla, columnas con el ancho de la primera fila y párrafos sin espaciado. Las tablas
// sin borde visible (el bloque de firmas: borde blanco) se dejan intactas, porque ahí el
// espaciado entre líneas es parte del diseño.
// Bloque de firmas (la tabla de borde blanco): html-to-docx ignora el padding-top de
// la celda, así que en el Word la línea para firmar quedaba casi pegada al texto de
// arriba, sin lugar para la firma. Se agrega un párrafo vacío de alto fijo al inicio de
// cada celda — solo en el .docx; la vista previa ya tiene ese espacio por CSS.
const ESPACIO_FIRMA_DXA = 1300 // ≈ 2,3 cm
function agregarEspacioParaFirmar(tabla: string): string {
  const espacio =
    "<w:p><w:pPr>" +
    `<w:spacing w:before="0" w:after="0" w:line="${ESPACIO_FIRMA_DXA}" w:lineRule="exact"/>` +
    "</w:pPr></w:p>"
  return tabla.replace(/(<w:tc>(?:\s*<w:tcPr>[\s\S]*?<\/w:tcPr>)?)/g, `$1${espacio}`)
}

export async function compactarTablasDeDocx(blob: Blob): Promise<Blob> {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(blob)
  const archivo = zip.file("word/document.xml")
  if (!archivo) return blob

  const xml = await archivo.async("string")
  const compactado = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tabla) => {
    if (/w:color="ffffff"/i.test(tabla)) return agregarEspacioParaFirmar(tabla)

    // La última celda de cada fila se ajusta para que la tabla ocupe exactamente el
    // ancho del texto (borde derecho alineado con el de los párrafos); las demás
    // columnas conservan el ancho que se les dio. Si la suma ya se pasa del ancho de
    // texto, la última se reduce para que no se salga de la hoja.
    const ajustarFila = (fila: string) => {
      const anchosFila = (fila.match(/<w:tcW w:w="\d+"/g) ?? []).map((m) =>
        Number(m.replace(/\D/g, ""))
      )
      if (anchosFila.length === 0) return fila
      const suma = anchosFila.reduce((a, b) => a + b, 0)
      const ultimo = anchosFila[anchosFila.length - 1] ?? 0
      const nuevoUltimo = Math.max(720, ultimo + (ANCHO_TEXTO_DXA - suma))
      const indiceUltimo = anchosFila.length - 1
      let i = -1
      return fila.replace(/<w:tcW w:w="\d+"/g, (coincidencia) => {
        i += 1
        return i === indiceUltimo ? `<w:tcW w:w="${nuevoUltimo}"` : coincidencia
      })
    }
    tabla = tabla.replace(/<w:tr>[\s\S]*?<\/w:tr>/g, ajustarFila)

    // Ancho de cada columna = el de las celdas de la primera fila (tcW en dxa).
    const primeraFila = tabla.match(/<w:tr>[\s\S]*?<\/w:tr>/)?.[0] ?? ""
    const anchos = (primeraFila.match(/<w:tcW w:w="\d+"/g) ?? []).map((m) => m.replace(/\D/g, ""))
    const cuadricula = anchos.length
      ? `<w:tblGrid>${anchos.map((a) => `<w:gridCol w:w="${a}"/>`).join("")}</w:tblGrid>`
      : null

    let resultado = tabla
      .replace(/<w:tblPr>[\s\S]*?<\/w:tblPr>/, TBLPR_SIN_FORMATO)
      .replace(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/g, "")
      // Alto de fila "al menos 0,28 cm" (160 dxa ~ 0,28 cm), como en Disposición de tabla.
      .replace(/<w:trPr\s*\/>/g, `<w:trPr>${ALTO_FILA}</w:trPr>`)
      .replace(/<w:spacing(?![^>]*w:after=)([^>]*)\/>/g, '<w:spacing w:after="0"$1/>')
    if (cuadricula) {
      resultado = resultado.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/, cuadricula)
    }
    return resultado
  })
  if (compactado === xml) return blob

  zip.file("word/document.xml", compactado)

  const estilos = zip.file("word/styles.xml")
  if (estilos) {
    const xmlEstilos = await estilos.async("string")
    if (!xmlEstilos.includes('w:styleId="TableNormal"')) {
      zip.file(
        "word/styles.xml",
        xmlEstilos.replace("</w:styles>", `${ESTILO_TABLA_NORMAL}</w:styles>`)
      )
    }
  }

  return zip.generateAsync({ type: "blob", mimeType: MIME_DOCX })
}

// El navegador (y por lo tanto la vista previa en pantalla) sí hereda font-family/
// font-size de un contenedor ancestro — por eso <div style="font-family:...;"> alrededor
// de todo el convenio se veía bien en pantalla. html-to-docx NO hereda nada: solo lee el
// style puesto directo en CADA párrafo/celda/etc. Confirmado probando la librería de
// forma aislada (un <p> sin su propio font-family exporta con la fuente por defecto de
// Word, sin importar lo que tenga un <div> que lo envuelve). Por eso el Word exportado
// salía con otra fuente/tamaño aunque la vista previa se viera bien. Esto agrega la
// fuente/tamaño a cada elemento de texto que todavía no tenga uno propio (nunca pisa un
// font-family/font-size que el admin ya haya elegido a mano para un fragmento puntual,
// ej. con el selector de fuente del editor o el tamaño ya fijado en el bloque de
// firmas). Solo corre en el navegador (usa el DOM) — descargarWord ya solo se llama ahí.
export function aplicarFuenteBaseParaWord(
  html: string,
  fontFamily: string,
  tamañoBasePt: number,
  tamañoTituloPt: number
): string {
  const contenedor = document.createElement("div")
  contenedor.innerHTML = html

  contenedor.querySelectorAll("p, h1, h2, h3, li, td, th, div, span").forEach((el) => {
    const elemento = el as HTMLElement
    if (!tieneDeclaracion(elemento, "font-family")) agregarDeclaracion(elemento, `font-family:${fontFamily}`)
  })

  contenedor.querySelectorAll("p, li, td, th, div").forEach((el) => {
    const elemento = el as HTMLElement
    if (!tieneDeclaracion(elemento, "font-size")) agregarDeclaracion(elemento, `font-size:${tamañoBasePt}pt`)
  })
  contenedor.querySelectorAll("h1, h2, h3").forEach((el) => {
    const elemento = el as HTMLElement
    if (!tieneDeclaracion(elemento, "font-size")) agregarDeclaracion(elemento, `font-size:${tamañoTituloPt}pt`)
  })

  return contenedor.innerHTML
}
