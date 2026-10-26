"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2 } from "lucide-react"

import { SelectField } from "@/components/shared/select-field"
import { StatusBadge } from "@/components/shared/status-badge"
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
  InventarioApiError,
  importarLotes,
  type ProyectoInventario,
  type ResultadoImportacionLotes,
} from "@/lib/api/inventario-api"
import { COLUMNAS_IMPORTACION, leerLotes, plantillaCsvLotes } from "@/lib/importar-lotes"
import { cn } from "@/lib/utils"

const MAX_FILAS = 1000

// Importación masiva de lotes de un proyecto: plantilla CSV, archivo o celdas pegadas
// desde Excel → vista previa validada por el backend (sin guardar) → importar. Es todo
// o nada: con un solo error no se guarda ningún lote.
export function ImportarLotesSheet({
  open,
  onOpenChange,
  proyectos,
  onImportado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  proyectos: ProyectoInventario[]
  onImportado: () => void
}) {
  const toast = useToast()
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  const [idProyecto, setIdProyecto] = useState("")
  const [texto, setTexto] = useState("")
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [revision, setRevision] = useState<ResultadoImportacionLotes | null>(null)
  const [errorRevision, setErrorRevision] = useState<string | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [isImporting, startImporting] = useTransition()

  useEffect(() => {
    if (!open) return
    setIdProyecto("")
    setTexto("")
    setNombreArchivo(null)
    setRevision(null)
    setErrorRevision(null)
  }, [open])

  const lectura = useMemo(() => leerLotes(texto), [texto])
  const proyecto = proyectos.find((p) => String(p.id) === idProyecto)
  const prefijo = (proyecto?.nomenclatura ?? "").trim().toUpperCase()
  const demasiadas = lectura.filas.length > MAX_FILAS

  // Vista previa: el backend valida sin guardar (códigos repetidos/existentes, estados,
  // números). Se repite sola, con una pequeña espera, cada vez que cambian los datos.
  useEffect(() => {
    setRevision(null)
    setErrorRevision(null)
    if (!proyecto || lectura.filas.length === 0 || demasiadas) return
    let cancelado = false
    setRevisando(true)
    const espera = setTimeout(() => {
      importarLotes(proyecto.id, lectura.filas, true)
        .then((resultado) => !cancelado && setRevision(resultado))
        .catch((err) => {
          if (cancelado) return
          setErrorRevision(
            err instanceof InventarioApiError
              ? err.message
              : "No se pudo revisar el archivo."
          )
        })
        .finally(() => !cancelado && setRevisando(false))
    }, 400)
    return () => {
      cancelado = true
      clearTimeout(espera)
    }
  }, [proyecto, lectura, demasiadas])

  const erroresPorFila = useMemo(
    () => new Map((revision?.errores ?? []).map((e) => [e.fila, e.mensajes])),
    [revision]
  )

  function descargarPlantilla() {
    const url = URL.createObjectURL(plantillaCsvLotes())
    const enlace = document.createElement("a")
    enlace.href = url
    enlace.download = "plantilla-lotes.csv"
    enlace.click()
    URL.revokeObjectURL(url)
  }

  function leerArchivo(archivo: File | undefined) {
    if (!archivo) return
    if (/\.xlsx?$/i.test(archivo.name)) {
      toast({
        variant: "error",
        title: "Guárdalo como CSV",
        description:
          'En Excel: Archivo → Guardar como → "CSV UTF-8". O copia las celdas y pégalas abajo.',
      })
      return
    }
    archivo.text().then((contenido) => {
      setTexto(contenido)
      setNombreArchivo(archivo.name)
    })
  }

  function importar() {
    if (!proyecto || !revision || revision.errores.length > 0) return
    startImporting(async () => {
      try {
        const resultado = await importarLotes(proyecto.id, lectura.filas, false)
        if (resultado.errores.length > 0) {
          // Algo cambió entre la revisión y la importación (ej. otro usuario creó un
          // lote con el mismo código): se muestra y no se guardó nada.
          setRevision(resultado)
          toast({
            variant: "error",
            description: "Hay errores nuevos: no se importó ningún lote.",
          })
          return
        }
        toast({
          variant: "success",
          description: `${resultado.creados} lotes importados en ${proyecto.nombre}.`,
        })
        onImportado()
        onOpenChange(false)
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudieron importar los lotes",
          description:
            err instanceof InventarioApiError ? err.message : "Intenta de nuevo.",
        })
      }
    })
  }

  const listos = revision && revision.errores.length === 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Importar lotes</SheetTitle>
          <SheetDescription>
            Crea muchos lotes de un proyecto de una sola vez. Revisa la vista previa antes
            de importar: si hay un error no se guarda ningún lote.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {/* 1. Proyecto */}
          <Paso numero={1} titulo="Proyecto">
            <SelectField
              placeholder="Elige el proyecto"
              opciones={proyectos.map((p) => ({
                value: String(p.id),
                label: `${p.nombre} (${p.nomenclatura})`,
              }))}
              value={idProyecto}
              onValueChange={setIdProyecto}
            />
            {prefijo ? (
              <p className="text-muted-foreground mt-1.5 text-xs">
                Si un código viene sin prefijo se completa solo: «101» → «{prefijo}101».
              </p>
            ) : null}
          </Paso>

          {/* 2. Datos */}
          <Paso numero={2} titulo="Lotes">
            <div className="mb-2.5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={descargarPlantilla}
              >
                <Download className="size-3.5" strokeWidth={1.8} />
                Descargar plantilla
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputArchivoRef.current?.click()}
              >
                <FileUp className="size-3.5" strokeWidth={1.8} />
                Subir CSV
              </Button>
              <input
                ref={inputArchivoRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  leerArchivo(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
              {nombreArchivo ? (
                <span className="text-muted-foreground self-center text-xs">
                  {nombreArchivo}
                </span>
              ) : null}
            </div>
            <Textarea
              value={texto}
              onChange={(event) => {
                setTexto(event.target.value)
                setNombreArchivo(null)
              }}
              placeholder={
                "…o copia las celdas en Excel (con la fila de títulos) y pégalas aquí.\n\n" +
                COLUMNAS_IMPORTACION.map((c) => c.titulo).join("\t")
              }
              className="bg-card focus-visible:border-primary min-h-[110px] rounded-md px-3.5 py-2.5 font-mono text-xs shadow-none"
            />
            <p className="text-muted-foreground mt-1.5 text-xs">
              Columnas: {COLUMNAS_IMPORTACION.map((c) => c.titulo).join(", ")}. Solo el
              código es obligatorio; el estado por defecto es LIBRE (también RESERVADO,
              CONVENIO o HIPOTECADO).
            </p>
            {lectura.filas.length > 0 ? (
              <p className="mt-1.5 text-xs">
                <span className="font-semibold">{lectura.filas.length} filas leídas</span>
                <span className="text-muted-foreground">
                  {" "}
                  · columnas: {lectura.columnasReconocidas.join(", ")}
                  {lectura.sinEncabezado
                    ? " (sin títulos: se usó el orden de la plantilla)"
                    : ""}
                  {lectura.columnasIgnoradas.length > 0
                    ? ` · se ignoran: ${lectura.columnasIgnoradas.join(", ")}`
                    : ""}
                </span>
              </p>
            ) : null}
          </Paso>

          {/* 3. Vista previa */}
          {lectura.filas.length > 0 ? (
            <Paso numero={3} titulo="Vista previa">
              {demasiadas ? (
                <Aviso tono="error">
                  Son {lectura.filas.length} filas: se pueden importar hasta {MAX_FILAS}{" "}
                  por vez. Divide el archivo.
                </Aviso>
              ) : !proyecto ? (
                <Aviso tono="info">Elige el proyecto para revisar los lotes.</Aviso>
              ) : errorRevision ? (
                <Aviso tono="error">{errorRevision}</Aviso>
              ) : revisando || !revision ? (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  Revisando…
                </p>
              ) : (
                <div className="space-y-2.5">
                  {listos ? (
                    <Aviso tono="ok">
                      Los {revision.total} lotes están listos para importarse en{" "}
                      {proyecto.nombre}.
                    </Aviso>
                  ) : (
                    <Aviso tono="error">
                      {revision.errores.length} de {revision.total} filas tienen errores.
                      Corrígelas (en Excel o aquí arriba) — mientras haya errores no se
                      importa ningún lote.
                    </Aviso>
                  )}

                  <div className="border-border max-h-[420px] overflow-auto rounded-md border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr className="text-muted-foreground text-[10.5px] tracking-wide uppercase">
                          <th className="px-2.5 py-2 font-bold">#</th>
                          <th className="px-2.5 py-2 font-bold">Código</th>
                          <th className="px-2.5 py-2 font-bold">Estado</th>
                          <th className="px-2.5 py-2 text-right font-bold">Área útil</th>
                          <th className="px-2.5 py-2 text-right font-bold">PVP</th>
                          <th className="px-2.5 py-2 text-right font-bold">Costo</th>
                          <th className="px-2.5 py-2 font-bold">Revisión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-border divide-y">
                        {lectura.filas.map((fila, i) => {
                          const mensajes = erroresPorFila.get(i + 1)
                          const codigo = fila.codigo.trim().toUpperCase()
                          const codigoFinal =
                            codigo && prefijo && !codigo.startsWith(prefijo)
                              ? `${prefijo}${codigo}`
                              : codigo
                          return (
                            <tr
                              key={i}
                              className={cn(mensajes && "bg-status-bloqueado-bg/60")}
                            >
                              <td className="text-muted-foreground px-2.5 py-1.5 font-mono">
                                {i + 1}
                              </td>
                              <td className="px-2.5 py-1.5 font-mono font-semibold whitespace-nowrap">
                                {codigoFinal || "—"}
                              </td>
                              <td className="px-2.5 py-1.5">
                                {(fila.estado || "LIBRE").toUpperCase()}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono whitespace-nowrap">
                                {fila.areaUtil || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono whitespace-nowrap">
                                {fila.pvp || "—"}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono whitespace-nowrap">
                                {fila.costo || "—"}
                              </td>
                              <td className="px-2.5 py-1.5">
                                {mensajes ? (
                                  <ul className="text-status-bloqueado-fg space-y-0.5">
                                    {mensajes.map((m) => (
                                      <li key={m}>{m}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <StatusBadge variant="disponible">OK</StatusBadge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    PVP, costo y áreas se guardan sin decimales (así está definida la
                    columna en la base).
                  </p>
                </div>
              )}
            </Paso>
          ) : null}
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!listos || isImporting || revisando}
            onClick={importar}
          >
            {isImporting
              ? "Importando…"
              : revision && listos
                ? `Importar ${revision.total} lotes`
                : "Importar lotes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="bg-accent text-accent-foreground flex size-5 items-center justify-center rounded-full text-[11px] font-bold">
          {numero}
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function Aviso({
  tono,
  children,
}: {
  tono: "ok" | "error" | "info"
  children: React.ReactNode
}) {
  const Icono = tono === "ok" ? CheckCircle2 : AlertTriangle
  return (
    <div
      className={cn(
        "flex gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed",
        tono === "ok" && "bg-status-disponible-bg text-status-disponible-fg",
        tono === "error" && "bg-status-bloqueado-bg text-status-bloqueado-fg",
        tono === "info" && "bg-muted text-muted-foreground"
      )}
    >
      <Icono className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      <p>{children}</p>
    </div>
  )
}
