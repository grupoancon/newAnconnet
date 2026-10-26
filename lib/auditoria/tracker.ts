// Cola en memoria de eventos de auditoría del navegador. Es un módulo (no un hook) para
// poder registrar una acción desde cualquier parte —incluidos handlers fuera de React—
// con `registrarAccion(...)`. El envío en lote lo dispara el AuditoriaProvider.
//
// Reglas de privacidad: aquí NUNCA entran valores de inputs, solo qué elemento se tocó
// (etiqueta, id, ruta). El backend redacta además cualquier clave sensible.

import { enviarEventosWeb, type EventoWeb } from "@/lib/api/auditoria-api"

const LOTE_MAX = 50
// Tope de la cola: si el backend está caído mucho rato no se acumula memoria sin fin;
// se descartan los más viejos.
const COLA_MAX = 500

let cola: EventoWeb[] = []
let enviando = false

export function registrarEvento(evento: Omit<EventoWeb, "ts">) {
  cola.push({ ...evento, ts: Date.now() })
  if (cola.length > COLA_MAX) cola = cola.slice(cola.length - COLA_MAX)
}

// Acción de negocio explícita (ej. "DEPOSITO_APROBADO") que un clic genérico no
// describe. Úsala tras confirmar que la operación salió bien.
export function registrarAccion(
  accion: string,
  etiqueta?: string,
  detalle?: Record<string, unknown>
) {
  registrarEvento({
    tipo: "UI_ACTION",
    accion,
    etiqueta,
    detalle,
    ruta: typeof window === "undefined" ? "/" : window.location.pathname,
  })
}

// Envía lo pendiente. `salida` = la pestaña se está cerrando u ocultando: se usa
// keepalive para que el navegador no cancele la petición.
export async function vaciarCola(salida = false) {
  if (enviando && !salida) return
  if (cola.length === 0) return

  enviando = true
  try {
    while (cola.length > 0) {
      const lote = cola.slice(0, LOTE_MAX)
      try {
        await enviarEventosWeb(lote, { keepalive: salida })
        cola = cola.slice(lote.length)
      } catch {
        // Se conserva en la cola y se reintenta en el próximo ciclo.
        return
      }
      // keepalive admite ~64KB por petición: en salida se manda un único lote.
      if (salida) return
    }
  } finally {
    enviando = false
  }
}
