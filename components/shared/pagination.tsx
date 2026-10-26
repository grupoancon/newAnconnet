"use client"

import { useId, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

const ELLIPSIS = "ellipsis" as const
type PageItem = number | typeof ELLIPSIS

// Siempre devuelve la misma cantidad de items (2 * siblings + 5) cuando hay
// paginas de sobra, asi el ancho del paginador no salta al navegar.
function getPageItems(
  page: number,
  totalPages: number,
  siblings = 1
): PageItem[] {
  const totalSlots = siblings * 2 + 5
  if (totalPages <= totalSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const left = Math.max(page - siblings, 1)
  const right = Math.min(page + siblings, totalPages)
  const showLeftEllipsis = left > 3
  const showRightEllipsis = right < totalPages - 2
  const edgeCount = siblings * 2 + 3

  if (!showLeftEllipsis) {
    const start = Array.from({ length: edgeCount }, (_, i) => i + 1)
    return [...start, ELLIPSIS, totalPages]
  }
  if (!showRightEllipsis) {
    const end = Array.from(
      { length: edgeCount },
      (_, i) => totalPages - edgeCount + i + 1
    )
    return [1, ELLIPSIS, ...end]
  }
  const middle = Array.from({ length: right - left + 1 }, (_, i) => left + i)
  return [1, ELLIPSIS, ...middle, ELLIPSIS, totalPages]
}

const navButton =
  "border-border text-muted-foreground disabled:text-border hover:bg-muted flex size-8 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const jumpId = useId()
  const [jump, setJump] = useState("")
  const items = getPageItems(page, totalPages)

  function goTo(p: number) {
    const next = Math.min(Math.max(p, 1), totalPages)
    if (next !== page) onPageChange(next)
  }

  function submitJump() {
    const n = Number.parseInt(jump, 10)
    if (!Number.isNaN(n)) goTo(n)
    setJump("")
  }

  return (
    <nav
      aria-label="Paginacion"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
          className={navButton}
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="size-3.5" strokeWidth={1.8} />
        </button>
        {items.map((item, i) =>
          item === ELLIPSIS ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden
              className="text-muted-foreground flex size-8 items-center justify-center text-[12.5px] font-bold select-none"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => goTo(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`Pagina ${item}`}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[12.5px] font-bold tabular-nums transition-colors",
                item === page
                  ? "bg-brand-gradient text-white"
                  : "border-border text-muted-foreground hover:bg-muted border"
              )}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => goTo(page + 1)}
          className={navButton}
          aria-label="Pagina siguiente"
        >
          <ChevronRight className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {totalPages > 10 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitJump()
          }}
          className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex"
        >
          <label htmlFor={jumpId}>Ir a</label>
          <input
            id={jumpId}
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPages}
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onBlur={() => jump && submitJump()}
            placeholder={String(page)}
            className="border-border focus-visible:ring-ring h-8 w-14 [appearance:textfield] rounded-md border bg-transparent px-2 text-center text-[12.5px] font-bold tabular-nums outline-none focus-visible:ring-2 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span>de {totalPages}</span>
        </form>
      ) : null}
    </nav>
  )
}
