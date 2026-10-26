import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// UUID v4 para claves de filas/elementos del lado del cliente. crypto.randomUUID() solo
// existe en contextos seguros (HTTPS o localhost): entrando a la intranet por la IP de la
// red (http://192.168.x.x:3000) no está definida y rompía la pantalla. getRandomValues()
// sí está disponible sin HTTPS, así que se arma el UUID a mano en ese caso.
export function generarId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
