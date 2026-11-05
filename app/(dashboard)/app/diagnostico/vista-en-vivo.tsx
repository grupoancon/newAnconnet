"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Moon, Radio, Smartphone } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  obtenerAccionesEnVivo,
  obtenerSesionesEnVivo,
  TelemetriaApiError,
} from "@/lib/api/telemetria-api"
import { cn } from "@/lib/utils"

import type { AccionEnVivo, SesionEnVivo } from "./datos"
import { describirAccion, esAccionConProblema, sinServidor } from "./en-vivo"
import { formatearHora, haceCuanto } from "./formato"

// La app envía sus eventos cada 5 s: consultar más seguido no mostraría nada nuevo.
const REFRESCO_MS = 5_000

function mensajeDeError(err: unknown): string {
  return err instanceof TelemetriaApiError
    ? err.message
    : "No se pudo conectar con el servidor"
}

// Repite `cargar` mientras la pestaña del navegador esté visible. Una consulta que
// falla muestra el error, pero se sigue reintentando.
function useConsultaPeriodica<T>(cargar: (() => Promise<T>) | null, clave: string) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDatos(null)
    setError(null)
    if (!cargar) return
    let vigente = true
    const consultar = () => {
      if (document.visibilityState === "hidden") return
      cargar()
        .then((d) => {
          if (!vigente) return
          setDatos(d)
          setError(null)
        })
        .catch((err) => vigente && setError(mensajeDeError(err)))
    }
    consultar()
    const intervalo = setInterval(consultar, REFRESCO_MS)
    document.addEventListener("visibilitychange", consultar)
    return () => {
      vigente = false
      clearInterval(intervalo)
      document.removeEventListener("visibilitychange", consultar)
    }
    // `clave` identifica la consulta; `cargar` cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return { datos, error }
}

// Quién está usando la app ahora, en qué pantalla y qué hizo último. Al abrir una
// sesión se ven sus acciones (toques, pantallas, campos y peticiones) según llegan.
export function VistaEnVivo() {
  const [abierta, setAbierta] = useState<SesionEnVivo | null>(null)
  const { datos: sesiones, error } = useConsultaPeriodica(
    abierta ? null : obtenerSesionesEnVivo,
    abierta ? "" : "sesiones",
  )

  if (abierta) {
    return <AccionesDeSesion sesion={abierta} onVolver={() => setAbierta(null)} />
  }
  if (error && !sesiones) {
    return <EmptyState title="No se pudo cargar el monitoreo" description={error} />
  }
  if (!sesiones) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (sesiones.length === 0) {
    return (
      <EmptyState
        title="No hay nadie usando la app"
        description="Las sesiones aparecen aquí en cuanto alguien abre la app. Solo envían datos las versiones de producción instaladas en un teléfono."
      />
    )
  }

  return (
    <div>
      <div className="text-muted-foreground border-border flex items-center gap-2 border-b px-5 py-2.5 text-[12.5px]">
        <Radio className="size-3.5 text-green-600" strokeWidth={1.8} />
        {sesiones.length === 1 ? "1 sesión activa" : `${sesiones.length} sesiones activas`}
        {error ? <span className="text-destructive"> · Sin actualizar: {error}</span> : null}
      </div>
      <ul className="divide-border divide-y">
        {sesiones.map((sesion) => (
          <li key={sesion.session}>
            <button
              type="button"
              onClick={() => setAbierta(sesion)}
              className="hover:bg-muted/50 flex w-full items-center gap-3 px-5 py-3 text-left"
            >
              <Smartphone className="text-muted-foreground size-4 shrink-0" strokeWidth={1.7} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[13.5px] font-semibold">
                    {sesion.userEmail ?? sesion.userId ?? "Sin iniciar sesión"}
                  </span>
                  {sesion.state === "background" ? (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-[12px]">
                      <Moon className="size-3" strokeWidth={1.8} />
                      Segundo plano
                    </span>
                  ) : null}
                  {sesion.errors > 0 ? (
                    <StatusBadge variant="bloqueado">
                      {sesion.errors === 1 ? "1 error" : `${sesion.errors} errores`}
                    </StatusBadge>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-[12.5px]">
                  {sesion.screen ?? "Pantalla desconocida"}
                  {sesion.lastAction ? ` · ${describirAccion(sesion.lastAction)}` : ""}
                </p>
                {sesion.lastError ? (
                  <p className="text-destructive mt-0.5 truncate text-[12.5px]">
                    Último error: {sinServidor(sesion.lastError)}
                  </p>
                ) : null}
              </div>
              <div className="text-muted-foreground shrink-0 text-right text-[12px]">
                <div>{haceCuanto(sesion.lastSeen)}</div>
                <div>
                  {[sesion.platform, sesion.appVersion].filter(Boolean).join(" ")}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AccionesDeSesion({
  sesion,
  onVolver,
}: {
  sesion: SesionEnVivo
  onVolver: () => void
}) {
  const { datos: acciones, error } = useConsultaPeriodica(
    () => obtenerAccionesEnVivo(sesion.session),
    sesion.session,
  )

  return (
    <div>
      <div className="border-border flex items-center gap-3 border-b px-5 py-2.5">
        <Button variant="outline" size="icon" className="size-8" aria-label="Volver" onClick={onVolver}>
          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">
            {sesion.userEmail ?? sesion.userId ?? "Sin iniciar sesión"}
          </p>
          <p className="text-muted-foreground truncate text-[12px]">
            {[sesion.deviceModel, sesion.platform, sesion.appVersion].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {error && !acciones ? (
        <EmptyState title="No se pudieron cargar las acciones" description={error} />
      ) : !acciones ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : acciones.length === 0 ? (
        <EmptyState title="Sin acciones todavía" description="Aparecerán aquí según lleguen." />
      ) : (
        <ul className="divide-border divide-y">
          {acciones.map((accion) => (
            <FilaAccion key={accion.id} accion={accion} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilaAccion({ accion }: { accion: AccionEnVivo }) {
  return (
    <li className="flex items-start gap-3 px-5 py-2">
      <span className="text-muted-foreground w-16 shrink-0 pt-px text-[12px] tabular-nums">
        {formatearHora(new Date(accion.time).toISOString())}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[12.5px] break-words",
            esAccionConProblema(accion) && "text-destructive font-medium",
          )}
        >
          {describirAccion(accion)}
        </p>
        {accion.cause ? (
          <p className="text-destructive mt-0.5 font-mono text-[11.5px] break-words">
            Causa en el servidor: {accion.cause}
          </p>
        ) : null}
        {accion.screen ? (
          <p className="text-muted-foreground truncate text-[11.5px]">{accion.screen}</p>
        ) : null}
      </div>
    </li>
  )
}
