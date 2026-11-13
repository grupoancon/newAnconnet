// POST /api/firma — firma electrónicamente (PAdES) un PDF con el certificado de la
// empresa configurado en el servidor (FIRMA_P12_PATH / FIRMA_P12_PASSWORD).
//
// Cuerpo: el PDF crudo (Content-Type: application/pdf).
// Parámetros opcionales (query): visible=1|0, pagina=primera|ultima|N, x, y, ancho, alto,
// razon, ubicacion. Lo que no se mande sale de las variables FIRMA_* del entorno.
//
// Respuestas:
//   200 application/pdf  → PDF firmado (headers X-Firma-Nivel, X-Firma-Firmante)
//   401 / 403            → sin sesión / sin el permiso "firma:firmar"
//   503 FIRMA_DESHABILITADA → FIRMA_HABILITADA no está en true
//   4xx/5xx JSON { codigo, mensaje } → error de firma (nunca incluye la contraseña)
//
// Requiere permiso "firma:firmar" (o rol Administrador): firmar con el certificado de la
// empresa es una acción sensible, no basta con estar autenticado.

import { NextResponse, type NextRequest } from "next/server"

import { registrarAccionServidor } from "@/lib/auditoria/servidor"
import { can } from "@/lib/auth/rbac"
import { getCurrentUser } from "@/lib/auth/session"
import {
  FirmaError,
  firmaHabilitada,
  firmarPdf,
  opcionesDesdeEntorno,
  type OpcionesFirma,
} from "@/lib/firma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 25 * 1024 * 1024

const error = (codigo: string, mensaje: string, status: number) =>
  NextResponse.json({ codigo, mensaje }, { status })

function opcionesDeConsulta(params: URLSearchParams): OpcionesFirma {
  const base = opcionesDesdeEntorno()
  const num = (k: string) => {
    const v = params.get(k)
    if (v === null || v === "") return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const texto = (k: string) => params.get(k)?.slice(0, 200) || undefined

  let visible = base.visible
  const v = params.get("visible")
  if (v === "0" || v === "false") visible = false
  else if (v === "1" || v === "true" || params.has("pagina")) {
    const pag = params.get("pagina") ?? "ultima"
    const posicion = {
      ...(visible || {}),
      pagina: pag === "primera" || pag === "ultima" ? pag : Number(pag),
    } as Exclude<OpcionesFirma["visible"], false | undefined>
    for (const k of ["x", "y", "ancho", "alto"] as const) {
      const n = num(k)
      if (n !== undefined) posicion[k] = n
    }
    visible = posicion
  }

  return {
    ...base,
    visible,
    razon: texto("razon") ?? base.razon,
    ubicacion: texto("ubicacion") ?? base.ubicacion,
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let usuario
  try {
    usuario = await getCurrentUser()
  } catch {
    return error("SERVIDOR_NO_DISPONIBLE", "No se pudo verificar la sesión.", 503)
  }
  if (!usuario) return error("NO_AUTENTICADO", "Sesión no válida.", 401)
  if (!can(usuario, "firma", "firmar")) {
    return error("SIN_PERMISO", "No tiene permiso para firmar documentos.", 403)
  }
  if (!(await firmaHabilitada())) {
    return error("FIRMA_DESHABILITADA", "La firma electrónica no está habilitada.", 503)
  }

  const largo = Number(request.headers.get("content-length") ?? 0)
  if (largo > MAX_BYTES) return error("PDF_MUY_GRANDE", "El PDF supera los 25 MB.", 413)

  const pdf = Buffer.from(await request.arrayBuffer())
  if (pdf.length === 0) return error("PDF_CORRUPTO", "No se recibió ningún PDF.", 400)
  if (pdf.length > MAX_BYTES)
    return error("PDF_MUY_GRANDE", "El PDF supera los 25 MB.", 413)

  const opciones = opcionesDeConsulta(request.nextUrl.searchParams)
  try {
    const resultado = await firmarPdf(pdf, opciones)
    console.info(`[firma] Documento firmado a pedido de ${usuario.email} (${usuario.id})`)
    // Queda en Auditoría con el usuario de la sesión (lo resuelve el backend).
    await registrarAccionServidor(request, "DOCUMENTO_FIRMADO", opciones.razon, {
      firmante: resultado.firmante.nombre,
      nivel: resultado.nivel,
      bytes: resultado.pdf.length,
    })
    return new Response(new Uint8Array(resultado.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
        "X-Firma-Nivel": resultado.nivel,
        "X-Firma-Firmante": encodeURIComponent(resultado.firmante.nombre),
      },
    })
  } catch (err) {
    if (err instanceof FirmaError) {
      console.error(`[firma] ${err.codigo}: ${err.message}`)
      await registrarAccionServidor(request, "FIRMA_FALLIDA", opciones.razon, {
        codigo: err.codigo,
        mensaje: err.message,
      })
      return error(err.codigo, err.message, err.estadoHttp)
    }
    // Error inesperado: se registra solo el nombre/mensaje, nunca el entorno.
    console.error(
      `[firma] Error inesperado: ${err instanceof Error ? err.message : String(err)}`
    )
    return error("ERROR_INTERNO", "No se pudo firmar el documento.", 500)
  }
}
