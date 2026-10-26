import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const RECURSOS = ["lote", "financiamiento"] as const
const ACCIONES = ["crear", "ver", "editar", "aprobar", "eliminar"] as const

const PERMISOS_POR_ROL: Record<string, Array<{ recurso: string; accion: string }>> = {
  Administrador: RECURSOS.flatMap((recurso) =>
    ACCIONES.map((accion) => ({ recurso, accion }))
  ),
  "Gerencia Comercial": [
    { recurso: "lote", accion: "ver" },
    { recurso: "lote", accion: "aprobar" },
    { recurso: "financiamiento", accion: "ver" },
    { recurso: "financiamiento", accion: "aprobar" },
  ],
  "Asesor de Ventas": [
    { recurso: "lote", accion: "crear" },
    { recurso: "lote", accion: "ver" },
    { recurso: "lote", accion: "editar" },
    { recurso: "financiamiento", accion: "crear" },
    { recurso: "financiamiento", accion: "ver" },
    // Ve solo sus procesos de entrega asignados y registra sus entregas.
    { recurso: "entregas", accion: "entregar" },
  ],
  "Analista Financiero": [
    { recurso: "lote", accion: "ver" },
    { recurso: "financiamiento", accion: "ver" },
    { recurso: "financiamiento", accion: "editar" },
    { recurso: "financiamiento", accion: "aprobar" },
  ],
}

// La identidad (tabla `user`) es legacy y tiene empleados reales: este seed NO crea
// usuarios. Solo asigna el rol Administrador a una cuenta real ya existente, si la
// encuentra, para poder probar el flujo completo sin tocar datos de otros empleados.
const EMAIL_ADMIN_INICIAL = "administrador@grupoancon.com"

