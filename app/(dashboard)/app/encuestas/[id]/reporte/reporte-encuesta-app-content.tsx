"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Send,
  Star,
  TrendingUp,
} from "lucide-react"

import { BotonImprimir } from "@/components/shared/boton-imprimir"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { KpiCard } from "@/components/shared/kpi-card"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  listarEncuestasApp,
  obtenerResultadosEncuestaApp,
} from "@/lib/api/app-encuestas-api"
import { descargarReporteEncuestaAppExcel } from "@/lib/app-encuestas-reporte"
import { useRouter } from "@/lib/navigation"
import { cn } from "@/lib/utils"

import {
  ESTADO_ENCUESTA_LABELS,
  TIPO_PREGUNTA_LABELS,
  VARIANTE_ESTADO_ENCUESTA,
  formatearFechaHora,
  porcentaje,
  type EncuestaResumen,
  type ResultadoPregunta,
  type ResultadosEncuesta,
} from "../../datos"

// Color de cada valor de la escala 1..5 (rojo → verde), mismos tokens que RatingScale.
const COLOR_ESCALA: Record<number, string> = {
  1: "bg-status-bloqueado",
  2: "bg-primary",
  3: "bg-status-reservado",
  4: "bg-lime-500",
  5: "bg-status-disponible",
}

