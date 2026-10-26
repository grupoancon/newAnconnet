"use client"

import { BarChart3, Menu, TrendingUp } from "lucide-react"
import { useRouter } from "@/lib/navigation"

import { useCan } from "@/components/shared/can"
import { NotificacionesBell } from "@/components/shared/notificaciones-bell"
import { NotificacionesInternasBell } from "@/components/shared/notificaciones-internas-bell"
import { useSidebarMobile } from "@/components/shared/sidebar-context"
import { ZONA_ECUADOR, useReloj } from "@/components/shared/use-reloj"
import { Button } from "@/components/ui/button"

function saludoPorHora(hora: number): string {
  if (hora < 12) return "Buenos días"
  if (hora < 19) return "Buenas tardes"
  return "Buenas noches"
}

// La hora del navegador/servidor no necesariamente es la de Ecuador — se lee la hora
// ya localizada a esa zona en vez de Date.getHours(), que usa el huso horario local.
function horaEnEcuador(fecha: Date): number {
  const texto = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_ECUADOR,
    hour: "numeric",
    hourCycle: "h23",
  }).format(fecha)
  return Number(texto)
}

export function AppTopbar({
  nombre,
  actions,
}: {
  nombre: string
  actions?: React.ReactNode
}) {
  const { abrirMenu } = useSidebarMobile()
  const router = useRouter()
  const puedeVerReporteVentas = useCan("ventas:reporte")
  const ahora = useReloj()

  // `ahora` es null en el primerísimo render (ver useReloj) — placeholder fijo ese
  // instante para que coincida con el HTML que mandó el servidor.
  const saludo = ahora ? saludoPorHora(horaEnEcuador(ahora)) : "Hola"
  const fecha = ahora
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: ZONA_ECUADOR,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(ahora)
    : ""

  return (
    <div className="bg-card border-border flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 lg:px-6.5">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label="Abrir menu"
          onClick={abrirMenu}
        >
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0">
          <div className="truncate text-[15.5px] font-extrabold tracking-tight">
            {saludo}, {nombre.split(" ")[0]}
          </div>
          <div className="text-muted-foreground truncate text-xs capitalize">{fecha}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {actions ?? (
          <>
            {/* Reporte agregado de toda la empresa — requiere "ventas:reporte", que un
                Asesor de Ventas no tiene por defecto (ellos usan "Mis ventas", al
                lado). */}
            {puedeVerReporteVentas ? (
              <Button
                variant="outline"
                size="sm"
                className="px-2.5 lg:px-3"
                onClick={() => router.push("/ventas/reporte")}
              >
                <TrendingUp className="size-3.5" strokeWidth={1.7} />
                {/* En mobile/tablet solo el icono — con el saludo + boton de menu no
                    entra el texto sin truncar el nombre del usuario. */}
                <span className="hidden lg:inline">Reporte de ventas</span>
              </Button>
            ) : null}
            <Button
              size="sm"
              className="px-2.5 lg:px-3"
              onClick={() => router.push("/ventas/mis-ventas")}
            >
              <BarChart3 className="size-3.5" strokeWidth={2} />
              <span className="hidden lg:inline">Mis ventas</span>
            </Button>
          </>
        )}
        {/* En mobile/tablet no hay lugar para esto junto al boton de abrir el menu y las
            acciones — se muestra solo en escritorio. */}
        <NotificacionesInternasBell />
        <NotificacionesBell />
      </div>
    </div>
  )
}
