// Imprimir un reporte desde el teléfono.
//
// En el teléfono (sobre todo con la app instalada en el inicio) window.print() no hace
// nada y tampoco hay barra del navegador para "Compartir / Guardar PDF". Ahí el reporte
// se convierte a PDF en el propio teléfono (la hoja tal como se ve en pantalla → imagen
// → páginas A4 con jsPDF) y se abre el menú de compartir del sistema, desde donde se
// puede imprimir, guardar en Archivos o mandar por WhatsApp. Si el teléfono no puede
// compartir archivos, el PDF se descarga.
//
// En la computadora sigue usando window.print() (impresión directa), con los estilos
// @media print de cada reporte.
//
// html2canvas-pro y jspdf se importan dentro de la función para que no entren al bundle
// inicial: solo se descargan cuando alguien imprime desde el teléfono.

// Teléfono o tablet: pantalla táctil sin mouse/trackpad, o un navegador móvil. Una
// computadora — aunque tenga la app instalada o pantalla táctil — sigue imprimiendo
// directo con window.print(), como siempre.
export function esDispositivoMovil(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true
  // iPadOS se presenta como "Macintosh", pero con pantalla táctil.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true
  const soloTactil =
    window.matchMedia?.("(pointer: coarse)").matches &&
    !window.matchMedia?.("(any-pointer: fine)").matches
  return Boolean(soloTactil)
}

export type OpcionesImprimir = {
  // Contenedor del reporte (lo que se imprime). Si tiene hijos `.hoja`, cada uno va en
  // su propia página; si no, el contenedor se corta en páginas A4.
  selector: string
  nombreArchivo: string
  horizontal?: boolean
  // Margen de la hoja en mm (8 por defecto). 0 cuando el contenedor ya es una hoja A4
  // con sus propios márgenes (ej. la oferta con membrete), así las páginas coinciden
  // con la vista.
  margen?: number
}

