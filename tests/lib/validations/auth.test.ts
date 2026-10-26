import { describe, expect, it } from "vitest"

import { loginSchema, passwordSchema } from "@/lib/validations/auth"

describe("loginSchema", () => {
  it("acepta un email y password validos", () => {
    const result = loginSchema.safeParse({
      email: "usuario@ancon.test",
      password: "Cambiar123!",
    })
    expect(result.success).toBe(true)
  })

  it("rechaza un email invalido", () => {
    const result = loginSchema.safeParse({
      email: "no-es-un-email",
      password: "Cambiar123!",
    })
    expect(result.success).toBe(false)
  })

  it("rechaza un password vacio", () => {
    const result = loginSchema.safeParse({
      email: "usuario@ancon.test",
      password: "",
    })
    expect(result.success).toBe(false)
  })

  // En login no se valida la composicion: el password ya existe en el backend con la
  // forma que sea (usuarios viejos pueden tener uno que no cumple las reglas nuevas).
  it("acepta un password que no cumple las reglas de complejidad", () => {
    const result = loginSchema.safeParse({
      email: "usuario@ancon.test",
      password: "abc",
    })
    expect(result.success).toBe(true)
  })
})

describe("passwordSchema", () => {
  it("acepta un password que cumple todas las reglas", () => {
    expect(passwordSchema.safeParse("Cambiar123").success).toBe(true)
  })

  it("rechaza un password menor a 8 caracteres", () => {
    expect(passwordSchema.safeParse("Ab1").success).toBe(false)
  })

  it("rechaza un password sin mayuscula", () => {
    expect(passwordSchema.safeParse("cambiar123").success).toBe(false)
  })

  it("rechaza un password sin numero", () => {
    expect(passwordSchema.safeParse("Cambiarahora").success).toBe(false)
  })
})
