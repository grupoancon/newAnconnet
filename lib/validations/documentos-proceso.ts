import type { DocumentoProcesoBackend, SolicitudDocumentoBackend } from "@/lib/api/ventas-api"
import { CATALOGO_DOCUMENTOS_PROCESO } from "@/lib/const/documentos-proceso"

export type EstadoDocumentoProceso = "subido" | "no_aplica" | "pendiente" | "solicitado"


export function calcularEstadoDocumento(
  tipo: string,
  documentos: DocumentoProcesoBackend[],
  solicitudes: SolicitudDocumentoBackend[] = []
): EstadoDocumentoProceso {
  const encontrado = documentos.find((d) => d.tipo === tipo)
  if (encontrado) return encontrado.no_aplica ? "no_aplica" : "subido"
  const solicitudAbierta = solicitudes.some((s) => s.tipo === tipo && s.estado === "pendiente")
  return solicitudAbierta ? "solicitado" : "pendiente"
}

export function calcularResumenDocumentos(documentos: DocumentoProcesoBackend[]): {
  resueltos: number
  total: number
} {
  const requeridos = CATALOGO_DOCUMENTOS_PROCESO.filter((item) => !item.repetible)
  const resueltos = requeridos.filter(
    (item) => calcularEstadoDocumento(item.tipo, documentos) !== "pendiente"
  ).length
  return { resueltos, total: requeridos.length }
}


export function slugificarTipo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50)
}

// Para tipos personalizados que ya existen en la BD (alguien los agrego en una sesion
// anterior) no se guarda la etiqueta original en ningun lado — se reconstruye a partir
// del tipo (slug) para no mostrar el string crudo.
export function etiquetaDesdeTipo(tipo: string): string {
  return tipo
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letra) => letra.toUpperCase())
}
