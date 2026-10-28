"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Pencil,
  Plus,
  XCircle,
} from "lucide-react"
import { useRouter, useSearchParams } from "@/lib/navigation"
import { Can } from "@/components/shared/can"

import { CampoSelect } from "@/components/shared/campo-select"
import { ComboboxField, type ComboboxOption } from "@/components/shared/combobox-field"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { MultiSelectField } from "@/components/shared/multi-select-field"
import { useSession } from "@/components/shared/session-provider"
import {
  ASESORES,
  ESTADOS_CIVILES,
  LUGARES_VENTA_OPCIONES,
  SEXOS,
} from "@/components/shared/select-options"
import { SelectField } from "@/components/shared/select-field"
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import {
  VentasApiError,
  actualizarProceso,
  listarDocumentosProceso,
  obtenerProcesoPorLote,
  type DocumentoProcesoBackend,
  type ProcesoBackend,
} from "@/lib/api/ventas-api"
import { nacionalidades } from "@/lib/const/nacionalidades"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const OPCIONES_NACIONALIDAD: ComboboxOption[] = nacionalidades.map((n) => ({
  value: n.nacionalidad,
  label: n.nacionalidad,
  keywords: n.pais,
}))
import { cn } from "@/lib/utils"
import { calcularResumenDocumentos } from "@/lib/validations/documentos-proceso"

type ProcesoFila = {
  numero: string
  idUser: string | null
  cliente: string
  fecha: string
  lugar: string
  asesor: string
  identificacion: string
  fechaNacimiento: string
  sexo: string
  estadoCivil: string
  nacionalidad: string
  finan: StatusVariant
  oferta: StatusVariant
  pago: StatusVariant
  licitud: StatusVariant
  convenio: StatusVariant
}

const ESTADO_PROCESO: Record<string, StatusVariant> = {
  pendiente: "pendiente",
  ingresado: "ingresado",
  aprobado: "aprobado",
  rechazado: "rechazado",
}

function normalizarEstadoProceso(crudo: string | null | undefined): StatusVariant {
  const clave = (crudo ?? "").trim().toLowerCase()
  return ESTADO_PROCESO[clave] ?? "pendiente"
}

// Los datos del cliente vienen del titular (process_users, rol="titular") que el
// backend ya une en la respuesta — sale_process solo tiene cli_name como copia rapida,
// se usa como respaldo si por algo no hay titular. Tampoco hay is_licit_done: licitud
// queda "pendiente" igual que convenio, hasta que el backend exponga ese estado.
function mapearProceso(proceso: ProcesoBackend): ProcesoFila {
  return {
    numero: String(proceso.id),
    idUser: proceso.id_user,
    cliente: proceso.titular?.nombre || proceso.cli_name || "—",
    fecha: proceso.created_at ? proceso.created_at.slice(0, 10) : "—",
    lugar: proceso.location || "—",
    asesor: proceso.cli_asesor || "",
    identificacion: proceso.titular?.identificacion || "",
    fechaNacimiento: proceso.titular?.fecha_nacimiento
      ? proceso.titular.fecha_nacimiento.slice(0, 10)
      : "",
    sexo: proceso.titular?.sexo || "",
    estadoCivil: proceso.titular?.estado_civil || "",
    nacionalidad: proceso.titular?.nacionalidad || "",
    finan: normalizarEstadoProceso(proceso.finan_status),
    oferta: normalizarEstadoProceso(proceso.offert_status),
    pago: normalizarEstadoProceso(proceso.payment_status),
    licitud: "pendiente",
    convenio: "pendiente",
  }
}

const COLUMNAS: Array<{
  key: keyof ProcesoFila
  label: string
  baseRuta: string
  soloReporte?: boolean
}> = [
  { key: "finan", label: "FINANC.", baseRuta: "ventas/financiamiento" },
  { key: "oferta", label: "OFERTA", baseRuta: "ventas/oferta" },
  { key: "pago", label: "PAGO", baseRuta: "ventas/pagos" },
  { key: "licitud", label: "LICITUD", baseRuta: "ventas/licitud", soloReporte: true },
  { key: "convenio", label: "CONVENIO", baseRuta: "ventas/convenio", soloReporte: true },
]

