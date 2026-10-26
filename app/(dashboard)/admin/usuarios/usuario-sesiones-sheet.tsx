"use client"

import { useCallback, useEffect, useState } from "react"
import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react"

import { usePresencia } from "@/components/shared/presencia-provider"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AdminApiError,
  listUserSessions,
  revokeUserSession,
  revokeUserSessions,
  type SesionUsuario,
  type UsuarioAdmin,
} from "@/lib/api/admin-api"
import { cn } from "@/lib/utils"

// Máximo de sesiones que se listan (activas + vencidas, las más recientes primero).
const MAX_SESIONES_VISIBLES = 10

type Dispositivo = {
  navegador: string
  sistema: string
  tipo: "movil" | "tablet" | "escritorio"
}

// Lectura simple del User-Agent: alcanza para distinguir "Chrome en Windows" de
// "Safari en iPhone" sin agregar una dependencia. El orden importa (Edge/Opera dicen
// también "Chrome"; Chrome dice también "Safari").
function leerUserAgent(ua: string | null | undefined): Dispositivo {
  const texto = ua ?? ""
  if (!texto) return { navegador: "Desconocido", sistema: "", tipo: "escritorio" }

  const navegador = /Edg\//.test(texto)
    ? "Edge"
    : /OPR\/|Opera/.test(texto)
      ? "Opera"
      : /SamsungBrowser/.test(texto)
        ? "Samsung Internet"
        : /Firefox|FxiOS/.test(texto)
          ? "Firefox"
          : /Chrome|CriOS/.test(texto)
            ? "Chrome"
            : /Safari/.test(texto)
              ? "Safari"
              : texto.includes("node") || /curl|axios|okhttp/i.test(texto)
                ? "Cliente API"
                : "Navegador"

  const sistema = /iPhone/.test(texto)
    ? "iPhone"
    : /iPad/.test(texto)
      ? "iPad"
      : /Android/.test(texto)
        ? "Android"
        : /Windows/.test(texto)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(texto)
            ? "macOS"
            : /CrOS/.test(texto)
              ? "ChromeOS"
              : /Linux/.test(texto)
                ? "Linux"
                : ""

  const tipo: Dispositivo["tipo"] =
    /iPad|Tablet/.test(texto) || (/Android/.test(texto) && !/Mobile/.test(texto))
      ? "tablet"
      : /iPhone|Android|Mobile/.test(texto)
        ? "movil"
        : "escritorio"

  return { navegador, sistema, tipo }
}

const formatoFecha = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

function fecha(valor: string): string {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? "—" : formatoFecha.format(d)
}

function IconoDispositivo({ tipo }: { tipo: Dispositivo["tipo"] }) {
  const Icono = tipo === "movil" ? Smartphone : tipo === "tablet" ? Tablet : Laptop
  return <Icono className="size-4.5" strokeWidth={1.7} />
}

