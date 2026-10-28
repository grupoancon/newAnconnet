// Catalogos de ejemplo para los selects de formularios estaticos (fase de diseno):
// no vienen de la base de datos todavia, se conectan cuando exista el modulo real.
export const LUGARES_VENTA = ["Oficina", "Puerto Quito"]

// Reutilizado tal cual (value === label) en cualquier form que guarde asesor —
// cli_asesor es VarChar(200) en la BD, el nombre completo entra sin problema.
export const ASESORES = [
  "ANDRADE CONTRERAS MIRIAM GERALDINE",
  "ALCAZAR SANTOS JHOANNA ELIZABETH",
  "BORJA MENDOZA MARCELO GEOVANNI",
  "CRUZ PEREZ THAIS STEPHANY",
  "CUVI VAZQUES MARIBEL GUADALUPE",
  "MAYORGA ORTIZ NANCY PATRICIA",
  "NARANJO VALENCIA JENNY MARCELA",
  "NARANJO YASIG VERONICA PATRICIA",
  "QUIMBAILA ANGULO MARIA GABRIELA",
  "ROSERO YASIG ANA BEATRIZ",
  "SARMIENTO MORALES CLAUDIA ALEJANDRA",
  "RODRIGUEZ MENDOZA MARTHA ELIANA",
  "NARANJO YASIG MARCO VINICIO",
  "OCAÑA VARGAS GLORIA NOEMI",
  "KARLA PAOLA ANDRADE",
]

export const ESTADOS_CIVILES = [
  "SOLTERO/A",
  "CASADO/A",
  "DIVORCIADO/A",
  "UNIÓN LIBRE",
  "VIUDO/A",
]

export const SEXOS = ["FEMENINO", "MASCULINO"]

// Selección múltiple (una referencia puede tener más de un vínculo con el cliente,
// ej. "Madre, Amiga") — reutilizable en cualquier form que pida parentesco de una
// referencia familiar (Referencias de la oferta, Cónyuge, etc.).
export const PARENTESCOS = [
  "PADRE",
  "MADRE",
  "HIJO/HIJA",
  "HERMANO/HERMANA",
  "PRIMO/PRIMA",
  "SOBRINO/SOBRINA",
  "TIO/TIA",
  "CUÑADO/CUÑADA",
  "ABUELO/ABUELA",
  "AMIGO/AMIGA",
]

// Relación con el cliente (clientes adicionales, referido, PEP, dueño de los fondos):
// cónyuge + parentescos + vínculos no familiares. Un solo valor (select simple).
export const RELACIONES = [
  "CÓNYUGE",
  ...PARENTESCOS,
  "SOCIO/SOCIA",
  "EMPLEADO/EMPLEADA",
  "OTRO",
]

// Un select con secciones (equivalente a <optgroup>) — SelectField lo acepta como
// prop "grupos" en vez de "options"/"opciones" cuando el catálogo tiene categorías.
export type GrupoOpciones = { grupo: string; opciones: string[] }

// Canal por el que llegó el cliente — reutilizable en cualquier form que pida "¿Cómo
// nos contactó?" del paso Asesor (u otro similar).
export const MEDIOS_CONTACTO_GRUPOS: GrupoOpciones[] = [
  {
    grupo: "REDES SOCIALES",
    opciones: [
      "FACEBOOK PERSONAL",
      "FACEBOOK EMPRESA",
      "TIKTOK",
      "TIKTOK PERSONAL",
      "INSTAGRAM",
      "PÁGINA WEB",
    ],
  },
  { grupo: "REFERIDOS", opciones: ["EXTERNO", "CLIENTE", "FAMILIAR ASESOR"] },
  { grupo: "ROTULOS", opciones: ["OFICINA", "PROYECTO"] },
  {
    grupo: "FERIAS",
    opciones: [
      "CLAVE MAYO",
      "CLAVE JUNIO",
      "CLAVE NOVIEMBRE",
      "CLAVE 2026",
      "BIESS",
      "FERIAS OTROS",
    ],
  },
  { grupo: "STAND", opciones: ["RECREO", "QUICENTRO SUR", "STAND OTROS"] },
  {
    grupo: "OTROS",
    opciones: ["CLIENTE ANTIGUO", "LLAMADA OFICINA", "FUNCIONARIO DE LA EMPRESA"],
  },
]

export const PROSPECTADORES = ["Cristian Mosquera", "Tatiana Cevallos", "Aaron Andrade"]

// Tipo de operación del inmueble (paso "Inmueble" de la oferta) — se refleja en el
// reporte de licitud de fondos (Sección 0 del formulario UAFE).
export const TIPOS_OPERACION = [
  "Compraventa",
  "Promesa de compraventa",
  "Arrendamiento",
  "Cesión de derechos",
  "Anticresis",
  "Otro",
]

