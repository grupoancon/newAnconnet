"use client"

import { useEffect, useRef, useState } from "react"
import { Check, MinusCircle, Pencil, Plus, Printer, Trash2, Upload, X } from "lucide-react"
import { useRouter, useSearchParams } from "@/lib/navigation"

import { Can } from "@/components/shared/can"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { VistaDocumento } from "@/components/shared/vista-documento"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  VentasApiError,
  eliminarTipoDocumento,
  listarDocumentosProceso,
  listarSolicitudesDocumento,
  listarVerificacionesDocumento,
  renombrarTipoDocumento,
  solicitarDocumento,
  subirDocumentoProceso,
  verificarDocumento,
  type DocumentoProcesoBackend,
  type DocumentoVerificacionBackend,
  type SolicitudDocumentoBackend,
} from "@/lib/api/ventas-api"
import { CATALOGO_DOCUMENTOS_PROCESO } from "@/lib/const/documentos-proceso"
import {
  calcularEstadoDocumento,
  etiquetaDesdeTipo,
  slugificarTipo,
  type EstadoDocumentoProceso,
} from "@/lib/validations/documentos-proceso"
import { cn } from "@/lib/utils"

const VARIANTE_ESTADO: Record<EstadoDocumentoProceso, StatusVariant> = {
  subido: "aprobado",
  no_aplica: "pronto",
  pendiente: "pendiente",
  solicitado: "solicitado",
}

const ETIQUETA_ESTADO: Record<EstadoDocumentoProceso, string> = {
  subido: "Subido",
  no_aplica: "No aplica",
  pendiente: "Pendiente",
  solicitado: "Solicitado",
}

// Abre el archivo en una pestaña nueva y dispara el dialogo de impresion del navegador
// apenas termina de cargar — funciona igual para imagenes y PDF, ya que ambos los abre
// el visor nativo del navegador (no hay que armar una vista de impresion aparte).
function imprimirDocumento(url: string) {
  const ventana = window.open(url, "_blank")
  if (!ventana) return
  ventana.addEventListener("load", () => {
    ventana.focus()
    ventana.print()
  })
}