// Panel de sesiones de un usuario (solo administradores — usa el plugin admin de
// Better Auth). Cerrar una sesión la borra de la base: el dispositivo queda sin
// acceso en su próxima petición (el SesionGuardian lo lleva a /login).
export function UsuarioSesionesSheet({
  usuario,
  onOpenChange,
}: {
  usuario: UsuarioAdmin | null
  onOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  const { enLinea } = usePresencia()
  const [sesiones, setSesiones] = useState<SesionUsuario[] | null>(null)
  // Cuántas había en total antes de recortar a MAX_SESIONES_VISIBLES.
  const [totalSesiones, setTotalSesiones] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [revocando, setRevocando] = useState<string | null>(null)

  const cargar = useCallback(async (userId: string) => {
    setError(null)
    try {
      const { sessions } = await listUserSessions(userId)
      // Más reciente primero (por inicio de sesión), y solo las últimas 10.
      const ordenadas = [...sessions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setTotalSesiones(ordenadas.length)
      setSesiones(ordenadas.slice(0, MAX_SESIONES_VISIBLES))
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "No se pudieron cargar las sesiones."
      )
    }
  }, [])

  useEffect(() => {
    setSesiones(null)
    if (usuario) void cargar(usuario.id)
  }, [usuario, cargar])

  async function cerrar(sesion: SesionUsuario) {
    setRevocando(sesion.token)
    try {
      await revokeUserSession(sesion.token)
      setSesiones((actual) => (actual ?? []).filter((s) => s.token !== sesion.token))
      setTotalSesiones((total) => Math.max(0, total - 1))
      toast({ variant: "success", description: "Sesión cerrada." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo cerrar la sesión",
        description: err instanceof AdminApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setRevocando(null)
    }
  }

  async function cerrarTodas() {
    if (!usuario) return
    if (
      !window.confirm(
        `¿Cerrar TODAS las sesiones de ${usuario.name}? Tendrá que iniciar sesión de nuevo en cada dispositivo.`
      )
    ) {
      return
    }
    setRevocando("todas")
    try {
      await revokeUserSessions(usuario.id)
      setSesiones([])
      setTotalSesiones(0)
      toast({ variant: "success", description: "Se cerraron todas las sesiones." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudieron cerrar las sesiones",
        description: err instanceof AdminApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setRevocando(null)
    }
  }

  const ahora = Date.now()
  // Sesiones de este usuario con la intranet abierta en este momento (por websocket).
  const presencia = usuario ? enLinea.find((u) => u.usuarioId === usuario.id) : undefined
  const idsActivos = new Set(presencia?.sesiones ?? [])
  const activasAhora = (sesiones ?? []).filter((s) => idsActivos.has(s.id)).length

  return (
    <Sheet open={Boolean(usuario)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {usuario && (
          <>
            <SheetHeader className="border-border border-b p-5">
              <SheetTitle>Sesiones de {usuario.name}</SheetTitle>
              <SheetDescription>
                Dispositivos y navegadores con sesión abierta. Cerrar una sesión la
                invalida de inmediato.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-3 p-5">
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : sesiones === null ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : sesiones.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Este usuario no tiene sesiones abiertas.
                </p>
              ) : (
                <>
                  <p className="text-[12px] font-semibold">
                    <span
                      className={cn(
                        "mr-1.5 inline-block size-2 rounded-full align-middle",
                        activasAhora > 0
                          ? "bg-status-disponible"
                          : "bg-muted-foreground/40"
                      )}
                    />
                    {activasAhora > 0
                      ? `${activasAhora} ${activasAhora === 1 ? "sesión activa" : "sesiones activas"} ahora`
                      : "Ninguna sesión activa ahora"}
                  </p>
                  {totalSesiones > sesiones.length ? (
                    <p className="text-muted-foreground text-[11.5px]">
                      Mostrando las {sesiones.length} más recientes de {totalSesiones}{" "}
                      sesiones.
                    </p>
                  ) : null}
                  {sesiones.map((sesion) => {
                    const disp = leerUserAgent(sesion.userAgent)
                    const vencida = new Date(sesion.expiresAt).getTime() <= ahora
                    const activoAhora = !vencida && idsActivos.has(sesion.id)
                    return (
                      <div
                        key={sesion.id}
                        className={cn(
                          "border-border flex items-start gap-3 rounded-lg border p-3.5",
                          vencida && "opacity-60"
                        )}
                      >
                        <div className="bg-accent text-accent-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md">
                          <IconoDispositivo tipo={disp.tipo} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-bold">
                            {disp.navegador}
                            {disp.sistema ? ` · ${disp.sistema}` : ""}
                            {vencida ? (
                              <span className="text-muted-foreground ml-1.5 text-[11px] font-semibold">
                                (vencida)
                              </span>
                            ) : null}
                            {activoAhora ? (
                              <span className="bg-status-disponible-bg text-status-disponible-fg ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[10.5px] font-bold">
                                <span className="bg-status-disponible size-1.5 animate-pulse rounded-full" />
                                Activo ahora
                              </span>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground mt-0.5 font-mono text-[11.5px]">
                            {sesion.ipAddress || "IP desconocida"}
                          </div>
                          {activoAhora && idsActivos.size === 1 && presencia?.modulo ? (
                            <div className="text-muted-foreground mt-0.5 text-[11.5px]">
                              En {presencia.modulo}
                            </div>
                          ) : null}
                          <dl className="text-muted-foreground mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11.5px]">
                            <dt>Inició</dt>
                            <dd>{fecha(sesion.createdAt)}</dd>
                            <dt>Vence</dt>
                            <dd>{fecha(sesion.expiresAt)}</dd>
                          </dl>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={revocando !== null}
                          onClick={() => void cerrar(sesion)}
                          className="text-status-bloqueado-fg shrink-0"
                        >
                          <LogOut className="size-3.5" strokeWidth={1.8} />
                          {revocando === sesion.token ? "Cerrando…" : "Cerrar"}
                        </Button>
                      </div>
                    )
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    disabled={revocando !== null}
                    onClick={() => void cerrarTodas()}
                    className="text-status-bloqueado-fg mt-1"
                  >
                    <LogOut className="size-3.5" strokeWidth={1.8} />
                    {revocando === "todas" ? "Cerrando…" : "Cerrar todas las sesiones"}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
