"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type ToastVariant = "success" | "info" | "warning" | "error"

type Toast = {
  id: string
  variant: ToastVariant
  title?: string
  description: string
  duracionMs: number
  saliendo: boolean
}

type MostrarToast = (input: {
  variant: ToastVariant
  title?: string
  description: string
  // ms visible antes de autodescartarse; pasa `duracionMs: 0` para que no se cierre solo.
  duracionMs?: number
}) => void

const ToastContext = createContext<MostrarToast | null>(null)

const VARIANT_STYLES: Record<
  ToastVariant,
  { bg: string; border: string; fg: string; icon: LucideIcon; tituloDefault: string }
> = {
  success: {
    bg: "bg-status-disponible-bg",
    border: "border-status-disponible-border",
    fg: "text-status-disponible-fg",
    icon: CheckCircle2,
    tituloDefault: "Éxito",
  },
  info: {
    bg: "bg-status-hipotecado-bg",
    border: "border-status-hipotecado-border",
    fg: "text-status-hipotecado-fg",
    icon: Info,
    tituloDefault: "Información",
  },
  warning: {
    bg: "bg-status-reservado-bg",
    border: "border-status-reservado-border",
    fg: "text-status-reservado-fg",
    icon: AlertTriangle,
    tituloDefault: "Advertencia",
  },
  error: {
    bg: "bg-status-bloqueado-bg",
    border: "border-status-bloqueado-border",
    fg: "text-status-bloqueado-fg",
    icon: AlertCircle,
    tituloDefault: "Error",
  },
}

const DURACION_DEFAULT_MS = 5000
const DURACION_SALIDA_MS = 200

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const contadorRef = useRef(0)

  const cerrarToast = useCallback((id: string) => {
    // Marca "saliendo" primero para que se pueda animar la salida, y recien despues
    // de la animacion lo saca del array — nunca desaparece de golpe.
    setToasts((actual) => actual.map((t) => (t.id === id ? { ...t, saliendo: true } : t)))
    setTimeout(() => {
      setToasts((actual) => actual.filter((t) => t.id !== id))
    }, DURACION_SALIDA_MS)
  }, [])

  const mostrarToast = useCallback<MostrarToast>((input) => {
    contadorRef.current += 1
    const id = `toast-${contadorRef.current}-${Date.now()}`
    setToasts((actual) => [
      ...actual,
      {
        id,
        variant: input.variant,
        title: input.title,
        description: input.description,
        duracionMs: input.duracionMs ?? DURACION_DEFAULT_MS,
        saliendo: false,
      },
    ])
  }, [])

  return (
    <ToastContext.Provider value={mostrarToast}>
      {children}
      <div
        className="pointer-events-none fixed top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-right))] z-100 flex w-full max-w-sm flex-col gap-2.5"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => cerrarToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    if (toast.duracionMs <= 0) return
    const temporizador = setTimeout(onClose, toast.duracionMs)
    return () => clearTimeout(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.duracionMs])

  const { bg, border, fg, icon: Icon, tituloDefault } = VARIANT_STYLES[toast.variant]

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3.5 shadow-lg duration-200",
        bg,
        border,
        toast.saliendo
          ? "animate-out fade-out-0 slide-out-to-right-6"
          : "animate-in fade-in-0 slide-in-from-right-6"
      )}
    >
      <Icon className={cn("mt-0.5 size-[18px] shrink-0", fg)} strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <div className={cn("text-[12.5px] font-bold", fg)}>
          {toast.title ?? tituloDefault}
        </div>
        <div className={cn("text-xs leading-relaxed", fg)}>{toast.description}</div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar notificación"
        className={cn(
          "shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100",
          fg
        )}
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}

export function useToast(): MostrarToast {
  const contexto = useContext(ToastContext)
  if (!contexto) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>")
  }
  return contexto
}
