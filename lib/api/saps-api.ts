// Wrapper sobre el endpoint de consulta a SAP (`/saps/*` en el backend, distinto de
// `/ventas/*` e `/inventarios/*`). Todas las llamadas van con `credentials: "include"`.

const SAPS_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/saps`

export class SapsApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SapsApiError"
  }
}

const TIMEOUT_MS = 15_000

// GET /saps/findOneOrderByLote/:lote — no se sabe si "no encontrada" viene como 200 con
// `{ error: "..." }` en el cuerpo o como un status HTTP de error, asi que no se usa
// `response.ok` para decidir: se inspecciona el cuerpo directamente. Solo se lanza
// SapsApiError si de verdad no se pudo conectar o la respuesta no es JSON valido.
//
// SAP devuelve la orden completa (incluye `DocumentStatus`). "bost_Close" significa que
// esa orden ya se cerró, así que aunque exista no debe bloquear un proceso nuevo para el
// lote — solo bloquea una orden todavía abierta (cualquier otro valor de DocumentStatus).
export async function buscarOrdenSapPorLote(
  lote: string
): Promise<{ encontrada: boolean; cerrada: boolean; data: unknown }> {
  let response: Response
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)
  try {
    response = await fetch(
      `${SAPS_BASE_URL}/findOneOrderByLote/${encodeURIComponent(lote)}`,
      {
        credentials: "include",
        signal: timeoutController.signal,
      }
    )
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new SapsApiError("El servidor tardó demasiado en responder")
    }
    throw new SapsApiError("No se pudo conectar con el servidor")
  } finally {
    clearTimeout(timeoutId)
  }

  const cuerpo = await response.json().catch(() => null)
  if (cuerpo && typeof cuerpo === "object" && "error" in cuerpo) {
    return { encontrada: false, cerrada: false, data: null }
  }
  const documentStatus =
    cuerpo && typeof cuerpo === "object" && "DocumentStatus" in cuerpo
      ? (cuerpo as { DocumentStatus?: string }).DocumentStatus
      : undefined
  return { encontrada: true, cerrada: documentStatus === "bost_Close", data: cuerpo }
}