// Institución financiera receptora del pago — el número y tipo de cuenta se completa
// solo según el banco elegido (ver CUENTAS_BANCOS_RECEPTORES). Se muestra en el
// reporte de licitud de fondos, Sección 6.
export const BANCOS_RECEPTORES = ["Banco Pichincha", "Banco General Rumiñahui"]

export const CUENTAS_BANCOS_RECEPTORES: Record<string, string> = {
  "Banco Pichincha": "3185109904 - Corriente",
  "Banco General Rumiñahui": "8020394004 - Corriente",
}

// Fuente de ingresos (paso "Datos financieros" de la oferta) — mismo catálogo que
// pide el formulario UAFE de licitud de fondos.
export const FUENTES_INGRESOS = [
  "Relación de dependencia",
  "Negocio propio",
  "Inversiones",
  "Alquileres",
  "Honorarios profesionales",
  "Remesas",
  "Otro",
]

export const MOTIVOS_COMPRA = [
  "INVERSION",
  "VACACIONAL",
  "NATURALEZA",
  "VIVIENDA",
  "SALUD",
  "PROYECTO",
]

// Reutilizado tal cual (value === label) en cualquier form que guarde nacionalidad —
// cli_nacion es VarChar(25) en la BD, estos valores entran sin problema.
export const NACIONALIDADES = [
  "Ecuatoriana",
  "Colombiana",
  "Venezolana",
  "Peruana",
  "Otra",
]

// value !== label: para campos con columna corta en la BD (sale_process en
// prisma/schema.prisma) donde no cabe guardar el texto completo que ve el usuario.
export type OpcionSelect = { value: string; label: string }

// cli_sexo es VarChar(5) — se guarda "M"/"F", se muestra el nombre completo.
export const SEXOS_OPCIONES: OpcionSelect[] = [
  { value: "M", label: "FEMENINO" },
  { value: "F", label: "MASCULINO" },
]

// cli_estcivil es VarChar(5) — códigos cortos como value; ajustalos si el sistema
// legado ya usa otra convención.
export const ESTADOS_CIVILES_OPCIONES: OpcionSelect[] = [
  { value: "S", label: "Soltero(a)" },
  { value: "C", label: "Casado(a)" },
  { value: "D", label: "Divorciado(a)" },
  { value: "V", label: "Viudo(a)" },
  { value: "U", label: "Unión libre" },
]

// location (lugar de venta real, no el catalogo amplio de LUGARES_VENTA de arriba
// que es solo para el mock de nuevo-proceso/oferta) — solo estos dos puntos de venta.
export const LUGARES_VENTA_OPCIONES: OpcionSelect[] = [
  { value: "oficina", label: "Oficina" },
  { value: "Puerto Quito", label: "Puerto Quito" },
]

export const SUCURSALES = ["Oficina Quito", "Oficina Puerto Quito", "Oficina Otavalo"]

export const TIPOS_FINANCIAMIENTO = [
  "Crédito directo",
  "Crédito BIESS",
  "Contado",
  "Mixto",
]

// Forma de pago de cada fila de la tabla de entrada (financiamiento).
export const FORMAS_PAGO_ENTRADA = [
  "Abono inicial",
  "Entrada",
  "Pago total",
  "Desembolso BIESS",
  "Crédito BIESS",
]

// Ofrecimientos adicionales del lote (financiamiento) — selección múltiple, se
// pueden marcar varios a la vez.
export const OFRECIMIENTOS_FINANCIAMIENTO = ["Huerto", "Tanque biodigestor"]

// Forma en la que el cliente hizo un pago (módulo Pago) — no confundir con
// FORMAS_PAGO_ENTRADA, que describe filas de la tabla de entrada del financiamiento.
export const TIPOS_PAGO = ["Transferencia", "Cheque"]

export const ANIOS = ["Todos", "2026", "2025", "2024"]

export const MESES = [
  "Todos",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

// --- RRHH (solicitudes de permiso / préstamo-anticipo) ---

export const TIPOS_PERMISO = [
  "PERMISO MEDICO",
  "PERMISO CON DESCUENTO A ROL",
  "PERMISO A SER RECUPERADO",
  "PERMISO OFICIAL",
  "PERMISO CARGO A VACACIONES",
  "ASUNTOS PERSONALES",
  "PERMISO POR CALAMIDAD DOMESTICA",
  "PERMISO POR MATRIMONIO",
  "PERMISO DEL DIA",
]

export const TIPOS_PRESTAMO = ["PRESTAMO", "ANTICIPO"]

export const PLAZOS_PRESTAMO = [
  "3 Meses",
  "6 Meses",
  "9 Meses",
  "12 Meses",
  "18 Meses",
  "24 Meses",
]

// Mayúsculas (a diferencia de MESES, que es para filtros) — mismo estilo que el
// resto de catálogos de este formulario ("PRESTAMO", "ANTICIPO").
export const MESES_COBRO = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
]
