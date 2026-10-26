"use client"

import { CheckSquare, Plus, Square } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RetiroFila = {
  fecha: string
  nombre: string
  lote: string
  valor: string
  estado: Extract<StatusVariant, "pendiente" | "aprobado">
  aprobar: boolean
  reporte: boolean
  credito: boolean
}

const RETIROS: RetiroFila[] = [
  {
    fecha: "1/7/2026",
    nombre: "Paucar Loya Jeanneth Elizabeth",
    lote: "G-M4-36",
    valor: "$6,114.39",
    estado: "pendiente",
    aprobar: true,
    reporte: false,
    credito: false,
  },
  {
    fecha: "1/7/2026",
    nombre: "Paucar Loya Genny Marlene",
    lote: "G-M4-26",
    valor: "$7,173.42",
    estado: "aprobado",
    aprobar: false,
    reporte: true,
    credito: false,
  },
  {
    fecha: "29/6/2026",
    nombre: "Luguaña Rivera Juan David",
    lote: "G-M2-50",
    valor: "$2,000.00",
    estado: "pendiente",
    aprobar: true,
    reporte: false,
    credito: false,
  },
  {
    fecha: "24/6/2026",
    nombre: "Santamaría Ortega Jasson Gabriel y otro",
    lote: "EJM2-27/28",
    valor: "$0.00",
    estado: "aprobado",
    aprobar: false,
    reporte: true,
    credito: false,
  },
]

function CheckIcon({ activo }: { activo: boolean }) {
  return activo ? (
    <CheckSquare className="text-primary size-[17px]" strokeWidth={1.7} />
  ) : (
    <Square className="text-border size-[17px]" strokeWidth={1.7} />
  )
}

export default function RetirosPage() {
  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="bg-brand-gradient-banner flex flex-col items-center gap-4.5 px-8 py-6.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Retiros y liquidaciones
        </h1>
        <div className="flex gap-3">
          <Button className="border border-white/40 bg-white/16 backdrop-blur-sm hover:bg-white/24">
            <Plus className="size-3.5" strokeWidth={2} />
            Nuevo retiro
          </Button>
          <Button
            variant="ghost"
            className="border border-white/50 text-white hover:bg-white/10"
          >
            Volver atrás
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border">
          <div className="border-border border-b px-5.5 py-4">
            <h2 className="text-[17px] font-extrabold">Retiros existentes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 border-collapse text-sm">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                  <th className="px-5.5 py-2.75 text-left">FECHA</th>
                  <th className="px-5.5 py-2.75 text-left">NOMBRE</th>
                  <th className="px-5.5 py-2.75 text-left">LOTE</th>
                  <th className="px-5.5 py-2.75 text-left">VALOR A DEVOLVER</th>
                  <th className="px-5.5 py-2.75 text-left">ESTADO</th>
                  <th className="px-5.5 py-2.75">APROBAR</th>
                  <th className="px-5.5 py-2.75">REPORTE</th>
                  <th className="px-5.5 py-2.75">N. CRÉDITO</th>
                </tr>
              </thead>
              <tbody>
                {RETIROS.map((fila, index) => (
                  <tr
                    key={fila.lote}
                    className={cn(
                      "hover:bg-muted/60 transition-colors",
                      index < RETIROS.length - 1 && "border-border border-b"
                    )}
                  >
                    <td className="text-muted-foreground px-5.5 py-3.5 font-mono text-xs">
                      {fila.fecha}
                    </td>
                    <td className="px-5.5 py-3.5 font-bold whitespace-nowrap">
                      {fila.nombre}
                    </td>
                    <td className="px-5.5 py-3.5 font-mono font-semibold">{fila.lote}</td>
                    <td className="px-5.5 py-3.5 font-mono">{fila.valor}</td>
                    <td className="px-5.5 py-3.5">
                      <StatusBadge variant={fila.estado} />
                    </td>
                    <td className="px-5.5 py-3.5 text-center">
                      <CheckIcon activo={fila.aprobar} />
                    </td>
                    <td className="px-5.5 py-3.5 text-center">
                      <CheckIcon activo={fila.reporte} />
                    </td>
                    <td className="px-5.5 py-3.5 text-center">
                      <CheckIcon activo={fila.credito} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
