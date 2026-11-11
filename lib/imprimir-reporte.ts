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
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function generarPdf({ selector, horizontal }: OpcionesImprimir): Promise<Blob> {
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
  const margen = 8
  const anchoUtil = anchoPagina - margen * 2
  const altoUtil = altoPagina - margen * 2

  const hojas = Array.from(contenedor.querySelectorAll<HTMLElement>(".hoja"))
  const bloques = hojas.length > 0 ? hojas : [contenedor]
  let primeraPagina = true

  for (const bloque of bloques) {
    const lienzo = await html2canvas(bloque, {
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
      // Contenedores con scroll (ej. el reporte de ventas): se captura todo su
      // contenido, no solo la parte visible.
      height: bloque.scrollHeight,
      windowHeight: Math.max(bloque.scrollHeight, window.innerHeight),
      onclone: (_doc, copia) => {
        copia.style.overflow = "visible"
        copia.style.height = "auto"
        copia.style.maxHeight = "none"
      },
    })
    // Alto de una página A4 expresado en píxeles del lienzo.
    const pxPorMm = lienzo.width / anchoUtil
    const altoPaginaPx = Math.floor(altoUtil * pxPorMm)

    for (let y = 0; y < lienzo.height; y += altoPaginaPx) {
      const alto = Math.min(altoPaginaPx, lienzo.height - y)
      const trozo = document.createElement("canvas")
      trozo.width = lienzo.width
      trozo.height = alto
      const ctx = trozo.getContext("2d")
      if (!ctx) continue
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, trozo.width, trozo.height)
      ctx.drawImage(lienzo, 0, y, lienzo.width, alto, 0, 0, lienzo.width, alto)

      if (!primeraPagina) pdf.addPage()
      primeraPagina = false
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
