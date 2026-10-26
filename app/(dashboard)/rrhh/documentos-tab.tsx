"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Download, Eye, FileText, Trash2, Upload, X } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { EmptyState } from "@/components/shared/empty-state"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  CATEGORIAS_DOCUMENTO_GENERAL,
  CATEGORIAS_DOCUMENTO_INDIVIDUAL,
  RrhhApiError,
  contarDocumentosPorUsuario,
  eliminarDocumento,
  listarColaboradores,
  listarDocumentosDeUsuario,
  listarDocumentosGenerales,
  listarMisDocumentos,
  obtenerUrlDocumento,
  subirDocumento,
  type ColaboradorBackend,
  type DocumentoRrhhBackend,
} from "@/lib/api/rrhh-api"
import { cn } from "@/lib/utils"

const TAMANO_MAXIMO = 15 * 1024 * 1024
const TIPOS_ACEPTADOS =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"

function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const f = new Date(fecha)
  if (isNaN(f.getTime())) return "—"
  return `${f.getDate()}/${f.getMonth() + 1}/${f.getFullYear()}`
}

function formatearTamano(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Los documentos viven en un bucket privado: se pide una URL firmada y temporal justo
// al abrirlos. La pestaña se abre antes del fetch (dentro del click) para que el
// bloqueador de ventanas emergentes no la frene.
async function abrirDocumento(id: number) {
  const ventana = window.open("", "_blank")
  try {
    const { url } = await obtenerUrlDocumento(id)
    if (ventana) ventana.location.href = url
    else window.location.href = url
  } catch (err) {
    ventana?.close()
    throw err
  }
}

// PDFs e imágenes se ven dentro del sistema; Word/Excel no tienen visor en el
// navegador, esos siguen abriéndose/descargándose en otra pestaña.
function esPrevisualizable(documento: DocumentoRrhhBackend): boolean {
  const mime = documento.mime ?? ""
  return (
    mime === "application/pdf" ||
    mime.startsWith("image/") ||
    /\.(pdf|jpe?g|png)$/i.test(documento.nombre_archivo)
  )
}

function esImagenDocumento(documento: DocumentoRrhhBackend): boolean {
  return (
    (documento.mime ?? "").startsWith("image/") ||
    /\.(jpe?g|png)$/i.test(documento.nombre_archivo)
  )
}

function VisorDocumento({
  documento,
  url,
  onCerrar,
}: {
  documento: DocumentoRrhhBackend
  url: string
  onCerrar: () => void
}) {
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar()
    }
    window.addEventListener("keydown", alTeclear)
    return () => window.removeEventListener("keydown", alTeclear)
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-label={documento.titulo}
        className="bg-card flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-border flex items-center gap-3 border-b px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{documento.titulo}</div>
            <div className="text-muted-foreground truncate text-[11.5px]">
              {documento.nombre_archivo}
            </div>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            download={documento.nombre_archivo}
            title="Abrir en otra pestaña"
            aria-label="Abrir en otra pestaña"
            className="text-muted-foreground hover:text-foreground"
          >
            <Download className="size-4.5" strokeWidth={1.7} />
          </a>
          <button
            type="button"
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground"
            onClick={onCerrar}
          >
            <X className="size-5" strokeWidth={1.7} />
          </button>
        </div>
        <div className="bg-muted flex-1 overflow-auto">
          {esImagenDocumento(documento) ? (
            <div className="flex min-h-full items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado en S3 con URL firmada */}
              <img src={url} alt={documento.titulo} className="max-h-full max-w-full" />
            </div>
          ) : (
            <iframe src={url} title={documento.titulo} className="size-full border-0" />
          )}
        </div>
      </div>
    </div>
  )
}

