// Errores de la firma electrónica. Los mensajes están pensados para mostrarse al usuario
// y NUNCA incluyen la contraseña del .p12 ni rutas internas del servidor.

export type CodigoErrorFirma =
  | "FIRMA_DESHABILITADA"
  | "CONFIGURACION_INCOMPLETA"
  | "CERTIFICADO_NO_ENCONTRADO"
  | "CONTRASENA_INCORRECTA"
  | "CERTIFICADO_INVALIDO"
  | "CERTIFICADO_SIN_CLAVE"
  | "CERTIFICADO_VENCIDO"
  | "CERTIFICADO_NO_VIGENTE"
  | "PDF_CORRUPTO"
  | "PDF_PROTEGIDO"
  | "PAGINA_INVALIDA"
  | "TSA_ERROR"
  | "ESPACIO_INSUFICIENTE"

const ESTADO_HTTP: Record<CodigoErrorFirma, number> = {
  FIRMA_DESHABILITADA: 503,
  CONFIGURACION_INCOMPLETA: 500,
  CERTIFICADO_NO_ENCONTRADO: 500,
  CONTRASENA_INCORRECTA: 500,
  CERTIFICADO_INVALIDO: 500,
  CERTIFICADO_SIN_CLAVE: 500,
  CERTIFICADO_VENCIDO: 500,
  CERTIFICADO_NO_VIGENTE: 500,
  PDF_CORRUPTO: 422,
  PDF_PROTEGIDO: 422,
  PAGINA_INVALIDA: 400,
  TSA_ERROR: 502,
  ESPACIO_INSUFICIENTE: 500,
}

export class FirmaError extends Error {
  readonly codigo: CodigoErrorFirma
  readonly estadoHttp: number

  constructor(codigo: CodigoErrorFirma, mensaje: string) {
    super(mensaje)
    this.name = "FirmaError"
    this.codigo = codigo
    this.estadoHttp = ESTADO_HTTP[codigo]
  }
}
