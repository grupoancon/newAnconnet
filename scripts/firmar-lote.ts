// Firma por lote de PDF existentes con el certificado configurado en el entorno.
//
//   npx tsx scripts/firmar-lote.ts <archivo.pdf | carpeta> [opciones]
//
// Opciones:
//   --salida <carpeta>     dónde dejar los firmados (por defecto, junto al original)
//   --sufijo <texto>       sufijo del nombre de salida (por defecto "-firmado")
//   --visible              firma visible (si no, usa FIRMA_VISIBLE del entorno)
//   --invisible            fuerza firma invisible
//   --pagina <primera|ultima|N>  --x N --y N --ancho N --alto N
//   --razon "<texto>"  --ubicacion "<texto>"
//   --env <archivo>        archivo .env a cargar (por defecto ./.env si existe)
//
// La ruta del .p12 y la contraseña se leen SIEMPRE de FIRMA_P12_PATH / FIRMA_P12_PASSWORD
// (nunca por argumento: quedaría en el historial de la terminal y en `ps`).

import { existsSync } from "node:fs"
import { mkdir, readdir, stat } from "node:fs/promises"
import path from "node:path"

import {
  FirmaError,
  firmarPdf,
  opcionesDesdeEntorno,
  type OpcionesFirma,
} from "../lib/firma"

function argumentos(argv: string[]) {
  const pos: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a.startsWith("--")) {
      const clave = a.slice(2)
      const sig = argv[i + 1]
      if (
        sig !== undefined &&
        !sig.startsWith("--") &&
        !["visible", "invisible"].includes(clave)
      ) {
        flags[clave] = sig
        i++
      } else flags[clave] = true
    } else pos.push(a)
  }
  return { pos, flags }
}

async function main() {
  const { pos, flags } = argumentos(process.argv.slice(2))
  const envArchivo = typeof flags.env === "string" ? flags.env : ".env"
  if (existsSync(envArchivo)) process.loadEnvFile(envArchivo)

  const objetivo = pos[0]
  if (!objetivo) {
    console.error(
      "Uso: npx tsx scripts/firmar-lote.ts <archivo.pdf | carpeta> [opciones]"
    )
    process.exit(2)
  }

  const base = opcionesDesdeEntorno()
  const num = (k: string) => (typeof flags[k] === "string" ? Number(flags[k]) : undefined)
  let visible = base.visible
  if (flags.invisible) visible = false
  else if (flags.visible || flags.pagina || flags.x || flags.y) {
    const pag = typeof flags.pagina === "string" ? flags.pagina : "ultima"
    visible = {
      ...(visible || {}),
      pagina: pag === "primera" || pag === "ultima" ? pag : Number(pag),
      ...(num("x") !== undefined ? { x: num("x") } : {}),
      ...(num("y") !== undefined ? { y: num("y") } : {}),
      ...(num("ancho") !== undefined ? { ancho: num("ancho") } : {}),
      ...(num("alto") !== undefined ? { alto: num("alto") } : {}),
    }
  }
  const opciones: OpcionesFirma = {
    ...base,
    visible,
    razon: typeof flags.razon === "string" ? flags.razon : base.razon,
    ubicacion: typeof flags.ubicacion === "string" ? flags.ubicacion : base.ubicacion,
  }

  const info = await stat(objetivo)
  const archivos = info.isDirectory()
    ? (await readdir(objetivo))
        .filter((f) => f.toLowerCase().endsWith(".pdf"))
        .map((f) => path.join(objetivo, f))
    : [objetivo]
  const sufijo = typeof flags.sufijo === "string" ? flags.sufijo : "-firmado"
  const carpetaSalida = typeof flags.salida === "string" ? flags.salida : null
  if (carpetaSalida) await mkdir(carpetaSalida, { recursive: true })

  let ok = 0
  let fallidos = 0
  for (const archivo of archivos) {
    if (path.basename(archivo, ".pdf").endsWith(sufijo)) continue // ya firmado por este comando
    const nombre = `${path.basename(archivo, path.extname(archivo))}${sufijo}.pdf`
    const salida = path.join(carpetaSalida ?? path.dirname(archivo), nombre)
    try {
      const r = await firmarPdf(archivo, salida, opciones)
      ok++
      console.log(`✔ ${archivo} → ${salida} (${r.nivel})`)
    } catch (err) {
      fallidos++
      const msg =
        err instanceof FirmaError ? `${err.codigo}: ${err.message}` : "error inesperado"
      console.error(`✘ ${archivo}: ${msg}`)
      // Errores de certificado/configuración afectan a todos: no tiene sentido seguir.
      if (
        err instanceof FirmaError &&
        !["PDF_CORRUPTO", "PDF_PROTEGIDO", "PAGINA_INVALIDA"].includes(err.codigo)
      ) {
        break
      }
    }
  }
  console.log(`\nFirmados: ${ok}  Con error: ${fallidos}`)
  process.exit(fallidos ? 1 : 0)
}

void main()
