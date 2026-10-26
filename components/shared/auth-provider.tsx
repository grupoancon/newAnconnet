"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

const COOKIE_NAME = "anconnet_session"
const COOKIE_MAX_AGE_SECONDS_DEFAULT = 60 * 60 * 24 * 30 // 30 dias, igual que la sesion del backend (anconAPI lib/auth.ts)
const CANAL_NOMBRE = "anconnet-auth"

export type SesionAuth<TUsuario> = {
  usuario: TUsuario
  token: string
  // epoch ms opcional; si se pasa, la sesion se descarta sola al leerla vencida y
  // controla el Max-Age real de la cookie.
  expiraEn?: number
}

type AuthContextValue<TUsuario> = {
  usuario: TUsuario | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  iniciarSesion: (sesion: SesionAuth<TUsuario>) => void
  actualizarUsuario: (usuario: TUsuario) => void
  cerrarSesion: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AuthContext = createContext<AuthContextValue<any> | null>(null)

// --- Cookies: lectura/escritura nunca deben tumbar la app (SSR sin `document`,
// cookies deshabilitadas, o valor corrupto siempre degradan a "sin sesion"). ---

function leerCookie(nombre: string): string | null {
  if (typeof document === "undefined") return null
  try {
    const fila = document.cookie
      .split("; ")
      .find((parte) => parte.startsWith(`${nombre}=`))
    if (!fila) return null
    return decodeURIComponent(fila.slice(nombre.length + 1))
  } catch {
    return null
  }
}

function escribirCookie(nombre: string, valor: string, maxAgeSegundos: number): void {
  if (typeof document === "undefined") return
  try {
    const segura = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${nombre}=${encodeURIComponent(valor)}; Max-Age=${Math.max(0, maxAgeSegundos)}; Path=/; SameSite=Lax${segura}`
  } catch {
    // El estado en memoria sigue funcionando aunque no se pueda persistir.
  }
}

function borrarCookie(nombre: string): void {
  if (typeof document === "undefined") return
  try {
    document.cookie = `${nombre}=; Max-Age=0; Path=/; SameSite=Lax`
  } catch {
    // silencioso
  }
}

function leerSesionGuardada<TUsuario>(): SesionAuth<TUsuario> | null {
  const crudo = leerCookie(COOKIE_NAME)
  if (!crudo) return null

  try {
    const sesion = JSON.parse(crudo) as SesionAuth<TUsuario>
    if (!sesion?.token) return null

    if (sesion.expiraEn && sesion.expiraEn < Date.now()) {
      borrarCookie(COOKIE_NAME)
      return null
    }

    return sesion
  } catch {
    return null
  }
}

function guardarSesion<TUsuario>(sesion: SesionAuth<TUsuario> | null): void {
  if (!sesion) {
    borrarCookie(COOKIE_NAME)
    return
  }

  // Nota: las cookies tienen un limite practico de ~4KB. Manten `usuario` liviano
  // (id, nombre, email, roles) — no metas objetos grandes ahi.
  const maxAgeSegundos = sesion.expiraEn
    ? Math.floor((sesion.expiraEn - Date.now()) / 1000)
    : COOKIE_MAX_AGE_SECONDS_DEFAULT

  escribirCookie(COOKIE_NAME, JSON.stringify(sesion), maxAgeSegundos)
}

export function AuthProvider<TUsuario = unknown>({
  children,
}: {
  children: React.ReactNode
}) {
  const [sesion, setSesion] = useState<SesionAuth<TUsuario> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const canalRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    setSesion(leerSesionGuardada<TUsuario>())
    setIsLoading(false)
  }, [])

  // Las cookies no disparan un evento nativo al cambiar (a diferencia de localStorage),
  // asi que la sincronizacion entre pestañas se hace a mano con BroadcastChannel.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return
    }
    const canal = new BroadcastChannel(CANAL_NOMBRE)
    canalRef.current = canal
    canal.onmessage = () => setSesion(leerSesionGuardada<TUsuario>())
    return () => {
      canal.close()
      canalRef.current = null
    }
  }, [])

  const notificarOtrasPestanas = useCallback(() => {
    canalRef.current?.postMessage("sync")
  }, [])

  const iniciarSesion = useCallback(
    (nuevaSesion: SesionAuth<TUsuario>) => {
      setSesion(nuevaSesion)
      guardarSesion(nuevaSesion)
      notificarOtrasPestanas()
    },
    [notificarOtrasPestanas]
  )

  const actualizarUsuario = useCallback(
    (usuario: TUsuario) => {
      setSesion((actual) => {
        if (!actual) return actual
        const siguiente = { ...actual, usuario }
        guardarSesion(siguiente)
        return siguiente
      })
      notificarOtrasPestanas()
    },
    [notificarOtrasPestanas]
  )

  const cerrarSesion = useCallback(() => {
    setSesion(null)
    guardarSesion(null)
    notificarOtrasPestanas()
  }, [notificarOtrasPestanas])

  const value = useMemo<AuthContextValue<TUsuario>>(
    () => ({
      usuario: sesion?.usuario ?? null,
      token: sesion?.token ?? null,
      isAuthenticated: Boolean(sesion),
      isLoading,
      iniciarSesion,
      actualizarUsuario,
      cerrarSesion,
    }),
    [sesion, isLoading, iniciarSesion, actualizarUsuario, cerrarSesion]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth<TUsuario = unknown>(): AuthContextValue<TUsuario> {
  const contexto = useContext(AuthContext)
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  }
  return contexto as AuthContextValue<TUsuario>
}