export async function imprimirReporte(opciones: OpcionesImprimir): Promise<void> {
  if (!esDispositivoMovil()) {
    window.print()
    return
  }
  const blob = await generarPdf(opciones)
  const nombre = opciones.nombreArchivo.endsWith(".pdf")
    ? opciones.nombreArchivo
    : `${opciones.nombreArchivo}.pdf`
  const archivo = new File([blob], nombre, { type: "application/pdf" })

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre })
      return
    } catch (err) {
      // El usuario cerró el menú de compartir: no es un error.
      if (err instanceof DOMException && err.name === "AbortError") return
    }
  }
  descargarBlob(blob, nombre)
}

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function generarPdf({
  selector,
  horizontal,
  margen = 8,
}: OpcionesImprimir): Promise<Blob> {
  const contenedor = document.querySelector<HTMLElement>(selector)
  if (!contenedor) throw new Error(`No se encontró el reporte (${selector}).`)

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ])

  const pdf = new jsPDF({
    orientation: horizontal ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  })
  const anchoPagina = pdf.internal.pageSize.getWidth()
  const altoPagina = pdf.internal.pageSize.getHeight()
  const anchoUtil = anchoPagina - margen * 2
  const altoUtil = altoPagina - margen * 2

  const hojas = Array.from(contenedor.querySelectorAll<HTMLElement>(".hoja"))
  const bloques = hojas.length > 0 ? hojas : [contenedor]
  let paginas = 0

  for (const bloque of bloques) {
    // html2canvas dibuja una COPIA del documento. Para que esa copia use exactamente la
    // misma fuente que la vista previa (si no, el texto cambia de largo y el final del
    // documento queda afuera), se anota la fuente ya calculada de cada elemento y se
    // fija en la copia.
    const fuentes = new Map<string, [string, string, string, string]>()
    const vivos = [bloque, ...Array.from(bloque.querySelectorAll<HTMLElement>("*"))]
    vivos.forEach((el, i) => {
      const cs = getComputedStyle(el)
      fuentes.set(String(i), [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.fontStyle])
      el.dataset.pdfFuente = String(i)
    })

    let lienzo: HTMLCanvasElement
    try {
      lienzo = await html2canvas(bloque, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        // Botones, selectores de firmantes, avisos de pantalla, etc. La marca de agua
        // diagonal BORRADOR tampoco va en el PDF del teléfono (tapa la tabla): queda solo
        // el aviso rojo de arriba de la hoja.
        ignoreElements: (el) =>
          (el.classList?.contains("no-print") ||
            el.classList?.contains("borrador-watermark")) ??
          false,
        windowWidth: Math.max(bloque.scrollWidth, 820),
        // Sin `height` fijo: el alto sale de la copia (con overflow visible, ver
        // onclone), así se captura TODO el contenido aunque en la copia ocupe más que en
        // pantalla.
        windowHeight: Math.max(bloque.scrollHeight, window.innerHeight),
        onclone: (doc, copia) => {
          // Los reportes pueden dar estilos propios al PDF con `.modo-pdf` (ej. el
          // fondo membretado de la oferta, que en pantalla está oculto).
          doc.documentElement.classList.add("modo-pdf")
          copia.style.overflow = "visible"
          copia.style.height = "auto"
          copia.style.maxHeight = "none"
          const copias = [copia, ...Array.from(copia.querySelectorAll<HTMLElement>("*"))]
          for (const el of copias) {
            const f = el.dataset?.pdfFuente
              ? fuentes.get(el.dataset.pdfFuente)
              : undefined
            if (!f) continue
            el.style.fontFamily = f[0]
            el.style.fontSize = f[1]
            el.style.fontWeight = f[2]
            el.style.fontStyle = f[3]
          }
        },
      })
    } finally {
      vivos.forEach((el) => delete el.dataset.pdfFuente)
    }
    // Alto de una página A4 expresado en píxeles del lienzo.
    const pxPorMm = lienzo.width / anchoUtil
    const altoPaginaPx = Math.floor(altoUtil * pxPorMm)

    for (let y = 0; y < lienzo.height;) {
      const alto = altoDeCorte(lienzo, y, altoPaginaPx)
      const inicio = y
      y += alto

      const trozo = document.createElement("canvas")
      trozo.width = lienzo.width
      trozo.height = alto
      const ctx = trozo.getContext("2d")
      if (!ctx) continue
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, trozo.width, trozo.height)
      ctx.drawImage(lienzo, 0, inicio, lienzo.width, alto, 0, 0, lienzo.width, alto)

      if (paginas > 0) pdf.addPage()
      paginas++
      pdf.addImage(
        trozo.toDataURL("image/jpeg", 0.92),
        "JPEG",
        margen,
        margen,
        anchoUtil,
        alto / pxPorMm
      )
    }
  }
  return pdf.output("blob")
}

// Alto del trozo que va en la página que empieza en `y`. Si no es la última, en vez de
// cortar justo en el borde (y partir un renglón por la mitad) se sube hasta encontrar
// una franja totalmente blanca dentro del último 20 % de la página.
function altoDeCorte(lienzo: HTMLCanvasElement, y: number, altoPaginaPx: number): number {
  const resto = lienzo.height - y
  // Unos píxeles de tolerancia por redondeo: una hoja A4 exacta (ej. la oferta con
  // membrete) no debe dejar una tira de 1 px en una página aparte.
  if (resto <= altoPaginaPx + 4) return resto
  const busqueda = Math.floor(altoPaginaPx * 0.2)
  const desde = y + altoPaginaPx - busqueda
  const ctx = lienzo.getContext("2d")
  if (!ctx) return altoPaginaPx
  const { data, width } = ctx.getImageData(0, desde, lienzo.width, busqueda)
  for (let fila = busqueda - 1; fila >= 0; fila--) {
    let blanca = true
    for (let x = 0; x < width && blanca; x += 2) {
      const i = (fila * width + x) * 4
      if (data[i]! < 245 || data[i + 1]! < 245 || data[i + 2]! < 245) blanca = false
    }
    if (blanca) return desde + fila + 1 - y
  }
  return altoPaginaPx
}
