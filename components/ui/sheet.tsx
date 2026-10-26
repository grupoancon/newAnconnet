"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

// forwardRef explicito en Overlay/Content: el proyecto usa React 18 (Next.js 14) y
// Radix (Presence/Portal) necesita adjuntar su ref al elemento real renderizado.
const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentProps<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    ref={ref}
    data-slot="sheet-overlay"
    className={cn(
      "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs",
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = "SheetOverlay"

// Select/DropdownMenu/Tooltip abren su contenido en un portal fuera del DOM del
// sheet (appendeado a document.body) — Radix no los registra como "branch" del
// Dialog, asi que un click ahi dispara el dismiss del Dialog como si fuera "afuera"
// (bug conocido de Radix al anidar Select dentro de Dialog).
const SELECTOR_POPOVER_PORTAL =
  '[data-slot="select-content"], [data-slot="dropdown-menu-content"], [data-slot="tooltip-content"]'

// Segundo sintoma del mismo problema, mas sutil: mientras el Select esta abierto,
// su propia capa desactiva pointer-events en todo lo que quede "debajo" en el
// stack de capas de Radix — incluido el resto del sheet, aunque sea el padre. Un
// click que visualmente cae DENTRO del sheet (otro campo, el header, etc.) no le
// llega a ese campo: atraviesa hacia el overlay de atras, y ese click en el
// overlay se interpreta como "afuera" y cierra el sheet. No se puede detectar
// esto por contencion en el DOM (technicamente el click SI fue "afuera" del
// contenido interactivo) asi que se compara por coordenadas contra el rectangulo
// visual del sheet.
function clicCayoDentroDelRectangulo(
  nodo: HTMLElement | null,
  originalEvent: PointerEvent | FocusEvent
): boolean {
  if (!nodo || !("clientX" in originalEvent)) return false
  const rect = nodo.getBoundingClientRect()
  return (
    originalEvent.clientX >= rect.left &&
    originalEvent.clientX <= rect.right &&
    originalEvent.clientY >= rect.top &&
    originalEvent.clientY <= rect.bottom
  )
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentProps<typeof SheetPrimitive.Content> & {
    side?: "top" | "right" | "bottom" | "left"
    showCloseButton?: boolean
  }
>(
  (
    {
      className,
      children,
      side = "right",
      showCloseButton = true,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    forwardedRef
  ) => {
    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node
        if (typeof forwardedRef === "function") forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef]
    )

    function debeIgnorarDismiss(event: {
      target: EventTarget | null
      detail: { originalEvent: PointerEvent | FocusEvent }
    }) {
      const target = event.target as HTMLElement | null
      return Boolean(
        target?.closest?.(SELECTOR_POPOVER_PORTAL) ||
        clicCayoDentroDelRectangulo(contentRef.current, event.detail.originalEvent)
      )
    }

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content
          ref={setRefs}
          data-slot="sheet-content"
          data-side={side}
          onPointerDownOutside={(event) => {
            if (debeIgnorarDismiss(event)) {
              event.preventDefault()
              return
            }
            onPointerDownOutside?.(event)
          }}
          onInteractOutside={(event) => {
            if (debeIgnorarDismiss(event)) {
              event.preventDefault()
              return
            }
            onInteractOutside?.(event)
          }}
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10 fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:top-[env(safe-area-inset-top)] data-[side=left]:bottom-[env(safe-area-inset-bottom)] data-[side=left]:left-0 data-[side=left]:h-auto data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:top-[env(safe-area-inset-top)] data-[side=right]:right-0 data-[side=right]:bottom-[env(safe-area-inset-bottom)] data-[side=right]:h-auto data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close data-slot="sheet-close" asChild>
              <Button variant="ghost" className="absolute top-3 right-3" size="icon-sm">
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Content>
      </SheetPortal>
    )
  }
)
SheetContent.displayName = "SheetContent"

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-foreground text-base font-medium", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
