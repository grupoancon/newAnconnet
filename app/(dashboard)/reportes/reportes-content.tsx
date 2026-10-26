"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "@/lib/navigation"
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Landmark,
  PieChart,
  Settings2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"

import { ReporteVentasContent } from "../ventas/reporte/reporte-ventas-content"
import { listarMisReportes } from "@/lib/api/reportes-api"

import { ReporteAdministrativo } from "./reporte-administrativo"
import { ReporteDepositos } from "./reporte-depositos"
import { ReporteDinamico } from "./reporte-dinamico"

type ReporteVisible = { id: string; titulo: string; descripcion: string }

// id del catálogo (lib/reportes/catalogo.ts) -> componente. El componente se monta (y
// por tanto pide sus datos) solo cuando el usuario abre la tarjeta, no antes. Si un id
// del catálogo no está aquí, se muestra como "no disponible" en vez de romper la página.
const COMPONENTES: Record<string, React.ComponentType> = {
  ventas: () => <ReporteVentasContent embebido />,
  administrativo: ReporteAdministrativo,
  depositos: ReporteDepositos,
}

const ICONOS: Record<string, LucideIcon> = {
  ventas: TrendingUp,
  administrativo: BarChart3,
  depositos: Landmark,
}

// Los reportes del constructor se identifican como "d:<slug>" para no chocar con los
// ids de los reportes programados en código.
const PREFIJO_DINAMICO = "d:"

export function ReportesContent({
  reportes: reportesCodigo,
  inicial,
  puedeAdministrar = false,
}: {
  reportes: ReporteVisible[]
  inicial?: string
  puedeAdministrar?: boolean
}) {
  const router = useRouter()
  const [dinamicos, setDinamicos] = useState<ReporteVisible[]>([])
  const [cargandoDinamicos, setCargandoDinamicos] = useState(true)

  // Cards de los reportes creados desde el constructor: el backend ya filtra por el
  // permiso reportes:<slug> de este usuario.
  useEffect(() => {
    let cancelado = false
    listarMisReportes()
      .then((lista) => {
        if (cancelado) return
        setDinamicos(
          lista.map((r) => ({
            id: `${PREFIJO_DINAMICO}${r.slug}`,
            titulo: r.titulo,
            descripcion: r.descripcion || "Reporte personalizado.",
          }))
        )
      })
      .catch(() => {
        // Sin conexión o sin sesión de backend: se siguen mostrando los de código.
      })
      .finally(() => {
        if (!cancelado) setCargandoDinamicos(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const reportes = [...reportesCodigo, ...dinamicos]
  // null = vista de tarjetas. `?r=` permite abrir un reporte directo desde un enlace,
  // pero solo si el usuario lo tiene permitido (la lista ya viene filtrada del servidor).
  const [activo, setActivo] = useState<string | null>(
    reportes.some((reporte) => reporte.id === inicial) ? (inicial ?? null) : null
  )

  // Enlace directo a un reporte del constructor (?r=d:slug): se resuelve cuando ya
  // llegó la lista permitida; si el usuario no lo tiene, simplemente no se abre.
  useEffect(() => {
    if (activo === null && inicial?.startsWith(PREFIJO_DINAMICO)) {
      if (dinamicos.some((d) => d.id === inicial)) setActivo(inicial)
    }
  }, [dinamicos, inicial, activo])

  const reporte = reportes.find((item) => item.id === activo) ?? null
  const esDinamico = reporte?.id.startsWith(PREFIJO_DINAMICO) ?? false
  const Componente = reporte && !esDinamico ? COMPONENTES[reporte.id] : undefined

  function abrir(id: string | null) {
    setActivo(id)
    router.replace(id ? `/reportes?r=${encodeURIComponent(id)}` : "/reportes", {
      scroll: false,
    })
  }

  // Vista de un reporte abierto.
  if (reporte) {
    return (
      <div className="flex h-full flex-col">
        <div className="no-print">
          <DashboardTopbar />
        </div>

        <div className="no-print border-border bg-card flex items-center gap-3 border-b px-6.5 py-4">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Volver a reportes"
            onClick={() => abrir(null)}
          >
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{reporte.titulo}</h1>
            <p className="text-muted-foreground text-[13px]">{reporte.descripcion}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {esDinamico && reporte ? (
            <ReporteDinamico
              key={reporte.id}
              slug={reporte.id.slice(PREFIJO_DINAMICO.length)}
            />
          ) : Componente ? (
            <Componente />
          ) : (
            <p className="text-muted-foreground p-6.5 text-sm">
              Este reporte todavía no está disponible.
            </p>
          )}
        </div>
      </div>
    )
  }

  // Vista de tarjetas.
  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mb-1 text-2xl font-extrabold tracking-tight">Reportes</h1>
            <p className="text-muted-foreground text-[13.5px]">
              Selecciona un reporte para verlo. Aquí aparecen solo los que tienes
              habilitados.
            </p>
          </div>
          {puedeAdministrar && (
            <Button asChild variant="outline">
              <Link href="/reportes/administrar">
                <Settings2 /> Administrar reportes
              </Link>
            </Button>
          )}
        </div>

        {cargandoDinamicos && reportes.length === 0 ? null : reportes.length === 0 ? (
          <EmptyState
            dashed={false}
            className="py-17.5"
            title="No tienes reportes asignados"
            description="Solicita acceso al administrador para ver un reporte en específico."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {reportes.map((item) => {
              const Icono = ICONOS[item.id] ?? PieChart
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => abrir(item.id)}
                  className="bg-card border-border hover:border-primary group flex flex-col gap-4 rounded-lg border p-5 text-left transition-colors"
                >
                  <div className="bg-accent text-accent-foreground flex size-11 items-center justify-center rounded-lg">
                    <Icono className="size-5" strokeWidth={1.7} />
                  </div>
                  <div>
                    <h2 className="mb-1 text-base font-bold">{item.titulo}</h2>
                    <p className="text-muted-foreground text-[13px] leading-snug">
                      {item.descripcion}
                    </p>
                  </div>
                  <span className="text-primary mt-auto flex items-center gap-1 text-[12.5px] font-bold">
                    Ver reporte
                    <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
