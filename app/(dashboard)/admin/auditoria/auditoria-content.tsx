"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { TextField } from "@/components/shared/text-field"
import { Button } from "@/components/ui/button"
import {
  AuditoriaApiError,
  listarAuditoria,
  obtenerCatalogosAuditoria,
  type CatalogosAuditoria,
  type EventoAuditoriaResumen,
  type FiltrosAuditoria,
} from "@/lib/api/auditoria-api"
import { cn } from "@/lib/utils"

import { EventoDetalleSheet } from "./evento-detalle-sheet"

const PAGE_SIZE = 25
const TODOS = "Todos"

const ESTADOS = [TODOS, "Exitoso", "Fallido"]
const SEVERIDADES = [TODOS, "info", "warning", "critical"]
const METODOS = [TODOS, "POST", "PUT", "PATCH", "DELETE", "GET"]

function formatearFechaHora(valor: string): string {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return "—"
  return fecha.toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function AuditoriaContent() {
  const [catalogos, setCatalogos] = useState<CatalogosAuditoria | null>(null)

  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [actor, setActor] = useState("")
  const [texto, setTexto] = useState("")
  const [accion, setAccion] = useState(TODOS)
  const [entidad, setEntidad] = useState(TODOS)
  const [fuente, setFuente] = useState(TODOS)
  const [estado, setEstado] = useState(TODOS)
  const [severidad, setSeveridad] = useState(TODOS)
  const [metodo, setMetodo] = useState(TODOS)
  const [page, setPage] = useState(1)

  // Los campos de texto se aplican con retraso para no consultar en cada tecla.
  const [actorAplicado, setActorAplicado] = useState("")
  const [textoAplicado, setTextoAplicado] = useState("")

  const [items, setItems] = useState<EventoAuditoriaResumen[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccionado, setSeleccionado] = useState<string | null>(null)

  useEffect(() => {
    obtenerCatalogosAuditoria()
      .then(setCatalogos)
      .catch(() => setCatalogos({ acciones: [], entidades: [], fuentes: [] }))
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      setActorAplicado(actor)
      setTextoAplicado(texto)
      setPage(1)
    }, 400)
    return () => clearTimeout(id)
  }, [actor, texto])

  const cargar = useCallback(async () => {
    const filtros: FiltrosAuditoria = {
      page,
      pageSize: PAGE_SIZE,
      desde: desde ? new Date(`${desde}T00:00:00`).toISOString() : undefined,
      hasta: hasta ? new Date(`${hasta}T23:59:59.999`).toISOString() : undefined,
      actor: actorAplicado || undefined,
      q: textoAplicado || undefined,
      accion: accion === TODOS ? undefined : accion,
      entidad: entidad === TODOS ? undefined : entidad,
      fuente: fuente === TODOS ? undefined : fuente,
      estado: estado === TODOS ? undefined : estado === "Exitoso" ? "success" : "failure",
      severidad: severidad === TODOS ? undefined : severidad,
      metodo: metodo === TODOS ? undefined : metodo,
    }

    setCargando(true)
    try {
      const respuesta = await listarAuditoria(filtros)
      setItems(respuesta.items)
      setTotal(respuesta.total)
      setError(null)
    } catch (err) {
      setError(
        err instanceof AuditoriaApiError ? err.message : "No se pudo cargar la auditoría."
      )
    } finally {
      setCargando(false)
    }
  }, [
    page,
    desde,
    hasta,
    actorAplicado,
    textoAplicado,
    accion,
    entidad,
    fuente,
    estado,
    severidad,
    metodo,
  ])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Cambiar cualquier filtro vuelve a la primera página.
  function conFiltro<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor)
      setPage(1)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    // data-audit-ignore: los clics de este visor no se auditan — cada filtro generaría
    // un evento nuevo que aparecería en la propia lista que se está consultando.
    <div className="flex h-full flex-col" data-audit-ignore>
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Admin · Auditoría"
            title="Auditoría"
            actions={
              <Button type="button" variant="outline" onClick={() => void cargar()}>
                <RefreshCw /> Actualizar
              </Button>
            }
          />

          <div className="bg-muted/60 border-border grid grid-cols-1 gap-3 border-b px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="DESDE"
              type="date"
              value={desde}
              onChange={conFiltro(setDesde)}
            />
            <TextField
              label="HASTA"
              type="date"
              value={hasta}
              onChange={conFiltro(setHasta)}
            />
            <TextField
              label="USUARIO"
              placeholder="Nombre, correo o id"
              value={actor}
              onChange={setActor}
            />
            <TextField
              label="BUSCAR"
              placeholder="Descripción o ruta"
              value={texto}
              onChange={setTexto}
            />
            <SelectField
              label="ACCIÓN"
              placeholder={TODOS}
              options={[TODOS, ...(catalogos?.acciones ?? [])]}
              value={accion}
              onValueChange={conFiltro(setAccion)}
            />
            <SelectField
              label="ENTIDAD"
              placeholder={TODOS}
              options={[TODOS, ...(catalogos?.entidades ?? [])]}
              value={entidad}
              onValueChange={conFiltro(setEntidad)}
            />
            <SelectField
              label="ORIGEN"
              placeholder={TODOS}
              options={[TODOS, ...(catalogos?.fuentes ?? [])]}
              value={fuente}
              onValueChange={conFiltro(setFuente)}
            />
            <SelectField
              label="MÉTODO HTTP"
              placeholder={TODOS}
              options={METODOS}
              value={metodo}
              onValueChange={conFiltro(setMetodo)}
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="ESTADO"
                placeholder={TODOS}
                options={ESTADOS}
                value={estado}
                onValueChange={conFiltro(setEstado)}
              />
              <SelectField
                label="SEVERIDAD"
                placeholder={TODOS}
                options={SEVERIDADES}
                value={severidad}
                onValueChange={conFiltro(setSeveridad)}
              />
            </div>
          </div>

          {cargando && items.length === 0 ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <EmptyState
              dashed={false}
              className="m-6"
              title="Error"
              description={error}
            />
          ) : items.length === 0 ? (
            <EmptyState
              dashed={false}
              className="m-6"
              title="Sin eventos"
              description="No hay registros con esos filtros."
            />
          ) : (
            <div className="overflow-x-auto">
              <div className={cn("min-w-[980px]", cargando && "opacity-60")}>
                <div className="text-muted-foreground border-border grid grid-cols-[170px_1.3fr_130px_130px_2.2fr_110px_100px] border-b px-6.5 py-3 text-[11px] font-bold">
                  <span>FECHA</span>
                  <span>USUARIO</span>
                  <span>ACCIÓN</span>
                  <span>ENTIDAD</span>
                  <span>DETALLE</span>
                  <span>ORIGEN</span>
                  <span>ESTADO</span>
                </div>

                {items.map((item, indice) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSeleccionado(item.id)}
                    className={cn(
                      "hover:bg-muted/60 grid w-full grid-cols-[170px_1.3fr_130px_130px_2.2fr_110px_100px] items-center px-6.5 py-3 text-left text-[12.5px] transition-colors",
                      indice < items.length - 1 && "border-border border-b"
                    )}
                  >
                    <span className="text-muted-foreground font-mono text-[11.5px]">
                      {formatearFechaHora(item.occurredAt)}
                    </span>
                    <span className="min-w-0 pr-3">
                      <span className="block truncate font-semibold">
                        {item.actorName || item.actorEmail || "Sin identificar"}
                      </span>
                      {item.actorRole && (
                        <span className="text-muted-foreground block truncate text-[11px]">
                          {item.actorRole}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold">
                      {item.accion}
                    </span>
                    <span className="text-muted-foreground truncate pr-3">
                      {item.entidad}
                    </span>
                    <span className="min-w-0 truncate pr-3">
                      {item.descripcion || item.entityId}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {item.fuente ?? "—"}
                    </span>
                    <span>
                      <StatusBadge
                        variant={item.estado === "success" ? "aprobado" : "rechazado"}
                      >
                        {item.estado === "success" ? "Exitoso" : "Fallido"}
                      </StatusBadge>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3.5">
            <span className="text-muted-foreground text-[12.5px]">
              {total.toLocaleString("es-EC")} evento{total === 1 ? "" : "s"}
            </span>
            <Pagination
              page={Math.min(page, totalPaginas)}
              totalPages={Math.min(totalPaginas, 10)}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      <EventoDetalleSheet id={seleccionado} onCerrar={() => setSeleccionado(null)} />
    </div>
  )
}
