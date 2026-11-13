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

import { FirmaClienteError, firmarPdfEnServidor } from "@/lib/firma-cliente"

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
  // con sus propios márgenes (ej. el convenio), así las páginas coinciden con la vista.
  margen?: number
  // Firma electrónica (PAdES) del PDF generado en el teléfono. Solo oferta,
  // financiamiento, refinanciamiento y convenio la usan — ver lib/firma y app/api/firma.
  firma?: { razon: string }
}

export async function imprimirReporte(opciones: OpcionesImprimir): Promise<void> {
  if (!esDispositivoMovil()) {
    window.print()
    return
  }
  const generado = await generarPdf(opciones)
  let blob = generado.blob
  if (opciones.firma) {
    // Sin firma habilitada o sin permiso sale sin firmar, igual que antes.
    blob = (
      await firmarPdfEnServidor(blob, {
        razon: opciones.firma.razon,
        ...opcionesSello(generado.sello),
      })
    ).blob
  }
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

// "PDF firmado" (computadora o teléfono): arma el PDF del reporte tal como se ve, lo firma
// en el servidor con el certificado de la empresa y lo descarga. Si la firma no está
// activada o el usuario no tiene permiso NO descarga nada y lanza el motivo: el botón
// promete un PDF firmado.
export async function descargarPdfFirmado(
  opciones: OpcionesImprimir & { firma: { razon: string } }
): Promise<void> {
  const { blob: original, sello } = await generarPdf(opciones)
  const resultado = await firmarPdfEnServidor(original, {
    razon: opciones.firma.razon,
    ...opcionesSello(sello),
  })
  if (!resultado.firmado) {
    throw new FirmaClienteError(
      resultado.motivo ?? "SIN_FIRMA",
      resultado.motivo === "SIN_PERMISO"
        ? "No tienes permiso para firmar documentos."
        : "La firma electrónica no está activada (Configuración → Firma electrónica)."
    )
  }
  const nombre = opciones.nombreArchivo.endsWith(".pdf")
    ? opciones.nombreArchivo
    : `${opciones.nombreArchivo}.pdf`
  descargarBlob(resultado.blob, nombre)
}

// Rectángulo del sello de firma electrónica en el PDF, en puntos (1/72"), con el
// origen abajo a la izquierda de la página — lo que espera /api/firma.
export type PosicionSello = {
  pagina: number
  x: number
  y: number
  ancho: number
  alto: number
}

const MM_A_PT = 72 / 25.4
const COLOR_TESTIGO = "#ff00ff"
const CLASE_SELLO = "sello-firma-electronica"

function opcionesSello(sello: PosicionSello | null) {
  return sello ? { visible: true, ...sello } : {}
}

async function generarPdf({
  selector,
  horizontal,
  margen = 8,
}: OpcionesImprimir): Promise<{ blob: Blob; sello: PosicionSello | null }> {
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
  let sello: PosicionSello | null = null

  for (const bloque of bloques) {
    // html2canvas dibuja una COPIA del documento. Para que esa copia use exactamente la
    // misma fuente que la vista previa (si no, el texto cambia de largo, el final del
    // documento queda afuera y el sello cae en otro lugar), se anota la fuente ya
    // calculada de cada elemento y se fija en la copia.
    const fuentes = new Map<string, [string, string, string, string]>()
    const vivos = [bloque, ...Array.from(bloque.querySelectorAll<HTMLElement>("*"))]
    vivos.forEach((el, i) => {
      const cs = getComputedStyle(el)
      fuentes.set(String(i), [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.fontStyle])
      el.dataset.pdfFuente = String(i)
    })

    // Recuadro "Firma electrónica" (components/shared/sello-firma.tsx), medido sobre la
    // copia que realmente se dibuja, relativo al bloque.
    let marcaCss: {
      x: number
      y: number
      w: number
      h: number
      anchoBloque: number
    } | null = null

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
        // pantalla — antes se cortaba el final (ej. las firmas del convenio).
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
          // El recuadro se pinta de un color testigo (magenta puro, sin texto ni borde)
          // para ubicarlo después en la imagen capturada; luego se tapa con blanco y ahí
          // va el sello real con QR. Se mide también por las dudas (respaldo).
          const rCopia = copia.getBoundingClientRect()
          copia.querySelectorAll<HTMLElement>(`.${CLASE_SELLO}`).forEach((el, i) => {
            if (i > 0) {
              el.style.visibility = "hidden"
              return
            }
            const r = el.getBoundingClientRect()
            if (r.width > 0) {
              marcaCss = {
                x: r.left - rCopia.left,
                y: r.top - rCopia.top,
                w: r.width,
                h: r.height,
                anchoBloque: rCopia.width,
              }
            }
            el.innerHTML = ""
            el.style.setProperty("background", COLOR_TESTIGO, "important")
            el.style.setProperty("border", "none", "important")
            el.style.setProperty("border-radius", "0", "important")
            el.style.setProperty("box-shadow", "none", "important")
            el.style.setProperty("opacity", "1", "important")
          })
        },
      })
    } finally {
      vivos.forEach((el) => delete el.dataset.pdfFuente)
    }
    // Alto de una página A4 expresado en píxeles del lienzo.
    const pxPorMm = lienzo.width / anchoUtil
    const altoPaginaPx = Math.floor(altoUtil * pxPorMm)

    // Recuadro en píxeles del lienzo.
    const m = marcaCss as {
      x: number
      y: number
      w: number
      h: number
      anchoBloque: number
    } | null
    const k = m && m.anchoBloque > 0 ? lienzo.width / m.anchoBloque : 1
    // Lo que manda es dónde quedó el color testigo en la imagen; la medida es respaldo.
    const marcaPx =
      (m ? ubicarYBorrarTestigo(lienzo) : null) ??
      (m ? { x: m.x * k, y: m.y * k, w: m.w * k, h: m.h * k } : null)

    for (let y = 0; y < lienzo.height;) {
      let alto = altoDeCorte(lienzo, y, altoPaginaPx)
      // Nunca partir el sello entre dos páginas: si el corte cae encima, se corta antes.
      if (
        marcaPx &&
        marcaPx.y > y &&
        marcaPx.y < y + alto &&
        marcaPx.y + marcaPx.h > y + alto
      ) {
        alto = Math.floor(marcaPx.y) - y
      }
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

      if (!sello && marcaPx && marcaPx.y >= inicio && marcaPx.y < inicio + alto) {
        const anchoMm = marcaPx.w / pxPorMm
        const altoMm = marcaPx.h / pxPorMm
        const xMm = margen + marcaPx.x / pxPorMm
        const arribaMm = margen + (marcaPx.y - inicio) / pxPorMm
        sello = {
          pagina: paginas,
          x: redondear(xMm * MM_A_PT),
          y: redondear((altoPagina - arribaMm - altoMm) * MM_A_PT),
          ancho: redondear(anchoMm * MM_A_PT),
          alto: redondear(altoMm * MM_A_PT),
        }
      }
    }
  }
  return { blob: pdf.output("blob"), sello }
}

