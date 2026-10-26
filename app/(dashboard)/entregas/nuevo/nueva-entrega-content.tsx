"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { ArrowLeft, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "@/lib/navigation"

import { ComboboxField, type ComboboxOption } from "@/components/shared/combobox-field"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { OpcionRevision } from "@/components/shared/opcion-revision"
import { PageHeader } from "@/components/shared/page-header"
import { SelectField } from "@/components/shared/select-field"
import { TextField } from "@/components/shared/text-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  EntregasApiError,
  TIPOS_FINANCIAMIENTO,
  buscarLoteEnSap,
  crearEntrega,
  listarAsesoresEntrega,
  type AsesorOpcion,
  type RevisionOfrecimiento,
} from "@/lib/api/entregas-api"
import { cn } from "@/lib/utils"

import { AdvertenciaAgenda } from "../advertencia-agenda"

const ITEMS_REVISION = [
  { id: "huerto", label: "Huerto" },
  { id: "tanque", label: "Tanque" },
  { id: "tag", label: "Tag Ingreso" },
] as const
type ItemRevision = (typeof ITEMS_REVISION)[number]["id"]

// Lo ofrecido en la oferta marca "SI" por defecto en la revision: huerto y/o tanque
// biodigestor. El resto (y el tag de ingreso) lo elige el usuario.
function revisionInicial(
  ofrecimientos: string | null
): Record<ItemRevision, RevisionOfrecimiento | null> {
  const texto = (ofrecimientos ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  return {
    huerto: texto.includes("huerto") ? "SI" : null,
    tanque: texto.includes("tanque") ? "SI" : null,
    tag: null,
  }
}

const textareaClase =
  "border-input bg-card focus-visible:border-primary focus-visible:ring-ring/15 w-full rounded-md border px-3.5 py-2.5 text-sm shadow-none focus-visible:ring-3"

export function NuevaEntregaContent() {
  const router = useRouter()
  const toast = useToast()
  const [guardando, startGuardando] = useTransition()

  const [buscandoSap, setBuscandoSap] = useState(false)

  // Lo que el usuario escribe para buscar en SAP vs. el lote ya cargado desde SAP
  // (Número de Lote y Cliente son de solo lectura: siempre salen de la orden de SAP).
  const [busqueda, setBusqueda] = useState("")
  const [lote, setLote] = useState("")
  const [cliente, setCliente] = useState("")
  const [asesores, setAsesores] = useState<AsesorOpcion[]>([])
  const [asesorId, setAsesorId] = useState("")
  // Lo que dice la fuente (venta o SAP) y las coincidencias, para explicar por que el
  // asesor quedo sin elegir.
  const [asesorOrigen, setAsesorOrigen] = useState<{
    nombre: string | null
    candidatos: AsesorOpcion[]
  } | null>(null)
  const [tipoFinanciamiento, setTipoFinanciamiento] = useState("")
  const [ofrecimientos, setOfrecimientos] = useState("")
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [revision, setRevision] = useState<
    Record<ItemRevision, RevisionOfrecimiento | null>
  >({
    huerto: null,
    tanque: null,
    tag: null,
  })
  const [trabajosExtra, setTrabajosExtra] = useState("")
  const [comentario, setComentario] = useState("")
  const [intento, setIntento] = useState(false)

  useEffect(() => {
    listarAsesoresEntrega()
      .then(setAsesores)
      .catch(() => setAsesores([]))
  }, [])

  // Si hay varios usuarios que coinciden con el nombre, van primero.
  const opcionesAsesor = useMemo<ComboboxOption[]>(() => {
    const prioritarios = new Set((asesorOrigen?.candidatos ?? []).map((c) => c.id))
    return [...asesores]
      .sort((a, b) => Number(prioritarios.has(b.id)) - Number(prioritarios.has(a.id)))
      .map((a) => ({ value: a.id, label: a.name }))
  }, [asesores, asesorOrigen])

  function aplicarAsesor(
    id: string | null,
    nombre: string | null,
    candidatos: AsesorOpcion[]
  ) {
    setAsesorId(id ?? "")
    setAsesorOrigen(id ? null : { nombre, candidatos })
  }

  async function traerDeSap() {
    const buscado = busqueda.trim()
    if (!buscado || buscandoSap) return
    setBuscandoSap(true)
    try {
      const orden = await buscarLoteEnSap(buscado)
      setLote(orden.lote)
      setCliente(orden.cliente ?? "")
      aplicarAsesor(orden.asesorId, orden.asesor, orden.asesorCandidatos)
      setTipoFinanciamiento(orden.tipoFinanciamiento ?? "")
      setOfrecimientos(orden.ofrecimientos ?? "")
      setRevision(revisionInicial(orden.ofrecimientos))
      toast({
        variant: "success",
        description: `Lote ${orden.lote} encontrado en SAP.`,
      })
    } catch (err) {
      limpiarDatosSap()
      toast({
        variant: "error",
        title: "No se pudo traer el lote de SAP",
        description: err instanceof EntregasApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setBuscandoSap(false)
    }
  }

  function limpiarDatosSap() {
    setLote("")
    setCliente("")
    setAsesorId("")
    setAsesorOrigen(null)
    setTipoFinanciamiento("")
    setOfrecimientos("")
    setRevision({ huerto: null, tanque: null, tag: null })
  }

  const faltantes = {
    lote: !lote.trim(),
    cliente: !cliente.trim(),
    fecha: !fecha,
    hora: !hora,
    asesor: !asesorId,
    revision: Object.values(revision).some((r) => r === null),
  }
  const hayFaltantes = Object.values(faltantes).some(Boolean)
  const errorDe = (campo: keyof typeof faltantes) =>
    intento && faltantes[campo] ? "Campo obligatorio" : null

  function crear() {
    setIntento(true)
    if (hayFaltantes) return
    startGuardando(async () => {
      try {
        await crearEntrega({
          lote: lote.trim(),
          asesorId,
          tipoFinanciamiento: tipoFinanciamiento || undefined,
          fechaPlanificada: fecha,
          horaPlanificada: hora,
          revision,
          trabajosExtra: trabajosExtra.trim() || undefined,
          comentario: comentario.trim() || undefined,
        })
        toast({
          variant: "success",
          description: `Proceso de entrega del lote ${lote.trim()} creado.`,
        })
        router.push("/entregas")
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo crear el proceso",
          description:
            err instanceof EntregasApiError ? err.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Entregas · Nuevo proceso"
            title="Crear proceso de entrega"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/entregas">
                  <ArrowLeft className="size-3.5" strokeWidth={2} />
                  Volver
                </Link>
              </Button>
            }
          />

          <div className="grid gap-x-6 gap-y-5 p-4 sm:p-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-muted-foreground block text-xs font-semibold">
                Buscar lote en SAP
              </label>
              <div className="flex gap-2">
                <input
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value)
                    // Si cambia el texto, lo cargado ya no corresponde a esta busqueda.
                    if (lote) limpiarDatosSap()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      traerDeSap()
                    }
                  }}
                  placeholder="Escribe el lote, ej. PV-J-047"
                  className="border-input bg-card focus:border-primary focus:ring-ring/15 h-11 w-full rounded-md border px-3.5 font-mono text-sm outline-none focus:ring-3"
                />
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={!busqueda.trim() || buscandoSap}
                  onClick={traerDeSap}
                >
                  <Search className="size-4" strokeWidth={2} />
                  {buscandoSap ? "Buscando…" : "Buscar"}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Todos los datos del lote se cargan desde SAP (orden abierta).
              </p>
            </div>

            <TextField
              label="Número de Lote *"
              placeholder="LT-XXX"
              value={lote}
              disabled
              error={errorDe("lote")}
            />

            <TextField
              label="Cliente *"
              placeholder="Nombre del cliente"
              value={cliente}
              disabled
              error={errorDe("cliente")}
            />
            <div className="space-y-1.5">
              <ComboboxField
                label="Asesor Asignado *"
                placeholder="Selecciona el asesor"
                searchPlaceholder="Buscar usuario…"
                options={opcionesAsesor}
                value={asesorId}
                onChange={setAsesorId}
              />
              {errorDe("asesor") ? (
                <p className="text-destructive text-xs font-medium">
                  Selecciona el asesor
                </p>
              ) : asesorOrigen ? (
                <p className="text-muted-foreground text-xs">
                  {asesorOrigen.candidatos.length > 1
                    ? `Varios usuarios coinciden con «${asesorOrigen.nombre}»; elige quién realiza la entrega.`
                    : asesorOrigen.nombre
                      ? `No se encontró un usuario para «${asesorOrigen.nombre}»; selecciónalo manualmente.`
                      : "Selecciona quién realiza la entrega."}
                </p>
              ) : null}
            </div>
            <div>
              <TextField
                type="date"
                label="Fecha Planificada de Entrega *"
                value={fecha}
                onChange={setFecha}
              />
              {errorDe("fecha") ? (
                <p className="text-destructive mt-1.5 text-xs font-medium">
                  {errorDe("fecha")}
                </p>
              ) : null}
            </div>
            <div>
              <TextField
                type="time"
                label="Hora Planificada de Entrega *"
                value={hora}
                onChange={setHora}
              />
              {errorDe("hora") ? (
                <p className="text-destructive mt-1.5 text-xs font-medium">
                  {errorDe("hora")}
                </p>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <AdvertenciaAgenda
                asesorId={asesorId}
                fecha={fecha}
                hora={hora}
                onSugerir={(sugerida) => {
                  setFecha(sugerida.fecha)
                  setHora(sugerida.hora)
                }}
              />
            </div>

            <SelectField
              label="Tipo Financiamiento"
              placeholder="Selecciona el tipo"
              options={TIPOS_FINANCIAMIENTO}
              value={tipoFinanciamiento}
              onValueChange={setTipoFinanciamiento}
            />

            <div className="md:col-span-2 md:grid md:grid-cols-2 md:gap-x-6">
              <div>
                <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                  Ofrecimientos (Oferta)
                </label>
                <Textarea
                  rows={3}
                  value={ofrecimientos}
                  readOnly
                  placeholder="Se carga al elegir el lote"
                  className={cn(textareaClase, "bg-muted/60 cursor-default")}
                />
              </div>
            </div>

            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Revisión ofrecimientos
              </label>
              <div className="border-border space-y-3 rounded-md border p-4">
                {ITEMS_REVISION.map((item) => (
                  <OpcionRevision
                    key={item.id}
                    label={item.label}
                    value={revision[item.id]}
                    onChange={(valor) =>
                      setRevision((prev) => ({ ...prev, [item.id]: valor }))
                    }
                  />
                ))}
                {intento && faltantes.revision ? (
                  <p className="text-destructive text-xs font-medium">
                    Elige una opción en Huerto, Tanque y Tag Ingreso.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-[11px]">
                    SI · NO · PD (pendiente) · NA (no aplica). Lo ofrecido en la oferta
                    viene marcado en SI.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Trabajos extra
              </label>
              <Textarea
                rows={5}
                value={trabajosExtra}
                onChange={(e) => setTrabajosExtra(e.target.value)}
                placeholder="Escriba trabajos extra"
                className={textareaClase}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Comentario (opcional)
              </label>
              <Textarea
                rows={3}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escriba un comentario extra para el proceso…"
                className={textareaClase}
              />
            </div>

            <div className="md:col-span-2">
              <Button size="lg" onClick={crear} disabled={guardando || hayFaltantes}>
                {guardando ? "Creando…" : "Crear"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
