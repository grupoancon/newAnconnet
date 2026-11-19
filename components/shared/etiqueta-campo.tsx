// Etiqueta de un campo de formulario: si termina en "*" (campo obligatorio), el
// asterisco se pinta en rojo. Cualquier otro contenido se muestra tal cual.
export function EtiquetaCampo({ children }: { children: React.ReactNode }) {
  if (typeof children !== "string") return <>{children}</>
  const coincidencia = /^(.*?)\s*\*$/.exec(children)
  if (!coincidencia) return <>{children}</>
  return (
    <>
      {coincidencia[1]}{" "}
      <span className="text-destructive" aria-hidden>
        *
      </span>
      <span className="sr-only">(obligatorio)</span>
    </>
  )
}
