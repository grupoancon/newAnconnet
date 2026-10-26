import { Settings, Wrench } from "lucide-react"

import { BrandMark } from "@/components/shared/brand-mark"
import { LogoutButton } from "@/components/shared/mantenimiento-logout"
import { MENSAJE_MANTENIMIENTO_POR_DEFECTO } from "@/lib/mantenimiento/constantes"
import type { EstadoMantenimiento } from "@/lib/mantenimiento/estado"

// Reemplaza toda la intranet mientras el mantenimiento está activo en modo "bloqueo"
// (salvo para Administrador — ver app/(dashboard)/layout.tsx). Mismo lenguaje visual
// que el panel izquierdo del login: fondo con el gradiente de marca y círculos
// decorativos, tarjeta blanca al centro.
export function MantenimientoPantalla({
  estado,
  nombreUsuario,
}: {
  estado: EstadoMantenimiento
  nombreUsuario: string
}) {
  const primerNombre = nombreUsuario.trim().split(/\s+/)[0] ?? ""

  return (
    <div className="bg-brand-gradient relative flex min-h-dvh flex-col overflow-hidden px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-white sm:px-10">
      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/8" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-[26rem] rounded-full bg-white/6" />
      <div className="pointer-events-none absolute right-[12%] bottom-[18%] hidden size-44 rounded-full border border-white/16 sm:block" />
      <Settings
        className="pointer-events-none absolute top-[14%] left-[8%] hidden size-40 text-white/8 motion-safe:animate-[spin_40s_linear_infinite] md:block"
        strokeWidth={1}
      />

      <header className="relative z-10 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-white/25 bg-white/16 backdrop-blur-sm">
          <BrandMark className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-base font-extrabold tracking-wide">ANCONnet</div>
          <div className="text-[11px] tracking-[0.14em] opacity-85">GRUPO ANCON</div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center py-10">
        <div className="bg-card text-card-foreground animate-in fade-in-0 zoom-in-95 w-full max-w-md rounded-2xl p-8 text-center shadow-2xl duration-500 sm:p-10">
          <div className="relative mx-auto mb-6 size-20">
            <div className="bg-primary/15 absolute -inset-2 rounded-[1.75rem] motion-safe:animate-pulse" />
            <div className="bg-brand-gradient shadow-brand-lg relative flex size-20 items-center justify-center rounded-3xl">
              <Wrench
                className="size-9 text-white motion-safe:animate-[wiggle_2.4s_ease-in-out_infinite]"
                strokeWidth={1.8}
              />
            </div>
          </div>

          <div className="bg-status-reservado-bg text-status-reservado-fg mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
            <span className="relative flex size-2">
              <span className="bg-status-reservado-fg absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" />
              <span className="bg-status-reservado-fg relative inline-flex size-2 rounded-full" />
            </span>
            En mantenimiento
          </div>

          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-balance">
            {primerNombre ? `${primerNombre}, volvemos pronto` : "Volvemos pronto"}
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Estamos mejorando la intranet. Mientras tanto no está disponible.
          </p>

          <div className="bg-muted border-border mb-6 rounded-xl border px-4 py-3.5 text-left">
            <div className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">
              Mensaje del equipo
            </div>
            <p className="text-foreground text-sm leading-[1.55] whitespace-pre-line">
              {estado.mensaje || MENSAJE_MANTENIMIENTO_POR_DEFECTO}
            </p>
          </div>

          <p className="text-muted-foreground mb-5 text-xs">
            Esta página se actualiza sola: apenas terminemos vas a poder entrar sin
            recargar.
          </p>

          <LogoutButton />
        </div>
      </main>

      <footer className="relative z-10 text-center text-[11px] opacity-75">
        © {new Date().getFullYear()} Grupo Ancon
      </footer>
    </div>
  )
}
