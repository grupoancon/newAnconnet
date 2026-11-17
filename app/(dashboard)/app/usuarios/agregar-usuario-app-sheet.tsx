"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, ChevronRight, Search } from "lucide-react"

import { Spinner } from "@/components/shared/spinner"
import { TextField } from "@/components/shared/text-field"
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
import {
  crearUsuarioApp,
  listarProcesosAprobados,
  verificarProcesoAprobado,
  type VerificacionProceso,
} from "@/lib/api/app-usuarios-api"

import type { ProcesoAprobado, UsuarioApp } from "./datos"
import { formatearFecha, mensajeDeError } from "./formato"

// Alta en dos pasos, igual que en la intranet anterior: (1) elegir la venta nueva
// aprobada del cliente — al elegirla se valida en SAP que el lote tenga orden de
// venta y que sea de ese cliente —, (2) confirmar sus datos y la contraseña temporal.
// Si el cliente ya tiene cuenta, el lote se suma a esa misma cuenta. El backend
// vuelve a validar todo al crear (no confía en lo que mande esta pantalla).
export function AgregarUsuarioAppSheet({
  open,
  onOpenChange,
  usuarios,
  onCreado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuarios: UsuarioApp[]
  onCreado: () => Promise<void> | void
}) {
  const toast = useToast()
  const [paso, setPaso] = useState<"proceso" | "datos">("proceso")
  const [busqueda, setBusqueda] = useState("")
  const [procesos, setProcesos] = useState<ProcesoAprobado[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificandoId, setVerificandoId] = useState<number | null>(null)
  const [verificacion, setVerificacion] = useState<VerificacionProceso | null>(null)
  const [password, setPassword] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setPaso("proceso")
    setBusqueda("")
    setVerificacion(null)
    setError(null)
    setCargando(true)
    let cancelado = false
    listarProcesosAprobados()
      .then((lista) => !cancelado && setProcesos(lista))
      .catch((err) => !cancelado && setError(mensajeDeError(err)))
      .finally(() => !cancelado && setCargando(false))
    return () => {
      cancelado = true
    }
  }, [open])

  // Lotes que ya tienen usuario en la app: se muestran, pero no se pueden elegir.
  const lotesRegistrados = useMemo(
    () => new Set(usuarios.flatMap((u) => u.lotes.map((l) => l.toUpperCase()))),
    [usuarios]
  )

  const procesosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return procesos
    return procesos.filter((p) =>
      [p.cliente, p.cedula, p.lote, p.asesor].some((campo) =>
        campo.toLowerCase().includes(termino)
      )
    )
  }, [busqueda, procesos])

  async function elegir(p: ProcesoAprobado) {
    if (verificandoId !== null) return
    if (!p.cedula) {
      toast({ variant: "error", description: "Este proceso no tiene la cédula del cliente." })
      return
    }
    setVerificandoId(p.processId)
    try {
      const resultado = await verificarProcesoAprobado(p.processId)
      if (resultado.aviso) toast({ variant: "warning", description: resultado.aviso })
      setVerificacion(resultado)
      // Por defecto la contraseña temporal es la cédula del cliente.
      setPassword(resultado.proceso.cedula)
      setPaso("datos")
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setVerificandoId(null)
    }
  }

  async function crear() {
    if (!verificacion) return
    setGuardando(true)
    try {
      const r = await crearUsuarioApp({
        processId: verificacion.proceso.processId,
        tempPassword: password.trim(),
      })
      toast({
        variant: "success",
        description: r.esNuevo
          ? `Usuario creado.${r.whatsappEnviado ? " Se le envió el aviso por WhatsApp." : ""}`
          : `Lote ${verificacion.proceso.lote} agregado a la cuenta existente.`,
      })
      if (r.enReservas === false) {
        toast({
          variant: "warning",
          description:
            "No se pudo registrar el lote en el sistema de reservas. Aparecerá como faltante en el listado.",
        })
      }
      await onCreado()
      onOpenChange(false)
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  const proceso = verificacion?.proceso
  const cuentaExistente = (verificacion?.lotesExistentes.length ?? 0) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>
            {paso === "proceso" ? "Seleccionar proceso aprobado" : "Agregar usuario"}
          </SheetTitle>
          <SheetDescription>
            {paso === "proceso"
              ? "Ventas nuevas aprobadas (oferta, financiamiento y pago)."
              : "Nuevo usuario para la app móvil."}
          </SheetDescription>
        </SheetHeader>

        {paso === "proceso" ? (
          <div className="flex flex-col">
            <div className="border-border border-b p-4">
              <div className="border-input bg-card focus-within:border-primary focus-within:ring-ring/15 flex h-[38px] items-center gap-2 rounded-md border px-3 focus-within:ring-3">
                <Search
                  className="text-muted-foreground size-[15px] shrink-0"
                  strokeWidth={1.7}
                />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar por cliente, cédula, lote o asesor…"
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
                />
              </div>
            </div>

            {cargando ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : error ? (
              <p className="text-destructive px-5 py-10 text-center text-sm">{error}</p>
            ) : procesosFiltrados.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                No hay procesos aprobados que coincidan.
              </p>
            ) : (
              <ul>
                {procesosFiltrados.map((p) => {
                  const registrado = lotesRegistrados.has(p.lote.toUpperCase())
                  const verificando = verificandoId === p.processId
                  return (
                    <li key={p.processId} className="border-border border-b last:border-b-0">
                      <button
                        type="button"
                        disabled={registrado || verificandoId !== null}
                        onClick={() => void elegir(p)}
                        className="hover:bg-muted/60 group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">
                            {p.cliente || "Sin nombre"}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            <span className="font-mono">{p.cedula || "sin cédula"}</span> ·
                            Lote <span className="font-mono">{p.lote || "—"}</span> ·{" "}
                            {p.asesor || "—"}
                          </p>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {registrado
                            ? "Ya tiene usuario"
                            : verificando
                              ? "Verificando en SAP…"
                              : formatearFecha(p.fechaCreacion)}
                        </span>
                        {verificando ? (
                          <Spinner className="size-4 shrink-0" />
                        ) : (
                          <ChevronRight
                            className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
                            strokeWidth={1.8}
                          />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : proceso && verificacion ? (
          <div className="space-y-4 p-5">
            <button
              type="button"
              onClick={() => setPaso("proceso")}
              className="text-accent-foreground hover:text-primary inline-flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="size-3.5" strokeWidth={1.8} />
              Cambiar proceso
            </button>

            <dl className="bg-muted/60 border-border grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border p-3.5 text-xs">
              {[
                ["Nombre", proceso.cliente],
                ["Cédula", proceso.cedula],
                ["Lote", proceso.lote],
                [
                  "Orden SAP",
                  verificacion.docNum
                    ? `DocEntry ${verificacion.docEntry ?? "—"} · DocNum ${verificacion.docNum}`
                    : "—",
                ],
                ["Correo", proceso.email || "—"],
                ["Celular", proceso.celular || "—"],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="min-w-0">
                  <dt className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
                    {etiqueta}
                  </dt>
                  <dd className="mt-0.5 truncate font-semibold">{valor}</dd>
                </div>
              ))}
            </dl>

            {verificacion.aviso ? (
              <Aviso>{verificacion.aviso}</Aviso>
            ) : null}

            {cuentaExistente ? (
              <Aviso>
                Este cliente ya tiene cuenta en la app con{" "}
                {verificacion.lotesExistentes.length > 1 ? "los lotes" : "el lote"}{" "}
                <strong>{verificacion.lotesExistentes.join(", ")}</strong>. Si continúas, el
                lote <strong>{proceso.lote}</strong> se agregará a esa misma cuenta (su
                contraseña no cambia).
              </Aviso>
            ) : (
              <div>
                <TextField
                  label="Contraseña temporal"
                  value={password}
                  onChange={setPassword}
                />
                <p className="text-muted-foreground mt-1.5 text-xs">
                  El cliente entra con su cédula y esta contraseña (por defecto, la cédula).
                  La app le pedirá cambiarla al entrar.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {paso === "datos" ? (
          <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={guardando || (!cuentaExistente && !password.trim())}
              onClick={() => void crear()}
            >
              {guardando
                ? "Guardando…"
                : cuentaExistente
                  ? "Agregar lote"
                  : "Crear usuario"}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-status-reservado-bg text-status-reservado-fg flex gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
      <p>{children}</p>
    </div>
  )
}
