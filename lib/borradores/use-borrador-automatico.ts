"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  eliminarBorrador,
  guardarBorrador,
  obtenerBorrador,
  type BorradorServidor,
  type TipoBorrador,
} from "@/lib/api/borradores-api"

// Autoguardado de formularios largos, al estilo Notion: mientras el usuario escribe,
// el estado completo del formulario se guarda solo — sin tocar el registro real (ej.
// la oferta), que sigue cambiando únicamente con el "Guardar" final.
//
// Dos copias, siempre la más nueva gana:
//  - Respaldo en el navegador (localStorage), en cada cambio, al instante. Es lo que
//    salva lo escrito si el servidor no responde o la sesión ya venció.
//  - Borrador en el servidor (anconAPI /borradores), 1 s después de dejar de escribir.
//    Es lo que permite seguir desde otro equipo, u otro día.
//
// La clave del respaldo local incluye el id del usuario: en una computadora compartida
// nadie ve el borrador de otro. Igual se borran todos al cerrar sesión (ver
// borrarRespaldosLocales).

const PREFIJO_LOCAL = "anconnet-borrador:"
const ESPERA_GUARDADO_MS = 1_000

export type EstadoAutoguardado =
  // Todavía no se cambió nada desde que se abrió el formulario.
  | { tipo: "sin-cambios" }
  | { tipo: "guardando" }
  // Guardado en el servidor.
  | { tipo: "guardado"; en: number }
  // El servidor no respondió: quedó solo en este equipo, se sube en el próximo cambio
  // o la próxima vez que se abra el formulario.
  | { tipo: "solo-local"; en: number }

type BorradorLocal<T> = BorradorServidor<T>

function claveLocal(idUsuario: string, tipo: TipoBorrador, clave: string): string {
  return `${PREFIJO_LOCAL}${idUsuario}:${tipo}:${clave}`
}

function leerLocal<T>(clave: string): BorradorLocal<T> | null {
  try {
    const crudo = localStorage.getItem(clave)
    if (!crudo) return null
    const valor = JSON.parse(crudo) as BorradorLocal<T>
    return typeof valor?.actualizadoEn === "number" ? valor : null
  } catch {
    return null
  }
}

function escribirLocal<T>(clave: string, borrador: BorradorLocal<T>): void {
  try {
    localStorage.setItem(clave, JSON.stringify(borrador))
  } catch {
    // sin localStorage (modo privado estricto, cuota llena): queda solo el servidor
  }
}

function borrarLocal(clave: string): void {
  try {
    localStorage.removeItem(clave)
  } catch {
    // nada que borrar
  }
}

// Al cerrar sesión: los respaldos locales llevan datos personales del cliente (cédula,
// ingresos...) — no tienen que quedar en el equipo. El borrador del servidor sigue ahí
// para cuando el usuario vuelva a entrar.
export function borrarRespaldosLocales(): void {
  try {
    const claves: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i)
      if (clave?.startsWith(PREFIJO_LOCAL)) claves.push(clave)
    }
    claves.forEach((clave) => localStorage.removeItem(clave))
  } catch {
    // sin localStorage: no hay nada guardado
  }
}

