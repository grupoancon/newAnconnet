"use client"

import { useEffect, useState } from "react"
import { CircleAlert, CircleCheck } from "lucide-react"

import { obtenerEstadoSistema, TelemetriaApiError } from "@/lib/api/telemetria-api"
import { cn } from "@/lib/utils"

import type { EstadoSistema } from "./datos"
import { haceCuanto } from "./formato"

// anconAPI hace el chequeo cada minuto.
const REFRESCO_MS = 30_000

// Estado de lo que necesita la app: bases de datos, Redis, SAP y que existan las
// tablas y columnas que el código espera. Si anconAPI deja de reportar, lo indica:
// un API caído no puede avisar por sí mismo.
export function EstadoSistemaCard() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const consultar = () => {
      if (document.visibilityState === "hidden") return
      obtenerEstadoSistema()
        .then((e) => {
          if (!vigente) return
          setEstado(e)
          setError(null)
        })
        .catch((err) => {
          if (!vigente) return
          setError(
            err instanceof TelemetriaApiError ? err.message : "No se pudo consultar el estado",
          )
        })
    }
    consultar()
    const intervalo = setInterval(consultar, REFRESCO_MS)
    return () => {
      vigente = false
      clearInterval(intervalo)
    }
  }, [])

  if (!estado) {
    return error ? (
      <div className="bg-card border-border text-muted-foreground rounded-lg border px-4 py-3 text-[13px] shadow-sm">
        Estado del sistema: {error}
      </div>
    ) : null
  }

  const fallas = estado.checks.filter((c) => !c.ok)
  const todoBien = !estado.stale && fallas.length === 0
  const titulo = estado.stale
    ? estado.checkedAt
      ? `anconAPI no reporta desde ${haceCuanto(estado.checkedAt)}`
      : "anconAPI todavía no ha reportado"
    : todoBien
      ? "Todos los servicios funcionan"
      : fallas.length === 1
        ? "1 problema detectado"
        : `${fallas.length} problemas detectados`

  return (
    <div className="bg-card border-border rounded-lg border px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            "flex items-center gap-2 text-[13.5px] font-semibold",
            !todoBien && "text-destructive",
          )}
        >
          {todoBien ? (
            <CircleCheck className="size-4 text-green-600" strokeWidth={1.8} />
          ) : (
            <CircleAlert className="size-4" strokeWidth={1.8} />
          )}
          {titulo}
        </p>
        {estado.checkedAt ? (
          <span className="text-muted-foreground text-[12px]">
            Revisado {haceCuanto(estado.checkedAt)}
          </span>
        ) : null}
      </div>
      {!todoBien ? (
        <ul className="mt-2 space-y-1.5">
          {fallas.map((falla) => (
            <li key={falla.name} className="text-[12.5px] break-words">
              <span className="font-medium">{falla.name}:</span>{" "}
              <span className="text-muted-foreground">{falla.detail ?? "No responde"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
