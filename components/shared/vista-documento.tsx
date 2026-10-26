import { FileText } from "lucide-react"

// Extraido de app/(dashboard)/ventas/procesos/documentos/documentos-content.tsx para
// reusarlo tambien en la pantalla de revision de documentos — mismo comportamiento,
// sin cambios: preview de imagen inline, o un boton "Ver documento" para PDF/otros.
function esImagen(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(url)
}

export function VistaDocumento({ url, etiqueta }: { url: string | null; etiqueta: string }) {
  if (!url) {
    return (
      <div className="bg-muted text-muted-foreground/60 flex aspect-4/3 items-center justify-center rounded-md">
        <FileText className="size-7" strokeWidth={1.4} />
      </div>
    )
  }
  if (esImagen(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="bg-muted block aspect-4/3 overflow-hidden rounded-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- preview de un archivo en S3, no una imagen del sitio que Next deba optimizar */}
        <img src={url} alt={etiqueta} className="size-full object-cover" />
      </a>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="bg-muted text-muted-foreground hover:bg-accent flex aspect-4/3 flex-col items-center justify-center gap-1.5 rounded-md transition-colors"
    >
      <FileText className="size-7" strokeWidth={1.4} />
      <span className="text-xs font-semibold">Ver documento</span>
    </a>
  )
}
