// Cliente para el módulo de Convenios (`/ventas/convenios*` y
// `/ventas/procesos/:id/convenio` en el backend) — reusa ventasFetch/VentasApiError
// de ventas-api.ts porque vive bajo el mismo prefijo "/ventas".

import { ventasFetch } from "@/lib/api/ventas-api"

export type EntidadVariable =
  | "proyecto"
  | "inventario"
  | "titular"
  | "conyuge"
  | "apoderado"
  | "financiamiento"
  | "oferta"
  | "proceso"
  | "sistema"
  | "seleccion"

// Solo para variables entidad === "seleccion": `valor` es lo que compara
// {{#if (eq clave "valor")}} en el contenido, `etiqueta` es lo que ve quien genera el
// convenio real en el desplegable.
export type OpcionSeleccion = {
  valor: string
  etiqueta: string
}

export type VariableDefinicion = {
  clave: string
  etiqueta: string
  entidad: EntidadVariable
  campo?: string // sin uso cuando entidad === "seleccion"
  opciones?: OpcionSeleccion[] // solo cuando entidad === "seleccion" — mínimo 2
}

export type ConvenioAsignacionBackend = {
  id: number
  convenio_id: number
  proyecto_id: number | null
  inventario_id: number | null
  created_at: string
}

export type ConvenioBackend = {
  id: number
  nombre: string
  contenido: string
  variables: VariableDefinicion[]
  activo: boolean
  created_at: string
  updated_at: string
}

export type ConvenioConAsignaciones = ConvenioBackend & {
  asignaciones: ConvenioAsignacionBackend[]
}

export type ConvenioInput = {
  nombre: string
  contenido: string
  variables: VariableDefinicion[]
  activo?: boolean
}

// GET /ventas/convenios/catalogo-variables — qué campos de qué entidades puede
// ofrecer el selector de "agregar variable" (ver components/convenios/variable-manager.tsx).
// No incluye "seleccion" — esa no tiene campos de BD, usa `opciones` en vez de `campo`.
export function obtenerCatalogoVariables() {
  return ventasFetch<Record<Exclude<EntidadVariable, "seleccion">, string[]>>(
    "/convenios/catalogo-variables"
  )
}

// ── Representantes de la empresa (lista propia que firma los convenios; NO son usuarios
// del sistema). Se administran en Configuración > Convenios > Representantes.
export type RepresentanteConvenio = {
  id: number
  nombre: string
  cedula: string | null
  activo: boolean
  created_at: string
}

// GET /ventas/convenio-representantes/activos — para el selector del reporte del convenio.
export function listarRepresentantesActivos() {
  return ventasFetch<RepresentanteConvenio[]>("/convenio-representantes/activos")
}

// GET /ventas/convenio-representantes — todos, para la pantalla de administración.
export function listarRepresentantesConvenio() {
  return ventasFetch<RepresentanteConvenio[]>("/convenio-representantes")
}

export function crearRepresentanteConvenio(datos: {
  nombre: string
  cedula?: string
  activo?: boolean
}) {
  return ventasFetch<RepresentanteConvenio>("/convenio-representantes", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function actualizarRepresentanteConvenio(
  id: number,
  datos: { nombre?: string; cedula?: string; activo?: boolean }
) {
  return ventasFetch<RepresentanteConvenio>(`/convenio-representantes/${id}`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function eliminarRepresentanteConvenio(id: number) {
  return ventasFetch<void>(`/convenio-representantes/${id}`, { method: "DELETE" })
}

export function listarConvenios() {
  return ventasFetch<ConvenioBackend[]>("/convenios")
}

export function obtenerConvenio(id: number) {
  return ventasFetch<ConvenioConAsignaciones>(`/convenios/${id}`)
}

export function crearConvenio(datos: ConvenioInput) {
  return ventasFetch<ConvenioBackend>("/convenios", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function actualizarConvenio(id: number, datos: Partial<ConvenioInput>) {
  return ventasFetch<ConvenioBackend>(`/convenios/${id}`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function eliminarConvenio(id: number) {
  return ventasFetch<void>(`/convenios/${id}`, { method: "DELETE" })
}

export function asignarConvenio(
  id: number,
  datos: { proyectoId?: number; inventarioId?: number }
) {
  return ventasFetch<ConvenioAsignacionBackend>(`/convenios/${id}/asignaciones`, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

export function eliminarAsignacion(id: number, asignacionId: number) {
  return ventasFetch<void>(`/convenios/${id}/asignaciones/${asignacionId}`, {
    method: "DELETE",
  })
}

// Preview con valores de ejemplo, para el editor admin — nunca datos reales. Trabaja
// sobre el borrador tal cual está en el formulario en ese momento (no hace falta haber
// guardado antes, y si hay cambios sin guardar, la preview igual los refleja).
export function previsualizarContenido(datos: { contenido: string; variables: VariableDefinicion[] }) {
  return ventasFetch<{ html: string }>("/convenios/preview", {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

// GET /ventas/procesos/:id/convenio/variables-seleccion — variables de "selección
// manual" (ej. firma normal vs. por apoderado) que el convenio asignado a este proceso
// necesita, para pedirlas con un desplegable ANTES de generar el documento final.
export function obtenerVariablesSeleccionDeProceso(idProceso: number) {
  return ventasFetch<VariableDefinicion[]>(`/procesos/${idProceso}/convenio/variables-seleccion`)
}

// POST /ventas/procesos/:id/convenio — generación real para un proceso de venta:
// resuelve el convenio asignado a su proyecto/lote, las variables atadas a BD solas, y
// las de "selección manual" con los valores elegidos en `selecciones` (clave -> valor
// de la opción). Si falta alguna, el backend usa su primera opción por defecto.
//
// `representante`: nombre del representante de la empresa que firma — alimenta la
// variable de sistema "representante_empresa" (imprimir el nombre, o cambiar un párrafo
// según quién firme con {{#if (eq clave "Nombre")}}).
export function obtenerConvenioDeProceso(
  idProceso: number,
  selecciones?: Record<string, string>,
  representante?: string
) {
  return ventasFetch<{ html: string; convenioNombre: string }>(`/procesos/${idProceso}/convenio`, {
    method: "POST",
    body: JSON.stringify({ selecciones, representante }),
  })
}
