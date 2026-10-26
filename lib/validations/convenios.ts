import { z } from "zod"

// Debe calzar 1:1 con VariableDefinicionDto/EntidadVariable en anconAPI
// (apps/intranet/convenios/dto/convenio.dto.ts) — la clave se inserta en el editor
// como {{clave}} (sintaxis Handlebars) y el backend la resuelve contra el campo real
// de la entidad elegida al generar el convenio de un proceso de venta real.
export const ENTIDADES_VARIABLE = [
  "proyecto",
  "inventario",
  "titular",
  "conyuge",
  "apoderado",
  "financiamiento",
  "oferta",
  "proceso",
  "sistema",
  "seleccion",
] as const

export const opcionSeleccionSchema = z.object({
  valor: z.string().min(1, "El valor es requerido"),
  etiqueta: z.string().min(1, "La etiqueta es requerida"),
})

// "seleccion" no usa `campo` (no tiene columna de BD) — en cambio exige `opciones` con
// al menos 2 filas, validado con superRefine porque depende del valor de `entidad`.
export const variableDefinicionSchema = z
  .object({
    clave: z
      .string()
      .min(1, "La clave es requerida")
      .regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y guión bajo"),
    etiqueta: z.string().min(1, "La etiqueta es requerida"),
    entidad: z.enum(ENTIDADES_VARIABLE),
    campo: z.string().optional(),
    opciones: z.array(opcionSeleccionSchema).optional(),
  })
  .superRefine((variable, ctx) => {
    if (variable.entidad === "seleccion") {
      const opciones = variable.opciones ?? []
      if (opciones.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Agrega al menos 2 opciones",
          path: ["opciones"],
        })
      } else if (new Set(opciones.map((o) => o.valor)).size !== opciones.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hay valores de opción repetidos",
          path: ["opciones"],
        })
      }
    } else if (!variable.campo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona un campo",
        path: ["campo"],
      })
    }
  })

export type VariableDefinicionInput = z.infer<typeof variableDefinicionSchema>

export const convenioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  contenido: z.string().min(1, "El contenido no puede estar vacío"),
  variables: z
    .array(variableDefinicionSchema)
    .refine(
      (variables) => new Set(variables.map((v) => v.clave)).size === variables.length,
      { message: "Hay claves de variable repetidas" }
    ),
  activo: z.boolean().optional(),
})

export type ConvenioInput = z.infer<typeof convenioSchema>
