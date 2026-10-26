import { describe, expect, it } from "vitest"

import { can } from "@/lib/auth/rbac"
import type { AuthenticatedUser } from "@/types/auth"

function usuarioConPermisos(
  permisos: Array<{ recurso: string; accion: string }>
): AuthenticatedUser {
  return {
    id: "usuario-1",
    email: "asesor@ancon.test",
    nombre: "Asesor Demo",
    roles: ["Asesor de Ventas"],
    permisos,
  }
}

describe("can()", () => {
  it("permite la accion cuando el usuario tiene el permiso exacto", () => {
    const usuario = usuarioConPermisos([{ recurso: "lote", accion: "crear" }])
    expect(can(usuario, "lote", "crear")).toBe(true)
  })

  it("deniega la accion cuando el usuario no tiene el permiso", () => {
    const usuario = usuarioConPermisos([{ recurso: "lote", accion: "ver" }])
    expect(can(usuario, "lote", "aprobar")).toBe(false)
  })

  it("deniega la accion cuando el recurso coincide pero la accion no", () => {
    const usuario = usuarioConPermisos([{ recurso: "financiamiento", accion: "crear" }])
    expect(can(usuario, "financiamiento", "aprobar")).toBe(false)
  })

  it("separacion de funciones: deniega aprobar algo creado por el mismo usuario aunque tenga el permiso", () => {
    const usuario = usuarioConPermisos([{ recurso: "financiamiento", accion: "aprobar" }])
    expect(can(usuario, "financiamiento", "aprobar", { creadoPorId: usuario.id })).toBe(
      false
    )
  })

  it("permite aprobar cuando el permiso existe y lo creo otro usuario", () => {
    const usuario = usuarioConPermisos([{ recurso: "financiamiento", accion: "aprobar" }])
    expect(
      can(usuario, "financiamiento", "aprobar", { creadoPorId: "otro-usuario" })
    ).toBe(true)
  })
})
