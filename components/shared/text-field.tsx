import { cn } from "@/lib/utils"
import { EtiquetaCampo } from "@/components/shared/etiqueta-campo"

export function TextField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  error,
  disabled,
  hint,
}: {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  type?: string
  error?: string | null
  disabled?: boolean
  // Nota gris debajo del campo (no se muestra si hay error).
  hint?: string
}) {
  return (
    <div className="min-w-0">
      {label ? (
        <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          <EtiquetaCampo>{label}</EtiquetaCampo>
        </label>
      ) : null}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        className={cn(
          "border-input bg-card focus:border-primary focus:ring-ring/15 h-11 w-full min-w-0 rounded-md border px-3.5 text-sm outline-none focus:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus:border-destructive"
        )}
      />
      {!error && hint ? (
        <p className="text-muted-foreground mt-1.5 text-xs">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-destructive mt-1.5 text-xs font-medium">{error}</p>
      ) : null}
    </div>
  )
}
