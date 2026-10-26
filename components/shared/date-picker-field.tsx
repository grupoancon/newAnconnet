"use client"

import { useEffect, useState } from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"]

function formatearAnioMes(anio: number, mesIndex: number): string {
  return `${anio}-${String(mesIndex + 1).padStart(2, "0")}`
}

function formatearFechaVisible(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  if (!anio || !mes || !dia) return fecha
  return `${dia}/${mes}/${anio}`
}

// Calendario visual propio (no un <input type="date"> nativo) — mismo lenguaje visual
// que el calendario de fecha de inicio de financiamiento (new/[id] de Financiamiento/
// Refinanciamiento/Cotizaciones), pero de uso general: sin restricción de día
// elegible por defecto (ahí sí tiene sentido restringir al 5/20; acá cualquier fecha
// sirve salvo que se pase `fechaMinima`, ej. RRHH: la fecha de un permiso/préstamo
// tiene que ser posterior a hoy).
export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Seleccione una fecha",
  fechaMinima,
}: {
  label?: string
  value: string
  onChange: (fecha: string) => void
  placeholder?: string
  // "YYYY-MM-DD" — cualquier día anterior a este queda deshabilitado (gris, sin
  // click) y la navegación no deja retroceder antes de su mes.
  fechaMinima?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const hoy = new Date()
  const mesHoy = formatearAnioMes(hoy.getFullYear(), hoy.getMonth())
  const mesMinimo = fechaMinima ? fechaMinima.slice(0, 7) : null
  const [mesMostrado, setMesMostrado] = useState(
    value ? value.slice(0, 7) : (mesMinimo ?? mesHoy)
  )

  // Al abrir, salta al mes de la fecha ya elegida (o al mínimo permitido / actual si
  // no hay ninguna) — así reabrir el popover no deja al asesor perdido en el mes que
  // haya navegado la última vez.
  useEffect(() => {
    if (abierto) setMesMostrado(value ? value.slice(0, 7) : (mesMinimo ?? mesHoy))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  const [anioTexto, mesTexto] = mesMostrado.split("-")
  const anio = Number(anioTexto)
  const mesIndice = Number(mesTexto) - 1
  const primerDiaSemana = new Date(Date.UTC(anio, mesIndice, 1)).getUTCDay()
  const diasEnMes = new Date(Date.UTC(anio, mesIndice + 1, 0)).getUTCDate()

  function irAMesAdyacente(delta: number) {
    const fecha = new Date(anio, mesIndice + delta, 1)
    setMesMostrado(formatearAnioMes(fecha.getFullYear(), fecha.getMonth()))
  }

  function seleccionarDia(dia: number) {
    onChange(`${mesMostrado}-${String(dia).padStart(2, "0")}`)
    setAbierto(false)
  }

  return (
    <div>
      {label ? (
        <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          {label}
        </label>
      ) : null}
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="border-input bg-card focus:border-primary focus:ring-ring/15 flex h-11 w-full items-center justify-between rounded-md border px-3.5 text-sm outline-none focus:ring-3"
          >
            <span className={cn(!value && "text-muted-foreground")}>
              {value ? formatearFechaVisible(value) : placeholder}
            </span>
            <CalendarIcon
              className="text-muted-foreground size-4 shrink-0"
              strokeWidth={1.8}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto">
          <div className="flex w-64 flex-col p-4.5">
            <div className="mb-3.5 flex items-center justify-between">
              <div className="text-sm font-bold">
                {MESES_NOMBRES[mesIndice]} {anio}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={mesMinimo != null && mesMostrado <= mesMinimo}
                  onClick={() => irAMesAdyacente(-1)}
                  className="border-border flex size-[26px] items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft
                    className="text-muted-foreground size-3.5"
                    strokeWidth={1.8}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => irAMesAdyacente(1)}
                  className="border-border flex size-[26px] items-center justify-center rounded-md border"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight
                    className="text-muted-foreground size-3.5"
                    strokeWidth={1.8}
                  />
                </button>
              </div>
            </div>
            <div className="text-muted-foreground mb-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold">
              {DIAS_SEMANA.map((dia, indice) => (
                <span key={indice}>{dia}</span>
              ))}
            </div>
            <div className="text-foreground grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: primerDiaSemana }).map((_, indice) => (
                <span key={`blank-${indice}`} />
              ))}
              {Array.from({ length: diasEnMes }, (_, indice) => indice + 1).map((dia) => {
                const fechaDelDia = `${mesMostrado}-${String(dia).padStart(2, "0")}`
                const esSeleccionado = value === fechaDelDia
                const esHoy = mesMostrado === mesHoy && dia === hoy.getDate()
                const esDeshabilitado = fechaMinima != null && fechaDelDia < fechaMinima
                return (
                  <button
                    key={dia}
                    type="button"
                    disabled={esDeshabilitado}
                    onClick={() => seleccionarDia(dia)}
                    className="relative flex items-center justify-center py-1.5 disabled:cursor-not-allowed"
                  >
                    <span
                      className={cn(
                        "flex size-[26px] items-center justify-center rounded-full font-bold transition-colors",
                        esDeshabilitado
                          ? "text-muted-foreground/40"
                          : esSeleccionado
                            ? "bg-brand-gradient text-white"
                            : esHoy
                              ? "border-primary text-primary border"
                              : "hover:bg-muted"
                      )}
                    >
                      {dia}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
