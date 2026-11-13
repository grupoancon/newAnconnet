import {
  ChevronRight,
  FileText,
  ShieldCheck,
  ShieldEllipsis,
  Tag,
  Users,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { PageHeader } from "@/components/shared/page-header"
import { getCurrentUser } from "@/lib/auth/session"

const SECCIONES = [
  {
    titulo: "Convenios",
    descripcion: "Plantillas de contrato, variables y su asignación a proyectos o lotes.",
    href: "/configuracion/convenios",
    icon: FileText,
  },
  {
    titulo: "Representantes de la empresa",
    descripcion: "Personas que firman por la empresa en los convenios.",
    href: "/configuracion/convenios/representantes",
    icon: Users,
  },
  {
    titulo: "Promociones",
    descripcion: "Promociones aplicables en cotizaciones y financiamientos.",
    href: "/configuracion/promociones",
    icon: Tag,
  },
  {
    titulo: "Usuarios",
    descripcion: "Cuentas, roles asignados, permisos puntuales y sesiones.",
    href: "/admin/usuarios",
    icon: ShieldEllipsis,
  },
  {
    titulo: "Roles y permisos",
    descripcion: "Crea roles y define qué puede hacer cada uno.",
    href: "/admin/roles",
    icon: ShieldCheck,
  },
  {
    titulo: "Mantenimiento",
    descripcion: "Aviso de mantenimiento o bloqueo de la intranet.",
    href: "/configuracion/mantenimiento",
    icon: Wrench,
  },
]

export default async function ConfiguracionPage() {
  // El middleware ya filtro por rol a nivel de ruta; esta verificacion server-side
  // es la que realmente autoriza el contenido de la pagina.
  const usuario = await getCurrentUser()

  if (!usuario || !usuario.roles.includes("Administrador")) {
    redirect("/")
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader eyebrow="Administración" title="Configuración" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {SECCIONES.map(({ titulo, descripcion, href, icon: Icono }) => (
            <Link
              key={href}
              href={href}
              className="bg-card border-border hover:bg-muted/60 group flex items-start gap-3.5 rounded-lg border p-4 transition-colors"
            >
              <span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
                <Icono className="size-[18px]" strokeWidth={1.7} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{titulo}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {descripcion}
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.8}
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
