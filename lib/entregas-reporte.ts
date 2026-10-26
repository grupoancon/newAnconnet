// Reporte de entregas (PDF y Excel/CSV) con los mismos filtros que tiene el listado en
// pantalla. Se arma en el navegador a partir de las filas ya cargadas: no hace falta un
// endpoint nuevo. jspdf se importa dentro de la funcion para que no entre al bundle
// inicial — solo se descarga cuando alguien pide el reporte.

import type { EntregaListado, EstadoPaso } from "@/lib/api/entregas-api"

export type OpcionesReporte = {
  filas: EntregaListado[]
  // Resumen legible de los filtros activos, ej. ["Pestaña: Agendadas", "Asesor: X"]
  filtros: string[]
  // Mismas reglas de visibilidad que la tabla en pantalla
  incluirPreEntrega: boolean
  incluirCierre: boolean
}

const ESTADO_TEXTO: Record<EstadoPaso, string> = {
  COMPLETO: "Completo",
  PENDIENTE: "Pendiente",
  OBSERVACION: "Observación",
}

function fechaHora(fecha: string | null, hora: string | null): string {
  if (!fecha) return "Sin fecha"
  const [anio, mes, dia] = fecha.split("-")
  return `${dia}/${mes}/${anio}${hora ? ` · ${hora}` : ""}`
}

// Detalle bajo la fecha: confirmada, re-agendada, sin completar.
function notasFecha(e: EntregaListado): string[] {
  const notas: string[] = []
  if (e.vencida) notas.push("Entrega sin completar")
  notas.push(e.fechaConfirmada ? "Confirmada" : "Sin confirmar")
  if (e.reagendamientos > 0) notas.push(`Re-agendado x${e.reagendamientos}`)
  return notas
}