async function main() {
  const permisosPorClave = new Map<string, { id: string }>()

  for (const recurso of RECURSOS) {
    for (const accion of ACCIONES) {
      const permiso = await prisma.permiso.upsert({
        where: { recurso_accion: { recurso, accion } },
        update: {},
        create: { recurso, accion },
      })
      permisosPorClave.set(`${recurso}:${accion}`, permiso)
    }
  }

  // Permisos puntuales que la matriz por rol necesita resolver (no salen de RECURSOS x ACCIONES).
  permisosPorClave.set(
    "entregas:entregar",
    await prisma.permiso.upsert({
      where: { recurso_accion: { recurso: "entregas", accion: "entregar" } },
      update: {},
      create: { recurso: "entregas", accion: "entregar" },
    })
  )

  for (const [nombreRol, permisos] of Object.entries(PERMISOS_POR_ROL)) {
    const rol = await prisma.rol.upsert({
      where: { nombre: nombreRol },
      update: {},
      create: { nombre: nombreRol },
    })

    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id } })
    await prisma.rolPermiso.createMany({
      data: permisos.map(({ recurso, accion }) => ({
        rolId: rol.id,
        permisoId: permisosPorClave.get(`${recurso}:${accion}`)!.id,
      })),
    })
  }

  // Permiso puntual para la feature de revision de documentacion — no forma parte de
  // la matriz lote/financiamiento (RECURSOS/ACCIONES), es un permiso aparte que se
  // asigna al rol que corresponda desde /admin/roles (nunca a "Asesor de Ventas": ese
  // rol es el que RECIBE las solicitudes, nunca quien revisa).
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "documentos", accion: "revisar" } },
    update: {},
    create: { recurso: "documentos", accion: "revisar" },
  })

  // Permiso puntual para aprobar/devolver la oferta de compra de un proceso — mismo
  // patron que "documentos:revisar": se asigna desde /admin/roles al rol revisor que
  // corresponda, nunca al mismo asesor que crea la oferta.
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "ofertas", accion: "revisar" } },
    update: {},
    create: { recurso: "ofertas", accion: "revisar" },
  })

  // Permiso puntual para crear/editar la oferta de compra de un proceso — separado de
  // "ventas:crear" (que sigue alcanzando para los pasos de solo lectura), se asigna
  // desde /admin/roles a quien pueda armar/corregir ofertas (ej. "Asesor de Ventas").
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "ofertas", accion: "editar" } },
    update: {},
    create: { recurso: "ofertas", accion: "editar" },
  })

  // Permiso puntual para aprobar/devolver el pago de un proceso — mismo patron que
  // "ofertas:revisar": se asigna desde /admin/roles al rol revisor que corresponda,
  // nunca al mismo asesor que ingresa el pago.
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "pago", accion: "aprobar" } },
    update: {},
    create: { recurso: "pago", accion: "aprobar" },
  })

  // Permiso del módulo "Ventas urgentes" (/ventas/urgentes): CRUD de lotes marcados
  // como venta urgente, que se pueden vender sin las validaciones de disponibilidad ni
  // la orden SAP habituales. Se asigna desde /admin/roles al rol que corresponda.
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "venta", accion: "urgente" } },
    update: {},
    create: { recurso: "venta", accion: "urgente" },
  })

  // Permiso del módulo "Entregas" (/entregas): ver el listado de procesos de entrega.
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "entregas", accion: "ver" } },
    update: {},
    create: { recurso: "entregas", accion: "ver" },
  })

  // Módulo "Encuestas" (/encuestas): ver el listado y registrar la encuesta de
  // satisfacción de los procesos con todo aprobado, y descargar el reporte general.
  for (const accion of ["ver", "crear", "reporte"]) {
    await prisma.permiso.upsert({
      where: { recurso_accion: { recurso: "encuestas", accion } },
      update: {},
      create: { recurso: "encuestas", accion },
    })
  }

  // Permiso para crear procesos de entrega (/entregas/nuevo).
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "entregas", accion: "crear" } },
    update: {},
    create: { recurso: "entregas", accion: "crear" },
  })

  // Permiso para registrar la pre-entrega de un proceso (/entregas/:id/pre-entrega).
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "entregas", accion: "pre_entrega" } },
    update: {},
    create: { recurso: "entregas", accion: "pre_entrega" },
  })

  // Permiso para re-agendar la fecha/hora de entrega de un proceso.
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "entregas", accion: "reagendar" } },
    update: {},
    create: { recurso: "entregas", accion: "reagendar" },
  })

  // Permiso para registrar la entrega (solo el asesor asignado al proceso).
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "entregas", accion: "entregar" } },
    update: {},
    create: { recurso: "entregas", accion: "entregar" },
  })

  // Permiso para el cierre de entregas: completar pasos con observaciones y cerrar el proceso.
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "entregas", accion: "cerrar" } },
    update: {},
    create: { recurso: "entregas", accion: "cerrar" },
  })

  // Permiso para descargar el reporte de entregas (PDF/Excel del listado).
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "entregas", accion: "reporte" } },
    update: {},
    create: { recurso: "entregas", accion: "reporte" },
  })

  // Permiso puntual para ver e imprimir el reporte de licitud de fondos
  // (/ventas/licitud/reporte/:id) — sin este permiso la pantalla ni siquiera carga, ver
  // LicitudReporteContent. Se asigna desde /admin/roles al rol que corresponda.
  await prisma.permiso.upsert({
    where: { recurso_accion: { recurso: "licitud", accion: "imprimir" } },
    update: {},
    create: { recurso: "licitud", accion: "imprimir" },
  })

  const admin = await prisma.user.findUnique({ where: { email: EMAIL_ADMIN_INICIAL } })
  if (admin) {
    const rolAdmin = await prisma.rol.findUniqueOrThrow({
      where: { nombre: "Administrador" },
    })
    await prisma.usuarioRol.upsert({
      where: { usuarioId_rolId: { usuarioId: admin.id, rolId: rolAdmin.id } },
      update: {},
      create: { usuarioId: admin.id, rolId: rolAdmin.id },
    })
    console.log(`Rol Administrador asignado a ${EMAIL_ADMIN_INICIAL}.`)
  } else {
    console.log(
      `No se encontro ${EMAIL_ADMIN_INICIAL} en la tabla user; no se asigno ningun rol inicial.`
    )
  }

  console.log(
    "Seed completo: catalogo de roles y permisos (roles_app/permisos_app) listo."
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
