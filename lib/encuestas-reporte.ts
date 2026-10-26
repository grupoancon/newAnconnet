// Reporte general de encuestas (PDF y Excel/CSV) con los mismos filtros del listado en
// pantalla. Igual que lib/entregas-reporte.ts: se arma en el navegador con las filas ya
// cargadas y jspdf se importa recién al pedir el PDF.

import {
  ENCUESTADORES,
  MEDIOS_CONTACTO,
  MEDIOS_VISITA,
  etiquetaEncuestador,
  etiquetaMedioContacto,
  etiquetaMedioVisita,
  type EncuestaListado,
} from "@/lib/api/encuestas-api"

export type OpcionesReporteEncuestas = {
  filas: EncuestaListado[]
  // Resumen legible de los filtros activos, ej. ["Pestaña: Realizadas", "Proyecto: X"]
  filtros: string[]
}

type Conteo = { etiqueta: string; cantidad: number }
type GrupoConteo = { grupo: string; total: number; items: Conteo[] }

export type ResumenEncuestas = {
  total: number
  realizadas: number
  pendientes: number
  medioContacto: GrupoConteo[]
  medioVisita: Conteo[]
  encuestador: Conteo[]
}

function contar(valores: string[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const v of valores) mapa.set(v, (mapa.get(v) ?? 0) + 1)
  return mapa
}

// Ordena de mayor a menor y deja fuera los que tienen 0.
function ordenar(items: Conteo[]): Conteo[] {
  return items.filter((i) => i.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)
}

export function calcularResumen(filas: EncuestaListado[]): ResumenEncuestas {
  const hechas = filas.filter((f) => f.realizada)

  // Medio de contacto agrupado como en el formulario (Redes sociales, Ferias, …). Lo
  // que no está en la lista es el texto libre de "otra feria / otro stand" (o valores
  // viejos): va a su propio grupo con el texto tal cual.
  const porContacto = contar(hechas.map((f) => f.medioContacto ?? ""))
  const conocidos = new Set<string>()
  const medioContacto: GrupoConteo[] = []
  for (const grupo of MEDIOS_CONTACTO) {
    const items = ordenar(
      grupo.opciones.map((o) => {
        conocidos.add(o.value)
        return { etiqueta: o.label, cantidad: porContacto.get(o.value) ?? 0 }
      })
    )
    if (items.length) {
      medioContacto.push({
        grupo: grupo.grupo ?? "Otros",
        total: items.reduce((t, i) => t + i.cantidad, 0),
        items,
      })
    }
  }
  const libres = ordenar(
    Array.from(porContacto.entries())
      .filter(([valor]) => valor && !conocidos.has(valor))
      .map(([valor, cantidad]) => ({ etiqueta: valor, cantidad }))
  )
  if (libres.length) {
    medioContacto.push({
      grupo: "Otra feria / stand",
      total: libres.reduce((t, i) => t + i.cantidad, 0),
      items: libres,
    })
  }
  medioContacto.sort((a, b) => b.total - a.total)

  const porVisita = contar(hechas.map((f) => f.medioVisita ?? ""))
  const visitaConocidos = new Set(MEDIOS_VISITA.map((o) => o.value))
  const medioVisita = ordenar([
    ...MEDIOS_VISITA.map((o) => ({
      etiqueta: o.label,
      cantidad: porVisita.get(o.value) ?? 0,
    })),
    ...Array.from(porVisita.entries())
      .filter(([v]) => v && !visitaConocidos.has(v))
      .map(([v, cantidad]) => ({ etiqueta: v, cantidad })),
  ])

  const porEncuestador = contar(hechas.map((f) => f.encuestador ?? ""))
  const encuestadorConocidos = new Set(ENCUESTADORES.map((o) => o.value))
  const encuestador = ordenar([
    ...ENCUESTADORES.map((o) => ({
      etiqueta: o.label,
      cantidad: porEncuestador.get(o.value) ?? 0,
    })),
    ...Array.from(porEncuestador.entries())
      .filter(([v]) => v && !encuestadorConocidos.has(v))
      .map(([v, cantidad]) => ({ etiqueta: v, cantidad })),
  ])

  return {
    total: filas.length,
    realizadas: hechas.length,
    pendientes: filas.length - hechas.length,
    medioContacto,
    medioVisita,
    encuestador,
  }
}

