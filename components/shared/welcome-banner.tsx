"use client"

import { ZONA_ECUADOR, useReloj } from "@/components/shared/use-reloj"

export function WelcomeBanner({ eyebrow, title }: { eyebrow: string; title: string }) {
  const ahora = useReloj()

  // Ecuador siempre es UTC-5 (sin horario de verano) — se fija el timeZone acá en vez
  // de confiar en el huso horario del navegador/servidor, que puede ser cualquier otro.
  // `ahora` es null en el primerísimo render (ver useReloj) — se muestra un placeholder
  // fijo ese instante para que coincida con el HTML que mandó el servidor.
  const hora = ahora
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: ZONA_ECUADOR,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(ahora)
    : "--:--:--"
  const fecha = ahora
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: ZONA_ECUADOR,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(ahora)
    : ""

  return (
    <div className="bg-brand-gradient-banner relative flex shrink-0 flex-col items-start justify-between gap-3 overflow-hidden rounded-lg px-5 py-4.5 text-white sm:flex-row sm:items-center lg:px-6.5 lg:py-5.5">
      <div className="absolute -top-15 -right-10 size-55 rounded-full bg-white/9" />
      <div className="relative">
        <div className="mb-1.5 text-[11px] font-bold tracking-[0.16em] opacity-85">
          {eyebrow}
        </div>
        <div className="text-xl font-extrabold tracking-tight sm:text-[22px]">{title}</div>
      </div>
      <div className="relative sm:text-right">
        <div className="font-mono text-[28px] leading-none sm:text-[34px] font-semibold">{hora}</div>
        <div className="mt-1 text-xs font-medium tracking-wide uppercase opacity-85">
          {fecha}
        </div>
      </div>
    </div>
  )
}