function TablaDocumentos({
  documentos,
  puedeEliminar,
  onEliminar,
}: {
  documentos: DocumentoRrhhBackend[]
  puedeEliminar: boolean
  onEliminar: (documento: DocumentoRrhhBackend) => void
}) {
  const toast = useToast()
  const [abriendoId, setAbriendoId] = useState<number | null>(null)
  const [visor, setVisor] = useState<{
    documento: DocumentoRrhhBackend
    url: string
  } | null>(null)

  async function manejarAbrir(documento: DocumentoRrhhBackend) {
    setAbriendoId(documento.id)
    try {
      if (esPrevisualizable(documento)) {
        const { url } = await obtenerUrlDocumento(documento.id)
        setVisor({ documento, url })
      } else {
        await abrirDocumento(documento.id)
      }
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo abrir el documento",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setAbriendoId(null)
    }
  }

  return (
    <>
      <table className="tabla-apilada w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
            <th className="px-5 py-2.75 text-left">DOCUMENTO</th>
            <th className="px-5 py-2.75 text-left">CATEGORÍA</th>
            <th className="px-5 py-2.75 text-left">ARCHIVO</th>
            <th className="px-5 py-2.75 text-left">SUBIDO</th>
            <th className="px-5 py-2.75 text-left">ACCIONES</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((documento, index) => (
            <tr
              key={documento.id}
              className={cn(
                "hover:bg-muted/60 transition-colors",
                index < documentos.length - 1 && "border-border border-b"
              )}
            >
              <td data-label="Documento" className="px-5 py-3.5">
                <div className="font-bold">{documento.titulo}</div>
                {documento.descripcion && (
                  <div className="text-muted-foreground mt-0.5 max-w-80 text-[12px]">
                    {documento.descripcion}
                  </div>
                )}
              </td>
              <td data-label="Categoría" className="px-5 py-3.5 whitespace-nowrap">
                {documento.categoria}
              </td>
              <td
                data-label="Archivo"
                className="text-muted-foreground px-5 py-3.5 text-[12.5px]"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 shrink-0" strokeWidth={1.7} />
                  <span className="max-w-56 truncate">{documento.nombre_archivo}</span>
                </div>
                <div className="text-[11px]">{formatearTamano(documento.tamano)}</div>
              </td>
              <td
                data-label="Subido"
                className="text-muted-foreground px-5 py-3.5 text-[12.5px]"
              >
                {formatearFecha(documento.created_at)}
                {documento.subido_por_nombre && (
                  <div className="text-[11px]">por {documento.subido_por_nombre}</div>
                )}
              </td>
              <td data-label="Acciones" className="px-5 py-3.5">
                <div className="flex gap-3">
                  <button
                    type="button"
                    aria-label="Ver documento"
                    title="Ver documento"
                    className="text-primary disabled:opacity-40"
                    disabled={abriendoId === documento.id}
                    onClick={() => manejarAbrir(documento)}
                  >
                    <Eye className="size-4" strokeWidth={1.7} />
                  </button>
                  {puedeEliminar && (
                    <button
                      type="button"
                      aria-label="Eliminar documento"
                      title="Eliminar"
                      className="text-status-bloqueado-fg"
                      onClick={() => onEliminar(documento)}
                    >
                      <Trash2 className="size-4" strokeWidth={1.7} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visor && (
        <VisorDocumento
          documento={visor.documento}
          url={visor.url}
          onCerrar={() => setVisor(null)}
        />
      )}
    </>
  )
}

// Carga una lista de documentos y arma el panel (tabla + subir + eliminar). `usuario`
// solo en el expediente individual de un colaborador (RRHH).
function PanelDocumentos({
  ambito,
  cargarLista,
  puedeGestionar,
  usuario,
  vacioTitulo,
  vacioDescripcion,
  onCambio,
}: {
  ambito: "general" | "individual"
  cargarLista: () => Promise<DocumentoRrhhBackend[]>
  puedeGestionar: boolean
  usuario?: ColaboradorBackend
  vacioTitulo: string
  vacioDescripcion: string
  onCambio?: () => void
}) {
  const toast = useToast()
  const [documentos, setDocumentos] = useState<DocumentoRrhhBackend[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [titulo, setTitulo] = useState("")
  const [categoria, setCategoria] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [archivo, setArchivo] = useState<File | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  const [eliminando, setEliminando] = useState<DocumentoRrhhBackend | null>(null)
  const [borrando, setBorrando] = useState(false)

  const categorias =
    ambito === "general" ? CATEGORIAS_DOCUMENTO_GENERAL : CATEGORIAS_DOCUMENTO_INDIVIDUAL

  function cargar() {
    setError(null)
    cargarLista()
      .then(setDocumentos)
      .catch((err) => {
        setError(
          err instanceof RrhhApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  useEffect(() => {
    setDocumentos(null)
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id])

  function limpiarFormulario() {
    setTitulo("")
    setCategoria("")
    setDescripcion("")
    setArchivo(null)
    if (inputArchivo.current) inputArchivo.current.value = ""
  }

  function elegirArchivo(file: File | null) {
    if (file && file.size > TAMANO_MAXIMO) {
      toast({
        variant: "error",
        title: "Archivo muy pesado",
        description: "El tamaño máximo es 15 MB.",
      })
      if (inputArchivo.current) inputArchivo.current.value = ""
      setArchivo(null)
      return
    }
    setArchivo(file)
    if (file && !titulo.trim()) setTitulo(file.name.replace(/\.[^.]+$/, ""))
  }

  async function manejarSubir() {
    if (!titulo.trim() || !categoria || !archivo) {
      toast({
        variant: "error",
        title: "Faltan datos",
        description: "Completa el título, la categoría y adjunta el archivo.",
      })
      return
    }
    setGuardando(true)
    try {
      await subirDocumento(
        {
          ambito,
          usuarioId: usuario?.id,
          categoria,
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || undefined,
        },
        archivo
      )
      toast({ variant: "success", description: "Documento subido." })
      setSubiendo(false)
      limpiarFormulario()
      cargar()
      onCambio?.()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo subir",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setGuardando(false)
    }
  }

  async function manejarEliminar() {
    if (!eliminando) return
    setBorrando(true)
    try {
      await eliminarDocumento(eliminando.id)
      toast({ variant: "success", description: "Documento eliminado." })
      setEliminando(null)
      cargar()
      onCambio?.()
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err instanceof RrhhApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setBorrando(false)
    }
  }

  return (
    <>
      {puedeGestionar && (
        <div className="mb-3.5 flex justify-end">
          <Button onClick={() => setSubiendo(true)}>
            <Upload className="size-3.5" strokeWidth={1.8} />
            Subir documento
          </Button>
        </div>
      )}

      <div className="bg-card border-border overflow-hidden rounded-lg border">
        {!documentos && !error ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-4 sm:p-6.5">
            <EmptyState
              title="No se pudieron cargar los documentos"
              description={error}
              dashed
            />
          </div>
        ) : documentos!.length === 0 ? (
          <div className="p-4 sm:p-6.5">
            <EmptyState title={vacioTitulo} description={vacioDescripcion} />
          </div>
        ) : (
          <TablaDocumentos
            documentos={documentos!}
            puedeEliminar={puedeGestionar}
            onEliminar={setEliminando}
          />
        )}
      </div>

      <Sheet
        open={subiendo}
        onOpenChange={(valor) => {
          if (!valor) {
            setSubiendo(false)
            limpiarFormulario()
          }
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>
              {ambito === "general" ? "Subir documento general" : "Subir documento"}
            </SheetTitle>
            <SheetDescription>
              {ambito === "general"
                ? "Lo van a ver todos los colaboradores (reglamentos, políticas...)."
                : `Va al expediente de ${usuario?.nombre ?? "este colaborador"} — solo lo ven esa persona y RRHH.`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3.5 p-5">
            <SelectField
              label="Categoría"
              placeholder="Seleccione una categoría"
              options={categorias}
              value={categoria}
              onValueChange={setCategoria}
            />
            <TextField label="Título" value={titulo} onChange={setTitulo} />
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Descripción (opcional)
              </label>
              <Textarea
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Archivo
              </label>
              <input
                ref={inputArchivo}
                type="file"
                accept={TIPOS_ACEPTADOS}
                className="hidden"
                onChange={(event) => elegirArchivo(event.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => inputArchivo.current?.click()}
                >
                  <Upload className="size-3.5" strokeWidth={1.8} />
                  {archivo ? "Cambiar archivo" : "Elegir archivo"}
                </Button>
                <span className="text-muted-foreground max-w-56 truncate text-[12.5px]">
                  {archivo
                    ? `${archivo.name} (${formatearTamano(archivo.size)})`
                    : "PDF, Word, Excel o imagen — máx. 15 MB"}
                </span>
              </div>
            </div>
          </div>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => {
                setSubiendo(false)
                limpiarFormulario()
              }}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={guardando} onClick={manejarSubir}>
              {guardando ? "Subiendo…" : "Subir"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!eliminando} onOpenChange={(valor) => !valor && setEliminando(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Eliminar documento</SheetTitle>
            <SheetDescription>
              ¿Estás seguro de eliminar «{eliminando?.titulo}»? Se borra también el
              archivo y esta acción no se puede deshacer.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="border-border border-t p-5">
            <Button
              type="button"
              variant="outline"
              disabled={borrando}
              onClick={() => setEliminando(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={borrando}
              onClick={manejarEliminar}
            >
              {borrando ? "Eliminando…" : "Eliminar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

// RRHH (solo rrhh:gestionar): elige un colaborador y administra su expediente.
function ExpedientesColaboradores() {
  const [colaboradores, setColaboradores] = useState<ColaboradorBackend[] | null>(null)
  const [conteo, setConteo] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [seleccionado, setSeleccionado] = useState<ColaboradorBackend | null>(null)

  function cargarConteo() {
    contarDocumentosPorUsuario()
      .then(setConteo)
      .catch(() => {
        // Silencioso: sin conteo la lista igual sirve.
      })
  }

  useEffect(() => {
    listarColaboradores()
      .then(setColaboradores)
      .catch((err) => {
        setError(
          err instanceof RrhhApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
    cargarConteo()
  }, [])

  if (seleccionado) {
    return (
      <>
        <button
          type="button"
          className="text-primary mb-3.5 flex items-center gap-1.5 text-[13px] font-semibold"
          onClick={() => setSeleccionado(null)}
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          Volver a colaboradores
        </button>
        <h2 className="mb-0.5 text-[16px] font-extrabold">{seleccionado.nombre}</h2>
        <p className="text-muted-foreground mb-4 text-[12.5px]">
          {[seleccionado.cargo, seleccionado.departamento].filter(Boolean).join(" · ") ||
            seleccionado.email}
        </p>
        <PanelDocumentos
          ambito="individual"
          usuario={seleccionado}
          puedeGestionar
          cargarLista={() => listarDocumentosDeUsuario(seleccionado.id)}
          vacioTitulo="Este colaborador no tiene documentos"
          vacioDescripcion="Usa «Subir documento» para agregar su contrato, addendums y demás."
          onCambio={cargarConteo}
        />
      </>
    )
  }

  const termino = busqueda.trim().toLowerCase()
  const visibles = (colaboradores ?? []).filter(
    (c) =>
      !termino ||
      c.nombre.toLowerCase().includes(termino) ||
      (c.departamento ?? "").toLowerCase().includes(termino)
  )

  return (
    <>
      <div className="mb-3.5 max-w-sm">
        <TextField
          placeholder="Buscar por nombre o departamento"
          value={busqueda}
          onChange={setBusqueda}
        />
      </div>
      <div className="bg-card border-border overflow-hidden rounded-lg border">
        {!colaboradores && !error ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-4 sm:p-6.5">
            <EmptyState
              title="No se pudieron cargar los colaboradores"
              description={error}
              dashed
            />
          </div>
        ) : visibles.length === 0 ? (
          <div className="p-4 sm:p-6.5">
            <EmptyState title="Sin resultados" description="Prueba con otro nombre." />
          </div>
        ) : (
          <table className="tabla-apilada w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-[10.5px] font-bold tracking-wide">
                <th className="px-5 py-2.75 text-left">COLABORADOR</th>
                <th className="px-5 py-2.75 text-left">DEPARTAMENTO</th>
                <th className="px-5 py-2.75 text-left">CARGO</th>
                <th className="px-5 py-2.75 text-left">DOCUMENTOS</th>
                <th className="px-5 py-2.75 text-left">EXPEDIENTE</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((colaborador, index) => (
                <tr
                  key={colaborador.id}
                  className={cn(
                    "hover:bg-muted/60 transition-colors",
                    index < visibles.length - 1 && "border-border border-b"
                  )}
                >
                  <td
                    data-label="Colaborador"
                    className="px-5 py-3 font-bold whitespace-nowrap"
                  >
                    {colaborador.nombre}
                  </td>
                  <td
                    data-label="Departamento"
                    className="text-muted-foreground px-5 py-3"
                  >
                    {colaborador.departamento || "—"}
                  </td>
                  <td data-label="Cargo" className="text-muted-foreground px-5 py-3">
                    {colaborador.cargo || "—"}
                  </td>
                  <td
                    data-label="Documentos"
                    className="px-5 py-3 font-mono font-semibold"
                  >
                    {conteo[colaborador.id] ?? 0}
                  </td>
                  <td data-label="Expediente" className="px-5 py-3">
                    <button
                      type="button"
                      className="text-primary text-xs font-semibold"
                      onClick={() => setSeleccionado(colaborador)}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// Documentación de RRHH: "General" (reglamentos y políticas, los ve todo colaborador),
// "Mis documentos" (el expediente propio: contratos, addendums...) y, solo con
// rrhh:gestionar, "Expedientes" para subir/administrar los documentos de cada persona.
export function DocumentosTab() {
  const puedeGestionar = useCan("rrhh:gestionar")
  const [seccion, setSeccion] = useState("general")

  const secciones = [
    { id: "general", label: "General" },
    { id: "mios", label: "Mis documentos" },
    ...(puedeGestionar ? [{ id: "expedientes", label: "Expedientes" }] : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <PillTabs value={seccion} onChange={setSeccion} tabs={secciones} />

      {seccion === "expedientes" && puedeGestionar ? (
        <ExpedientesColaboradores />
      ) : seccion === "mios" ? (
        <PanelDocumentos
          key="mios"
          ambito="individual"
          puedeGestionar={false}
          cargarLista={listarMisDocumentos}
          vacioTitulo="Todavía no tienes documentos"
          vacioDescripcion="Tu contrato, addendums y demás documentos que suba RRHH van a aparecer acá."
        />
      ) : (
        <PanelDocumentos
          key="general"
          ambito="general"
          puedeGestionar={puedeGestionar}
          cargarLista={listarDocumentosGenerales}
          vacioTitulo="Todavía no hay documentos generales"
          vacioDescripcion="Los reglamentos y políticas de la empresa van a aparecer acá."
        />
      )}
    </div>
  )
}
