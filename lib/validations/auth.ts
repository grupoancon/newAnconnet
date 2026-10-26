import { z } from "zod"

// Reglas de complejidad para cuando un administrador define la contraseña de un
// usuario (Admin → Usuarios → Cambiar contraseña). En forma de lista para mostrarlas
// en vivo mientras se escribe; passwordSchema valida lo mismo.
export const REGLAS_PASSWORD: { texto: string; cumple: (password: string) => boolean }[] = [
  { texto: "Al menos 8 caracteres", cumple: (p) => p.length >= 8 },
  { texto: "Una letra mayúscula", cumple: (p) => /[A-Z]/.test(p) },
  { texto: "Un número", cumple: (p) => /[0-9]/.test(p) },
]

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir al menos una letra mayuscula")
  .regex(/[0-9]/, "Debe incluir al menos un numero")

// En login el password ya existe en el backend con la forma que sea; solo se valida
// que no venga vacio, nunca su composicion.
export const loginSchema = z.object({
  email: z.string().min(1, "El email es requerido").email("Ingresa un email valido"),
  password: z.string().min(1, "La contraseña es requerida"),
})

export type LoginInput = z.infer<typeof loginSchema>
