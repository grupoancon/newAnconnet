import { describe, expect, it } from "vitest"

import { REPORTES, reportesPermitidos } from "@/lib/reportes/catalogo"
import type { AuthenticatedUser } from "@/types/auth"

const usuario = (
  roles: string[],
  permisos: Array<[string, string]>
): AuthenticatedUser =>
  ({
    id: "u1",
    email: "a@a.com",
    nombre: "Ana",
    roles,
    permisos: permisos.map(([recurso, accion]) => ({ recurso, accion })),
  }) as unknown as AuthenticatedUser

describe("reportesPermitidos", () => {
  it("el Administrador sin reportes asignados no ve ninguno (sin bypass)", () => {
    expect(reportesPermitidos(usuario(["Administrador"], []))).toEqual([])
  })

  it("el Administrador ve solo los reportes que tiene asignados", () => {
    const admin = usuario(["Administrador"], [["reportes", "ventas"]])
    expect(reportesPermitidos(admin).map((r) => r.id)).toEqual(["ventas"])
  })

  it("un usuario normal con un permiso ve solo ese reporte", () => {
    const u = usuario(["Asesor de Ventas"], [["reportes", "depositos"]])
    expect(reportesPermitidos(u).map((r) => r.id)).toEqual(["depositos"])
  })

  it("reportes:all habilita todos los del catálogo", () => {
    const u = usuario([], [["reportes", "all"]])
    expect(reportesPermitidos(u)).toHaveLength(REPORTES.length)
  })

  it("un permiso de otro módulo no habilita reportes", () => {
    const u = usuario([], [["ventas", "reporte"]])
    expect(reportesPermitidos(u)).toEqual([])
  })
})
