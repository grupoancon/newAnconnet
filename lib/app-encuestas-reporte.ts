// Excel (CSV) del reporte de una encuesta de la app: resumen por pregunta y, debajo,
// una fila por persona con todas sus respuestas. Mismo formato que
// lib/encuestas-reporte.ts (CSV con ";" y BOM para que Excel respete las tildes).

import {
  TIPO_PREGUNTA_LABELS,
  type ResultadosEncuesta,
} from "@/app/(dashboard)/app/encuestas/datos"

function celdaCsv(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

function fechaHora(valor: string | null): string {
  if (!valor) return ""
  const d = new Date(valor)
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

function pct(parte: number, total: number): string {
  return total ? `${Math.round((parte / total) * 100)}%` : "0%"
}

export function filasReporteEncuestaApp(r: ResultadosEncuesta): string[][] {
  const filas: string[][] = [
    ["Reporte de encuesta de la app"],
    ["Encuesta", r.encuesta.titulo],
    ...(r.encuesta.etiquetaInterna ? [["Subtítulo interno", r.encuesta.etiquetaInterna]] : []),
    ["Generado", fechaHora(new Date().toISOString())],
    [],
    ["Asignadas", String(r.asignadas)],
    ["Respondidas", String(r.respondidas)],
    ["Pendientes", String(r.pendientes)],
    ["Canceladas", String(r.canceladas)],
    ["Tasa de respuesta", `${Math.round(r.tasaRespuesta * 100)}%`],
    [
      "Satisfacción general (1 a 5)",
      r.satisfaccionGeneral != null ? r.satisfaccionGeneral.toFixed(2) : "",
    ],
    [],
    ["RESUMEN POR PREGUNTA"],
  ]

  r.preguntas.forEach((q, i) => {
    filas.push([])
    filas.push([`${i + 1}. ${q.text}`, TIPO_PREGUNTA_LABELS[q.type], `${q.respuestas} respuestas`])
    if (q.type === "rating") {
      filas.push(["Promedio", q.promedio != null ? q.promedio.toFixed(2) : ""])
      for (const d of q.distribucion ?? []) {
        filas.push([String(d.valor), String(d.cantidad), pct(d.cantidad, q.respuestas)])
      }
    } else if (q.type === "yesno") {
      filas.push(["Sí", String(q.si ?? 0), pct(q.si ?? 0, q.respuestas)])
      filas.push(["No", String(q.no ?? 0), pct(q.no ?? 0, q.respuestas)])
    } else if (q.type === "text") {
      for (const t of q.textos ?? []) filas.push(["", t])
    } else {
      for (const o of q.conteoOpciones ?? []) {
        filas.push([o.label, String(o.cantidad), pct(o.cantidad, q.respuestas)])
      }
      if ((q.otros ?? []).length > 0) {
        filas.push([`Otro (${q.otros!.length})`])
        for (const t of q.otros!) filas.push(["", t])
      }
    }
  })

  filas.push([], ["RESPUESTAS POR PERSONA"])
  filas.push([
    "Nombre",
    "Cédula",
    "Respondió",
    ...r.preguntas.map((q, i) => `${i + 1}. ${q.text}`),
  ])
  for (const p of r.personas) {
    filas.push([
      p.nombre ?? "",
      p.cedula,
      fechaHora(p.respondidaEn),
      ...r.preguntas.map((q) => p.valores[q.id] ?? ""),
    ])
  }
  return filas
}

export function descargarReporteEncuestaAppExcel(r: ResultadosEncuesta) {
  const contenido =
    "﻿" + filasReporteEncuestaApp(r).map((f) => f.map(celdaCsv).join(";")).join("\r\n")
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  const nombre = r.encuesta.titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  enlace.href = url
  enlace.download = `encuesta-app-${nombre || r.encuesta.id}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
