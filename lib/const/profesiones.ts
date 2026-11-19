import type { ComboboxOption } from "@/components/shared/combobox-field"

// Catálogo de "Profesión / Ocupación" de la oferta de compra, agrupado por categoría.
// La búsqueda del combo también filtra por el nombre de la categoría.

export const PROFESION_OTRA = "Otra profesión u oficio — especificar"
export const INGENIERIA_OTRA = "Otra ingeniería — especificar"

// Al guardar "Otra ingeniería" se manda "Ingeniero/a en <texto>"; al leerla de vuelta
// se reconoce por este prefijo.
const PREFIJO_INGENIERIA = "Ingeniero/a en "

export const PROFESIONES_POR_CATEGORIA: { categoria: string; opciones: string[] }[] = [
  {
    categoria: "Administración y negocios",
    opciones: [
      "Administrador/a de empresas",
      "Contador/a o auditor/a",
      "Economista",
      "Profesional de finanzas",
      "Profesional de marketing",
      "Profesional de comercio exterior",
    ],
  },
  {
    categoria: "Derecho y ciencias sociales",
    opciones: ["Abogado/a", "Psicólogo/a", "Trabajador/a social"],
  },
  {
    categoria: "Educación y comunicación",
    opciones: [
      "Docente",
      "Periodista o comunicador/a",
      "Diseñador/a gráfico/a",
      "Artista",
    ],
  },
  {
    categoria: "Salud",
    opciones: [
      "Médico/a",
      "Odontólogo/a",
      "Enfermero/a",
      "Auxiliar de enfermería",
      "Veterinario/a",
      "Farmacéutico/a o bioquímico/a",
      "Nutricionista",
      "Fisioterapeuta",
    ],
  },
  {
    categoria: "Ingeniería y tecnología",
    opciones: [
      "Arquitecto/a",
      "Ingeniero/a civil",
      "Ingeniero/a industrial",
      "Ingeniero/a mecánico/a",
      "Ingeniero/a eléctrico/a",
      "Ingeniero/a electrónico/a o en telecomunicaciones",
      "Profesional de sistemas o desarrollo de software",
      "Ingeniero/a agrónomo/a",
      "Ingeniero/a ambiental",
      INGENIERIA_OTRA,
    ],
  },
  {
    categoria: "Comercio y servicios",
    opciones: [
      "Comerciante",
      "Vendedor/a o asesor/a comercial",
      "Agente inmobiliario/a",
      "Cocinero/a o chef",
      "Panadero/a o pastelero/a",
      "Peluquero/a, barbero/a o profesional de belleza",
      "Profesional de turismo u hotelería",
    ],
  },
  {
    categoria: "Oficios y operaciones",
    opciones: [
      "Agricultor/a",
      "Ganadero/a",
      "Pescador/a",
      "Artesano/a",
      "Albañil",
      "Carpintero/a",
      "Electricista",
      "Plomero/a o gasfitero/a",
      "Mecánico/a",
      "Soldador/a",
      "Sastre o modista",
      "Conductor/a",
      "Operador/a de maquinaria",
      "Técnico/a de mantenimiento",
      "Trabajador/a de limpieza",
      "Trabajador/a del hogar remunerado/a",
    ],
  },
  {
    categoria: "Seguridad",
    opciones: ["Policía", "Militar", "Bombero/a", "Guardia de seguridad"],
  },
  {
    categoria: "Opciones finales",
    opciones: [PROFESION_OTRA, "No tengo una profesión u oficio definido"],
  },
]

export const OPCIONES_PROFESIONES: ComboboxOption[] = PROFESIONES_POR_CATEGORIA.flatMap(
  ({ categoria, opciones }) =>
    opciones.map((opcion) => ({ value: opcion, label: opcion, group: categoria }))
)

const VALORES = new Set(OPCIONES_PROFESIONES.map((o) => o.value))

export function requiereEspecificarProfesion(profesion: string): boolean {
  return profesion === PROFESION_OTRA || profesion === INGENIERIA_OTRA
}

// Valor guardado → { opción del combo, texto "especificar" }. Lo que no está en el
// catálogo (texto libre o valores del catálogo anterior) cae en "Otra profesión".
export function separarProfesion(guardado: string | null | undefined): {
  profesion: string
  otro: string
} {
  const valor = (guardado ?? "").trim()
  if (!valor || VALORES.has(valor)) return { profesion: valor, otro: "" }
  if (valor.startsWith(PREFIJO_INGENIERIA))
    return { profesion: INGENIERIA_OTRA, otro: valor.slice(PREFIJO_INGENIERIA.length) }
  return { profesion: PROFESION_OTRA, otro: valor }
}

// Opción del combo + texto "especificar" → valor que se guarda.
export function unirProfesion(profesion: string, otro: string): string {
  const texto = otro.trim()
  if (profesion === INGENIERIA_OTRA) return texto ? `${PREFIJO_INGENIERIA}${texto}` : ""
  if (profesion === PROFESION_OTRA) return texto
  return profesion
}

// Catálogo de "Cargo / Puesto" (nivel jerárquico). "Otro nivel" pide el texto, que es
// lo que se guarda; un valor guardado que no está en la lista se carga como "Otro nivel".
export const CARGO_OTRO = "Otro nivel — especificar"

export const CARGOS_NIVELES = [
  "Presidencia",
  "Gerencia general",
  "Dirección de área",
  "Gerencia de área",
  "Jefatura",
  "Coordinación",
  "Supervisión",
  "Especialista",
  "Analista",
  "Asesor/a o ejecutivo/a",
  "Asistente",
  "Auxiliar",
  "Personal técnico",
  "Personal operativo",
  CARGO_OTRO,
  "No aplica",
]

export function separarCargo(guardado: string | null | undefined): {
  cargo: string
  otro: string
} {
  const valor = (guardado ?? "").trim()
  if (!valor || CARGOS_NIVELES.includes(valor)) return { cargo: valor, otro: "" }
  return { cargo: CARGO_OTRO, otro: valor }
}

export function unirCargo(cargo: string, otro: string): string {
  return cargo === CARGO_OTRO ? otro.trim() : cargo
}
