"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, ChevronRight, Search } from "lucide-react"

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

import { PROCESOS_EJEMPLO, type ProcesoAprobado, type UsuarioApp } from "./datos"
import { formatearFecha } from "./formato"

// Alta en dos pasos, igual que en la intranet anterior: (1) elegir la venta nueva
// aprobada del cliente, (2) confirmar sus datos y definir usuario + contraseña temporal.
// Al elegir el proceso, la versión real valida la orden de venta en SAP (lote +
// cédula) y, si el cliente ya tiene cuenta, el lote se agrega a esa misma cuenta.
export function AgregarUsuarioAppSheet({
  open,
  onOpenChange,
  usuarios,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuarios: UsuarioApp[]
}) {
  const toast = useToast()
  const [paso, setPaso] = useState<"proceso" | "datos">("proceso")
  const [busqueda, setBusqueda] = useState("")
  const [proceso, setProceso] = useState<ProcesoAprobado | null>(null)
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    if (!open) return
    setPaso("proceso")
    setBusqueda("")
    setProceso(null)
  }, [open])

  const procesosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return PROCESOS_EJEMPLO
    return PROCESOS_EJEMPLO.filter((p) =>
      [p.cliente, p.cedula, p.lote, p.asesor].some((campo) =>
        campo.toLowerCase().includes(termino)
      )
    )
  }, [busqueda])

  const lotesExistentes = proceso
    ? (usuarios.find((u) => u.cedula === proceso.cedula)?.lotes ?? [])
    : []

  function elegir(p: ProcesoAprobado) {
    setProceso(p)
    // Por defecto usuario y contraseña temporal son la cédula del cliente.
    setUsuario(p.cedula)
    setPassword(p.cedula)
    setPaso("datos")
  }

  function crear() {
    toast({
      variant: "info",
      title: "Aún no disponible",
      description: "La creación de usuarios de la app se conectará próximamente.",
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>
            {paso === "proceso" ? "Seleccionar proceso aprobado" : "Agregar usuario"}
          </SheetTitle>
          <SheetDescription>
            {paso === "proceso"
              ? "Ventas nuevas aprobadas desde el 1 de agosto de 2026."
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

            {procesosFiltrados.length === 0 ? (
              <p className="text-muted-foreground px-5 py-10 text-center text-sm">
                No hay procesos aprobados que coincidan.
              </p>
            ) : (
              <ul>
                {procesosFiltrados.map((p) => (
                  <li key={p.processId} className="border-border border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => elegir(p)}
                      className="hover:bg-muted/60 group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{p.cliente}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          <span className="font-mono">{p.cedula}</span> · Lote{" "}
                          <span className="font-mono">{p.lote}</span> · {p.asesor}
                        </p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatearFecha(p.fechaCreacion)}
                      </span>
                      <ChevronRight
                        className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
                        strokeWidth={1.8}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : proceso ? (
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
                ["Orden SAP", "DocEntry 8812 · DocNum 10655"],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="min-w-0">
                  <dt className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">
                    {etiqueta}
                  </dt>
                  <dd className="mt-0.5 truncate font-semibold">{valor}</dd>
                </div>
              ))}
            </dl>

            {lotesExistentes.length > 0 ? (
              <div className="bg-status-reservado-bg text-status-reservado-fg flex gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                <p>
                  Este cliente ya tiene cuenta en la app con{" "}
                  {lotesExistentes.length > 1 ? "los lotes" : "el lote"}{" "}
                  <strong>{lotesExistentes.join(", ")}</strong>. Si continúas, el lote{" "}
                  <strong>{proceso.lote}</strong> se agregará a esa misma cuenta.
                </p>
              </div>
            ) : null}

            <TextField label="Usuario" value={usuario} onChange={setUsuario} />
            <div>
              <TextField
                label="Contraseña temporal"
                value={password}
                onChange={setPassword}
              />
              <p className="text-muted-foreground mt-1.5 text-xs">
                Por defecto, la cédula del cliente. Se le pedirá cambiarla al entrar.
              </p>
            </div>
          </div>
        ) : null}

        {paso === "datos" ? (
          <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!usuario || !password} onClick={crear}>
              Crear usuario
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
