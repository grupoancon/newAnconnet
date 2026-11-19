"use client"

import { useEffect, useState } from "react"
import { Activity, CalendarDays, KeyRound, LogOut, RefreshCw, Smartphone, Users } from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterSearchInput } from "@/components/shared/filter-bar"
import { KpiCard } from "@/components/shared/kpi-card"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  cerrarSesionApp,
  listarSesiones,
  obtenerResumenSesiones,
  SesionesApiError,
} from "@/lib/api/app-sesiones-api"

import {
  describirCierre,
  haceCuanto,
  METODOS,
  POR_PAGINA,
  type Conteo,
  type ListaSesiones,
  type ResumenSesiones,
  type SesionApp,
} from "./datos"

const ACTUALIZAR_CADA_MS = 60_000

function mensajeDeError(err: unknown): string {
  return err instanceof SesionesApiError ? err.message : "No se pudo conectar con el servidor"
}

export function SesionesContent() {
  const toast = useToast()
  const [resumen, setResumen] = useState<ResumenSesiones | null>(null)
  const [errorResumen, setErrorResumen] = useState<string | null>(null)
  const [lista, setLista] = useState<ListaSesiones | null>(null)
  const [errorLista, setErrorLista] = useState<string | null>(null)
  const [buscar, setBuscar] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [pagina, setPagina] = useState(1)
  const [recarga, setRecarga] = useState(0)
  const [porCerrar, setPorCerrar] = useState<SesionApp | null>(null)

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusqueda(buscar)
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [buscar])

  // El resumen se refresca solo cada minuto.
  useEffect(() => {
    let vigente = true
    const cargar = () =>
      obtenerResumenSesiones()
        .then((r) => {
          if (!vigente) return
          setResumen(r)
          setErrorResumen(null)
        })
        .catch((err) => vigente && setErrorResumen(mensajeDeError(err)))
    void cargar()
    const id = setInterval(cargar, ACTUALIZAR_CADA_MS)
    return () => {
      vigente = false
      clearInterval(id)
    }
  }, [recarga])

  useEffect(() => {
    let vigente = true
    setErrorLista(null)
    listarSesiones(busqueda, pagina)
      .then((l) => vigente && setLista(l))
      .catch((err) => vigente && setErrorLista(mensajeDeError(err)))
    return () => {
      vigente = false
    }
  }, [busqueda, pagina, recarga])

  async function confirmarCerrar() {
    if (!porCerrar) return
    try {
      await cerrarSesionApp(porCerrar.sessionId)
      toast({
        variant: "success",
        description: "Sesión cerrada. El cliente verá el aviso la próxima vez que use la app.",
      })
      setRecarga((n) => n + 1)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setPorCerrar(null)
    }
  }

  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / POR_PAGINA)) : 1

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="App · Sesiones"
            title="Sesiones y usuarios activos"
            actions={
              <Button variant="outline" onClick={() => setRecarga((n) => n + 1)}>
                <RefreshCw className="size-4" strokeWidth={1.8} />
                Actualizar
              </Button>
            }
          />

          {errorResumen && !resumen ? (
            <EmptyState title="No se pudo cargar el resumen" description={errorResumen} />
          ) : !resumen ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                  label="Activos ahora"
                  value={resumen.activosAhora}
                  trendLabel={`Dispositivos con actividad en los últimos ${resumen.ventanaActivosMinutos} min`}
                  icon={<Activity className="size-4" strokeWidth={1.8} />}
                />
                <KpiCard
                  label="Usaron la app hoy"
                  value={resumen.usuariosHoy}
                  trendLabel={`${resumen.dispositivosHoy} ${resumen.dispositivosHoy === 1 ? "dispositivo" : "dispositivos"}`}
                  icon={<CalendarDays className="size-4" strokeWidth={1.8} />}
                />
                <KpiCard
                  label="Últimos 7 días"
                  value={resumen.usuarios7d}
                  trendLabel="Clientes distintos"
                  icon={<Users className="size-4" strokeWidth={1.8} />}
                />
                <KpiCard
                  label="Sesiones abiertas"
                  value={resumen.sesionesAbiertas}
                  trendLabel={`De ${resumen.usuariosConSesion} ${resumen.usuariosConSesion === 1 ? "cliente" : "clientes"}`}
                  icon={<KeyRound className="size-4" strokeWidth={1.8} />}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <Desglose titulo="Plataforma (7 días)" filas={resumen.plataformas} />
                <Desglose titulo="Versión de la app (7 días)" filas={resumen.versiones} />
                <Desglose
                  titulo="Cierres y bloqueos (7 días)"
                  filas={resumen.cierres7d.map((c) => ({
                    nombre: describirCierre(c.evento, c.motivo),
                    total: c.total,
                  }))}
                  vacio="Aún no hay datos: los envían las versiones de la app que incluyen este registro."
                />
              </div>
              <p className="text-muted-foreground text-[11.5px]">
                La actividad sale de la telemetría de la app (solo versiones de producción instaladas en un
                teléfono). Se actualiza cada minuto.
              </p>
            </div>
          )}
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
            <div>
              <p className="text-[14px] font-semibold">Sesiones abiertas</p>
              <p className="text-muted-foreground text-[12px]">
                Una por teléfono donde el cliente inició sesión. Vencen tras 30 días sin usar la app.
              </p>
            </div>
            <FilterSearchInput placeholder="Buscar por nombre, cédula o dispositivo" value={buscar} onChange={setBuscar} />
          </div>

          {errorLista ? (
            <EmptyState title="No se pudieron cargar las sesiones" description={errorLista} />
          ) : !lista ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : lista.sesiones.length === 0 ? (
            <EmptyState
              title={busqueda ? "Sin resultados" : "No hay sesiones abiertas"}
              description={busqueda ? "Prueba con otro nombre o cédula." : "Aparecen aquí cuando un cliente inicia sesión."}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead className="text-muted-foreground border-border border-b text-[11.5px] font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 sm:px-6">Cliente</th>
                      <th className="px-3 py-2.5">Dispositivo</th>
                      <th className="px-3 py-2.5">Entró con</th>
                      <th className="px-3 py-2.5">Último uso</th>
                      <th className="px-3 py-2.5">Inició sesión</th>
                      <th className="px-4 py-2.5 sm:px-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {lista.sesiones.map((s) => (
                      <tr key={s.sessionId}>
                        <td className="px-4 py-3 sm:px-6">
                          <p className="font-semibold">{s.usuario.nombre ?? "Sin nombre"}</p>
                          <p className="text-muted-foreground text-[12px]">{s.usuario.cedula ?? s.usuario.email ?? "—"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Smartphone className="text-muted-foreground size-4 shrink-0" strokeWidth={1.7} />
                            <div className="min-w-0">
                              <p className="truncate">{s.dispositivo ?? "Desconocido"}</p>
                              <p className="text-muted-foreground text-[12px]">
                                {[s.sistema, s.ip].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">{s.metodo ? (METODOS[s.metodo] ?? s.metodo) : "—"}</td>
                        <td className="px-3 py-3" title={s.ultimoUso ?? undefined}>
                          {haceCuanto(s.ultimoUso)}
                        </td>
                        <td className="text-muted-foreground px-3 py-3">
                          {new Date(s.iniciada).toLocaleString("es-EC", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right sm:px-6">
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setPorCerrar(s)}>
                            <LogOut className="size-3.5" strokeWidth={1.8} />
                            Cerrar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
                <p className="text-muted-foreground text-[12px]">
                  {lista.total} {lista.total === 1 ? "sesión" : "sesiones"}
                </p>
                {totalPaginas > 1 ? (
                  <Pagination page={pagina} totalPages={totalPaginas} onPageChange={setPagina} />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        abierto={porCerrar !== null}
        titulo="¿Cerrar esta sesión?"
        descripcion={`${porCerrar?.usuario.nombre ?? "El cliente"} tendrá que volver a iniciar sesión en ${porCerrar?.dispositivo ?? "ese dispositivo"}. Sus otras sesiones siguen abiertas.`}
        textoConfirmar="Cerrar sesión"
        destructivo
        onConfirmar={confirmarCerrar}
        onCancelar={() => setPorCerrar(null)}
      />
    </div>
  )
}

function Desglose({ titulo, filas, vacio = "Sin datos todavía." }: { titulo: string; filas: Conteo[]; vacio?: string }) {
  const max = Math.max(1, ...filas.map((f) => f.total))
  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground mb-3 text-[11.5px] font-semibold">{titulo}</p>
      {filas.length === 0 ? (
        <p className="text-muted-foreground text-[12px]">{vacio}</p>
      ) : (
        <ul className="space-y-2">
          {filas.map((f) => (
            <li key={f.nombre}>
              <div className="mb-1 flex justify-between gap-3 text-[12.5px]">
                <span className="truncate">{f.nombre}</span>
                <span className="font-semibold tabular-nums">{f.total}</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${(f.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
