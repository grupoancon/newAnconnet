"use client"

import { useEffect, useState } from "react"
import { BellRing } from "lucide-react"
import { useRouter } from "@/lib/navigation"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  contarNotificacionesInternasNoLeidas,
  listarMisNotificacionesInternas,
  marcarNotificacionInternaLeida,
  marcarTodasNotificacionesInternasLeidas,
  type NotificacionInternaBackend,
} from "@/lib/api/notificaciones-internas-api"
import { cn } from "@/lib/utils"

// Mismo intervalo que NotificacionesBell (documentos solicitados) — sin precedente de
// uno más corto en este codebase.
const INTERVALO_MS = 60_000

function formatearRelativo(fecha: string | null): string {
  if (!fecha) return ""
  const diffMs = Date.now() - new Date(fecha).getTime()
  const minutos = Math.floor(diffMs / 60_000)
  if (minutos < 1) return "Recién"
  if (minutos < 60) return `Hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `Hace ${dias} d`
}

// Centro de notificaciones in-app genérico (RRHH, y lo que se agregue después) —
// aparte de NotificacionesBell (documentos solicitados, solo Ventas): dos campanitas
// con dominios distintos, no una fusionada, para no arriesgar esa ya en uso.
export function NotificacionesInternasBell() {
  const router = useRouter()
  const [notificaciones, setNotificaciones] = useState<NotificacionInternaBackend[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelado = false

    function cargarContador() {
      contarNotificacionesInternasNoLeidas()
        .then((data) => {
          if (cancelado) return
          setTotal(data.total)
        })
        .catch(() => {
          // Silencioso: la campanita es una conveniencia, no debe romper el topbar.
        })
    }

    cargarContador()
    const intervalo = setInterval(cargarContador, INTERVALO_MS)
    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
  }, [])

  function alAbrir(abierto: boolean) {
    if (!abierto) return
    listarMisNotificacionesInternas()
      .then(setNotificaciones)
      .catch(() => {
        // Silencioso — ver mismo criterio de arriba.
      })
  }

  async function alHacerClick(notificacion: NotificacionInternaBackend) {
    if (!notificacion.leida_at) {
      try {
        await marcarNotificacionInternaLeida(notificacion.id)
        setTotal((anterior) => Math.max(0, anterior - 1))
        setNotificaciones((anterior) =>
          anterior.map((n) =>
            n.id === notificacion.id ? { ...n, leida_at: new Date().toISOString() } : n
          )
        )
      } catch {
        // Silencioso: si falla marcar como leída, igual se navega.
      }
    }
    if (notificacion.link) router.push(notificacion.link)
  }

  async function marcarTodasLeidas() {
    try {
      await marcarTodasNotificacionesInternasLeidas()
      setTotal(0)
      setNotificaciones((anterior) =>
        anterior.map((n) => ({ ...n, leida_at: n.leida_at ?? new Date().toISOString() }))
      )
    } catch {
      // Silencioso.
    }
  }

  return (
    <Popover onOpenChange={alAbrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-border relative hidden size-9.5 items-center justify-center rounded-md border lg:flex"
          aria-label={total > 0 ? `Notificaciones (${total} sin leer)` : "Notificaciones"}
        >
          <BellRing className="text-muted-foreground size-[17px]" strokeWidth={1.7} />
          {total > 0 ? (
            <span className="bg-status-bloqueado absolute top-2 right-2.5 size-1.5 rounded-full" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="border-border flex items-center justify-between border-b p-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {total > 0 && (
            <button
              type="button"
              onClick={marcarTodasLeidas}
              className="text-primary text-xs font-semibold"
            >
              Marcar todas leídas
            </button>
          )}
        </div>
        {notificaciones.length === 0 ? (
          <p className="text-muted-foreground p-3 text-xs">No tienes notificaciones.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1.5">
            {notificaciones.map((notificacion) => (
              <button
                key={notificacion.id}
                type="button"
                onClick={() => alHacerClick(notificacion)}
                className={cn(
                  "hover:bg-muted block w-full rounded-md p-2 text-left text-xs",
                  !notificacion.leida_at && "bg-accent/40"
                )}
              >
                <p className="font-semibold">{notificacion.titulo}</p>
                {notificacion.cuerpo ? (
                  <p className="text-muted-foreground mt-0.5">{notificacion.cuerpo}</p>
                ) : null}
                <p className="text-muted-foreground mt-0.5">
                  {formatearRelativo(notificacion.created_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
