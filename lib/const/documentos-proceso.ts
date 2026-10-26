// Catalogo de tipos de documento que se controlan por proceso de venta. Para agregar
// un tipo nuevo (ej. "contrato") alcanza con sumar una entrada aca — el resto del
// modulo (checklist, badges, subida) lo recorre dinamicamente sin tocar nada mas.
//
// anconAPI (repo separado) tiene su propio mirror de los tipos no-repetibles en
// apps/intranet/ventas/const/documentos-catalogo.const.ts, para calcular el resumen de
// revision de documentos server-side. No hay paquete compartido entre los dos repos —
// si se agrega/quita un tipo aca, hay que actualizar ese archivo tambien a mano.
export type CatalogoDocumentoProceso = {
  tipo: string
  etiqueta: string
  // Documentos repetibles (ej. rol de pago) no cuentan para el resumen fijo "x/y" de
  // la tabla de procesos, y se listan aparte con la posibilidad de agregar mas de uno
  // (usando "orden").
  repetible?: boolean
}

export const CATALOGO_DOCUMENTOS_PROCESO: CatalogoDocumentoProceso[] = [
  { tipo: "cedula_frontal", etiqueta: "Cédula (frontal)" },
  { tipo: "cedula_reverso", etiqueta: "Cédula (reverso)" },
  { tipo: "papeleta_votacion", etiqueta: "Papeleta de votación" },
  { tipo: "planilla_servicio_basico", etiqueta: "Planilla de servicio básico" },
  { tipo: "declaracion_sri", etiqueta: "Declaración SRI" },
  { tipo: "buro", etiqueta: "Buró de crédito" },
  { tipo: "rol_pago", etiqueta: "Rol de pago", repetible: true },
]
