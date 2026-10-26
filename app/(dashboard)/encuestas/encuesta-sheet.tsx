"use client"

import { useEffect, useState } from "react"
import { CircleCheckBig, MessageCircleHeart } from "lucide-react"

import { useCan } from "@/components/shared/can"
import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ENCUESTADOR_OTRO,
  ENCUESTADORES,
  EncuestasApiError,
  MEDIOS_CON_DETALLE,
  MEDIOS_CONTACTO,
  MEDIOS_VISITA,
  etiquetaEncuestador,
  etiquetaMedioContacto,
  etiquetaMedioVisita,
  guardarEncuesta,
  obtenerEncuesta,
  type EncuestaDetalle,
} from "@/lib/api/encuestas-api"
import { cn } from "@/lib/utils"

import { formatearFecha } from "./formato"

type Formulario = {
  medioContacto: string
  medioContactoDetalle: string
  medioVisita: string
  encuestador: string
  encuestadorOtro: string
}

const FORM_VACIO: Formulario = {
  medioContacto: "",
  medioContactoDetalle: "",
  medioVisita: "",
  encuestador: "",
  encuestadorOtro: "",
}

function Dato({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[11px] font-semibold uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] font-semibold break-words">{children || "—"}</dd>
    </div>
  )
}

function Pregunta({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold">
        {numero}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 text-[13.5px] font-bold">{titulo}</div>
        {children}
      </div>
    </div>
  )
}

// Botones tipo "chip" para las preguntas con pocas opciones — más rápido que un select.
function Chips({
  opciones,
  valor,
  onChange,
}: {
  opciones: { value: string; label: string }[]
  valor: string
  onChange: (valor: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((opcion) => (
        <button
          key={opcion.value}
          type="button"
          aria-pressed={valor === opcion.value}
          onClick={() => onChange(opcion.value)}
          className={cn(
            "border-border rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
            valor === opcion.value
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card hover:bg-muted"
          )}
        >
          {opcion.label}
        </button>
      ))}
    </div>
  )
}

const CLASE_INPUT =
  "border-input bg-card focus:border-primary focus:ring-ring/15 mt-2 h-10 w-full rounded-md border px-3 text-sm uppercase outline-none focus:ring-3 placeholder:normal-case"