function TarjetaDocumento({
  tipo,
  etiqueta,
  documento,
  solicitudes,
  verificado,
  ocupado,
  onSubir,
  onNoAplica,
  onSolicitar,
  onVerificar,
  onRenombrar,
  onEliminar,
}: {
  tipo: string
  etiqueta: string
  documento: DocumentoProcesoBackend | undefined
  solicitudes: SolicitudDocumentoBackend[]
  verificado: boolean
  ocupado: boolean
  onSubir: (archivo: File) => void
  onNoAplica: () => void
  onSolicitar: () => void
  onVerificar: () => void
  // Solo para tipos personalizados — los del catalogo no se renombran ni eliminan.
  onRenombrar?: (nuevaEtiqueta: string) => Promise<boolean>
  onEliminar?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editando, setEditando] = useState(false)
  const [nombreEditado, setNombreEditado] = useState(etiqueta)

  async function guardarNombre() {
    if (!onRenombrar) return
    if (await onRenombrar(nombreEditado)) setEditando(false)
  }
  const estado = calcularEstadoDocumento(tipo, documento ? [documento] : [], solicitudes)
  const solicitudPendiente = solicitudes.find(
    (s) => s.tipo === tipo && s.estado === "pendiente"
  )
  const puedeVerificar = Boolean(documento?.url) || Boolean(documento?.no_aplica)

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => {
          const archivo = event.target.files?.[0]
          event.target.value = ""
          if (archivo) onSubir(archivo)
        }}
      />
      <div className="p-2.5 pb-0">
        <VistaDocumento url={documento?.url ?? null} etiqueta={etiqueta} />
      </div>
      <div className="p-3">
        {editando ? (
          <div className="mb-1 flex items-center gap-1">
            <Input
              value={nombreEditado}
              onChange={(event) => setNombreEditado(event.target.value)}
              className="h-8 text-sm"
              autoFocus
              disabled={ocupado}
              onKeyDown={(event) => {
                if (event.key === "Enter") void guardarNombre()
                if (event.key === "Escape") setEditando(false)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Guardar nombre"
              disabled={ocupado || !nombreEditado.trim()}
              onClick={() => void guardarNombre()}
            >
              <Check className="size-4" strokeWidth={1.8} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Cancelar"
              disabled={ocupado}
              onClick={() => setEditando(false)}
            >
              <X className="size-4" strokeWidth={1.8} />
            </Button>
          </div>
        ) : (
          <div className="mb-1 flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{etiqueta}</p>
            {onRenombrar || onEliminar ? (
              <Can permiso="documentos:revisar">
                {onRenombrar ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label="Renombrar documento"
                    disabled={ocupado}
                    onClick={() => {
                      setNombreEditado(etiqueta)
                      setEditando(true)
                    }}
                  >
                    <Pencil className="size-3.5" strokeWidth={1.8} />
                  </Button>
                ) : null}
                {onEliminar ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-7 shrink-0"
                    aria-label="Eliminar documento"
                    disabled={ocupado}
                    onClick={onEliminar}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.8} />
                  </Button>
                ) : null}
              </Can>
            ) : null}
          </div>
        )}
        {verificado ? (
          <StatusBadge variant="aprobado">Verificado</StatusBadge>
        ) : (
          <StatusBadge variant={VARIANTE_ESTADO[estado]}>
            {ETIQUETA_ESTADO[estado]}
          </StatusBadge>
        )}
        {solicitudPendiente ? (
          <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
            Se solicitó este documento
            {solicitudPendiente.comentario ? `: "${solicitudPendiente.comentario}"` : "."}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {documento?.url ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => imprimirDocumento(documento.url!)}
            >
              <Printer className="size-3.5" strokeWidth={1.8} />
              Imprimir
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" strokeWidth={1.8} />
            {documento?.url ? "Reemplazar" : "Subir"}
          </Button>
        </div>
        {/* Acciones solo para quien tiene permiso de revisar documentacion — el asesor
            que subio el proceso solo puede subir/reemplazar arriba, nada mas. */}
        <Can permiso="documentos:revisar">
          <div className="border-border mt-2.5 flex flex-wrap gap-1.5 border-t pt-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ocupado}
              onClick={onNoAplica}
            >
              <MinusCircle className="size-3.5" strokeWidth={1.8} />
              No aplica
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={ocupado || Boolean(solicitudPendiente)}
              onClick={onSolicitar}
            >
              Solicitar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={ocupado || !puedeVerificar || verificado}
              onClick={onVerificar}
            >
              Marcar revisado
            </Button>
          </div>
        </Can>
      </div>
    </div>
  )
}