function porcentaje(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)}%` : "—"
}

function fechaCorta(valor: string | null): string {
  if (!valor) return ""
  const [fecha, hora] = valor.split(" ")
  const [anio, mes, dia] = (fecha ?? "").split("-")
  if (!anio || !mes || !dia) return valor
  return `${dia}/${mes}/${anio}${hora ? ` ${hora}` : ""}`
}

function marcaAhora(): string {
  const f = new Date()
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(f.getHours())}:${dos(f.getMinutes())}`
}

function nombreArchivo(extension: string): string {
  const f = new Date()
  const dos = (n: number) => String(n).padStart(2, "0")
  return `reporte-encuestas-${f.getFullYear()}${dos(f.getMonth() + 1)}${dos(f.getDate())}.${extension}`
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

// --- Excel (CSV) -------------------------------------------------------------------
// ";" como separador y BOM UTF-8: así Excel en español lo abre en columnas y con tildes.

function celdaCsv(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

export function descargarReporteEncuestasExcel(opciones: OpcionesReporteEncuestas) {
  const r = calcularResumen(opciones.filas)
  const lineas: string[][] = [
    ["Reporte de encuestas de satisfacción"],
    ["Generado", marcaAhora()],
    ["Filtros", opciones.filtros.join(" | ") || "Ninguno"],
    [],
    ["Procesos", String(r.total)],
    ["Encuestas realizadas", String(r.realizadas)],
    ["Pendientes", String(r.pendientes)],
    ["Cobertura", porcentaje(r.realizadas, r.total)],
    [],
    ["¿Por qué medio se enteró de nosotros?", "Cantidad", "% de realizadas"],
  ]
  for (const g of r.medioContacto) {
    lineas.push([
      g.grupo.toUpperCase(),
      String(g.total),
      porcentaje(g.total, r.realizadas),
    ])
    for (const i of g.items) {
      lineas.push([
        `  ${i.etiqueta}`,
        String(i.cantidad),
        porcentaje(i.cantidad, r.realizadas),
      ])
    }
  }
  lineas.push([], ["¿Nos visitó antes de comprar?", "Cantidad", "% de realizadas"])
  for (const i of r.medioVisita) {
    lineas.push([i.etiqueta, String(i.cantidad), porcentaje(i.cantidad, r.realizadas)])
  }
  lineas.push([], ["Encuestador", "Cantidad", "% de realizadas"])
  for (const i of r.encuestador) {
    lineas.push([i.etiqueta, String(i.cantidad), porcentaje(i.cantidad, r.realizadas)])
  }
  lineas.push(
    [],
    [
      "Proceso",
      "Cliente",
      "Lote",
      "Proyecto",
      "Asesor",
      "Fecha del proceso",
      "Encuesta",
      "Medio por el que se enteró",
      "Visitó antes de comprar",
      "Encuestador",
      "Fecha de la encuesta",
    ]
  )
  for (const e of opciones.filas) {
    lineas.push([
      String(e.processId),
      e.cliente ?? "",
      e.lote ?? "",
      e.proyecto ?? "",
      e.asesor ?? "",
      fechaCorta(e.fechaProceso),
      e.realizada ? "Realizada" : "Pendiente",
      e.realizada ? etiquetaMedioContacto(e.medioContacto) : "",
      e.realizada ? etiquetaMedioVisita(e.medioVisita) : "",
      e.realizada ? etiquetaEncuestador(e.encuestador) : "",
      fechaCorta(e.fechaEncuesta),
    ])
  }

  descargar(
    new Blob(["﻿" + lineas.map((f) => f.map(celdaCsv).join(";")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    nombreArchivo("csv")
  )
}

// --- PDF ---------------------------------------------------------------------------

type Color = [number, number, number]
const NARANJA: Color = [245, 137, 31]
const NARANJA_CLARO: Color = [253, 236, 218]
const TEXTO: Color = [20, 22, 27]
const GRIS: Color = [107, 114, 128]
const BORDE: Color = [229, 231, 235]
const ZEBRA: Color = [249, 250, 251]
const VERDE: Color = [21, 128, 61]
const AMBAR: Color = [180, 83, 9]

type Columna = { titulo: string; ancho: number; centrada?: boolean }

export async function descargarReporteEncuestasPdf(opciones: OpcionesReporteEncuestas) {
  const doc = await generarReporteEncuestasPdf(opciones)
  doc.save(nombreArchivo("pdf"))
}

// Separado de la descarga para poder previsualizarlo (doc.output("bloburl")).
export async function generarReporteEncuestasPdf(opciones: OpcionesReporteEncuestas) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const margen = 28
  const anchoUtil = anchoPagina - margen * 2
  const limiteInferior = altoPagina - margen - 14
  const r = calcularResumen(opciones.filas)

  function encabezadoDePagina(): number {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(...GRIS)
    doc.text("GRUPO ANCON · INTRANET", margen, margen)
    doc.setFontSize(18)
    doc.setTextColor(...TEXTO)
    doc.text("Reporte de encuestas de satisfacción", margen, margen + 22)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...GRIS)
    doc.text(`Generado el ${marcaAhora()}`, anchoPagina - margen, margen + 22, {
      align: "right",
    })
    doc.setDrawColor(...NARANJA)
    doc.setLineWidth(2)
    doc.line(margen, margen + 30, anchoPagina - margen, margen + 30)
    return margen + 46
  }

  let y = encabezadoDePagina()

  // --- filtros ---
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...TEXTO)
  const lineasFiltros = doc.splitTextToSize(
    "Filtros: " + (opciones.filtros.length ? opciones.filtros.join("  ·  ") : "ninguno"),
    anchoUtil
  ) as string[]
  for (const linea of lineasFiltros) {
    doc.text(linea, margen, y)
    y += 11
  }
  y += 8

  // --- tarjetas de totales ---
  const tarjetas: { titulo: string; valor: string; color: Color }[] = [
    { titulo: "Procesos aprobados", valor: String(r.total), color: TEXTO },
    { titulo: "Encuestas realizadas", valor: String(r.realizadas), color: VERDE },
    { titulo: "Pendientes", valor: String(r.pendientes), color: AMBAR },
    { titulo: "Cobertura", valor: porcentaje(r.realizadas, r.total), color: NARANJA },
  ]
  const separacion = 10
  const anchoTarjeta = (anchoUtil - separacion * (tarjetas.length - 1)) / tarjetas.length
  tarjetas.forEach((t, i) => {
    const x = margen + i * (anchoTarjeta + separacion)
    doc.setDrawColor(...BORDE)
    doc.setLineWidth(0.6)
    doc.roundedRect(x, y, anchoTarjeta, 46, 4, 4, "S")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(...GRIS)
    doc.text(t.titulo.toUpperCase(), x + 10, y + 15)
    doc.setFontSize(17)
    doc.setTextColor(...t.color)
    doc.text(t.valor, x + 10, y + 36)
  })
  y += 46 + 20

  // --- distribuciones: tres columnas ---
  // Cada bloque es una lista "etiqueta · barra · cantidad (%)". El de medio de contacto
  // lleva subtítulos por grupo.
  type Linea =
    | { tipo: "grupo"; etiqueta: string; cantidad: number }
    | { tipo: "item"; etiqueta: string; cantidad: number }
  const bloques: { titulo: string; lineas: Linea[] }[] = [
    {
      titulo: "¿Por qué medio se enteró de nosotros?",
      lineas: r.medioContacto.flatMap((g) => [
        { tipo: "grupo" as const, etiqueta: g.grupo, cantidad: g.total },
        ...g.items.map((i) => ({ tipo: "item" as const, ...i })),
      ]),
    },
    {
      titulo: "¿Nos visitó antes de comprar?",
      lineas: r.medioVisita.map((i) => ({ tipo: "item" as const, ...i })),
    },
    {
      titulo: "Encuestas por encuestador",
      lineas: r.encuestador.map((i) => ({ tipo: "item" as const, ...i })),
    },
  ]
  const anchos = [anchoUtil * 0.42, anchoUtil * 0.29, anchoUtil * 0.29]
  const separacionBloque = 14
  const altoLinea = 15
  const maximo = Math.max(1, ...bloques.flatMap((b) => b.lineas.map((l) => l.cantidad)))

  let yMaxBloques = y
  let xBloque = margen
  bloques.forEach((bloque, indice) => {
    const ancho = anchos[indice] - (indice < bloques.length - 1 ? separacionBloque : 0)
    let yb = y
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...TEXTO)
    doc.text(bloque.titulo, xBloque, yb)
    yb += 6
    doc.setDrawColor(...BORDE)
    doc.setLineWidth(0.5)
    doc.line(xBloque, yb, xBloque + ancho, yb)
    yb += 13

    if (bloque.lineas.length === 0) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(...GRIS)
      doc.text("Sin encuestas realizadas.", xBloque, yb)
      yb += altoLinea
    }

    const anchoEtiqueta = ancho * 0.42
    const anchoValor = 62
    const anchoBarra = ancho - anchoEtiqueta - anchoValor - 8
    for (const linea of bloque.lineas) {
      if (yb > limiteInferior) break
      const esGrupo = linea.tipo === "grupo"
      doc.setFont("helvetica", esGrupo ? "bold" : "normal")
      doc.setFontSize(esGrupo ? 8 : 8.5)
      doc.setTextColor(...(esGrupo ? GRIS : TEXTO))
      const etiqueta = esGrupo ? linea.etiqueta.toUpperCase() : linea.etiqueta
      const recortada = (
        doc.splitTextToSize(etiqueta, anchoEtiqueta - (esGrupo ? 0 : 8)) as string[]
      )[0]
      doc.text(recortada, xBloque + (esGrupo ? 0 : 8), yb)

      const xBarra = xBloque + anchoEtiqueta
      const largo = Math.max(2, (linea.cantidad / maximo) * anchoBarra)
      doc.setFillColor(...(esGrupo ? NARANJA_CLARO : NARANJA))
      doc.roundedRect(xBarra, yb - 7, largo, 8, 2, 2, "F")

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      doc.setTextColor(...TEXTO)
      doc.text(
        `${linea.cantidad}  (${porcentaje(linea.cantidad, r.realizadas)})`,
        xBloque + ancho,
        yb,
        { align: "right" }
      )
      yb += altoLinea
    }
    yMaxBloques = Math.max(yMaxBloques, yb)
    xBloque += anchos[indice]
  })

  // --- detalle: siempre arranca en página nueva para que el resumen quede limpio ---
  const base: Columna[] = [
    { titulo: "Proceso", ancho: 46, centrada: true },
    { titulo: "Cliente", ancho: 150 },
    { titulo: "Lote", ancho: 90 },
    { titulo: "Asesor", ancho: 120 },
    { titulo: "Encuesta", ancho: 62, centrada: true },
    { titulo: "Se enteró por", ancho: 140 },
    { titulo: "Visitó", ancho: 70 },
    { titulo: "Encuestador", ancho: 90 },
    { titulo: "Fecha", ancho: 70, centrada: true },
  ]
  const suma = base.reduce((t, c) => t + c.ancho, 0)
  const columnas = base.map((c) => ({ ...c, ancho: (c.ancho / suma) * anchoUtil }))
  const paddingX = 5
  const paddingY = 6
  const interlinea = 11

  function encabezadoDeTabla(yt: number): number {
    const alto = 22
    doc.setFillColor(...ZEBRA)
    doc.rect(margen, yt, anchoUtil, alto, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(...GRIS)
    let x = margen
    for (const c of columnas) {
      const texto = c.titulo.toUpperCase()
      if (c.centrada) doc.text(texto, x + c.ancho / 2, yt + 14, { align: "center" })
      else doc.text(texto, x + paddingX, yt + 14)
      x += c.ancho
    }
    doc.setDrawColor(...BORDE)
    doc.setLineWidth(0.5)
    doc.line(margen, yt + alto, anchoPagina - margen, yt + alto)
    return yt + alto
  }

  if (opciones.filas.length > 0) {
    doc.addPage()
    y = encabezadoDePagina()
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...TEXTO)
    doc.text(
      `Detalle · ${opciones.filas.length} ${opciones.filas.length === 1 ? "proceso" : "procesos"}`,
      margen,
      y
    )
    y = encabezadoDeTabla(y + 8)

    opciones.filas.forEach((e, indice) => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      const ancho = (i: number) => columnas[i].ancho - paddingX * 2
      const celdas: string[][] = [
        [`#${e.processId}`],
        doc.splitTextToSize((e.cliente ?? "—").toUpperCase(), ancho(1)),
        [e.lote ?? "—", ...(e.proyecto ? [e.proyecto] : [])],
        doc.splitTextToSize((e.asesor ?? "—").toUpperCase(), ancho(3)),
        [e.realizada ? "Realizada" : "Pendiente"],
        e.realizada
          ? doc.splitTextToSize(etiquetaMedioContacto(e.medioContacto), ancho(5))
          : ["—"],
        e.realizada
          ? doc.splitTextToSize(etiquetaMedioVisita(e.medioVisita), ancho(6))
          : ["—"],
        e.realizada
          ? doc.splitTextToSize(etiquetaEncuestador(e.encuestador), ancho(7))
          : ["—"],
        [e.fechaEncuesta ? fechaCorta(e.fechaEncuesta.split(" ")[0] ?? null) : "—"],
      ]
      const alto = Math.max(...celdas.map((c) => c.length)) * interlinea + paddingY * 2

      if (y + alto > limiteInferior) {
        doc.addPage()
        y = encabezadoDeTabla(encabezadoDePagina())
      }
      if (indice % 2 === 1) {
        doc.setFillColor(...ZEBRA)
        doc.rect(margen, y, anchoUtil, alto, "F")
      }

      let x = margen
      celdas.forEach((lineas, i) => {
        const columna = columnas[i]
        lineas.forEach((linea, n) => {
          // En "Lote" la segunda línea es el proyecto (secundaria); el resto son el
          // mismo texto partido en varias líneas.
          const secundaria = i === 2 && n > 0
          const estado = i === 4
          doc.setFont("helvetica", secundaria || i >= 5 ? "normal" : "bold")
          doc.setFontSize(secundaria ? 7 : 8)
          doc.setTextColor(
            ...(secundaria ? GRIS : estado ? (e.realizada ? VERDE : AMBAR) : TEXTO)
          )
          const yTexto = y + paddingY + 8 + n * interlinea
          if (columna.centrada)
            doc.text(linea, x + columna.ancho / 2, yTexto, { align: "center" })
          else doc.text(linea, x + paddingX, yTexto)
        })
        x += columna.ancho
      })

      doc.setDrawColor(...BORDE)
      doc.setLineWidth(0.4)
      doc.line(margen, y + alto, anchoPagina - margen, y + alto)
      y += alto
    })
  } else {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...GRIS)
    doc.text("No hay procesos con los filtros elegidos.", margen, yMaxBloques + 10)
  }

  const totalPaginas = doc.getNumberOfPages()
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    doc.text(`Página ${p} de ${totalPaginas}`, anchoPagina - margen, altoPagina - 14, {
      align: "right",
    })
  }

  return doc
}