function mensajeDeError(err: unknown): string {
  return err instanceof Error ? err.message : "Ocurrió un error inesperado."
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

// `embebido`: dentro de la página /reportes (reporte "Encuestas de la app", permiso
// reportes:encuestas-app) — sin barra superior ni enlace a App → Encuestas, que esa
// persona puede no tener; cambiar de encuesta avisa a `onCambiarEncuesta` en vez de
// navegar.
export function ReporteEncuestaAppContent({
  id,
  embebido = false,
  onCambiarEncuesta,
}: {
  id: number
  embebido?: boolean
  onCambiarEncuesta?: (id: number) => void
}) {
  const router = useRouter()
  const [resultados, setResultados] = useState<ResultadosEncuesta | null>(null)
  const [encuestas, setEncuestas] = useState<EncuestaResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<"preguntas" | "personas">("preguntas")
  const [busqueda, setBusqueda] = useState("")

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setResultados(await obtenerResultadosEncuestaApp(id))
      setError(null)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    listarEncuestasApp()
      .then(setEncuestas)
      .catch(() => setEncuestas([]))
  }, [])

  const personasVisibles = useMemo(() => {
    if (!resultados) return []
    const termino = normalizar(busqueda.trim())
    if (!termino) return resultados.personas
    return resultados.personas.filter((p) =>
      normalizar(`${p.nombre ?? ""} ${p.cedula}`).includes(termino)
    )
  }, [resultados, busqueda])

  return (
    <div className="flex h-full flex-col">
      {embebido ? null : (
        <div className="no-print print:hidden">
          <DashboardTopbar />
        </div>
      )}

      {/* En la impresión solo va la versión de abajo (VersionImpresion): título, los 4
          indicadores, el resumen de TODAS las preguntas y las respuestas por persona.
          print-color-adjust para que el navegador imprima el color de las barras. */}
      <div className="reporte-encuesta-app flex-1 overflow-y-auto p-4 [print-color-adjust:exact] sm:p-5 lg:p-6.5 print:overflow-visible! print:p-0!">
        {resultados ? <VersionImpresion resultados={resultados} /> : null}

        <div className="print:hidden [.modo-pdf_&]:hidden">
          <div className="mb-4.5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {embebido ? null : (
                <Link
                  href="/app/encuestas"
                  className="no-print text-muted-foreground hover:text-primary mb-2 inline-flex items-center gap-1 text-xs font-semibold"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={1.8} />
                  Encuestas de la app
                </Link>
              )}
              <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                Reporte de encuesta
              </p>
              <h1 className="truncate text-2xl font-extrabold tracking-tight">
                {resultados?.encuesta.titulo ?? "…"}
              </h1>
              {resultados ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    variant={VARIANTE_ESTADO_ENCUESTA[resultados.encuesta.estado]}
                  >
                    {ESTADO_ENCUESTA_LABELS[resultados.encuesta.estado]}
                  </StatusBadge>
                  {resultados.encuesta.etiquetaInterna ? (
                    <span className="text-primary text-xs font-semibold">
                      {resultados.encuesta.etiquetaInterna}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="no-print flex flex-wrap items-center gap-2">
              {encuestas.length > 1 ? (
                <div className="w-64">
                  <SelectField
                    placeholder="Cambiar de encuesta"
                    opciones={encuestas.map((e) => ({
                      value: String(e.id),
                      label: e.etiquetaInterna
                        ? `${e.etiquetaInterna} — ${e.titulo}`
                        : e.titulo,
                    }))}
                    value={String(id)}
                    onValueChange={(v) =>
                      onCambiarEncuesta
                        ? onCambiarEncuesta(Number(v))
                        : router.push(`/app/encuestas/${v}/reporte`)
                    }
                  />
                </div>
              ) : null}
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Actualizar"
                disabled={cargando}
                onClick={() => void cargar()}
              >
                <RefreshCw className="size-3.5" strokeWidth={1.8} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!resultados}
                onClick={() => resultados && descargarReporteEncuestaAppExcel(resultados)}
              >
                <FileSpreadsheet className="size-3.5" strokeWidth={1.8} />
                Excel
              </Button>
              <BotonImprimir
                type="button"
                size="sm"
                selector=".reporte-encuesta-app"
                nombreArchivo={`Encuesta app - ${resultados?.encuesta.titulo ?? id}`}
                disabled={!resultados}
              />
            </div>
          </div>

          {cargando && !resultados ? (
            <div className="flex items-center justify-center py-24">
              <Spinner />
            </div>
          ) : error ? (
            <EmptyState title="No se pudo cargar el reporte" description={error} dashed />
          ) : resultados ? (
            <div className="space-y-4.5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                  label="Asignadas"
                  value={resultados.asignadas}
                  trendLabel={
                    resultados.canceladas > 0
                      ? `${resultados.canceladas} canceladas aparte`
                      : undefined
                  }
                  icon={
                    <Send className="text-accent-foreground size-4" strokeWidth={1.7} />
                  }
                />
                <KpiCard
                  label="Respondidas"
                  value={resultados.respondidas}
                  trendLabel={`${resultados.pendientes} pendientes`}
                  icon={
                    <CheckCircle2
                      className="text-accent-foreground size-4"
                      strokeWidth={1.7}
                    />
                  }
                />
                <KpiCard
                  label="Tasa de respuesta"
                  value={porcentaje(resultados.tasaRespuesta)}
                  icon={
                    <TrendingUp
                      className="text-accent-foreground size-4"
                      strokeWidth={1.7}
                    />
                  }
                />
                <KpiCard
                  label="Satisfacción general"
                  value={
                    resultados.satisfaccionGeneral != null
                      ? `${resultados.satisfaccionGeneral.toFixed(1)} / 5`
                      : "—"
                  }
                  trendLabel="Promedio de las preguntas de escala"
                  icon={
                    <Star className="text-accent-foreground size-4" strokeWidth={1.7} />
                  }
                />
              </div>

              <div className="no-print">
                <PillTabs
                  tabs={[
                    { id: "preguntas", label: "Resumen por pregunta" },
                    {
                      id: "personas",
                      label: `Respuestas por persona (${resultados.personas.length})`,
                    },
                  ]}
                  value={vista}
                  onChange={(v) => setVista(v as "preguntas" | "personas")}
                />
              </div>

              {vista === "preguntas" ? (
                resultados.respondidas === 0 ? (
                  <EmptyState
                    title="Todavía nadie respondió"
                    description="Los resultados aparecerán aquí cuando los usuarios respondan en la app."
                    dashed
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {resultados.preguntas.map((q, i) => (
                      <TarjetaPregunta key={q.id} pregunta={q} numero={i + 1} />
                    ))}
                  </div>
                )
              ) : (
                <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
                  <div className="bg-muted/60 border-border flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="relative w-full max-w-xs">
                      <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
                        strokeWidth={1.8}
                      />
                      <Input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre o cédula"
                        className="bg-card pl-8"
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {personasVisibles.length} de {resultados.personas.length}
                    </span>
                  </div>
                  {personasVisibles.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-10 text-center text-xs">
                      {resultados.personas.length === 0
                        ? "Todavía nadie respondió."
                        : "Sin resultados."}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[12.5px]">
                        <thead className="bg-muted/40 text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
                          <tr>
                            <th className="sticky left-0 bg-inherit px-4 py-2.5">
                              Persona
                            </th>
                            <th className="px-3 py-2.5 whitespace-nowrap">Respondió</th>
                            {resultados.preguntas.map((q, i) => (
                              <th
                                key={q.id}
                                className="max-w-[220px] min-w-[160px] px-3 py-2.5 normal-case"
                                title={q.text}
                              >
                                <span className="line-clamp-2">
                                  {i + 1}. {q.text}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-border divide-y">
                          {personasVisibles.map((p) => (
                            <tr
                              key={p.asignacionId}
                              className="hover:bg-muted/40 align-top"
                            >
                              <td className="bg-card sticky left-0 px-4 py-2.5">
                                <p className="font-semibold whitespace-nowrap">
                                  {p.nombre || "Sin nombre"}
                                </p>
                                <p className="text-muted-foreground font-mono text-[11px]">
                                  {p.cedula}
                                </p>
                              </td>
                              <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                                {formatearFechaHora(p.respondidaEn)}
                              </td>
                              {resultados.preguntas.map((q) => (
                                <td key={q.id} className="px-3 py-2.5">
                                  {p.valores[q.id] || (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// Versión solo para imprimir / PDF del teléfono (en pantalla está oculta): encabezado,
// los 4 indicadores en una fila, el resumen de todas las preguntas y, después, lo que
// respondió cada persona (en bloques, porque una tabla con todas las preguntas no
// entra a lo ancho de una hoja A4).
function VersionImpresion({ resultados: r }: { resultados: ResultadosEncuesta }) {
  return (
    <div className="hidden text-black print:block [.modo-pdf_&]:block">
      <header className="mb-4 border-b border-neutral-300 pb-3">
        <p className="text-[10px] font-bold tracking-wide text-neutral-500 uppercase">
          Reporte de encuesta · App
        </p>
        <h1 className="text-[20px] leading-tight font-extrabold">{r.encuesta.titulo}</h1>
        <p className="mt-0.5 text-[11px] text-neutral-600">
          {r.encuesta.etiquetaInterna ? `${r.encuesta.etiquetaInterna} · ` : ""}
          Generado el {formatearFechaHora(new Date().toISOString())}
        </p>
      </header>

      <div className="mb-5 grid grid-cols-4 gap-2">
        {[
          ["Asignadas", String(r.asignadas)],
          ["Respondidas", String(r.respondidas)],
          ["Tasa de respuesta", porcentaje(r.tasaRespuesta)],
          [
            "Satisfacción general",
            r.satisfaccionGeneral != null
              ? `${r.satisfaccionGeneral.toFixed(1)} / 5`
              : "—",
          ],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-md border border-neutral-300 px-3 py-2">
            <p className="text-[10px] font-semibold text-neutral-500">{etiqueta}</p>
            <p className="font-mono text-[18px] font-semibold">{valor}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-[13px] font-bold tracking-wide uppercase">
        Resumen por pregunta
      </h2>
      {r.respondidas === 0 ? (
        <p className="mb-5 text-[12px] text-neutral-600">Todavía nadie respondió.</p>
      ) : (
        <div className="mb-6 space-y-3">
          {r.preguntas.map((q, i) => (
            <TarjetaPregunta key={q.id} pregunta={q} numero={i + 1} />
          ))}
        </div>
      )}

      {r.personas.length > 0 ? (
        <>
          <h2 className="mb-2 break-before-page text-[13px] font-bold tracking-wide uppercase">
            Respuestas por persona ({r.personas.length})
          </h2>
          <div className="space-y-2.5">
            {r.personas.map((p) => (
              <div
                key={p.asignacionId}
                className="break-inside-avoid rounded-md border border-neutral-300 px-3 py-2"
              >
                <p className="text-[12px] font-bold">
                  {p.nombre || "Sin nombre"}{" "}
                  <span className="font-mono font-normal text-neutral-600">
                    · {p.cedula} · {formatearFechaHora(p.respondidaEn)}
                  </span>
                </p>
                <dl className="mt-1 space-y-0.5 text-[11px]">
                  {r.preguntas.map((q, i) => (
                    <div key={q.id} className="grid grid-cols-[1fr_1fr] gap-3">
                      <dt className="text-neutral-600">
                        {i + 1}. {q.text}
                      </dt>
                      <dd className="font-semibold">{p.valores[q.id] || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function TarjetaPregunta({
  pregunta: q,
  numero,
}: {
  pregunta: ResultadoPregunta
  numero: number
}) {
  return (
    <section className="bg-card border-border break-inside-avoid rounded-lg border p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="bg-brand-gradient flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-extrabold text-white">
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug font-bold">{q.text}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {TIPO_PREGUNTA_LABELS[q.type]} · {q.respuestas}{" "}
            {q.respuestas === 1 ? "respuesta" : "respuestas"}
          </p>
        </div>
      </div>

      {q.respuestas === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-xs">
          Nadie respondió esta pregunta (no era obligatoria).
        </p>
      ) : q.type === "rating" ? (
        <div>
          <p className="mb-3 flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-semibold">
              {q.promedio != null ? q.promedio.toFixed(1) : "—"}
            </span>
            <span className="text-muted-foreground text-xs">/ 5 de promedio</span>
          </p>
          <div className="space-y-1.5">
            {[...(q.distribucion ?? [])].reverse().map((d) => (
              <Barra
                key={d.valor}
                etiqueta={String(d.valor)}
                cantidad={d.cantidad}
                total={q.respuestas}
                colorClase={COLOR_ESCALA[d.valor] ?? "bg-primary"}
                etiquetaAncho="w-6"
              />
            ))}
          </div>
        </div>
      ) : q.type === "yesno" ? (
        <div className="space-y-1.5">
          <Barra
            etiqueta="Sí"
            cantidad={q.si ?? 0}
            total={q.respuestas}
            colorClase="bg-status-disponible"
          />
          <Barra
            etiqueta="No"
            cantidad={q.no ?? 0}
            total={q.respuestas}
            colorClase="bg-status-bloqueado"
          />
        </div>
      ) : q.type === "text" ? (
        <ListaTextos textos={q.textos ?? []} />
      ) : (
        <div className="space-y-1.5">
          {[...(q.conteoOpciones ?? [])]
            .sort((a, b) => b.cantidad - a.cantidad)
            .map((o) => (
              <Barra
                key={o.id}
                etiqueta={o.label}
                cantidad={o.cantidad}
                total={q.respuestas}
                colorClase="bg-primary"
                etiquetaAncho="w-32"
              />
            ))}
          {(q.otros ?? []).length > 0 ? (
            <div className="border-border mt-3 border-t pt-3">
              <p className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase">
                Otro ({q.otros!.length})
              </p>
              <ListaTextos textos={q.otros!} />
            </div>
          ) : null}
          {q.type === "multiple_choice" ? (
            <p className="text-muted-foreground pt-1 text-[11px]">
              Selección múltiple: el porcentaje es sobre las personas que respondieron,
              por eso puede sumar más de 100%.
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}

function Barra({
  etiqueta,
  cantidad,
  total,
  colorClase,
  etiquetaAncho = "w-10",
}: {
  etiqueta: string
  cantidad: number
  total: number
  colorClase: string
  etiquetaAncho?: string
}) {
  const proporcion = total ? cantidad / total : 0
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span
        className={cn("shrink-0 truncate font-semibold", etiquetaAncho)}
        title={etiqueta}
      >
        {etiqueta}
      </span>
      <div className="bg-muted h-5 flex-1 overflow-hidden rounded">
        <div
          className={cn("h-full rounded transition-[width] duration-500", colorClase)}
          style={{ width: `${Math.max(proporcion * 100, cantidad > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono">
        {cantidad}{" "}
        <span className="text-muted-foreground">({porcentaje(proporcion)})</span>
      </span>
    </div>
  )
}

function ListaTextos({ textos }: { textos: string[] }) {
  if (textos.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-xs">Sin comentarios.</p>
    )
  }
  return (
    <ul className="max-h-64 space-y-1.5 overflow-y-auto print:max-h-none [.modo-pdf_&]:max-h-none">
      {textos.map((t, i) => (
        <li
          key={i}
          className="bg-muted/60 rounded-md px-3 py-2 text-[12.5px] leading-snug"
        >
          {t}
        </li>
      ))}
    </ul>
  )
}
