import { cn } from "@/lib/utils"

export function PageHeader({
  eyebrow,
  title,
  actions,
  stackOnMobile,
  className,
}: {
  eyebrow?: string
  title: string
  actions?: React.ReactNode
  // Con acciones anchas (ej. pestañas) las apila debajo del titulo en mobile.
  stackOnMobile?: boolean
  className?: string
}) {
  // flex-wrap: en el teléfono, si el título y las acciones no entran en una fila, las
  // acciones bajan a la siguiente en vez de quedar encima del título.
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6 sm:py-5",
        stackOnMobile && "flex-col items-stretch sm:flex-row sm:items-center",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-muted-foreground mb-1 text-[11px] font-semibold">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-xl font-extrabold tracking-tight sm:text-[22px]">{title}</h1>
      </div>
      {actions ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap gap-2.5",
            stackOnMobile && "min-w-0 shrink flex-col sm:shrink-0 sm:flex-row"
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
}
