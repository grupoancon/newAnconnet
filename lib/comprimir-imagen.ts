// Achica fotos antes de subirlas. El backend (multer) y Cloudinary rechazan archivos
// de más de 10 MB, y una foto de celular escaneada puede pasar de eso. Las imágenes se
// reducen a un lado máximo de 2400 px en JPEG; los PDF no se pueden comprimir aquí.

export const MAX_BYTES_SUBIDA = 10 * 1024 * 1024
const LADO_MAXIMO = 2400
// Por debajo de esto no vale la pena tocar la imagen.
const BYTES_SIN_COMPRIMIR = 1.5 * 1024 * 1024

export function megas(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("No se pudo leer la imagen"))
    }
    img.src = url
  })
}

/** Devuelve la imagen reducida (JPEG) o el mismo archivo si no hace falta o no se puede. */
export async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.size <= BYTES_SIN_COMPRIMIR) {
    return archivo
  }
  try {
    const img = await cargarImagen(archivo)
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    const ctx = canvas.getContext("2d")
    if (!ctx) return archivo
    // Fondo blanco: un PNG con transparencia quedaría negro en JPEG.
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    )
    if (!blob || blob.size >= archivo.size) return archivo
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() })
  } catch {
    return archivo
  }
}
