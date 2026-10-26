// Convierte la primera página de un PDF (ej. un plano exportado de AutoCAD) a una
// imagen PNG, para poder subirla igual que cualquier otra imagen de plano — el backend
// (subirPlanoProyecto) no sabe procesar PDFs, solo guarda lo que le llega en S3.
//
// pdfjs-dist se importa acá adentro (no a nivel de módulo) porque toca APIs de
// navegador (Worker, canvas) que no existen en el server — un import estático rompería
// el SSR de la página que use este helper, aunque el componente sea "use client".
export async function pdfPrimeraPaginaAImagen(archivo: File): Promise<Blob> {
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

  const datos = await archivo.arrayBuffer()
  const documento = await pdfjsLib.getDocument({ data: datos }).promise
  const pagina = await documento.getPage(1)

  // Escala 2x: un plano suele tener texto/números de lote chicos, a escala 1 quedan
  // ilegibles al hacer zoom sobre la imagen ya subida.
  const viewport = pagina.getViewport({ scale: 2 })
  const canvas = document.createElement("canvas")
  canvas.width = viewport.width
  canvas.height = viewport.height
  const contexto = canvas.getContext("2d")
  if (!contexto) {
    throw new Error("El navegador no pudo preparar el lienzo para convertir el PDF")
  }

  await pagina.render({ canvasContext: contexto, viewport }).promise

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("No se pudo generar la imagen del plano a partir del PDF"))
    }, "image/png")
  })
}
