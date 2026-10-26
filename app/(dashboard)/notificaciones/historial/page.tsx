"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Ban,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  notificacionesApi,
  type EntregaResp,
  type EnvioFila,
  type Notificacion,
} from "@/lib/api/notificaciones-api"

const ESTADO_STYLE: Record<string, string> = {
  programada: "bg-status-reservado-bg text-status-reservado-fg",
  enviada: "bg-status-disponible-bg text-status-disponible-fg",
  parcial: "bg-status-hipotecado-bg text-status-hipotecado-fg",
  fallo: "bg-status-bloqueado-bg text-status-bloqueado-fg",
  cancelada: "bg-muted text-muted-foreground",
  vencida: "bg-muted text-muted-foreground",
  resuelto: "bg-muted text-muted-foreground",
}

function fmt(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function HistorialPage() {
  const [rows, setRows] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [tipo, setTipo] = useState("")
  const [estado, setEstado] = useState("")
  const [q, setQ] = useState("")

  const [sel, setSel] = useState<Notificacion | null>(null)
  const [sends, setSends] = useState<EnvioFila[]>([])
  const [entrega, setEntrega] = useState<EntregaResp | null>(null)
  const [detalleLoading, setDetalleLoading] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await notificacionesApi.historial({
        page,
        tipo: tipo || undefined,
        estado: estado || undefined,
        q: q || undefined,
      })
      setRows(r.data)
      setPages(r.pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [page, tipo, estado, q])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function abrirDetalle(n: Notificacion) {
    setSel(n)
    setSends([])
    setEntrega(null)
    setDetalleLoading(true)
    try {
      const [d, e] = await Promise.all([
        notificacionesApi.detalle(n.id),
        notificacionesApi.entrega(n.id).catch(() => null),
      ])
      setSends(d?.sends ?? [])
      setEntrega(e)
    } finally {
      setDetalleLoading(false)
    }
  }

  async function accion(fn: () => Promise<unknown>) {
    try {
      await fn()
      await cargar()
      setSel(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error")
    }
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-extrabold tracking-tight">
              Historial de notificaciones
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cargar}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" asChild>
                <Link href="/notificaciones">
                  <Plus className="h-4 w-4" /> Nueva
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Buscar título o mensaje…"
              value={q}
              onChange={(e) => {
                setPage(1)
                setQ(e.target.value)
              }}
            />
            <Select
              value={tipo || "all"}
              onValueChange={(v) => {
                setPage(1)
                setTipo(v === "all" ? "" : v)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="segmentada">Segmentada</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={estado || "all"}
              onValueChange={(v) => {
                setPage(1)
                setEstado(v === "all" ? "" : v)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="programada">Programada</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="fallo">Fallo</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Título</th>
                  <th className="px-3 py-2 text-left font-medium">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Dest.</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-muted-foreground px-3 py-8 text-center"
                    >
                      Sin notificaciones
                    </td>
                  </tr>
                ) : (
                  rows.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() => abrirDetalle(n)}
                      className="hover:bg-muted/40 cursor-pointer border-t"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {fmt(n.fecha_envio ?? n.fecha_enviar)}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 font-medium">
                        {n.titulo}
                      </td>
                      <td className="px-3 py-2 capitalize">{n.tipo}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            ESTADO_STYLE[n.estado ?? ""] ?? "bg-muted"
                          }`}
                        >
                          {n.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {n.destinatarios ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground">
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>{sel.titulo}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-4 text-sm">
                <p className="text-muted-foreground">{sel.contenido}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="capitalize">{sel.tipo}</span>
                  <span className="text-muted-foreground">Estado</span>
                  <span>{sel.estado}</span>
                  <span className="text-muted-foreground">Programada</span>
                  <span>{fmt(sel.fecha_enviar)}</span>
                  <span className="text-muted-foreground">Enviada</span>
                  <span>{fmt(sel.fecha_envio)}</span>
                  {sel.url && (
                    <>
                      <span className="text-muted-foreground">Deep-link</span>
                      <span>{sel.url}</span>
                    </>
                  )}
                </div>

                {sel.estado === "programada" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        accion(() => notificacionesApi.enviarAhora(sel.id))
                      }
                    >
                      <Send className="h-4 w-4" /> Enviar ahora
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        accion(() => notificacionesApi.cancelar(sel.id))
                      }
                    >
                      <Ban className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                )}

                {detalleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <div>
                      <p className="mb-1.5 font-semibold">
                        Estado de entrega (Novu)
                      </p>
                      {entrega?.available ? (
                        <ul className="space-y-1 text-xs">
                          {entrega.jobs.map((j, i) => (
                            <li key={i} className="flex justify-between">
                              <span className="capitalize">{j.channel}</span>
                              <span
                                className={
                                  j.status === "completed"
                                    ? "text-status-disponible-fg"
                                    : "text-status-bloqueado-fg"
                                }
                              >
                                {j.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Sin datos (el plan Free de Novu retiene solo 24h).
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1.5 font-semibold">
                        Destinatarios ({sends.length})
                      </p>
                      <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                        {sends.map((s) => (
                          <li
                            key={s.id}
                            className="flex justify-between border-b py-1"
                          >
                            <span>{s.user_id === "*" ? "Todos" : s.user_id}</span>
                            <span className="text-muted-foreground">
                              {fmt(s.sent_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