export function useBorradorAutomatico<T>({
  tipo,
  clave,
  idUsuario,
  datos,
  listo,
  alRecuperar,
}: {
  tipo: TipoBorrador
  clave: string
  idUsuario: string
  // Estado completo del formulario. Tiene que ser serializable a JSON.
  datos: T
  // true recién cuando el formulario terminó de cargar sus datos reales (ej. la oferta
  // ya guardada) — recién ahí se busca un borrador y empieza el autoguardado. Si no,
  // los datos "vacíos" del primer render se guardarían como borrador.
  listo: boolean
  // Se llama una sola vez si hay un borrador más nuevo que lo cargado: el formulario
  // tiene que volcar esos datos en su estado.
  alRecuperar: (datos: T) => void
}) {
  const [estado, setEstado] = useState<EstadoAutoguardado>({ tipo: "sin-cambios" })
  // Fecha del borrador que se recuperó al abrir (para el aviso "Recuperamos tu
  // borrador..."); null si no había ninguno.
  const [recuperadoEn, setRecuperadoEn] = useState<number | null>(null)
  const [activo, setActivo] = useState(false)

  const clLocal = claveLocal(idUsuario, tipo, clave)
  // Último estado ya guardado (serializado) — un cambio solo se guarda si es distinto.
  const ultimoSerializado = useRef<string | null>(null)
  // Cambio pendiente de subir al servidor (el respaldo local ya está escrito).
  const pendiente = useRef<BorradorServidor<T> | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alRecuperarRef = useRef(alRecuperar)
  alRecuperarRef.current = alRecuperar
  // Después de enviar o descartar: no se vuelve a guardar nada aunque cambien los datos
  // (ej. mientras la pantalla navega al reporte).
  const cerrado = useRef(false)

  const subirPendiente = useCallback(
    async (opciones: { keepalive?: boolean } = {}) => {
      const borrador = pendiente.current
      if (!borrador || cerrado.current) return
      setEstado({ tipo: "guardando" })
      try {
        await guardarBorrador(tipo, clave, borrador, opciones)
        // Si mientras subía hubo otro cambio, ese sigue pendiente.
        if (pendiente.current === borrador) pendiente.current = null
        setEstado({ tipo: "guardado", en: borrador.actualizadoEn })
      } catch {
        // Quedó en el respaldo local; se reintenta en el próximo cambio o al volver a
        // abrir el formulario. Un 401 ya redirige al login solo (avisarSiSesionVencida).
        setEstado({ tipo: "solo-local", en: borrador.actualizadoEn })
      }
    },
    [tipo, clave]
  )

  // 1) Al terminar de cargar el formulario: buscar borrador (servidor y local) y, si
  //    hay, recuperar el más nuevo.
  useEffect(() => {
    if (!listo || activo) return
    let cancelado = false

    async function buscar() {
      const local = leerLocal<T>(clLocal)
      let servidor: BorradorServidor<T> | null = null
      try {
        servidor = await obtenerBorrador<T>(tipo, clave)
      } catch {
        // servidor sin responder: se usa el local, si hay
      }
      if (cancelado) return

      const masNuevo =
        local && (!servidor || local.actualizadoEn > servidor.actualizadoEn)
          ? local
          : servidor
      if (masNuevo) {
        alRecuperarRef.current(masNuevo.datos)
        setRecuperadoEn(masNuevo.actualizadoEn)
        ultimoSerializado.current = JSON.stringify(masNuevo.datos)
        // El local era más nuevo que el del servidor (ej. se escribió con la sesión ya
        // vencida): se sube ahora.
        if (masNuevo === local) {
          pendiente.current = local
          void subirPendiente()
        }
      }
      // Mismo lote de renders que el alRecuperar de arriba: cuando el efecto de
      // guardado (2) vea `activo`, los datos ya son los recuperados.
      setActivo(true)
    }

    void buscar()
    return () => {
      cancelado = true
    }
  }, [listo, activo, tipo, clave, clLocal, subirPendiente])

  // 2) Cada cambio: respaldo local al instante, servidor 1 s después de dejar de escribir.
  useEffect(() => {
    if (!activo || cerrado.current) return
    const serializado = JSON.stringify(datos)
    if (ultimoSerializado.current === null) {
      // Primer render activo sin borrador recuperado: es el estado tal como se cargó,
      // todavía no es un cambio del usuario.
      ultimoSerializado.current = serializado
      return
    }
    if (serializado === ultimoSerializado.current) return
    ultimoSerializado.current = serializado

    const borrador: BorradorServidor<T> = { datos, actualizadoEn: Date.now() }
    escribirLocal(clLocal, borrador)
    pendiente.current = borrador
    setEstado({ tipo: "guardando" })
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => void subirPendiente(), ESPERA_GUARDADO_MS)
  }, [datos, activo, clLocal, subirPendiente])

  // 3) Al salir de la pantalla o esconder la pestaña: subir lo pendiente ya, sin esperar
  //    el segundo de espera.
  useEffect(() => {
    function alOcultar() {
      if (document.visibilityState === "hidden" && pendiente.current) {
        clearTimeout(temporizador.current)
        void subirPendiente({ keepalive: true })
      }
    }
    document.addEventListener("visibilitychange", alOcultar)
    return () => {
      document.removeEventListener("visibilitychange", alOcultar)
      clearTimeout(temporizador.current)
      if (pendiente.current) void subirPendiente({ keepalive: true })
    }
  }, [subirPendiente])

  // Borra el borrador (servidor y local) y deja de autoguardar. Para después de enviar
  // el formulario con éxito, o cuando el usuario elige descartarlo.
  const eliminar = useCallback(async () => {
    cerrado.current = true
    clearTimeout(temporizador.current)
    pendiente.current = null
    borrarLocal(clLocal)
    try {
      await eliminarBorrador(tipo, clave)
    } catch {
      // Si no se pudo borrar en el servidor, no se bloquea al usuario: en el peor caso
      // la próxima vez se le ofrece un borrador viejo, que puede descartar.
    }
  }, [tipo, clave, clLocal])

  return { estado, recuperadoEn, eliminar }
}
