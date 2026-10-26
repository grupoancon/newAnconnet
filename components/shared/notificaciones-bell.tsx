"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import Link from "next/link"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { listarMisSolicitudesPendientes, type SolicitudDocumentoBackend } from "@/lib/api/ventas-api"

type SolicitudConVenta = SolicitudDocumentoBackend & {
  cli_name: string | null
  cli_lote: string | null
}

// 60s: sin precedente de polling en este codebase, es el intervalo mas chico que no
// satura al backend con un endpoint que cualquier usuario logeado puede pegarle cada
// vez que la pestaña esta abierta, sin dejar la notificacion visiblemente vieja.
const INTERVALO_MS = 60_000

export function NotificacionesBell() {
  const [solicitudes, setSolicitudes] = useState<SolicitudConVenta[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelado = false

    function cargar() {
      listarMisSolicitudesPendientes()
        .then((data) => {
          if (cancelado) return
          setSolicitudes(data.items)
          setTotal(data.total)
        })
        .catch(() => {
          // Silencioso: la campanita es una conveniencia, no debe romper el resto del
          // topbar si el backend no responde.
        })
    }

    cargar()
    const intervalo = setInterval(cargar, INTERVALO_MS)
    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="border-border relative hidden size-9.5 items-center justify-center rounded-md border lg:flex"
          aria-label={total > 0 ? `Notificaciones (${total} pendientes)` : "Notificaciones"}
        >
          <Bell className="text-muted-foreground size-[17px]" strokeWidth={1.7} />
          {total > 0 ? (
            <span className="bg-status-bloqueado absolute top-2 right-2.5 size-1.5 rounded-full" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="border-border border-b p-3">
          <p className="text-sm font-semibold">Documentos solicitados</p>
        </div>
        {solicitudes.length === 0 ? (
          <p className="text-muted-foreground p-3 text-xs">No tienes solicitudes pendientes.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1.5">
            {solicitudes.slice(0, 5).map((solicitud) => (
              <Link
                key={solicitud.id}
                href={`/ventas/procesos/documentos?proceso=${solicitud.id_process}`}
                className="hover:bg-muted block rounded-md p-2 text-xs"
              >
                <p className="font-semibold">
                  {solicitud.cli_name || `Proceso #${solicitud.id_process}`}
                  {solicitud.cli_lote ? ` · Lote ${solicitud.cli_lote}` : ""}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Se solicitó: {solicitud.tipo.replace(/_/g, " ")}
                </p>
                {solicitud.comentario ? (
                  <p className="text-muted-foreground mt-0.5 italic">
                    &ldquo;{solicitud.comentario}&rdquo;
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