function marcaAhora(): string {
  const f = new Date()
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${dos(f.getHours())}:${dos(f.getMinutes())}`
}

function nombreArchivo(extension: string): string {
  const f = new Date()
  const dos = (n: number) => String(n).padStart(2, "0")
  return `reporte-entregas-${f.getFullYear()}${dos(f.getMonth() + 1)}${dos(f.getDate())}.${extension}`
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
// ";" como separador y BOM UTF-8: asi Excel en español lo abre en columnas y con tildes.

function celdaCsv(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}

export function descargarReporteEntregasExcel(opciones: OpcionesReporte) {
  const encabezados = [
    "#",
    "Cliente",
    "Lote",
    "Proyecto",
    "Fecha planificada",
    "Hora",
    "Fecha confirmada",
    "Re-agendamientos",
    "Asesor",
    "Tanque",
    "Huerto",
    ...(opciones.incluirPreEntrega ? ["Pre entrega"] : []),
    "Entrega",
    ...(opciones.incluirCierre ? ["Cierre"] : []),
    "Entrega sin completar",
  ]
  const filas = opciones.filas.map((e) => [
    String(e.id),
    e.cliente ?? "",
    e.lote ?? "",
    e.proyecto ?? "",
    e.fechaPlanificada ? fechaHora(e.fechaPlanificada, null) : "",
    e.hora ?? "",
    e.fechaConfirmada ? "Sí" : "No",
    String(e.reagendamientos),
    (e.asesor ?? "").split(",").join(" / "),
    e.tanque ?? "",
    e.huerto ?? "",
    ...(opciones.incluirPreEntrega ? [ESTADO_TEXTO[e.preEntrega]] : []),
    ESTADO_TEXTO[e.entrega],
    ...(opciones.incluirCierre ? [e.cerrada ? "Cerrada" : "Abierta"] : []),
    e.vencida ? "Sí" : "No",
  ])
  const lineas = [
    ["Reporte de entregas"],
    ["Generado", marcaAhora()],
    ["Filtros", opciones.filtros.join(" | ") || "Ninguno"],
    [],
    encabezados,
    ...filas,
  ].map((fila) => fila.map(celdaCsv).join(";"))

  descargar(
    new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" }),
    nombreArchivo("csv")
  )
}

// --- PDF ---------------------------------------------------------------------------

type Columna = { titulo: string; ancho: number; centrada?: boolean }

const NARANJA: [number, number, number] = [245, 137, 31]
const TEXTO: [number, number, number] = [20, 22, 27]
const GRIS: [number, number, number] = [107, 114, 128]
const BORDE: [number, number, number] = [229, 231, 235]
const AMARILLO: [number, number, number] = [253, 243, 227]
const ZEBRA: [number, number, number] = [249, 250, 251]

export async function descargarReporteEntregasPdf(opciones: OpcionesReporte) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const anchoPagina = doc.internal.pageSize.getWidth()
  const altoPagina = doc.internal.pageSize.getHeight()
  const margen = 28
  const anchoUtil = anchoPagina - margen * 2

  // Columnas: se reparte el ancho segun lo que muestra la tabla en pantalla.
  const base: Columna[] = [
    { titulo: "#", ancho: 28, centrada: true },
    { titulo: "Cliente", ancho: 150 },
    { titulo: "Lote", ancho: 92 },
    { titulo: "Fecha planificada", ancho: 128 },
    { titulo: "Asesor", ancho: 150 },
    { titulo: "Tanque", ancho: 42, centrada: true },
    { titulo: "Huerto", ancho: 42, centrada: true },
    ...(opciones.incluirPreEntrega
      ? [{ titulo: "Pre entrega", ancho: 62, centrada: true }]
      : []),
    { titulo: "Entrega", ancho: 62, centrada: true },
    ...(opciones.incluirCierre ? [{ titulo: "Cierre", ancho: 50, centrada: true }] : []),
  ]
  const sumaBase = base.reduce((t, c) => t + c.ancho, 0)
  const columnas = base.map((c) => ({ ...c, ancho: (c.ancho / sumaBase) * anchoUtil }))

  const interlinea = 11
  const paddingY = 6
  const paddingX = 5

  function dibujarEncabezadoDePagina(): number {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(...GRIS)
    doc.text("GRUPO ANCON · INTRANET", margen, margen)
    doc.setFontSize(18)
    doc.setTextColor(...TEXTO)
    doc.text("Reporte de entregas", margen, margen + 22)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...GRIS)
    doc.text(`Generado el ${marcaAhora()}`, anchoPagina - margen, margen + 22, {
      align: "right",
    })
    doc.setDrawColor(...NARANJA)
    doc.setLineWidth(2)
    doc.line(margen, margen + 30, anchoPagina - margen, margen + 30)
    return margen + 44
  }

  function dibujarEncabezadoDeTabla(y: number): number {
    const alto = 22
    doc.setFillColor(...ZEBRA)
    doc.rect(margen, y, anchoUtil, alto, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(...GRIS)
    let x = margen
    for (const c of columnas) {
      const texto = c.titulo.toUpperCase()
      if (c.centrada) doc.text(texto, x + c.ancho / 2, y + 14, { align: "center" })
      else doc.text(texto, x + paddingX, y + 14)
      x += c.ancho
    }
    doc.setDrawColor(...BORDE)
    doc.setLineWidth(0.5)
    doc.line(margen, y + alto, anchoPagina - margen, y + alto)
    return y + alto
  }

  // --- portada: filtros y totales ---
  let y = dibujarEncabezadoDePagina()
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...TEXTO)
  const textoFiltros =
    "Filtros: " + (opciones.filtros.length ? opciones.filtros.join("  ·  ") : "ninguno")
  const lineasFiltros = doc.splitTextToSize(textoFiltros, anchoUtil) as string[]
  for (const linea of lineasFiltros) {
    doc.text(linea, margen, y)
    y += interlinea
  }
  doc.setFont("helvetica", "bold")
  doc.text(
    `${opciones.filas.length} ${opciones.filas.length === 1 ? "proceso" : "procesos"}`,
    margen,
    y + 2
  )
  y += 16
  y = dibujarEncabezadoDeTabla(y)

  // --- filas ---
  opciones.filas.forEach((e, indice) => {
    // El ajuste de linea se mide con la misma fuente con que se dibuja.
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    const celdas: string[][] = [
      [String(e.id)],
      doc.splitTextToSize(
        (e.cliente ?? "—").toUpperCase(),
        columnas[1].ancho - paddingX * 2
      ),
      [e.lote ?? "—", ...(e.proyecto ? [e.proyecto] : [])],
      [fechaHora(e.fechaPlanificada, e.hora), ...notasFecha(e)],
      doc.splitTextToSize(
        (e.asesor ?? "—").split(",").join(" · ").toUpperCase(),
        columnas[4].ancho - paddingX * 2
      ),
      [e.tanque ?? "—"],
      [e.huerto ?? "—"],
      ...(opciones.incluirPreEntrega ? [[ESTADO_TEXTO[e.preEntrega]]] : []),
      [ESTADO_TEXTO[e.entrega]],
      ...(opciones.incluirCierre ? [[e.cerrada ? "Cerrada" : "Abierta"]] : []),
    ]
    const lineasMax = Math.max(...celdas.map((c) => c.length))
    const alto = lineasMax * interlinea + paddingY * 2

    if (y + alto > altoPagina - margen - 14) {
      doc.addPage()
      y = dibujarEncabezadoDeTabla(dibujarEncabezadoDePagina())
    }

    if (e.vencida) {
      doc.setFillColor(...AMARILLO)
      doc.rect(margen, y, anchoUtil, alto, "F")
    } else if (indice % 2 === 1) {
      doc.setFillColor(...ZEBRA)
      doc.rect(margen, y, anchoUtil, alto, "F")
    }

    let x = margen
    celdas.forEach((lineas, i) => {
      const columna = columnas[i]
      lineas.forEach((linea, n) => {
        // Cliente y asesor se parten en varias lineas del mismo texto; solo lote y fecha
        // tienen lineas secundarias (proyecto, notas).
        const esPrincipal = n === 0 || i === 1 || i === 4
        doc.setFont("helvetica", esPrincipal ? "bold" : "normal")
        doc.setFontSize(esPrincipal ? 8 : 7)
        doc.setTextColor(...(esPrincipal ? TEXTO : GRIS))
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

  if (opciones.filas.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...GRIS)
    doc.text("No hay procesos con los filtros elegidos.", margen, y + 24)
  }

  // numeracion de paginas
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

  doc.save(nombreArchivo("pdf"))
}
