import { z } from "zod"

// Ejemplo de schema del futuro modulo de financiamiento: demuestra que las reglas
// (ej. limites de monto) viven en un solo lugar, reutilizado en cliente y servidor.
// El modulo real (server/actions, pantallas de negocio) se construye en la fase siguiente.
export const solicitudFinanciamientoSchema = z.object({
  loteId: z.string().min(1, "Selecciona un lote"),
  monto: z.coerce
    .number({ error: "El monto debe ser un numero" })
    .positive("El monto debe ser mayor a 0")
    .max(10_000_000, "El monto excede el maximo permitido"),
  plazoMeses: z.coerce
    .number({ error: "El plazo debe ser un numero" })
    .int("El plazo debe ser un numero entero de meses")
    .min(1, "El plazo minimo es 1 mes")
    .max(360, "El plazo maximo es 360 meses"),
})

export type SolicitudFinanciamientoInput = z.infer<typeof solicitudFinanciamientoSchema>
