// Lado navegador de la firma electrónica: manda el PDF generado (jsPDF) a /api/firma y
// devuelve el PDF firmado. El certificado y su contraseña viven SOLO en el servidor.
//
// Si la firma no está habilitada en el servidor, o el usuario no tiene el permiso
// "firma:firmar", se devuelve el PDF original sin firmar (el flujo de descarga no se
// rompe). Cualquier otro error (certificado vencido, contraseña mal configurada, TSA
// caída con sello obligatorio…) lanza FirmaClienteError con un mensaje para mostrar.

export class FirmaClienteError extends Error {
  readonly codigo: string
  constructor(codigo: string, mensaje: string) {
    super(mensaje)
    this.name = "FirmaClienteError"
    this.codigo = codigo
  }
}

export type OpcionesFirmaCliente = {
  visible?: boolean
  pagina?: "primera" | "ultima" | number
  x?: number
  y?: number
  ancho?: number
  alto?: number
  razon?: string
  ubicacion?: string
}

export type ResultadoFirmaCliente = {
  blob: Blob
  firmado: boolean
  firmante?: string
  // Por qué no se firmó (solo cuando firmado = false).
  motivo?: "FIRMA_DESHABILITADA" | "SIN_PERMISO"
}

const SIN_FIRMA = new Set(["FIRMA_DESHABILITADA", "SIN_PERMISO"])

export async function firmarPdfEnServidor(
  pdf: Blob,
  opciones: OpcionesFirmaCliente = {}
): Promise<ResultadoFirmaCliente> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(opciones)) {
    if (v === undefined) continue
    params.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v))
  }
  const qs = params.toString()

  let respuesta: Response
  try {
    respuesta = await fetch(`/api/firma${qs ? `?${qs}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: pdf,
      credentials: "same-origin",
    })
  } catch {
    throw new FirmaClienteError(
      "RED",
      "No se pudo contactar al servidor para firmar el documento."
    )
  }

  if (respuesta.ok) {
    const firmante = respuesta.headers.get("X-Firma-Firmante")
    return {
      blob: await respuesta.blob(),
      firmado: true,
      firmante: firmante ? decodeURIComponent(firmante) : undefined,
    }
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as {
    codigo?: string
    mensaje?: string
  } | null
  const codigo = cuerpo?.codigo ?? `HTTP_${respuesta.status}`
  if (SIN_FIRMA.has(codigo)) {
    return {
      blob: pdf,
      firmado: false,
      motivo: codigo as "FIRMA_DESHABILITADA" | "SIN_PERMISO",
    }
  }
  throw new FirmaClienteError(
    codigo,
    cuerpo?.mensaje ?? "No se pudo firmar el documento."
  )
}