// pendiente -> crear el registro (wizard/formulario). ingresado/aprobado/rechazado ->
// el reporte (/ventas/oferta/reporte/:id, /ventas/financiamiento/reporte/:id,
// /ventas/pagos/reporte/:id): "ingresado" es justamente el estado que espera revisión
// (ahí viven los botones Aprobar/Devolver), y aprobado/rechazado quedan como reporte de
// la decisión ya tomada. Editar sigue disponible siempre desde un botón dentro del
// propio reporte, no hace falta una ruta aparte para eso. Las tres columnas
// (oferta/financiamiento/pago) son pantallas reales conectadas al backend, todas con la
// misma forma de ruta — por eso comparten esta función.
function rutaPorEstado(
  baseRuta: string,
  estado: StatusVariant,
  idProceso: string
): string {
  switch (estado) {
    case "ingresado":
    case "aprobado":
    case "rechazado":
      return `/${baseRuta}/reporte/${idProceso}`
    default:
      return `/${baseRuta}/new/${idProceso}`
  }
}

// Licitud y convenio son documentos generados: solo llevan al reporte, y solo si
// financiamiento, oferta y pago del proceso ya están aprobados.
function prerequisitosCumplidos(fila: ProcesoFila): boolean {
  return (
    fila.finan === "aprobado" && fila.oferta === "aprobado" && fila.pago === "aprobado"
  )
}

// El pago solo puede ingresarse una vez que financiamiento y oferta ya fueron
// aprobados — no tiene sentido cobrar sobre una oferta o un financiamiento que
// todavía puede rechazarse.
function pagoHabilitado(fila: ProcesoFila): boolean {
  return fila.finan === "aprobado" && fila.oferta === "aprobado"
}

const LEYENDA: Array<{
  variant: StatusVariant
  icon: React.ReactNode
  descripcion: string
}> = [
  {
    variant: "aprobado",
    icon: <CheckCircle2 className="size-3" strokeWidth={1.9} />,
    descripcion: "Verificado y aprobado",
  },
  {
    variant: "ingresado",
    icon: <Clock className="size-3" strokeWidth={1.9} />,
    descripcion: "En espera de revisión",
  },
  {
    variant: "pendiente",
    icon: <Plus className="size-3" strokeWidth={1.9} />,
    descripcion: "Pendiente de ingreso",
  },
  {
    variant: "rechazado",
    icon: <XCircle className="size-3" strokeWidth={1.9} />,
    descripcion: "No cumple requisitos",
  },
]

