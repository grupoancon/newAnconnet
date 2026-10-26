import * as React from "react"

import { cn } from "@/lib/utils"

// forwardRef explicito: el proyecto usa React 18 (Next.js 14), donde los componentes
// de funcion no reciben `ref` como prop automaticamente (eso llega con React 19).
// FormControl (components/ui/form.tsx) envuelve este input con Slot y necesita el ref.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "border-input file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/15 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 bg-card h-10 w-full min-w-0 rounded-sm border px-3 py-1 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
