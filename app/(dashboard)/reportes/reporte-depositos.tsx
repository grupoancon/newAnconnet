"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import {
  DepositosApiError,
  listarDepositos,
  type DepositoBackend,
} from "@/lib/api/depositos-api"

import {
  calcularEstadoDeposito,
  formatearFechaLarga,
  formatearMoneda,
  numeroReciboDeposito,
  type EstadoDeposito,
} from "../tesoreria/depositos/depositos-utils"

const TODOS = "Todos"
const ESTADOS = [TODOS, "Pendiente", "Aprobado", "Devuelto"]

const VARIANTE: Record<EstadoDeposito, StatusVariant> = {
  Pendiente: "pendiente",
  Aprobado: "aprobado",
  Devuelto: "rechazado",
}

function aNumero(valor: string | null): number {
  const n = parseFloat(valor ?? "0")
  return Number.isNaN(n) ? 0 : n
}

export function ReporteDepositos() {
  const [depositos, setDepositos] = useState<DepositoBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState(TODOS)
  const [busqueda, setBusqueda] = useState("")

  useEffect(() => {
    let cancelado = false
    listarDepositos()
      .then((data) => {
        if (!cancelado) setDepositos(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (cancelado) return
        setError(
          err instanceof DepositosApiError ? err.message : "No se pudo cargar el reporte."
        )
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const filas = useMemo(
    () =>
      depositos.map((deposito) => ({
        deposito,
        estado: calcularEstadoDeposito(deposito.lotes_relacionados),
      })),
    [depositos]
  )

  const resumen = useMemo(() => {
    const por = (e: EstadoDeposito) => filas.filter((f) => f.estado === e)
    const suma = (lista: typeof filas) =>
      lista.reduce((acc, f) => acc + aNumero(f.deposito.monto_pagado), 0)
    return {
      total: filas.length,
      pendientes: por("Pendiente").length,
      registrados: por("Aprobado").length,
      devueltos: por("Devuelto").length,
      montoRegistrado: suma(por("Aprobado")),
      montoPendiente: suma(por("Pendiente")),
    }
  }, [filas])

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return filas.filter(({ deposito, estado: e }) => {
      if (estado !== TODOS && e !== estado) return false
      if (!termino) return true
      return (
        (deposito.cliente_nombre ?? "").toLowerCase().includes(termino) ||
        numeroReciboDeposito(deposito).toLowerCase().includes(termino) ||
        deposito.lotes_relacionados.some((l) => l.lote?.toLowerCase().includes(termino))
      )
    })
  }, [filas, estado, busqueda])

  if (cargando) {
    return (
      <div className="flex justify-center py-17.5">
        <Spinner />
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-6.5">
        <EmptyState
          dashed={false}
          title="No se pudo cargar el reporte"
          description={error}
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6.5">
      <div className="mb-4.5 grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <KpiCard label="Depósitos" value={String(resumen.total)} />
        <KpiCard label="Pendientes" value={String(resumen.pendientes)} />
        <KpiCard label="Registrados" value={String(resumen.registrados)} />
        <KpiCard label="Devueltos" value={String(resumen.devueltos)} />
        <KpiCard
          label="Monto registrado"
          value={formatearMoneda(resumen.montoRegistrado)}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <SelectField
          label="ESTADO"
          placeholder={TODOS}
          options={ESTADOS}
          value={estado}
          onValueChange={setEstado}
        />
        <div className="sm:col-span-2">
          <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
            BUSCAR POR CLIENTE, LOTE O N° DE RECIBO
          </label>
          <div className="border-input bg-card flex h-11 items-center gap-2 rounded-md border px-3.5">
            <Search className="text-muted-foreground size-[15px]" strokeWidth={1.7} />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, EJ-21 o N° de recibo"
              className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {visibles.length === 0 ? (
        <EmptyState
          dashed={false}
          title="Sin depósitos"
          description="No hay depósitos con esos filtros."
        />
      ) : (
        <div className="bg-card border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead className="text-muted-foreground border-border border-b text-[11px]">
              <tr>
                <th className="px-4 py-3 font-bold">FECHA</th>
                <th className="px-4 py-3 font-bold">CLIENTE</th>
                <th className="px-4 py-3 font-bold">LOTES</th>
                <th className="px-4 py-3 font-bold">N° RECIBO</th>
                <th className="px-4 py-3 text-right font-bold">VALOR</th>
                <th className="px-4 py-3 font-bold">ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(({ deposito, estado: e }) => (
                <tr key={deposito.id} className="border-border border-b last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatearFechaLarga(deposito.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {deposito.cliente_nombre || deposito.idUser || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {deposito.lotes_relacionados.map((l) => l.lote).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">{numeroReciboDeposito(deposito)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatearMoneda(deposito.monto_pagado)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={VARIANTE[e]}>
                      {e === "Devuelto" ? "Devuelto" : e}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
