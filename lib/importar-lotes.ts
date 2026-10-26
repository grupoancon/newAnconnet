import type { FilaImportacionLote } from "@/lib/api/inventario-api"

// Lectura de lotes para la importación masiva (Gestión inventario → "Importar lotes").
// Acepta tanto un archivo CSV (Excel → "Guardar como CSV") como celdas copiadas desde
// Excel y pegadas (separadas por tabulación). Sin librerías: el proyecto no tiene una
// para .xlsx y para esto alcanza con texto.

export const COLUMNAS_IMPORTACION: {
  campo: keyof FilaImportacionLote
  titulo: string
  // Variantes aceptadas en el encabezado (se comparan sin tildes, espacios ni mayúsculas).
  alias: string[]
  ejemplo: [string, string]
}[] = [
  {
    campo: "codigo",
    titulo: "Código",
    alias: ["codigo", "lote", "codigolote", "cod"],
    ejemplo: ["101", "102"],
  },
  {
    campo: "estado",
    titulo: "Estado",
    alias: ["estado"],
    ejemplo: ["LIBRE", "RESERVADO"],
  },
  {
    campo: "areaUtil",
    titulo: "Área útil",
    alias: ["areautil", "area", "areaútil"],
    ejemplo: ["450", "520.5"],
  },
  {
    campo: "areaProtec",
    titulo: "Área de protección",
    alias: ["areadeproteccion", "areaproteccion", "areaprotec", "proteccion"],
    ejemplo: ["0", "35"],
  },
  {
    campo: "pvp",
    titulo: "PVP",
    alias: ["pvp", "precio", "preciodeventa", "valor"],
    ejemplo: ["18500", "21000"],
  },
  { campo: "costo", titulo: "Costo", alias: ["costo"], ejemplo: ["9800", "10500"] },
  {
    campo: "numFac",
    titulo: "N.º factura",
    alias: ["numfac", "factura", "numerofactura", "nofactura", "nfactura"],
    ejemplo: ["", ""],
  },
  {
    campo: "anioFac",
    titulo: "Año factura",
    alias: ["aniofac", "anofactura", "aniofactura", "año", "anio"],
    ejemplo: ["", ""],
  },
]

function normalizarTitulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function detectarSeparador(primeraLinea: string): string {
  if (primeraLinea.includes("\t")) return "\t"
  const puntoYComa = (primeraLinea.match(/;/g) ?? []).length
  const comas = (primeraLinea.match(/,/g) ?? []).length
  return puntoYComa >= comas && puntoYComa > 0 ? ";" : ","
}

// CSV con comillas ("a;b" dentro de un campo, comillas dobles escapadas como "").
function separarCampos(linea: string, separador: string): string[] {
  const campos: string[] = []
  let actual = ""
  let enComillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (enComillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else if (c === '"') {
        enComillas = false
      } else {
        actual += c
      }
    } else if (c === '"') {
      enComillas = true
    } else if (c === separador) {
      campos.push(actual)
      actual = ""
    } else {
      actual += c
    }
  }
  campos.push(actual)
  return campos.map((campo) => campo.trim())
}

export type LecturaLotes = {
  filas: FilaImportacionLote[]
  // Columnas reconocidas en el encabezado (para mostrarle al usuario qué se leyó).
  columnasReconocidas: string[]
  // Encabezados que no se reconocieron (se ignoran).
  columnasIgnoradas: string[]
  sinEncabezado: boolean
}

export function leerLotes(texto: string): LecturaLotes {
  const lineas = texto
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((linea) => linea.trim().length > 0)
  if (lineas.length === 0) {
    return {
      filas: [],
      columnasReconocidas: [],
      columnasIgnoradas: [],
      sinEncabezado: false,
    }
  }

  const separador = detectarSeparador(lineas[0]!)
  const primera = separarCampos(lineas[0]!, separador)

  // ¿La primera fila es encabezado? Sí, si al menos una celda coincide con un alias.
  const indicePorCampo = new Map<keyof FilaImportacionLote, number>()
  const ignoradas: string[] = []
  primera.forEach((titulo, indice) => {
    const normalizado = normalizarTitulo(titulo)
    const columna = COLUMNAS_IMPORTACION.find((c) =>
      c.alias.some((alias) => normalizarTitulo(alias) === normalizado)
    )
    if (columna && !indicePorCampo.has(columna.campo))
      indicePorCampo.set(columna.campo, indice)
    else if (titulo) ignoradas.push(titulo)
  })
  const sinEncabezado = indicePorCampo.size === 0
  if (sinEncabezado) {
    // Sin encabezado: se asume el orden de la plantilla.
    COLUMNAS_IMPORTACION.forEach((c, i) => indicePorCampo.set(c.campo, i))
  }

  const filas = lineas.slice(sinEncabezado ? 0 : 1).map((linea) => {
    const celdas = separarCampos(linea, separador)
    const fila = {} as FilaImportacionLote
    for (const columna of COLUMNAS_IMPORTACION) {
      const indice = indicePorCampo.get(columna.campo)
      fila[columna.campo] = indice !== undefined ? (celdas[indice] ?? "") : ""
    }
    return fila
  })

  return {
    filas,
    columnasReconocidas: COLUMNAS_IMPORTACION.filter((c) =>
      indicePorCampo.has(c.campo)
    ).map((c) => c.titulo),
    columnasIgnoradas: sinEncabezado ? [] : ignoradas,
    sinEncabezado,
  }
}

// Plantilla CSV con «;» (el separador que usa Excel en español) y BOM UTF-8 para que
// Excel muestre bien las tildes al abrirla con doble clic.
export function plantillaCsvLotes(): Blob {
  const encabezado = COLUMNAS_IMPORTACION.map((c) => c.titulo).join(";")
  const ejemplos = [0, 1].map((i) =>
    COLUMNAS_IMPORTACION.map((c) => c.ejemplo[i]).join(";")
  )
  return new Blob(["﻿" + [encabezado, ...ejemplos].join("\r\n") + "\r\n"], {
    type: "text/csv;charset=utf-8",
  })
}
