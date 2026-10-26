import { cn } from "@/lib/utils"

// Piezas para reconstruir el "Formulario Único de Origen Lícito de Recursos" (UAFE, D.E. 298)
// tal cual el PDF de referencia. Cada fila (Row) es su propia cuadricula con anchos
// proporcionales medidos del PDF (fr, no una grilla fija de 12 columnas) — asi cada campo
// conserva el ancho que tiene en el original. Los bordes se colapsan a mano: la tabla
// (FormTable) pone border-t/l y cada celda border-r/b.

const CELDA =
  "border-r border-b border-black bg-white px-1 py-[2.5px] text-black break-words"

export function FormTable({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("border-t border-l border-black", className)}>{children}</div>
}

// Bloque de una seccion: barra magenta redondeada + tabla pegada debajo. break-inside-avoid
// evita que una seccion se parta entre dos hojas al imprimir.
export function FormSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("mb-2.5 break-inside-avoid", className)}>
      <h2 className="rounded-[3px] bg-[#d6336c] px-2 py-[6.5px] text-left text-[10px] leading-[12px] font-extrabold tracking-[0.02em] text-white uppercase print:text-[10px]!">
        {title}
      </h2>
      <FormTable>{children}</FormTable>
    </section>
  )
}

// "cols" son las proporciones (fr) de cada celda de la fila; minmax(0, …) evita que un
// texto largo estire su columna y descuadre el resto de la fila.
export function Row({
  cols,
  children,
  className,
}: {
  cols: number[]
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("grid", className)}
      style={{
        gridTemplateColumns: cols.map((fr) => `minmax(0, ${fr}fr)`).join(" "),
      }}
    >
      {children}
    </div>
  )
}

// Celda libre (contenido rico, filas de una sola celda, etc.).
export function Cell({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return <div className={cn(CELDA, "text-[8.5px] leading-[10px]", className)}>{children}</div>
}

export function Label({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        CELDA,
        "flex items-center text-[7px] leading-[9px] font-bold print:text-[7px]!",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Value({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        CELDA,
        "flex items-center text-[8.5px] leading-[10px] uppercase print:text-[8.5px]!",
        className
      )}
    >
      {children}
    </div>
  )
}

// Franja de una sola celda con texto de instruccion (avisos debajo de un titulo).
export function Nota({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Row cols={[1]}>
      <Cell className={cn("py-[3px] text-[7px] leading-[9px]", className)}>{children}</Cell>
    </Row>
  )
}

export function CheckBox({ checked = false }: { checked?: boolean }) {
  return (
    <span className="inline-flex size-[11px] shrink-0 items-center justify-center rounded-[2px] border border-black bg-white text-[9px] leading-none font-bold text-green-600">
      {checked ? "✓" : ""}
    </span>
  )
}

export function YesNo({ value }: { value: "si" | "no" | null }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-[7px] leading-[9px] font-bold">
      SI: <CheckBox checked={value === "si"} />
      <span className="ml-1">NO:</span> <CheckBox checked={value === "no"} />
    </span>
  )
}

// Pregunta SI/NO de una sola fila: texto a la izquierda, casillas a la derecha.
export function YesNoRow({
  children,
  value,
}: {
  children: React.ReactNode
  value: "si" | "no" | null
}) {
  return (
    <Row cols={[1]}>
      <Cell className="flex items-center justify-between gap-3 py-[5px]">
        <span className="text-[7px] leading-[9px] font-bold">{children}</span>
        <YesNo value={value} />
      </Cell>
    </Row>
  )
}

// Celda de firma: etiqueta en cursiva arriba, linea de firma, y nombre/detalle debajo.
export function SignatureCell({
  label,
  name,
  detail,
}: {
  label: string
  name?: string
  detail?: string
}) {
  return (
    <Cell className="flex flex-col items-center px-3 pt-3 pb-3 text-center">
      <span className="text-[7px] leading-[9px] text-neutral-500 italic">{label}</span>
      <span className="mt-[38px] block h-[2.5px] w-3/4 bg-slate-600" />
      <span className="mt-2 text-[8px] leading-[10px] uppercase">{name}</span>
      {detail ? (
        <span className="mt-2.5 text-[8px] leading-[10px] uppercase">{detail}</span>
      ) : null}
    </Cell>
  )
}