// Panel lateral de un proceso: si la encuesta está pendiente muestra el formulario
// (solo con encuestas:crear); si ya se hizo, el informe con las respuestas.
export function EncuestaSheet({
  processId,
  onClose,
  onGuardada,
}: {
  processId: number | null
  onClose: () => void
  onGuardada: () => void
}) {
  const toast = useToast()
  const puedeCrear = useCan("encuestas:crear", true)
  const [detalle, setDetalle] = useState<EncuestaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Formulario>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (processId === null) return
    setDetalle(null)
    setError(null)
    setForm(FORM_VACIO)
    obtenerEncuesta(processId)
      .then(setDetalle)
      .catch((err) =>
        setError(
          err instanceof EncuestasApiError ? err.message : "No se pudo cargar el proceso"
        )
      )
  }, [processId])

  const pideDetalle = MEDIOS_CON_DETALLE.includes(form.medioContacto)
  const pideOtro = form.encuestador === ENCUESTADOR_OTRO
  const completo =
    Boolean(form.medioContacto) &&
    (!pideDetalle || Boolean(form.medioContactoDetalle.trim())) &&
    Boolean(form.medioVisita) &&
    Boolean(form.encuestador) &&
    (!pideOtro || Boolean(form.encuestadorOtro.trim()))

  async function enviar() {
    if (processId === null || !completo) return
    setGuardando(true)
    try {
      const guardada = await guardarEncuesta(processId, {
        medioContacto: form.medioContacto,
        medioContactoDetalle: pideDetalle ? form.medioContactoDetalle : undefined,
        medioVisita: form.medioVisita,
        encuestador: form.encuestador,
        encuestadorOtro: pideOtro ? form.encuestadorOtro : undefined,
      })
      setDetalle(guardada)
      toast({ variant: "success", description: "Encuesta registrada." })
      onGuardada()
    } catch (err) {
      toast({
        variant: "error",
        description:
          err instanceof EncuestasApiError
            ? err.message
            : "No se pudo guardar la encuesta",
      })
    } finally {
      setGuardando(false)
    }
  }

  const mostrarFormulario = detalle && !detalle.realizada && puedeCrear

  return (
    <Sheet open={processId !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-border border-b p-5">
          <div className="flex items-center gap-2.5">
            <SheetTitle>Encuesta · Proceso #{processId ?? ""}</SheetTitle>
            {detalle ? (
              detalle.realizada ? (
                <StatusBadge variant="aprobado">Realizada</StatusBadge>
              ) : (
                <StatusBadge variant="pronto">Pendiente</StatusBadge>
              )
            ) : null}
          </div>
          <SheetDescription className="uppercase">
            {detalle?.cliente ?? "Encuesta de satisfacción del cliente"}
          </SheetDescription>
        </SheetHeader>

        {detalle === null && !error ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : error || !detalle ? (
          <div className="p-5">
            <EmptyState title="No se pudo cargar" description={error ?? undefined} />
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <dl className="border-border bg-muted/40 grid grid-cols-2 gap-x-6 gap-y-3.5 rounded-lg border p-4">
              <Dato label="Lote">
                <span className="font-mono">{detalle.lote}</span>
              </Dato>
              <Dato label="Proyecto">{detalle.proyecto}</Dato>
              <Dato label="Asesor">
                <span className="uppercase">{detalle.asesor}</span>
              </Dato>
              <Dato label="Fecha del proceso">
                {formatearFecha(detalle.fechaProceso)}
              </Dato>
            </dl>

            <div className="bg-status-hipotecado-bg border-status-hipotecado-border text-status-hipotecado-fg rounded-lg border px-4 py-3">
              <div className="text-[11px] font-bold uppercase">
                ¿Cómo nos contactó? (según la oferta)
              </div>
              <div className="mt-0.5 text-[13.5px] font-semibold">
                {detalle.contactoOferta || "No se registró en la oferta"}
              </div>
            </div>

            {detalle.realizada ? (
              <section className="border-border rounded-lg border">
                <div className="border-border bg-status-disponible-bg text-status-disponible-fg flex items-center gap-2 border-b px-5 py-3">
                  <CircleCheckBig className="size-4" strokeWidth={2} />
                  <h2 className="text-[14px] font-extrabold">Respuestas del cliente</h2>
                </div>
                <div className="space-y-4 p-5">
                  <Pregunta numero={1} titulo="¿Por qué medio se enteró de nosotros?">
                    <p className="text-[13.5px]">
                      {etiquetaMedioContacto(detalle.medioContacto)}
                    </p>
                  </Pregunta>
                  <Pregunta
                    numero={2}
                    titulo="Antes de tomar la decisión de compra, ¿nos visitó en…?"
                  >
                    <p className="text-[13.5px]">
                      {etiquetaMedioVisita(detalle.medioVisita)}
                    </p>
                  </Pregunta>
                  <dl className="border-border grid grid-cols-2 gap-x-6 gap-y-3.5 border-t pt-4">
                    <Dato label="Realizada por">
                      {etiquetaEncuestador(detalle.encuestador)}
                    </Dato>
                    <Dato label="Fecha">
                      {detalle.fechaEncuesta
                        ? formatearFecha(detalle.fechaEncuesta)
                        : "Intranet anterior"}
                    </Dato>
                    {detalle.registradaPor ? (
                      <Dato label="Registrada en el sistema por">
                        {detalle.registradaPor}
                      </Dato>
                    ) : null}
                  </dl>
                </div>
              </section>
            ) : mostrarFormulario ? (
              <section className="border-border rounded-lg border">
                <div className="border-border bg-muted/40 border-b px-5 py-3">
                  <h2 className="flex items-center gap-2 text-[14px] font-extrabold">
                    <MessageCircleHeart className="text-primary size-4" strokeWidth={2} />
                    Encuesta de satisfacción
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    La comunicación es lo más importante para nosotros: lo que nos cuente
                    el cliente nos ayuda a mejorar.
                  </p>
                </div>
                <div className="space-y-5 p-5">
                  <Pregunta numero={1} titulo="¿Por qué medio se enteró de nosotros?">
                    <Select
                      value={form.medioContacto}
                      onValueChange={(valor) =>
                        setForm((f) => ({
                          ...f,
                          medioContacto: valor,
                          medioContactoDetalle: "",
                        }))
                      }
                    >
                      <SelectTrigger className="border-input bg-card h-10! w-full! rounded-md! px-3! text-sm">
                        <SelectValue placeholder="Selecciona el medio" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDIOS_CONTACTO.map((grupo) => (
                          <SelectGroup key={grupo.grupo ?? "otros"}>
                            {grupo.grupo ? (
                              <SelectLabel>{grupo.grupo}</SelectLabel>
                            ) : null}
                            {grupo.opciones.map((opcion) => (
                              <SelectItem key={opcion.value} value={opcion.value}>
                                {opcion.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    {pideDetalle ? (
                      <input
                        autoFocus
                        value={form.medioContactoDetalle}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, medioContactoDetalle: e.target.value }))
                        }
                        placeholder={
                          form.medioContacto === "FERIA OTROS"
                            ? "¿En qué feria?"
                            : "¿En qué stand?"
                        }
                        maxLength={200}
                        className={CLASE_INPUT}
                      />
                    ) : null}
                  </Pregunta>

                  <Pregunta
                    numero={2}
                    titulo="Antes de tomar la decisión de compra, ¿nos visitó en…?"
                  >
                    <Chips
                      opciones={MEDIOS_VISITA}
                      valor={form.medioVisita}
                      onChange={(valor) => setForm((f) => ({ ...f, medioVisita: valor }))}
                    />
                  </Pregunta>

                  <Pregunta numero={3} titulo="¿Quién realizó la encuesta?">
                    <Chips
                      opciones={[
                        ...ENCUESTADORES,
                        { value: ENCUESTADOR_OTRO, label: "Otra persona" },
                      ]}
                      valor={form.encuestador}
                      onChange={(valor) =>
                        setForm((f) => ({
                          ...f,
                          encuestador: valor,
                          encuestadorOtro: "",
                        }))
                      }
                    />
                    {pideOtro ? (
                      <input
                        autoFocus
                        value={form.encuestadorOtro}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, encuestadorOtro: e.target.value }))
                        }
                        placeholder="Nombre de quién realizó la encuesta"
                        maxLength={255}
                        className={CLASE_INPUT}
                      />
                    ) : null}
                  </Pregunta>
                </div>
              </section>
            ) : (
              <EmptyState
                title="Encuesta pendiente"
                description="No tienes permiso para registrar encuestas."
              />
            )}
          </div>
        )}

        {mostrarFormulario ? (
          <SheetFooter className="border-border bg-card sticky bottom-0 border-t p-4">
            <Button onClick={enviar} disabled={!completo || guardando} className="w-full">
              {guardando ? "Guardando…" : "Registrar encuesta"}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
