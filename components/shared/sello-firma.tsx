// Recuadro "Firma electrónica" de la vista previa: marca dónde va a aparecer el sello
// (QR + firmante + fecha) en el PDF firmado. lib/imprimir-reporte.ts lo mide al generar
// el PDF, lo oculta y le pasa esa posición al servidor, que dibuja la firma visible
// exactamente ahí. No sale al imprimir en papel (ver .sello-firma-electronica en
// app/globals.css).

const ICONO =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h7v-4"/></svg>'

const TEXTO =
  "<span><b>Firma electrónica</b><small>Aquí va el sello con QR</small></span>"

export const CLASE_SELLO_FIRMA = "sello-firma-electronica"

// Versión HTML (para bloques que se arman como string, ej. el convenio).
export function htmlSelloFirma(estilo: string): string {
  return `<div class="${CLASE_SELLO_FIRMA}" aria-hidden="true" style="${estilo}">${ICONO}${TEXTO}</div>`
}

export function SelloFirma({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      aria-hidden
      className={`${CLASE_SELLO_FIRMA} ${className ?? ""}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONO + TEXTO }}
    />
  )
}
