// Novedades del Inicio de la app móvil: se crean aquí y la app las muestra en el
// carrusel "Novedades" de Inicio (antes "Nuestros proyectos").

export type Novedad = {
  id: number
  titulo: string
  descripcion: string | null
  imagenUrl: string | null
  galeria: string[]
  enlaceUrl: string | null
  enlaceTexto: string | null
  proyecto: string | null
  orden: number
  activo: boolean
  publicarDesde: string | null
  publicarHasta: string | null
  creadoPor: string | null
  createdAt: string
  updatedAt: string
}

/** Lo que envía el formulario. Fechas "YYYY-MM-DD"; vacío = sin límite. */
export type NovedadForm = {
  titulo: string
  descripcion: string
  imagenUrl: string
  /** Fotos del detalle, en el orden en que se ven. */
  galeria: string[]
  enlaceUrl: string
  enlaceTexto: string
  proyecto: string
  orden: number
  activo: boolean
  publicarDesde: string
  publicarHasta: string
}

export const FORM_VACIO: NovedadForm = {
  titulo: "",
  descripcion: "",
  imagenUrl: "",
  galeria: [],
  enlaceUrl: "",
  enlaceTexto: "",
  proyecto: "",
  orden: 0,
  activo: true,
  publicarDesde: "",
  publicarHasta: "",
}

export const MAX_TITULO = 120
// Tope de seguridad del API; en la práctica no hay límite.
export const MAX_DESCRIPCION = 200_000
export const MAX_GALERIA = 10

export const PROYECTOS = [
  { value: "", label: "Todos los clientes" },
  { value: "LA FONTANA", label: "La Fontana" },
  { value: "PUERTO QUITO GARDEN", label: "Puerto Quito Garden" },
]

export type EstadoNovedad = "publicada" | "programada" | "vencida" | "oculta"

const soloFecha = (valor: string | null) => (valor ? valor.slice(0, 10) : "")

export function aFormulario(n: Novedad): NovedadForm {
  return {
    titulo: n.titulo,
    descripcion: n.descripcion ?? "",
    imagenUrl: n.imagenUrl ?? "",
    galeria: n.galeria ?? [],
    enlaceUrl: n.enlaceUrl ?? "",
    enlaceTexto: n.enlaceTexto ?? "",
    proyecto: n.proyecto ?? "",
    orden: n.orden,
    activo: n.activo,
    publicarDesde: soloFecha(n.publicarDesde),
    publicarHasta: soloFecha(n.publicarHasta),
  }
}

/** `hoy` en "YYYY-MM-DD" local. Compara por día, igual que la publicación. */
export function estadoDe(n: Pick<Novedad, "activo" | "publicarDesde" | "publicarHasta">, hoy: string): EstadoNovedad {
  if (!n.activo) return "oculta"
  const desde = soloFecha(n.publicarDesde)
  const hasta = soloFecha(n.publicarHasta)
  if (desde && desde > hoy) return "programada"
  if (hasta && hasta < hoy) return "vencida"
  return "publicada"
}

export function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
