"use client"

import { useEffect, useState } from "react"
import { Pencil } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  RrhhApiError,
  actualizarSaldoVacaciones,
  listarColaboradores,
  type ColaboradorBackend,
} from "@/lib/api/rrhh-api"
import { cn } from "@/lib/utils"

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

// 1.5 -> "1 h 30 min", 2 -> "2 h", 0.5 -> "30 min", 0 -> "0 h".
function formatearHoras(horas: number): string {
  const signo = horas < 0 ? "-" : ""
  const totalMin = Math.round(Math.abs(horas) * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0 && m === 0) return "0 h"
  return (
    signo + [h > 0 ? `${h} h` : "", m > 0 ? `${m} min` : ""].filter(Boolean).join(" ")
  )
}

// Saldo de vacaciones: "disponibles" (15 + 1 por cada 5 años) + "aumentados"
// (lo no tomado del periodo anterior, ajustable a mano) - "descontados" (vacaciones
// aprobadas del periodo) = el total que puede tomar el colaborador. Disponibles y
// descontados los calcula el backend (SaldoVacacionesService).
export function ColaboradoresTab() {
  const toast = useToast()
  const puedeGestionar = useCan("rrhh:gestionar")

  const [colaboradores, setColaboradores] = useState<ColaboradorBackend[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [edicion, setEdicion] = useState<ColaboradorBackend | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cargar() {
    if (!puedeGestionar) return
    setError(null)
    listarColaboradores()
      .then(setColaboradores)
      .catch((err) => {
        setError(
          err instanceof RrhhApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeGestionar])

  async function manejarGuardar() {
    if (!edicion) return
    setGuardando(true)
    try {
      await actualizarSaldoVacaciones(edicion.id, {
        diasAumentados: edicion.diasAumentados,
        horasFavor: edicion.horasFavor,
      })
      toast({ variant: "success", description: "Datos del colaborador actualizados." })
      setEdicion(null)
      cargar()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo guardar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  if (!puedeGestionar) {
    return (
      <EmptyState
        title="No tienes permiso para esta sección"
        description="Hace falta el permiso rrhh:gestionar para administrar colaboradores."
        dashed
      />
    )
  }

  return (
    <>
      <div className="bg-card border-border overflow-hidden rounded-lg border">
        {!colaboradores && !error ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-4 sm:p-6.5">
            <EmptyState
              title="No se pudieron cargar los colaboradores"
              description={error}
              dashed
            />
          </div>
        ) : (
          <table className="tabla-apilada w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                <th className="px-5 py-2.75 text-left">ACCIONES</th>
                <th className="px-5 py-2.75 text-left">NOMBRE</th>
                <th className="px-5 py-2.75 text-left">DEPARTAMENTO</th>
                <th className="px-5 py-2.75 text-left">ANTIGÜEDAD</th>
                <th className="px-5 py-2.75 text-left">DISPONIBLES</th>
                <th className="px-5 py-2.75 text-left">AUMENTADOS</th>
                <th className="px-5 py-2.75 text-left">DESCONTADOS</th>
                <th className="px-5 py-2.75 text-left">SALDO TOTAL</th>
                <th className="px-5 py-2.75 text-left">HORAS A FAVOR</th>
              </tr>
            </thead>
            <tbody>
              {colaboradores!.map((colaborador, index) => {
                const saldoTotal =
                  colaborador.diasVacaciones +
                  colaborador.diasAumentados -
                  colaborador.diasDescontados
                return (
                  <tr
                    key={colaborador.id}
                    className={cn(
                      "hover:bg-muted/60 transition-colors",
                      index < colaboradores!.length - 1 && "border-border border-b"
                    )}
                  >
                    <td data-label="Acciones" className="px-5 py-3.5">
                      <button
                        type="button"
                        aria-label="Editar saldo de vacaciones y horas a favor"
                        className="text-primary"
                        onClick={() => setEdicion(colaborador)}
                      >
                        <Pencil className="size-4" strokeWidth={1.7} />
                      </button>
                    </td>
                    <td
                      data-label="Nombre"
                      className="px-5 py-3.5 font-bold whitespace-nowrap"
                    >
                      {colaborador.nombre}
                      <div className="text-muted-foreground mt-0.5 text-[11.5px] font-normal">
                        {colaborador.email}
                      </div>
                    </td>
                    <td
                      data-label="Departamento"
                      className="text-muted-foreground px-5 py-3.5"
                    >
                      {colaborador.departamento || "—"}
                    </td>
                    <td
                      data-label="Antigüedad"
                      className="text-muted-foreground px-5 py-3.5 font-mono text-[11.5px]"
                    >
                      {colaborador.anosTrabajados} año
                      {colaborador.anosTrabajados === 1 ? "" : "s"}
                      <div>Desde {formatearFecha(colaborador.fechaIngreso)}</div>
                    </td>
                    <td
                      data-label="Disponibles"
                      className="px-5 py-3.5 font-mono font-semibold"
                    >
                      {colaborador.diasVacaciones}
                    </td>
                    <td
                      data-label="Aumentados"
                      className="text-status-disponible-fg px-5 py-3.5 font-mono font-semibold"
                    >
                      {colaborador.diasAumentados >= 0 ? "+" : ""}
                      {colaborador.diasAumentados}
                    </td>
                    <td
                      data-label="Descontados"
                      className="text-status-bloqueado-fg px-5 py-3.5 font-mono font-semibold"
                    >
                      -{colaborador.diasDescontados}
                    </td>
                    <td
                      data-label="Saldo total"
                      className="px-5 py-3.5 font-mono font-extrabold"
                    >
                      {saldoTotal}
                    </td>
                    <td
                      data-label="Horas a favor"
                      className={cn(
                        "px-5 py-3.5 font-mono font-semibold whitespace-nowrap",
                        colaborador.horasFavor < 0 && "text-status-bloqueado-fg"
                      )}
                    >
                      {formatearHoras(colaborador.horasFavor)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={!!edicion} onOpenChange={(valor) => !valor && setEdicion(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Ajustar saldo y horas a favor</SheetTitle>
            <SheetDescription>{edicion?.nombre}</SheetDescription>
          </SheetHeader>
          {edicion && (
            <div className="flex flex-col gap-3.5 p-5">
              <div className="bg-muted/60 border-border rounded-md border p-3 text-[12.5px]">
                <div className="mb-1.5 font-semibold">Se calculan solos</div>
                <div className="text-muted-foreground flex flex-col gap-0.5">
                  <span>
                    Disponibles del periodo: <b>{edicion.diasVacaciones}</b> (15 + 1 por
                    cada 5 años de antigüedad)
                  </span>
                  <span>
                    Descontados: <b>{edicion.diasDescontados}</b> (vacaciones aprobadas
                    del periodo)
                  </span>
                </div>
              </div>
              <TextField
                label="Días aumentados (arrastrados del periodo anterior o ajuste)"
                type="number"
                value={String(edicion.diasAumentados)}
                onChange={(valor) =>
                  setEdicion({ ...edicion, diasAumentados: Number(valor) || 0 })
                }
              />
              <div>
                <TextField
                  label="Horas a favor"
                  type="number"
                  value={String(edicion.horasFavor)}
                  onChange={(valor) =>
                    setEdicion({
                      ...edicion,
                      horasFavor: Number(valor) || 0,
                    })
                  }
                />
                <p className="text-muted-foreground mt-1.5 text-[11.5px]">
                  En horas, con decimales: 1 = 1 hora, 1.5 = 1 hora 30 min. Puede ser
                  negativa (horas que debe). Ahora: {formatearHoras(edicion.horasFavor)}.
                </p>
              </div>
            </div>
          )}
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => setEdicion(null)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={guardando} onClick={manejarGuardar}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