// Panel de edicion de un proceso — el formulario y su estado ya estan armados, falta
// conectar `guardarProceso` con el endpoint real del backend (ej. PUT/PATCH sobre el
// proceso). Por ahora solo loguea lo que se guardaria y cierra el panel.
function EditarProcesoSheet({
  proceso,
  onOpenChange,
  onGuardado,
}: {
  proceso: ProcesoFila | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const toast = useToast()
  const [cliente, setCliente] = useState("")
  const [lugar, setLugar] = useState("")
  const [asesor, setAsesor] = useState<string[]>([])
  const [cedula, setCedula] = useState("")
  const [ecivil, setEcivil] = useState("")
  const [fnacimiento, setFnacimiento] = useState("")
  const [sexo, setSexo] = useState("")
  const [nacionalidad, setNacionalidad] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!proceso) return
    setCliente(proceso.cliente)
    setLugar(proceso.lugar)
    setAsesor(
      proceso.asesor
        ? proceso.asesor
            .split(",")
            .map((nombre) => nombre.trim())
            .filter(Boolean)
        : []
    )
    setCedula(proceso.identificacion)
    setEcivil(proceso.estadoCivil)
    setFnacimiento(proceso.fechaNacimiento)
    setSexo(proceso.sexo)
    setNacionalidad(proceso.nacionalidad)
  }, [proceso])

  function guardarProceso() {
    if (!proceso) return
    setGuardando(true)
    actualizarProceso(proceso.numero, {
      cli_name: cliente,
      location: lugar,
      cli_asesor: asesor.join(","),
      identificacion: cedula,
      estado_civil: ecivil,
      fecha_nacimiento: fnacimiento,
      sexo,
      nacionalidad,
    })
      .then(() => {
        toast({ variant: "success", description: "Proceso actualizado." })
        onGuardado()
        onOpenChange(false)
      })
      .catch((error) => {
        toast({
          variant: "error",
          title: "No se pudo guardar",
          description:
            error instanceof VentasApiError
              ? error.message
              : "Intenta de nuevo en unos segundos.",
        })
      })
      .finally(() => setGuardando(false))
  }

  return (
    <Sheet open={Boolean(proceso)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {proceso && (
          <>
            <SheetHeader className="border-border border-b p-5">
              <SheetTitle>Editar proceso #{proceso.numero}</SheetTitle>
              <SheetDescription>Actualizá los datos de este proceso.</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="editar-cliente">Cliente</Label>
                <Input
                  id="editar-cliente"
                  value={cliente}
                  onChange={(event) => setCliente(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editar-identificacion">
                  Identificación (cédula o pasaporte)
                </Label>
                <Input
                  id="editar-identificacion"
                  value={cedula}
                  onChange={(event) => setCedula(event.target.value)}
                />
              </div>

              <MultiSelectField
                label="Asesor"
                placeholder="Seleccione asesor(es)"
                options={ASESORES}
                value={asesor}
                onChange={setAsesor}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editar-fnacimiento">Fecha de nacimiento</Label>
                  <Input
                    id="editar-fnacimiento"
                    type="date"
                    value={fnacimiento}
                    onChange={(event) => setFnacimiento(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Sexo"
                  placeholder="Sexo"
                  options={SEXOS}
                  value={sexo || undefined}
                  onValueChange={setSexo}
                />
                <SelectField
                  label="Estado civil"
                  placeholder="Estado civil"
                  options={ESTADOS_CIVILES}
                  value={ecivil || undefined}
                  onValueChange={setEcivil}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ComboboxField
                  label="Nacionalidad"
                  placeholder="Seleccione nacionalidad"
                  searchPlaceholder="Buscar por nacionalidad o país…"
                  options={OPCIONES_NACIONALIDAD}
                  value={nacionalidad}
                  onChange={setNacionalidad}
                />
                <CampoSelect
                  label="Lugar de venta"
                  value={lugar}
                  onChange={setLugar}
                  opciones={LUGARES_VENTA_OPCIONES}
                />
              </div>
            </div>

            <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={guardando} onClick={guardarProceso}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default function ProcesosContentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const usuario = useSession()
  const lote = searchParams.get("lote") ?? ""

  const [procesos, setProcesos] = useState<ProcesoFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesoEditando, setProcesoEditando] = useState<ProcesoFila | null>(null)
  const [documentosPorProceso, setDocumentosPorProceso] = useState<
    Record<string, DocumentoProcesoBackend[]>
  >({})

  // GET /ventas/procesos/lote/:cliLote devuelve TODOS los procesos de ese lote —
  // validateCreateProcess permite crear mas de uno para el mismo lote mientras ninguno
  // este 100% aprobado, asi que puede haber varias filas (ordenadas del mas nuevo al
  // mas viejo por el backend). Extraída de useEffect para poder recargar la tabla
  // despues de guardar una edición (ver EditarProcesoSheet.onGuardado).
  const cargarProcesos = useCallback(() => {
    if (!lote) {
      setCargando(false)
      setError("No se especificó un lote.")
      return () => {}
    }

    let cancelado = false
    setCargando(true)
    setError(null)

    obtenerProcesoPorLote(lote)
      .then((procesos) => {
        if (cancelado) return
        setProcesos(Array.isArray(procesos) ? procesos.map(mapearProceso) : [])
      })
      .catch((err) => {
        if (cancelado) return
        console.error("No se pudo cargar el proceso del lote", err)
        setError("No se pudo cargar el proceso de este lote.")
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [lote])

  useEffect(() => cargarProcesos(), [cargarProcesos])

  // Trae el estado de documentos de cada proceso en paralelo, para el resumen "x/y" de
  // la columna DOCUMENTOS — si alguno falla, esa fila se queda mostrando "…" (no bloquea
  // el resto de la tabla).
  useEffect(() => {
    if (procesos.length === 0) return
    let cancelado = false

    Promise.allSettled(
      procesos.map((fila) =>
        listarDocumentosProceso(fila.numero).then(
          (data) => [fila.numero, Array.isArray(data) ? data : []] as const
        )
      )
    ).then((resultados) => {
      if (cancelado) return
      const mapa: Record<string, DocumentoProcesoBackend[]> = {}
      for (const resultado of resultados) {
        if (resultado.status === "fulfilled") {
          const [numero, documentos] = resultado.value
          mapa[numero] = documentos
        }
      }
      setDocumentosPorProceso((actual) => ({ ...actual, ...mapa }))
    })

    return () => {
      cancelado = true
    }
  }, [procesos])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mb-4 flex flex-col gap-3 sm:mb-4.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-muted-foreground mb-1.5 text-[11px] font-semibold">
              Ventas · Lotes
            </div>
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xl font-extrabold tracking-tight sm:text-[23px]">
              Procesos del lote
              <span className="bg-accent text-accent-foreground rounded-md px-2.5 py-1 font-mono text-sm font-semibold whitespace-nowrap">
                {lote || "—"}
              </span>
            </h1>
          </div>
          <div className="flex gap-2.5 [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Volver atrás
            </Button>
            <Button
              size="sm"
              onClick={() =>
                router.push(`/ventas/nuevo-proceso?lote=${encodeURIComponent(lote)}`)
              }
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Crear proceso
            </Button>
          </div>
        </div>

        <div className="bg-card border-border mb-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3.5 sm:flex sm:flex-wrap sm:items-center sm:gap-6.5">
          <span className="text-muted-foreground col-span-2 text-[11px] font-bold tracking-wide sm:col-span-1">
            LEYENDA
          </span>
          {LEYENDA.map((item) => (
            <div
              key={item.variant}
              className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2.5"
            >
              <StatusBadge variant={item.variant} icon={item.icon} />
              <span className="text-muted-foreground text-xs">{item.descripcion}</span>
            </div>
          ))}
        </div>

        <div className="bg-card border-border overflow-x-auto rounded-lg border">
          <table className="tabla-apilada w-full min-w-250 border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60 text-muted-foreground text-[10px] font-bold tracking-wide">
                <th className="px-2.5 py-2.75 text-left">#</th>
                <th className="px-2.5 py-2.75 text-left">CLIENTE</th>
                <th className="px-2.5 py-2.75">FECHA</th>
                <th className="px-2.5 py-2.75">LUGAR</th>
                {COLUMNAS.map((col) => (
                  <th key={col.key} className="px-2.5 py-2.75">
                    {col.label}
                  </th>
                ))}
                <th className="px-2.5 py-2.75">DOCUMENTOS</th>
                <th className="px-2.5 py-2.75" />
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td
                    colSpan={6 + COLUMNAS.length}
                    className="text-muted-foreground justify-center px-2.5 py-8 text-center text-sm"
                  >
                    Cargando procesos…
                  </td>
                </tr>
              )}
              {!cargando && error && (
                <tr>
                  <td
                    colSpan={6 + COLUMNAS.length}
                    className="text-status-bloqueado-fg justify-center px-2.5 py-8 text-center text-sm"
                  >
                    {error}
                  </td>
                </tr>
              )}
              {!cargando && !error && procesos.length === 0 && (
                <tr>
                  <td
                    colSpan={6 + COLUMNAS.length}
                    className="text-muted-foreground justify-center px-2.5 py-8 text-center text-sm"
                  >
                    Todavía no hay procesos para este lote — usá &ldquo;Crear
                    proceso&rdquo;.
                  </td>
                </tr>
              )}
              {!cargando &&
                !error &&
                procesos.map((fila, index) => {
                  const documentosFila = documentosPorProceso[fila.numero]
                  const resumenDocumentos = documentosFila
                    ? calcularResumenDocumentos(documentosFila)
                    : null

                  return (
                    <tr
                      key={fila.numero}
                      className={cn(
                        "hover:bg-muted/60 transition-colors",
                        index < procesos.length - 1 && "border-border border-b"
                      )}
                    >
                      <td
                        data-label="#"
                        className="text-muted-foreground px-2.5 py-3 font-mono font-semibold"
                      >
                        {fila.numero}
                      </td>
                      <td
                        data-label="Cliente"
                        className="px-2.5 py-3 font-bold whitespace-nowrap"
                      >
                        {fila.cliente}
                      </td>
                      <td
                        data-label="Fecha"
                        className="text-muted-foreground px-2.5 py-3 text-center font-mono text-xs"
                      >
                        {fila.fecha}
                      </td>
                      <td
                        data-label="Lugar"
                        className="text-muted-foreground px-2.5 py-3 text-center text-xs"
                      >
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" strokeWidth={1.7} />
                          {fila.lugar}
                        </span>
                      </td>
                      {COLUMNAS.map((col) => {
                        const habilitado = col.soloReporte
                          ? prerequisitosCumplidos(fila)
                          : col.key === "pago"
                            ? pagoHabilitado(fila)
                            : true
                        const ruta = col.soloReporte
                          ? `/${col.baseRuta}/reporte/${fila.numero}`
                          : rutaPorEstado(
                              col.baseRuta,
                              fila[col.key] as StatusVariant,
                              fila.numero
                            )

                        return (
                          <td
                            key={col.key}
                            data-label={col.label}
                            className="px-2.5 py-3 text-center"
                          >
                            <button
                              type="button"
                              disabled={!habilitado}
                              onClick={() => router.push(ruta)}
                              title={
                                !habilitado
                                  ? col.key === "pago"
                                    ? "Se habilita cuando financiamiento y oferta estén aprobados"
                                    : "Se habilita cuando financ., oferta y pago estén aprobados"
                                  : undefined
                              }
                              className={cn(
                                "inline-block transition-transform",
                                habilitado
                                  ? "cursor-pointer hover:scale-105 active:scale-95"
                                  : "cursor-not-allowed opacity-40"
                              )}
                            >
                              {col.soloReporte ? (
                                <StatusBadge
                                  variant={habilitado ? "aprobado" : "pronto"}
                                  icon={<FileText className="size-3" strokeWidth={1.9} />}
                                >
                                  Reporte
                                </StatusBadge>
                              ) : (
                                <StatusBadge variant={fila[col.key] as StatusVariant} />
                              )}
                            </button>
                          </td>
                        )
                      })}
                      <td data-label="Documentos" className="px-2.5 py-3 text-center">
                        {fila.idUser === usuario.id ? (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/ventas/procesos/documentos?proceso=${fila.numero}`
                              )
                            }
                            className="inline-block transition-transform hover:scale-105 active:scale-95"
                          >
                            {resumenDocumentos ? (
                              <StatusBadge
                                variant={
                                  resumenDocumentos.resueltos === resumenDocumentos.total
                                    ? "aprobado"
                                    : "pendiente"
                                }
                              >
                                {resumenDocumentos.resueltos}/{resumenDocumentos.total}
                              </StatusBadge>
                            ) : (
                              <StatusBadge variant="pronto">…</StatusBadge>
                            )}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </td>
                      <Can permiso="ventas:editar">
                        <td data-label="Editar" className="px-2.5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setProcesoEditando(fila)}
                            className="border-border hover:border-primary hover:bg-accent inline-flex size-7.5 items-center justify-center rounded-md border"
                            aria-label="Editar proceso"
                          >
                            <Pencil
                              className="text-muted-foreground size-3.5"
                              strokeWidth={1.7}
                            />
                          </button>
                        </td>
                      </Can>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Toca cualquier estado para avanzar el proceso · el lápiz edita los datos del
          proceso.
        </p>
      </div>

      <EditarProcesoSheet
        proceso={procesoEditando}
        onOpenChange={(open) => !open && setProcesoEditando(null)}
        onGuardado={cargarProcesos}
      />
    </div>
  )
}
