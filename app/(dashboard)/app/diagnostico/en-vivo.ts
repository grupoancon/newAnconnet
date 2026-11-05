// Texto legible de los eventos de auditoría que envía la app (src/telemetry/audit.ts
// en AnconApp). Los campos llegan sin valores: la app nunca envía lo escrito.

type AccionBase = {
  message: string
  level: string
  props: Record<string, unknown> | null
}

// El servidor es siempre el mismo: la ruta se lee mejor sin él.
export function sinServidor(texto: string): string {
  return texto.replace(/https?:\/\/[^/\s]+/g, "")
}

export function describirAccion({ message, props }: AccionBase): string {
  const p = props ?? {}
  switch (message) {
    case "screen_view":
      return `Abrió ${p.path ?? "una pantalla"}`
    case "ui_click": {
      const donde = p.x != null && p.y != null ? ` (${p.x}%, ${p.y}%)` : ""
      return `Tocó ${p.text ? `"${p.text}"` : (p.element ?? "la pantalla")}${donde}`
    }
    case "field_change":
      return `Cambió el campo ${p.field ?? "sin nombre"}`
    case "http_request": {
      const resultado = Number(p.status) === 0 ? "sin respuesta" : p.status
      return `${p.httpMethod} ${sinServidor(String(p.url))} → ${resultado} · ${p.durationMs} ms`
    }
    case "app_background":
      return "Dejó la app en segundo plano"
    case "app_foreground":
      return "Volvió a la app"
    default:
      return sinServidor(message)
  }
}

export function esAccionConProblema({ message, level, props }: AccionBase): boolean {
  if (level === "error" || level === "warn") return true
  if (message !== "http_request") return false
  const status = Number(props?.status)
  return status === 0 || status >= 400
}
