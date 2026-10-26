/**
 * Migración NO destructiva: puebla `permisos_app` con TODOS los tokens `recurso:accion`
 * que hoy existen en el string plano `user.permissions` de cualquier usuario, para que
 * el catálogo relacional refleje la realidad completa (los 16 módulos, no solo el
 * catálogo de juguete de lote/financiamiento).
 *
 * No toca `user.permissions` de nadie: los strings quedan intactos, nadie pierde acceso.
 * Es idempotente (usa el @@unique([recurso, accion]) — correr dos veces no duplica).
 *
 *   pnpm tsx prisma/migrar-catalogo-permisos.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function parseTokens(raw: string | null): Array<{ recurso: string; accion: string }> {
  if (!raw) return []
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [recurso, accion] = t.split(":")
      return { recurso: (recurso ?? "").trim(), accion: (accion ?? "").trim() }
    })
    .filter((p) => p.recurso && p.accion)
}

async function main() {
  const usuarios = await prisma.user.findMany({ select: { permissions: true } })

  const catalogo = new Map<string, { recurso: string; accion: string }>()
  for (const usuario of usuarios) {
    for (const permiso of parseTokens(usuario.permissions)) {
      catalogo.set(`${permiso.recurso}:${permiso.accion}`, permiso)
    }
  }

  console.log(`Encontrados ${catalogo.size} permisos distintos en los strings actuales.`)

  let creados = 0
  for (const permiso of Array.from(catalogo.values())) {
    const existente = await prisma.permiso.findUnique({
      where: { recurso_accion: { recurso: permiso.recurso, accion: permiso.accion } },
    })
    if (!existente) {
      await prisma.permiso.create({ data: permiso })
      creados += 1
    }
  }

  const total = await prisma.permiso.count()
  console.log(`Permisos nuevos insertados: ${creados}`)
  console.log(`Total de permisos en el catálogo ahora: ${total}`)
}

main()
  .catch((error) => {
    console.error("Error en la migración:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
