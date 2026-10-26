import Link from "next/link"
import { Receipt } from "lucide-react"

import { ProjectTabsBar } from "@/components/shared/project-tabs-bar"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { requirePermiso } from "@/lib/auth/guard"
import { can } from "@/lib/auth/rbac"

import { SelectorProyectosContent } from "./selector-proyectos-content"

export default async function SelectorProyectosPage() {
  // Si no tiene el permiso, requirePermiso ya redirige a /sin-acceso por dentro.
  // Si llega a la siguiente linea es porque SI esta autorizado.
  const usuario = await requirePermiso("ventas:nueva", "Nueva Venta")
  // "Ventas realizadas" es solo para gerencia/administración: el asesor no ve el botón.
  const puedeVerVentasRealizadas = can(usuario, "ventas", "reporte")

  return (
    <div>
      <ProjectTabsBar tabs={[{ id: "inicio", label: "Inicio" }]} defaultTabId="inicio" />

      <div className="px-8.5 py-9">
        <div className="mb-7 text-center">
          <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight">
            ¿En dónde quieres la oferta?
          </h1>
          <p className="text-muted-foreground text-sm">
            Selecciona un proyecto para comenzar tu cotización.
          </p>
          {/* Los lotes vendidos ya no salen en Nueva Venta (solo lista lotes libres):
              sus procesos y reportes se consultan desde "Ventas realizadas". */}
          {puedeVerVentasRealizadas && (
            <Link
              href="/ventas/realizadas"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
            >
              <Receipt className="size-3.5" strokeWidth={1.7} />
              Ver ventas realizadas
            </Link>
          )}
        </div>

        <SelectorProyectosContent />
      </div>
    </div>
  )
}
