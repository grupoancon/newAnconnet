"use client"

import { useCallback, useEffect, useState } from "react"
import { Fingerprint, Info, KeyRound, Lock, Smartphone } from "lucide-react"

import { DatePickerField } from "@/components/shared/date-picker-field"
import { SelectField } from "@/components/shared/select-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/shared/spinner"
import {
  avisarLoteEntregado,
  cerrarSesionUsuarioApp,
  cerrarSesionesUsuarioApp,
  listarSesionesUsuarioApp,
} from "@/lib/api/app-usuarios-api"

import { MOTIVOS_CIERRE_SESION, type SesionUsuarioApp, type UsuarioApp } from "./datos"
import { formatearFecha, hoyISO, mensajeDeError } from "./formato"

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/60 border-border text-muted-foreground flex gap-2 rounded-md border px-3 py-2.5 text-xs leading-relaxed">
      <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} />
      <p>{children}</p>
    </div>
  )
}

// Solo manda la notificación push de "lote entregado" al cliente; no cierra su sesión.
export function LoteEntregadoSheet({
  usuario,
  onOpenChange,
}: {
  usuario: UsuarioApp | null
  onOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  const [lote, setLote] = useState("")
  const [fecha, setFecha] = useState("")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    setLote(usuario.lotes[0] ?? "")
    setFecha(hoyISO())
  }, [usuario])

  async function enviar() {
    if (!usuario) return
    setEnviando(true)
    try {
      await avisarLoteEntregado({ cedula: usuario.cedula, lote, fecha })
      toast({
        variant: "success",
        description: `Aviso de lote entregado enviado a ${usuario.nombre}.`,
      })
      onOpenChange(false)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Sheet open={usuario !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Lote entregado</SheetTitle>
          <SheetDescription>
            Avisa a <strong>{usuario?.nombre}</strong> que su lote pasó a la administración.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <SelectField
            label="Lote entregado"
            placeholder="Selecciona el lote"
            options={usuario?.lotes ?? []}
            value={lote}
            onValueChange={setLote}
          />
          <DatePickerField label="Fecha de entrega" value={fecha} onChange={setFecha} />
          <Nota>Le llega una notificación en la app. Su sesión sigue abierta.</Nota>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={enviando || !lote || !fecha}
            onClick={() => void enviar()}
          >
            {enviando ? "Enviando…" : "Enviar aviso"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const formatoFechaHora = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function fechaHora(valor: string | null): string {
  if (!valor) return "—"
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? "—" : formatoFechaHora.format(fecha)
}

const ETIQUETA_METODO: Record<string, string> = {
  password: "Contraseña",
  pin: "PIN",
  biometric: "Huella / rostro",
}

function IconoMetodo({ metodo }: { metodo: string | null }) {
  const clase = "size-3 shrink-0"
  if (metodo === "biometric") return <Fingerprint className={clase} strokeWidth={1.8} />
  if (metodo === "pin") return <Lock className={clase} strokeWidth={1.8} />
  return <KeyRound className={clase} strokeWidth={1.8} />
}

// Sesiones del usuario en la app: muestra desde qué dispositivo entró cada una y
// permite cerrar una en particular o todas. El cliente ve un aviso según el motivo;
// con "Lote entregado" además le llega el aviso de entrega (lote + fecha).
export function CerrarSesionSheet({
  usuario,
  onOpenChange,
  onCerradas,
}: {
  usuario: UsuarioApp | null
  onOpenChange: (open: boolean) => void
  onCerradas: () => Promise<void> | void
}) {
  const toast = useToast()
  const [motivo, setMotivo] = useState(MOTIVOS_CIERRE_SESION[0]!.value)
  const [lote, setLote] = useState("")
  const [fecha, setFecha] = useState("")
  const [sesiones, setSesiones] = useState<SesionUsuarioApp[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // sessionId que se está cerrando, o "todas".
  const [cerrando, setCerrando] = useState<string | null>(null)

  const cargarSesiones = useCallback(async (id: string) => {
    setCargando(true)
    try {
      setSesiones(await listarSesionesUsuarioApp(id))
      setError(null)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!usuario) return
    setMotivo(MOTIVOS_CIERRE_SESION[0]!.value)
    setLote(usuario.lotes[0] ?? "")
    setFecha(hoyISO())
    setSesiones([])
    void cargarSesiones(usuario.id)
  }, [usuario, cargarSesiones])

  const esEntrega = motivo === "LOTE_ENTREGADO"
  const usaLote = esEntrega || motivo === "LOTE_RETIRADO"
  const faltanDatos = esEntrega && (!lote || !fecha)
  const datosMotivo = {
    reason: motivo,
    ...(usaLote && lote ? { lote } : {}),
    ...(esEntrega ? { fecha } : {}),
  }

  async function cerrarUna(sesion: SesionUsuarioApp) {
    if (!usuario) return
    setCerrando(sesion.sessionId)
    try {
      await cerrarSesionUsuarioApp(usuario.id, sesion.sessionId, datosMotivo)
      toast({
        variant: "success",
        description: `Sesión cerrada en ${sesion.dispositivo || "el dispositivo"}.`,
      })
      await Promise.all([cargarSesiones(usuario.id), onCerradas()])
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setCerrando(null)
    }
  }

  async function cerrarTodas() {
    if (!usuario) return
    setCerrando("todas")
    try {
      await cerrarSesionesUsuarioApp({ cedula: usuario.cedula, ...datosMotivo })
      toast({
        variant: "success",
        description: `Se cerraron todas las sesiones de ${usuario.nombre}.`,
      })
      await onCerradas()
      onOpenChange(false)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setCerrando(null)
    }
  }

  return (
    <Sheet open={usuario !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Sesiones en la app</SheetTitle>
          <SheetDescription>
            Dispositivos donde <strong>{usuario?.nombre}</strong> tiene la sesión abierta
            (cédula {usuario?.cedula}).
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <SelectField
            label="Motivo del cierre"
            placeholder="Selecciona el motivo"
            opciones={MOTIVOS_CIERRE_SESION}
            value={motivo}
            onValueChange={setMotivo}
          />
          {usaLote ? (
            <SelectField
              label={esEntrega ? "Lote entregado" : "Lote retirado"}
              placeholder="Selecciona el lote"
              options={usuario?.lotes ?? []}
              value={lote}
              onValueChange={setLote}
            />
          ) : null}
          {esEntrega ? (
            <DatePickerField label="Fecha de entrega" value={fecha} onChange={setFecha} />
          ) : null}

          <div className="border-border border-t pt-4">
            <p className="text-muted-foreground mb-2.5 text-[11px] font-bold tracking-wide uppercase">
              Sesiones abiertas{!cargando && !error ? ` (${sesiones.length})` : ""}
            </p>
            {cargando ? (
              <div className="flex justify-center py-6">
                <Spinner className="size-6" />
              </div>
            ) : error ? (
              <p className="text-destructive text-xs">{error}</p>
            ) : sesiones.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No tiene sesiones abiertas en este momento.
              </p>
            ) : (
              <ul className="space-y-2">
                {sesiones.map((sesion) => (
                  <li
                    key={sesion.sessionId}
                    className="border-border flex items-start gap-3 rounded-md border p-3"
                  >
                    <div className="bg-accent flex size-8 shrink-0 items-center justify-center rounded-md">
                      <Smartphone
                        className="text-accent-foreground size-4"
                        strokeWidth={1.7}
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate text-[13px] font-semibold">
                        {sesion.dispositivo || "Dispositivo desconocido"}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate">
                        {[sesion.sistema, sesion.ubicacion, sesion.ip]
                          .filter(Boolean)
                          .join(" · ") || "Sin datos del dispositivo"}
                      </p>
                      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="inline-flex items-center gap-1">
                          <IconoMetodo metodo={sesion.metodo} />
                          {ETIQUETA_METODO[sesion.metodo ?? ""] ?? "Contraseña"}
                        </span>
                        <span>Inició {formatearFecha(sesion.iniciada)}</span>
                        <span>Último uso {fechaHora(sesion.ultimoUso)}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={cerrando !== null || faltanDatos}
                      onClick={() => void cerrarUna(sesion)}
                    >
                      {cerrando === sesion.sessionId ? "Cerrando…" : "Cerrar"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Nota>El usuario verá un aviso en la app según el motivo elegido.</Nota>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={cerrando !== null || faltanDatos}
            onClick={() => void cerrarTodas()}
          >
            {cerrando === "todas" ? "Cerrando…" : "Cerrar todas"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
