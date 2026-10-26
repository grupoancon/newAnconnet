"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { io, type Socket } from "socket.io-client"

import { useSession } from "@/components/shared/session-provider"

// Namespace "aplication" del gateway de anconAPI (`apps/aplication/websocket`). Misma
// NEXT_PUBLIC_API_URL que lib/api/*: cambiar de servidor sigue siendo una línea en .env.
const SOCKET_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/aplication`

// El backend agrupa a los admins/intranet por empresa en la sala `empresa_<id>`. (La
// triple "c" es el id real que usa el backend por defecto — no es un typo de acá.)
const EMPRESA_ID = "inmoconstruccciones"

// Un usuario conectado a la intranet ahora mismo (varias pestañas = un solo registro).
export type UsuarioEnLinea = {
  usuarioId: string
  nombre: string
  // Ruta en la que está, ej. "/tesoreria/depositos".
  modulo: string
  conexiones: number
  desde: number
  // ids de las sesiones (dispositivos) de este usuario con la intranet abierta ahora.
  // Puede faltar si el backend es una versión anterior.
  sesiones?: string[]
}

type PresenciaContexto = {
  // Socket único de la pestaña, compartido con las pantallas que escuchan eventos
  // propios (ej. depósitos). Null hasta que monta.
  socket: Socket | null
  conectado: boolean
  enLinea: UsuarioEnLinea[]
}

const PresenciaContext = createContext<PresenciaContexto>({
  socket: null,
  conectado: false,
  enLinea: [],
})

// Se monta una sola vez en el shell del dashboard, así "en línea" significa "tiene la
// intranet abierta" y no "tiene abierta una pantalla en particular". Es la única
// conexión websocket de la pestaña.
export function PresenciaProvider({ children }: { children: React.ReactNode }) {
  const usuario = useSession()
  const pathname = usePathname()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [conectado, setConectado] = useState(false)
  const [enLinea, setEnLinea] = useState<UsuarioEnLinea[]>([])

  // Refs para que la (re)conexión use siempre el módulo actual sin recrear el socket.
  const moduloRef = useRef(pathname)
  moduloRef.current = pathname

  useEffect(() => {
    const nuevoSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    nuevoSocket.on("connect", () => {
      setConectado(true)
      // Hay que re-identificarse en cada (re)conexión: las salas se pierden al caer.
      // El tercer elemento es opcional: handlers viejos que solo leen
      // [empresaId, rol] lo ignoran. Solo id y nombre, nunca el email.
      nuevoSocket.emit("identificar_admin", [
        EMPRESA_ID,
        "admin",
        {
          app: "intranet",
          modulo: moduloRef.current,
          usuarioId: usuario.id,
          nombre: usuario.nombre,
        },
      ])
    })
    nuevoSocket.on("disconnect", () => {
      setConectado(false)
      setEnLinea([])
    })
    nuevoSocket.on("presencia_intranet", (lista: UsuarioEnLinea[]) => {
      setEnLinea(Array.isArray(lista) ? lista : [])
    })

    setSocket(nuevoSocket)

    return () => {
      nuevoSocket.off()
      nuevoSocket.disconnect()
      setSocket(null)
      setConectado(false)
      setEnLinea([])
    }
  }, [usuario.id, usuario.nombre])

  // Cada navegación le dice al backend en qué módulo está el usuario.
  useEffect(() => {
    if (socket?.connected) {
      socket.emit("actualizar_modulo", { modulo: pathname })
    }
  }, [pathname, socket])

  const valor = useMemo(
    () => ({ socket, conectado, enLinea }),
    [socket, conectado, enLinea]
  )

  return <PresenciaContext.Provider value={valor}>{children}</PresenciaContext.Provider>
}

export function usePresencia(): PresenciaContexto {
  return useContext(PresenciaContext)
}

// Útil para marcar filas/listas: `estaEnLinea(id)`.
export function useEstaEnLinea(): (usuarioId: string) => boolean {
  const { enLinea } = usePresencia()
  const ids = useMemo(() => new Set(enLinea.map((u) => u.usuarioId)), [enLinea])
  return (usuarioId) => ids.has(usuarioId)
}
