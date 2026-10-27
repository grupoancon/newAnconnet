"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CloudCheck, CloudDownload, CloudOff } from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar, FilterSearchInput } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { PillTabs } from "@/components/shared/pill-tabs"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InventarioApiError,
  listarInventario,
  listarProyectos,
  type LoteInventario,
  type ProyectoInventario,
} from "@/lib/api/inventario-api"
import {
  listarPlanosCacheados,
  respaldarPlanos,
  type ProgresoRespaldo,
} from "@/lib/plano-cache"
import { CatalogoDetalladaView } from "./catalogo-detallada-view"
import { CatalogoLoteDetalleSheet } from "./catalogo-lote-detalle-sheet"
import { CatalogoPlanosView } from "./catalogo-planos-view"
import { CatalogoSimpleView } from "./catalogo-simple-view"

type VistaPrincipal = "simple" | "planos" | "detallada"

const VISTAS_PRINCIPALES: { id: VistaPrincipal; label: string }[] = [
  { id: "simple", label: "Simple" },
  { id: "planos", label: "Planos" },
  { id: "detallada", label: "Detallada" },
]

// Catálogo de solo lectura pensado para que un asesor busque qué lote ofrecer, con 3
// formas de verlo: Simple (grilla de lotes LIBRES por proyecto — click abre la ficha
// detallada de ese lote, ver CatalogoLoteDetalleSheet), Planos (imagen del plano con
// los marcadores ya ubicados) y Detallada (tabla de precios/cuotas sin reservados ni
// hipotecados, estilo lista de referencia). Las 3 comparten los mismos datos (traídos acá
// una sola vez) — el filtro de proyecto/búsqueda es común a Simple y Detallada; Planos
// elige un solo proyecto a la vez porque un plano es por definición de un solo proyecto.
export function InventarioCatalogoContent() {
  const [lotes, setLotes] = useState<LoteInventario[] | null>(null)
  const [proyectos, setProyectos] = useState<ProyectoInventario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [proyectoId, setProyectoId] = useState("todos")
  // Filtro de presupuesto — vacío = sin límite en ese extremo. Poner el mismo valor en
  // los dos (ej. 29500-29500) sirve para buscar un precio exacto, no hace falta un modo
  // aparte para eso.
  const [precioDesde, setPrecioDesde] = useState("")
  const [precioHasta, setPrecioHasta] = useState("")
  const [vistaPrincipal, setVistaPrincipal] = useState<VistaPrincipal>("simple")
  const [loteSeleccionado, setLoteSeleccionado] = useState<LoteInventario | null>(null)
  // Solo true cuando se está mostrando el respaldo guardado en IndexedDB porque la
  // carga online falló — ver listarPlanosCacheados. Cubre únicamente los proyectos que
  // ESTE navegador ya vio antes con conexión (en Planos o en el editor de mapeo); no es
  // un caché compartido entre dispositivos.
  const [modoOffline, setModoOffline] = useState(false)
  const [respaldo, setRespaldo] = useState<ProgresoRespaldo | null>(null)
  const toast = useToast()
  const objectUrlsRef = useRef<string[]>([])

  useEffect(() => {
    setCargando(true)
    setError(null)
    setModoOffline(false)
    Promise.all([listarInventario(), listarProyectos()])
      .then(([lotesRes, proyectosRes]) => {
        setLotes(lotesRes)
        setProyectos(proyectosRes)
        // Sin await: el respaldo offline no debe demorar la pantalla. El progreso se
        // muestra en un aviso para que el asesor sepa cuándo ya puede quedarse sin señal.
        void respaldarPlanos(proyectosRes, lotesRes, setRespaldo).then((final) => {
          // Toast solo si se bajó algo nuevo — si ya estaba todo guardado, el aviso fijo
          // alcanza y no se molesta en cada visita.
          if (final.descargados > 0 && final.fallidos === 0) {
            toast({
              variant: "success",
              description: "Planos listos para usar sin conexión.",
            })
          }
        })
      })
      .catch(async (err) => {
        const cacheados = await listarPlanosCacheados()
        if (cacheados.length > 0) {
          const urls: string[] = []
          const proyectosOffline = cacheados.map((c) => {
            const url = URL.createObjectURL(c.imagen)
            urls.push(url)
            return { ...c.proyecto, plano_url: url }
          })
          objectUrlsRef.current = urls
          setProyectos(proyectosOffline)
          setLotes(cacheados.flatMap((c) => c.lotes))
          setModoOffline(true)
          // Sin conexión lo que hay guardado son los planos — se abre directo ahí.
          setVistaPrincipal("planos")
        } else if (!navigator.onLine) {
          // Sin red y sin nada en IndexedDB: decir por qué, no un error genérico. En
          // iPhone el almacenamiento de Safari y el de la app instalada son distintos.
          setError(
            "No hay planos guardados en este dispositivo. Abre el inventario una vez con conexión desde esta misma app para tenerlos disponibles sin señal."
          )
        } else {
          setError(
            err instanceof InventarioApiError
              ? err.message
              : "No se pudo conectar con el servidor"
          )
        }
      })
      .finally(() => setCargando(false))
  }, [toast])

  // Los object URL de las imágenes cacheadas solo sirven mientras dure esta pestaña —
  // hay que liberarlos al salir de la pantalla para no dejar memoria reservada de más.
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  // El presupuesto se filtra acá aparte (no solo dentro de lotesFiltrados) porque
  // también se le pasa a Planos — esa vista no usa lotesFiltrados porque maneja su
  // propio selector de proyecto y su propio buscador de lote por código, pero el
  // presupuesto sí es un filtro transversal que debe limitar qué lotes se ven/buscan ahí.
  const lotesPorPresupuesto = useMemo(() => {
    if (!lotes) return []
    const desde = precioDesde.trim() ? Number(precioDesde) : null
    const hasta = precioHasta.trim() ? Number(precioHasta) : null
    if (desde == null && hasta == null) return lotes
    return lotes.filter((lote) => {
      const precio = Number(lote.pvp)
      return (
        (desde == null || (!isNaN(precio) && precio >= desde)) &&
        (hasta == null || (!isNaN(precio) && precio <= hasta))
      )
    })
  }, [lotes, precioDesde, precioHasta])

  const lotesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return lotesPorPresupuesto.filter((lote) => {
      const coincideProyecto =
        proyectoId === "todos" || String(lote.id_proyecto) === proyectoId
      const coincideBusqueda =
        !termino ||
        lote.codigo?.toLowerCase().includes(termino) ||
        lote.proyecto?.nombre?.toLowerCase().includes(termino)
      return coincideProyecto && coincideBusqueda
    })
  }, [lotesPorPresupuesto, busqueda, proyectoId])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader eyebrow="Ventas · Catálogo" title="Inventario" />

      <FilterBar className="flex-wrap gap-y-2.5">
        <PillTabs
          tabs={VISTAS_PRINCIPALES}
          value={vistaPrincipal}
          onChange={(id) => setVistaPrincipal(id as VistaPrincipal)}
        />

        {vistaPrincipal !== "planos" ? (
          <>
            <FilterSearchInput
              className="basis-full sm:basis-auto"
              placeholder="Buscar por lote o proyecto..."
              value={busqueda}
              onChange={setBusqueda}
            />
            <Select value={proyectoId} onValueChange={setProyectoId}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los proyectos</SelectItem>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}

        {/* Presupuesto del cliente — a diferencia del buscador/proyecto de arriba, este
        filtro va en las 3 vistas (también en Planos, que tiene su propio selector de
        proyecto y buscador de lote por código, pero igual debe respetar el presupuesto).
        Vacío en cualquiera de los dos = sin límite ahí; el mismo valor en los dos sirve
        para buscar un precio exacto (ej. 29500-29500), no hace falta un modo aparte. */}
        <div className="border-input bg-card flex h-[38px] w-full items-center gap-1.5 rounded-md border px-3 sm:w-auto">
          <span className="text-muted-foreground text-[12px] font-semibold">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Desde"
            value={precioDesde}
            onChange={(event) => setPrecioDesde(event.target.value)}
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[12.5px] outline-none sm:w-20 sm:flex-none"
          />
          <span className="text-muted-foreground text-[12px]">–</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="Hasta"
            value={precioHasta}
            onChange={(event) => setPrecioHasta(event.target.value)}
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[12.5px] outline-none sm:w-20 sm:flex-none"
          />
        </div>
      </FilterBar>

      <div className="flex-1 overflow-y-auto p-6.5">
        {modoOffline ? (
          <div className="bg-status-reservado-bg text-status-reservado-fg mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] font-semibold">
            <CloudOff className="size-4 shrink-0" strokeWidth={1.8} />
            Sin conexión — mostrando los planos guardados en este dispositivo (solo los
            que ya se vieron antes con señal). Puede faltar algún proyecto o estar
            desactualizado.
          </div>
        ) : respaldo && respaldo.total > 0 ? (
          <AvisoRespaldo respaldo={respaldo} />
        ) : null}

        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="No se pudo cargar el inventario"
            description={error}
            dashed
          />
        ) : vistaPrincipal === "simple" ? (
          <CatalogoSimpleView
            lotes={lotesFiltrados}
            onSeleccionarLote={setLoteSeleccionado}
          />
        ) : vistaPrincipal === "detallada" ? (
          <CatalogoDetalladaView lotes={lotesFiltrados} />
        ) : (
          <CatalogoPlanosView
            proyectos={proyectos}
            lotes={lotesPorPresupuesto}
            onSeleccionarLote={setLoteSeleccionado}
            modoOffline={modoOffline}
          />
        )}
      </div>

      <CatalogoLoteDetalleSheet
        lote={loteSeleccionado}
        onOpenChange={(open) => !open && setLoteSeleccionado(null)}
      />
    </div>
  )
}