function TarjetaRepetible({
  etiqueta,
  instancias,
  ocupado,
  onSubir,
}: {
  etiqueta: string
  instancias: DocumentoProcesoBackend[]
  ocupado: boolean
  onSubir: (archivo: File, orden: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const siguienteOrden = instancias.length + 1
  const activas = instancias.filter((d) => !d.no_aplica)

  return (
    <div className="border-border bg-card rounded-lg border p-3.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => {
          const archivo = event.target.files?.[0]
          event.target.value = ""
          if (archivo) onSubir(archivo, siguienteOrden)
        }}
      />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{etiqueta}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ocupado}
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="size-3.5" strokeWidth={1.8} />
          Agregar
        </Button>
      </div>
      {activas.length === 0 ? (
        <p className="text-muted-foreground text-xs">Ninguno subido todavía.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {activas
            .slice()
            .sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))
            .map((instancia, index) => (
              <div key={instancia.id} className="space-y-1.5">
                <VistaDocumento
                  url={instancia.url}
                  etiqueta={`${etiqueta} #${instancia.orden ?? index + 1}`}
                />
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-muted-foreground text-xs">
                    #{instancia.orden ?? index + 1}
                  </span>
                  {instancia.url ? (
                    <button
                      type="button"
                      onClick={() => imprimirDocumento(instancia.url!)}
                      aria-label="Imprimir"
                      title="Imprimir"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Printer className="size-3.5" strokeWidth={1.8} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function DocumentosProcesoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const idProceso = searchParams.get("proceso") ?? ""

  const [documentos, setDocumentos] = useState<DocumentoProcesoBackend[] | null>(null)
  const [solicitudes, setSolicitudes] = useState<SolicitudDocumentoBackend[]>([])
  const [verificaciones, setVerificaciones] = useState<DocumentoVerificacionBackend[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tipoOcupado, setTipoOcupado] = useState<string | null>(null)
  const [tiposPersonalizados, setTiposPersonalizados] = useState<string[]>([])
  const [nuevoTipoTexto, setNuevoTipoTexto] = useState("")
  const [tipoAEliminar, setTipoAEliminar] = useState<string | null>(null)
  // Ultimo tipo pedido, para que el titulo no quede vacio durante la animacion de cierre.
  const ultimoTipoAEliminar = useRef("")
  if (tipoAEliminar) ultimoTipoAEliminar.current = tipoAEliminar

  useEffect(() => {
    if (!idProceso) {
      setCargando(false)
      setError("No se especificó un proceso.")
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    Promise.all([
      listarDocumentosProceso(idProceso),
      listarSolicitudesDocumento(idProceso),
      listarVerificacionesDocumento(idProceso),
    ])
      .then(([documentosData, solicitudesData, verificacionesData]) => {
        if (cancelado) return
        setDocumentos(Array.isArray(documentosData) ? documentosData : [])
        setSolicitudes(Array.isArray(solicitudesData) ? solicitudesData : [])
        setVerificaciones(Array.isArray(verificacionesData) ? verificacionesData : [])
      })
      .catch((err) => {
        if (cancelado) return
        setError(
          err instanceof VentasApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [idProceso])

  async function recargar() {
    const [documentosData, solicitudesData, verificacionesData] = await Promise.all([
      listarDocumentosProceso(idProceso),
      listarSolicitudesDocumento(idProceso),
      listarVerificacionesDocumento(idProceso),
    ])
    setDocumentos(Array.isArray(documentosData) ? documentosData : [])
    setSolicitudes(Array.isArray(solicitudesData) ? solicitudesData : [])
    setVerificaciones(Array.isArray(verificacionesData) ? verificacionesData : [])
  }

  async function solicitar(tipo: string, etiqueta: string) {
    setTipoOcupado(tipo)
    try {
      await solicitarDocumento(idProceso, tipo, { etiqueta })
      await recargar()
      toast({ variant: "success", description: "Documento solicitado al asesor." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo solicitar el documento",
        description:
          err instanceof VentasApiError && err.code === "ASESOR_NO_RESUELTO"
            ? "No se pudo determinar el asesor responsable. Usa la pantalla de Revisión de documentos para elegirlo manualmente."
            : err instanceof VentasApiError
              ? err.message
              : "Intenta de nuevo.",
      })
    } finally {
      setTipoOcupado(null)
    }
  }

  async function verificar(tipo: string) {
    setTipoOcupado(tipo)
    try {
      await verificarDocumento(idProceso, tipo)
      await recargar()
      toast({ variant: "success", description: "Documento verificado." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo verificar",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setTipoOcupado(null)
    }
  }

  async function subir(tipo: string, archivo: File, orden?: number) {
    setTipoOcupado(tipo)
    try {
      await subirDocumentoProceso(idProceso, { tipo, archivo, orden })
      await recargar()
      toast({ variant: "success", description: "Documento subido." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo subir el documento",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setTipoOcupado(null)
    }
  }

  async function marcarNoAplica(tipo: string) {
    setTipoOcupado(tipo)
    try {
      await subirDocumentoProceso(idProceso, { tipo, noAplica: true })
      await recargar()
      toast({ variant: "success", description: "Documento marcado como no aplica." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo actualizar",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setTipoOcupado(null)
    }
  }

  // Devuelve true si se renombro, para que la tarjeta cierre el modo edicion.
  async function renombrarTipo(tipo: string, nuevaEtiqueta: string): Promise<boolean> {
    const nuevoTipo = slugificarTipo(nuevaEtiqueta)
    if (!nuevoTipo) return false
    if (nuevoTipo === tipo) return true
    if (tiposConocidos.has(nuevoTipo) || tiposPersonalizadosTotal.includes(nuevoTipo)) {
      toast({
        variant: "error",
        description: "Ya existe un documento con ese nombre en este proceso.",
      })
      return false
    }

    // Si solo existe en pantalla (se agrego pero todavia no tiene nada subido ni
    // solicitado), no hay nada que cambiar en el backend.
    const persistido =
      tiposPersonalizadosEnDatos.includes(tipo) ||
      tiposPersonalizadosSolicitados.includes(tipo)

    setTipoOcupado(tipo)
    try {
      if (persistido) await renombrarTipoDocumento(idProceso, tipo, nuevoTipo)
      setTiposPersonalizados((actual) =>
        actual.map((t) => (t === tipo ? nuevoTipo : t))
      )
      if (persistido) await recargar()
      toast({ variant: "success", description: "Documento renombrado." })
      return true
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo renombrar",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
      return false
    } finally {
      setTipoOcupado(null)
    }
  }

  // Si ya tiene algo guardado (archivo o solicitud) se pide confirmacion antes; si solo
  // existe en pantalla se quita directo.
  function pedirEliminarTipo(tipo: string) {
    const persistido =
      tiposPersonalizadosEnDatos.includes(tipo) ||
      tiposPersonalizadosSolicitados.includes(tipo)
    if (persistido) setTipoAEliminar(tipo)
    else void eliminarTipo(tipo)
  }

  async function eliminarTipo(tipo: string) {
    const persistido =
      tiposPersonalizadosEnDatos.includes(tipo) ||
      tiposPersonalizadosSolicitados.includes(tipo)

    setTipoOcupado(tipo)
    try {
      if (persistido) await eliminarTipoDocumento(idProceso, tipo)
      setTiposPersonalizados((actual) => actual.filter((t) => t !== tipo))
      if (persistido) await recargar()
      toast({ variant: "success", description: "Documento eliminado." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err instanceof VentasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setTipoOcupado(null)
    }
  }

  function agregarTipoPersonalizado() {
    const tipo = slugificarTipo(nuevoTipoTexto)
    if (!tipo) return
    setTiposPersonalizados((actual) =>
      actual.includes(tipo) ? actual : [...actual, tipo]
    )
    setNuevoTipoTexto("")
  }

  const catalogoSimple = CATALOGO_DOCUMENTOS_PROCESO.filter((item) => !item.repetible)
  const catalogoRepetible = CATALOGO_DOCUMENTOS_PROCESO.find((item) => item.repetible)
  const tiposConocidos = new Set(CATALOGO_DOCUMENTOS_PROCESO.map((item) => item.tipo))

  // Un tipo personalizado puede existir por dos motivos: ya tiene un documento subido,
  // o el revisor lo solicito (agregandolo desde su pantalla) pero todavia no le
  // subieron nada — en ese caso no aparece en `documentos`, solo en `solicitudes`. Sin
  // esto ultimo el asesor nunca veria donde subir lo que le pidieron.
  const tiposPersonalizadosEnDatos = (documentos ?? [])
    .map((d) => d.tipo)
    .filter((tipo) => !tiposConocidos.has(tipo))
  const tiposPersonalizadosSolicitados = solicitudes
    .map((s) => s.tipo)
    .filter((tipo) => !tiposConocidos.has(tipo))

  const tiposPersonalizadosTotal = Array.from(
    new Set([
      ...tiposPersonalizadosEnDatos,
      ...tiposPersonalizadosSolicitados,
      ...tiposPersonalizados,
    ])
  )

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mb-4.5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
              Ventas · Procesos
            </div>
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xl font-extrabold tracking-tight sm:text-[23px]">
              Documentos del proceso
              <span className="bg-accent text-accent-foreground rounded-md px-2.5 py-1 font-mono text-sm font-semibold">
                {idProceso || "—"}
              </span>
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => router.back()}
          >
            Volver atrás
          </Button>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="No se pudieron cargar los documentos"
            description={error}
            dashed
          />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {catalogoSimple.map((item) => (
                <TarjetaDocumento
                  key={item.tipo}
                  tipo={item.tipo}
                  etiqueta={item.etiqueta}
                  documento={(documentos ?? []).find((d) => d.tipo === item.tipo)}
                  solicitudes={solicitudes}
                  verificado={verificaciones.some((v) => v.tipo === item.tipo)}
                  ocupado={tipoOcupado === item.tipo}
                  onSubir={(archivo) => void subir(item.tipo, archivo)}
                  onNoAplica={() => void marcarNoAplica(item.tipo)}
                  onSolicitar={() => void solicitar(item.tipo, item.etiqueta)}
                  onVerificar={() => void verificar(item.tipo)}
                />
              ))}
              {tiposPersonalizadosTotal.map((tipo) => (
                <TarjetaDocumento
                  key={tipo}
                  tipo={tipo}
                  etiqueta={etiquetaDesdeTipo(tipo)}
                  documento={(documentos ?? []).find((d) => d.tipo === tipo)}
                  solicitudes={solicitudes}
                  verificado={verificaciones.some((v) => v.tipo === tipo)}
                  ocupado={tipoOcupado === tipo}
                  onSubir={(archivo) => void subir(tipo, archivo)}
                  onNoAplica={() => void marcarNoAplica(tipo)}
                  onSolicitar={() => void solicitar(tipo, etiquetaDesdeTipo(tipo))}
                  onVerificar={() => void verificar(tipo)}
                  onRenombrar={(nuevaEtiqueta) => renombrarTipo(tipo, nuevaEtiqueta)}
                  onEliminar={() => pedirEliminarTipo(tipo)}
                />
              ))}
            </div>

            {catalogoRepetible ? (
              <TarjetaRepetible
                etiqueta={catalogoRepetible.etiqueta}
                instancias={(documentos ?? []).filter(
                  (d) => d.tipo === catalogoRepetible.tipo
                )}
                ocupado={tipoOcupado === catalogoRepetible.tipo}
                onSubir={(archivo, orden) =>
                  void subir(catalogoRepetible.tipo, archivo, orden)
                }
              />
            ) : null}

            <Can permiso="documentos:revisar">
              <div className="border-border bg-muted/40 rounded-lg border border-dashed p-3.5">
                <p className="mb-2 text-sm font-semibold">Agregar tipo de documento</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={nuevoTipoTexto}
                    onChange={(event) => setNuevoTipoTexto(event.target.value)}
                    placeholder="Ej. Contrato de compraventa"
                    className={cn("h-9 max-w-sm")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") agregarTipoPersonalizado()
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!nuevoTipoTexto.trim()}
                    onClick={agregarTipoPersonalizado}
                  >
                    <Plus className="size-3.5" strokeWidth={1.8} />
                    Agregar
                  </Button>
                </div>
              </div>
            </Can>
          </div>
        )}
      </div>

      <ConfirmDialog
        abierto={tipoAEliminar !== null}
        titulo={`¿Eliminar "${etiquetaDesdeTipo(ultimoTipoAEliminar.current)}"?`}
        descripcion="Se borra el documento subido y sus solicitudes. Esta acción no se puede deshacer."
        textoConfirmar="Eliminar"
        destructivo
        onConfirmar={() => {
          if (tipoAEliminar) void eliminarTipo(tipoAEliminar)
          setTipoAEliminar(null)
        }}
        onCancelar={() => setTipoAEliminar(null)}
      />
    </div>
  )
}
