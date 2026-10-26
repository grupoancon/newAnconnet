"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Megaphone, Wrench } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { PageHeader } from "@/components/shared/page-header"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  MAX_MENSAJE_MANTENIMIENTO,
  MENSAJE_AVISO_POR_DEFECTO,
  MENSAJE_MANTENIMIENTO_POR_DEFECTO,
} from "@/lib/mantenimiento/constantes"
import type { EstadoMantenimiento, ModoMantenimiento } from "@/lib/mantenimiento/estado"
import { cn } from "@/lib/utils"
import { accionGuardarMantenimiento } from "@/server/actions/mantenimiento"

const MODOS: Array<{
  id: ModoMantenimiento
  titulo: string
  descripcion: string
  icon: typeof Megaphone
}> = [
  {
    id: "aviso",
    titulo: "Solo aviso",
    descripcion:
      "Sale un banner arriba en todas las pantallas. Todos pueden seguir trabajando.",
    icon: Megaphone,
  },
  {
    id: "bloqueo",
    titulo: "Bloquear la intranet",
    descripcion:
      "Todos ven la pantalla de mantenimiento y no pueden usar nada. Los administradores siguen entrando.",
    icon: Lock,
  },
]

function formatearFecha(iso: string | null): string {
  if (!iso) return ""
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

export function MantenimientoContent({
  estadoInicial,
}: {
  estadoInicial: EstadoMantenimiento
}) {
  const router = useRouter()
  const toast = useToast()
  const [guardado, setGuardado] = useState(estadoInicial)
  const [activo, setActivo] = useState(estadoInicial.activo)
  const [modo, setModo] = useState<ModoMantenimiento>(estadoInicial.modo)
  const [mensaje, setMensaje] = useState(estadoInicial.mensaje)
  const [guardando, setGuardando] = useState(false)

  const hayCambios =
    activo !== guardado.activo ||
    modo !== guardado.modo ||
    mensaje.trim() !== guardado.mensaje

  async function guardar() {
    if (activo && modo === "bloqueo" && !guardado.activo) {
      const confirmado = window.confirm(
        "Vas a bloquear la intranet: todos los usuarios que no sean administradores verán la pantalla de mantenimiento en menos de un minuto. ¿Continuar?"
      )
      if (!confirmado) return
    }

    setGuardando(true)
    const resultado = await accionGuardarMantenimiento({ activo, modo, mensaje })
    setGuardando(false)

    if (!resultado.ok) {
      toast({ variant: "error", description: resultado.error })
      return
    }

    setGuardado(resultado.estado)
    setMensaje(resultado.estado.mensaje)
    toast({
      variant: "success",
      description: resultado.estado.activo
        ? "Mantenimiento activado."
        : "Mantenimiento desactivado.",
    })
    // Recalcula el layout para que el banner aparezca/desaparezca ya mismo acá también.
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader eyebrow="Configuración" title="Mantenimiento" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="bg-card border-border flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-md",
                  guardado.activo
                    ? "bg-status-reservado-bg text-status-reservado-fg"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Wrench className="size-[18px]" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold">
                  {guardado.activo
                    ? guardado.modo === "bloqueo"
                      ? "Intranet bloqueada"
                      : "Aviso de mantenimiento visible"
                    : "Sin mantenimiento"}
                </div>
                {guardado.actualizadoPor ? (
                  <div className="text-muted-foreground text-xs">
                    Último cambio: {guardado.actualizadoPor} ·{" "}
                    {formatearFecha(guardado.actualizadoEn)}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={activo}
              aria-label="Activar mantenimiento"
              onClick={() => setActivo((valor) => !valor)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                activo ? "bg-primary" : "bg-input"
              )}
            >
              <span
                className={cn(
                  "bg-card inline-block size-5 rounded-full shadow transition-transform",
                  activo ? "translate-x-[22px]" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          <div className="bg-card border-border space-y-4 rounded-lg border p-4">
            <div>
              <div className="text-muted-foreground mb-1.5 text-xs font-semibold">
                Modo
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {MODOS.map(({ id, titulo, descripcion, icon: Icono }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={modo === id}
                    onClick={() => setModo(id)}
                    className={cn(
                      "border-border flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-left transition-colors",
                      modo === id
                        ? "border-primary bg-primary/5 ring-primary ring-1"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <Icono
                      className="text-primary mt-0.5 size-4 shrink-0"
                      strokeWidth={1.8}
                    />
                    <span>
                      <span className="block text-[13px] font-bold">{titulo}</span>
                      <span className="text-muted-foreground block text-xs">
                        {descripcion}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="mensaje-mantenimiento"
                className="text-muted-foreground mb-1.5 block text-xs font-semibold"
              >
                Mensaje para los usuarios
              </label>
              <Textarea
                id="mensaje-mantenimiento"
                value={mensaje}
                maxLength={MAX_MENSAJE_MANTENIMIENTO}
                placeholder={
                  modo === "bloqueo"
                    ? MENSAJE_MANTENIMIENTO_POR_DEFECTO
                    : MENSAJE_AVISO_POR_DEFECTO
                }
                onChange={(event) => setMensaje(event.target.value)}
                className="bg-card min-h-[96px]"
              />
              <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
                <span>Si lo dejas vacío se usa el mensaje de ejemplo.</span>
                <span>
                  {mensaje.length}/{MAX_MENSAJE_MANTENIMIENTO}
                </span>
              </div>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Los usuarios que ya tienen la intranet abierta ven el cambio en menos de un
            minuto, sin tener que recargar.
          </p>

          <div className="flex justify-end">
            <Button onClick={guardar} disabled={!hayCambios || guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