// Aviso del respaldo offline de los planos (ver respaldarPlanos): mientras se guardan
// muestra el avance, y al terminar confirma cuántos quedaron disponibles sin conexión.
function AvisoRespaldo({ respaldo }: { respaldo: ProgresoRespaldo }) {
  const { total, hechos, fallidos } = respaldo
  const listos = hechos - fallidos

  if (hechos < total) {
    return (
      <div className="bg-muted text-muted-foreground mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] font-semibold">
        <CloudDownload className="size-4 shrink-0 animate-pulse" strokeWidth={1.8} />
        Guardando planos para usar sin conexión… {hechos} de {total}
      </div>
    )
  }

  if (fallidos > 0) {
    return (
      <div className="bg-status-reservado-bg text-status-reservado-fg mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] font-semibold">
        <CloudOff className="size-4 shrink-0" strokeWidth={1.8} />
        {listos} de {total} planos disponibles sin conexión — {fallidos} no se pudieron
        guardar. Vuelve a abrir el inventario con buena señal para reintentar.
      </div>
    )
  }

  return (
    <div className="bg-status-disponible-bg text-status-disponible-fg mb-4 flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] font-semibold">
      <CloudCheck className="size-4 shrink-0" strokeWidth={1.8} />
      {total === 1 ? "El plano está listo" : `Los ${total} planos están listos`} para usar
      sin conexión.
    </div>
  )
}
