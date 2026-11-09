// Estados de un refinanciamiento (refinanciamiento.status) y lo que se puede hacer en
// cada uno:
//   "borrador"  → en edición (pendiente). Se imprime con la marca de agua BORRADOR.
//   "ingresado" → guardado = PREAPROBADO. Se imprime el anexo final, sin marca de agua.
//   "aprobado"  → anexo final + Exportar a Excel.
//   "rechazado" → no se imprime.
// Pruebas: lib/refinanciamiento-estado.test.ts.
import type { StatusVariant } from "@/components/shared/status-badge"

export type EstadoRefinanciamiento = "borrador" | "preaprobado" | "aprobado" | "rechazado"

export function estadoRefinanciamiento(
  crudo: string | null | undefined
): EstadoRefinanciamiento {
  const clave = (crudo ?? "").trim().toLowerCase()
  if (clave === "ingresado") return "preaprobado"
  if (clave === "aprobado" || clave === "rechazado") return clave
  // "borrador" y cualquier valor inesperado = todavía en edición.
  return "borrador"
}

export const ETIQUETA_ESTADO_REFINANCIAMIENTO: Record<EstadoRefinanciamiento, string> = {
  borrador: "Borrador",
  preaprobado: "Preaprobado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
}

// Colores del badge (se reusan las variantes existentes de StatusBadge).
export const VARIANTE_ESTADO_REFINANCIAMIENTO: Record<
  EstadoRefinanciamiento,
  StatusVariant
> = {
  borrador: "pendiente",
  preaprobado: "ingresado",
  aprobado: "aprobado",
  rechazado: "rechazado",
}

export function sePuedeImprimirRefinanciamiento(estado: EstadoRefinanciamiento): boolean {
  return estado !== "rechazado"
}

// Solo el borrador lleva la marca de agua; desde preaprobado ya es el reporte final.
export function imprimeComoBorrador(estado: EstadoRefinanciamiento): boolean {
  return estado === "borrador"
}

export function sePuedeExportarExcel(estado: EstadoRefinanciamiento): boolean {
  return estado === "aprobado"
}
