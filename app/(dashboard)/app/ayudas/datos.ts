// Videos de la sección Ayuda de la app móvil: se agregan aquí (link de YouTube) y la
// app los reproduce dentro de la misma app, en el orden elegido.

export type VideoAyuda = {
  id: number
  titulo: string
  descripcion: string | null
  youtubeId: string
  youtubeUrl: string
  orden: number
  activo: boolean
  creadoPor: string | null
  createdAt: string
  updatedAt: string
}

/** Lo que envía el formulario. */
export type VideoAyudaForm = {
  titulo: string
  descripcion: string
  youtubeUrl: string
  orden: number
  activo: boolean
}

export const FORM_VACIO: VideoAyudaForm = {
  titulo: "",
  descripcion: "",
  youtubeUrl: "",
  orden: 0,
  activo: true,
}

export const MAX_TITULO = 120
export const MAX_DESCRIPCION = 200

export function aFormulario(v: VideoAyuda): VideoAyudaForm {
  return {
    titulo: v.titulo,
    descripcion: v.descripcion ?? "",
    youtubeUrl: v.youtubeUrl,
    orden: v.orden,
    activo: v.activo,
  }
}

const YOUTUBE_ID = /^[\w-]{11}$/

/** Mismo criterio que newApi (videos-ayuda/youtube.ts): ID del video o null. */
export function youtubeIdDe(valor: string): string | null {
  const texto = valor.trim()
  if (YOUTUBE_ID.test(texto)) return texto
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "")
  let id: string | null = null
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0]
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}

export const miniatura = (youtubeId: string) => `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
