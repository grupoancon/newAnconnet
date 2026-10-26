import type { ProjectBadgeTone } from "@/components/shared/project-card"
import type { ProyectoInventario } from "@/lib/api/inventario-api"
import fontanaImg from "@/public/images/proyectos/fontana.webp"
import gardenImg from "@/public/images/proyectos/back-slideMAIN-fontana-1.3-min.webp"
import perlaImg from "@/public/images/proyectos/fondoPerla.png"
import jardinImg from "@/public/images/proyectos/img-box-jardin-1-min.webp"
import edenImg from "@/public/images/proyectos/img-box-eden-1-min.webp"
import miradorImg from "@/public/images/proyectos/img-box-mirador-1-min.webp"
import manantialImg from "@/public/images/proyectos/img-box-manantial-1-min.webp"

// Vitrina por defecto, indexada por `nombre`: se usa solo cuando el proyecto todavía no
// tiene foto/descripción propias cargadas desde Gestión de inventario (columnas
// `imagen_url` / `descripcion`). Gradiente y pastilla fija siguen saliendo de acá.
export const VITRINA_PROYECTO: Record<
  string,
  {
    description: string
    imageSrc: string
    gradientClassName: string
    // Pastilla fija opcional ("NUEVO", "LOTES EXCLUSIVOS") — "ÚLTIMOS LOTES" y
    // "AGOTADO" no van acá: se calculan del stock real (ver pastillaProyecto).
    badge?: string
    badgeTone?: ProjectBadgeTone
  }
> = {
  "Perla Verde": {
    description: "Tu espacio propio en el tesoro verde de Puerto Quito.",
    imageSrc: perlaImg.src,
    gradientClassName: "bg-[linear-gradient(135deg,#2E8B57,#1E6E4A)]",
    badge: "NUEVO",
    badgeTone: "green",
  },
  "Puerto Quito Garden": {
    description: "Tu próximo sueño se encuentra aquí. Puerto Quito.",
    imageSrc: gardenImg.src,
    gradientClassName: "bg-[linear-gradient(135deg,#2E8B57,#1E6E4A)]",
    badge: "NUEVO",
    badgeTone: "green",
  },
  "La Fontana": {
    description: "Un lugar mágico para que sueñes en grande.",
    imageSrc: fontanaImg.src,
    gradientClassName: "bg-[linear-gradient(135deg,#1D6FB8,#0E4C86)]",
  },
  "El Jardín": {
    description: "Una experiencia única con la naturaleza en Puerto Quito.",
    imageSrc: jardinImg.src,
    gradientClassName: "bg-[linear-gradient(135deg,#3FA796,#2C7A6E)]",
  },
  "El Edén": {
    description: "Naturaleza, clima cálido y maravillosas áreas comunales.",
    imageSrc: edenImg.src,
    gradientClassName: "bg-[linear-gradient(135deg,#E9A521,#C97A16)]",
  },
  "El Mirador": {
    description: "Un paraíso con vista al lago San Pablo, en Otavalo.",
    imageSrc: miradorImg.src,
    gradientClassName: "bg-[linear-gradient(135deg,#C2622E,#8F4620)]",
    badge: "LOTES EXCLUSIVOS",
    badgeTone: "blue",
  },
  "El Manantial": {
    description: "Diversión y libertad a sólo 2 horas de Quito.",
    imageSrc: manantialImg.src,
    gradientClassName: "bg-[linear-gradient(135deg,#4C9A2A,#2F6E17)]",
  },
}

export const VITRINA_DEFECTO = {
  gradientClassName: "bg-[linear-gradient(135deg,#64748B,#334155)]",
}

// Con esta cantidad de lotes libres o menos, el proyecto pasa a "ÚLTIMOS LOTES".
export const UMBRAL_ULTIMOS_LOTES = 10

// La pastilla de cada proyecto: "AGOTADO" y "ÚLTIMOS LOTES" salen solas del stock
// (lotes del proyecto menos los vendidos, lo calcula el backend); si no aplica ninguna,
// se usa la pastilla fija de la vitrina ("NUEVO", "LOTES EXCLUSIVOS") o ninguna.
export function pastillaProyecto(
  proyecto: ProyectoInventario,
  vitrina?: { badge?: string; badgeTone?: ProjectBadgeTone }
): { badge?: string; badgeTone?: ProjectBadgeTone } {
  const stock = Number(proyecto.stock)
  if (!isNaN(stock)) {
    if (stock <= 0) return { badge: "AGOTADO", badgeTone: "gray" }
    if (stock <= UMBRAL_ULTIMOS_LOTES) return { badge: "ÚLTIMOS LOTES", badgeTone: "red" }
  }
  return { badge: vitrina?.badge, badgeTone: vitrina?.badgeTone }
}

export const DESCRIPCION_DEFECTO = "Conoce los lotes disponibles en este proyecto."

// Todo lo que muestra la tarjeta de un proyecto: primero lo cargado en Gestión de
// inventario (descripcion / imagen_url), si no la vitrina por defecto de arriba.
export function vitrinaDeProyecto(proyecto: ProyectoInventario) {
  const vitrina = VITRINA_PROYECTO[proyecto.nombre]
  const pastilla = pastillaProyecto(proyecto, vitrina)
  return {
    description:
      proyecto.descripcion?.trim() || vitrina?.description || DESCRIPCION_DEFECTO,
    imageSrc: proyecto.imagen_url || vitrina?.imageSrc,
    gradientClassName: vitrina?.gradientClassName ?? VITRINA_DEFECTO.gradientClassName,
    badge: pastilla.badge,
    badgeTone: pastilla.badgeTone,
  }
}
