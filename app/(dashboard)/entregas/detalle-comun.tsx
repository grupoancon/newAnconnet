"use client"

import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { type EstadoPaso, type ItemEntrega } from "@/lib/api/entregas-api"
import { cn } from "@/lib/utils"

// Piezas compartidas por el panel de detalle y la pagina de cierre.

export const ESTADO_VARIANTE: Record<
  EstadoPaso,
  { variant: StatusVariant; label: string }
> = {
  COMPLETO: { variant: "aprobado", label: "Completo" },
  PENDIENTE: { variant: "pronto", label: "Pendiente" },
  OBSERVACION: { variant: "rechazado", label: "Observación" },
}

export function formatearFecha(valor: string | null, hora?: string | null): string {
  if (!valor) return "Sin fecha"
  const [anio, mes, dia] = valor.split("-")
  return `${dia}/${mes}/${anio}${hora ? ` · ${hora}` : ""}`
}

export function Dato({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[11px] font-semibold uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-semibold break-words">{children || "—"}</dd>
    </div>
  )
}

export function Seccion({
  titulo,
  estado,
  acciones,
  children,
}: {
  titulo: string
  estado?: React.ReactNode
  acciones?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-border rounded-lg border">
      <div className="border-border bg-muted/40 flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[14px] font-extrabold">{titulo}</h2>
          {estado}
        </div>
        {acciones}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// Resultados del checklist en colores, con el motivo de cada punto si lo tiene.
export function ChecklistLista({
  puntos,
  items,
  motivos,
}: {
  // Puntos a listar: los de la pre-entrega o los (mas largos) de la entrega.
  puntos: readonly { id: ItemEntrega; label: string }[]
  items: Partial<Record<ItemEntrega, string>>
  motivos?: Partial<Record<ItemEntrega, string>>
}) {
  return (
    <ul className="divide-border divide-y">
      {puntos.map((item) => {
        const valor = items[item.id]
        return (
          <li key={item.id} className="py-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{item.label}</span>
              <span
                className={cn(
                  "min-w-9 rounded-md px-2 py-0.5 text-center text-xs font-bold",
                  valor === "SI" && "bg-status-disponible-bg text-status-disponible-fg",
                  valor === "NO" && "bg-status-bloqueado-bg text-status-bloqueado-fg",
                  valor === "PD" && "bg-status-reservado-bg text-status-reservado-fg",
                  valor === "NA" && "bg-muted text-muted-foreground"
                )}
              >
                {valor ?? "—"}
              </span>
            </div>
            {motivos?.[item.id] ? (
              <p className="text-muted-foreground mt-1 text-[12px]">
                Motivo: {motivos[item.id]}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

// Paso aun sin registrar: se muestra como pendiente en vez de una seccion vacia.
export function SinRegistrar({ texto }: { texto: string }) {
  return <p className="text-muted-foreground text-[13px]">{texto}</p>
}

export function EstadoBadge({ estado }: { estado: EstadoPaso }) {
  return (
    <StatusBadge variant={ESTADO_VARIANTE[estado].variant}>
      {ESTADO_VARIANTE[estado].label}
    </StatusBadge>
  )
}
