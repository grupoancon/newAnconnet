"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Copy, KeyRound } from "lucide-react"

import { PillTabs } from "@/components/shared/pill-tabs"
import { SelectField } from "@/components/shared/select-field"
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
import { actualizarUsuarioApp } from "@/lib/api/app-usuarios-api"

import {
  ESTADO_LABELS,
  ESTADOS_EDITABLES,
  ROLES_APP,
  type UsuarioApp,
} from "./datos"
import { mensajeDeError } from "./formato"

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ModoPassword = "ninguno" | "auto" | "manual"

export function EditarUsuarioAppSheet({
  usuario,
  onOpenChange,
  onGuardado,
}: {
  usuario: UsuarioApp | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => Promise<void> | void
}) {
  const toast = useToast()
  const [nombre, setNombre] = useState("")
  const [cedula, setCedula] = useState("")
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [rol, setRol] = useState("cliente")
  const [estado, setEstado] = useState("activo")
  const [modoPassword, setModoPassword] = useState<ModoPassword>("ninguno")
  const [passwordManual, setPasswordManual] = useState("")
  const [guardando, setGuardando] = useState(false)
  // Contraseña generada por el servidor: se muestra una sola vez, antes de cerrar.
  const [generada, setGenerada] = useState<string | null>(null)

  useEffect(() => {
    if (!usuario) return
    setNombre(usuario.nombre)
    setCedula(usuario.cedula)
    setEmail(usuario.email)
    setTelefono(usuario.telefono)
    setRol(usuario.rol)
    setEstado(usuario.estado)
    setModoPassword("ninguno")
    setPasswordManual("")
    setGenerada(null)
  }, [usuario])

  const correoInvalido = email.trim().length > 0 && !CORREO_VALIDO.test(email.trim())
  const puedeGuardar =
    !guardando &&
    nombre.trim().length > 0 &&
    cedula.trim().length > 0 &&
    !correoInvalido &&
    (modoPassword !== "manual" || passwordManual.trim().length > 0)

  async function guardar() {
    if (!usuario) return
    setGuardando(true)
    try {
      const r = await actualizarUsuarioApp(usuario.id, {
        nombre: nombre.trim(),
        cedula: cedula.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        rol,
        estado,
        generateTempPassword: modoPassword === "auto",
        tempPassword: modoPassword === "manual" ? passwordManual.trim() : undefined,
      })
      toast({ variant: "success", description: "Usuario actualizado." })
      await onGuardado()
      if (r.tempPassword) {
        setGenerada(r.tempPassword)
      } else {
        onOpenChange(false)
      }
    } catch (err) {
      toast({ variant: "error", description: mensajeDeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  async function copiar() {
    if (!generada) return
    try {
      await navigator.clipboard.writeText(generada)
      toast({ variant: "success", description: "Contraseña copiada." })
    } catch {
      toast({ variant: "error", description: "No se pudo copiar. Cópiala a mano." })
    }
  }

  if (generada) {
    return (
      <Sheet open={usuario !== null} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-border border-b p-5">
            <SheetTitle>Contraseña temporal generada</SheetTitle>
            <SheetDescription>{usuario?.nombre}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-5">
            <div className="bg-muted/60 border-border flex items-center gap-3 rounded-md border p-4">
              <KeyRound className="text-accent-foreground size-5 shrink-0" strokeWidth={1.8} />
              <span className="flex-1 font-mono text-lg font-semibold tracking-wider">
                {generada}
              </span>
              <Button variant="outline" size="sm" onClick={() => void copiar()}>
                <Copy className="size-3.5" strokeWidth={1.8} />
                Copiar
              </Button>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Entrégasela al cliente: entra con su cédula y esta contraseña, y la app le
              pedirá crear una nueva. No se volverá a mostrar.
            </p>
          </div>
          <SheetFooter className="border-border flex-row justify-end border-t p-4">
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Listo
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={usuario !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Editar usuario</SheetTitle>
          <SheetDescription>{usuario?.nombre}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <TextField label="Nombre" value={nombre} onChange={setNombre} />
          <TextField label="Cédula" value={cedula} onChange={setCedula} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <TextField label="Correo" type="email" value={email} onChange={setEmail} />
              {correoInvalido ? (
                <p className="text-destructive mt-1 text-xs">El correo no es válido.</p>
              ) : null}
            </div>
            <TextField label="Teléfono" value={telefono} onChange={setTelefono} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              label="Rol"
              placeholder="Rol"
              opciones={ROLES_APP.map((r) => ({
                value: r,
                label: r === "admin" ? "Administrador" : "Cliente",
              }))}
              value={rol}
              onValueChange={setRol}
            />
            <SelectField
              label="Estado"
              placeholder="Estado"
              opciones={ESTADOS_EDITABLES.map((e) => ({ value: e, label: ESTADO_LABELS[e] }))}
              value={estado}
              onValueChange={setEstado}
            />
          </div>

          <div className="border-border space-y-2.5 border-t pt-4">
            <p className="text-muted-foreground text-xs font-semibold">Contraseña temporal</p>
            <PillTabs
              tabs={[
                { id: "ninguno", label: "No cambiar" },
                { id: "auto", label: "Generar automática" },
                { id: "manual", label: "Manual" },
              ]}
              value={modoPassword}
              onChange={(id) => setModoPassword(id as ModoPassword)}
            />
            {modoPassword === "manual" ? (
              <TextField
                placeholder="Nueva contraseña temporal"
                value={passwordManual}
                onChange={setPasswordManual}
              />
            ) : null}
            {modoPassword !== "ninguno" ? (
              <div className="bg-status-reservado-bg text-status-reservado-fg flex gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                <p>
                  El usuario entrará con esta contraseña y la app le pedirá crear una
                  nueva.
                  {modoPassword === "auto"
                    ? " La contraseña generada se mostrará una sola vez al guardar."
                    : ""}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!puedeGuardar} onClick={() => void guardar()}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