const redondear = (n: number) => Math.round(n * 100) / 100

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

// Busca en el lienzo el rectángulo pintado con COLOR_TESTIGO (el recuadro de la firma),
// lo tapa con blanco y devuelve su posición en píxeles del lienzo.
function ubicarYBorrarTestigo(
  lienzo: HTMLCanvasElement
): { x: number; y: number; w: number; h: number } | null {
  const ctx = lienzo.getContext("2d")
  if (!ctx) return null
  const franja = 256
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -1
  let y1 = -1
  for (let desde = 0; desde < lienzo.height; desde += franja) {
    const alto = Math.min(franja, lienzo.height - desde)
    const { data, width } = ctx.getImageData(0, desde, lienzo.width, alto)
    for (let fila = 0; fila < alto; fila++) {
      for (let x = 0; x < width; x++) {
        const i = (fila * width + x) * 4
        if (data[i]! >= 245 && data[i + 1]! <= 12 && data[i + 2]! >= 245) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          const y = desde + fila
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    // Ya se encontró y se pasó del recuadro: no hace falta seguir leyendo.
    if (y1 >= 0 && desde > y1 + franja) break
  }
  if (x1 < 0) return null
  // Se tapa con un margen de 2 px para cubrir los bordes suavizados (rosados).
  // html2canvas deja el contexto con su escala (ej. ×2) aplicada: se trabaja en píxeles
  // reales del lienzo, igual que getImageData.
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 5, y1 - y0 + 5)
  ctx.restore()
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
