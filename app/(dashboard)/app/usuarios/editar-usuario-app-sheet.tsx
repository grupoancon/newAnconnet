"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

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

import {
  ESTADO_LABELS,
  ESTADOS_EDITABLES,
  ROLES_APP,
  type UsuarioApp,
} from "./datos"

type ModoPassword = "ninguno" | "auto" | "manual"

export function EditarUsuarioAppSheet({
  usuario,
  onOpenChange,
}: {
  usuario: UsuarioApp | null
  onOpenChange: (open: boolean) => void
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
  }, [usuario])

  const puedeGuardar =
    nombre.trim().length > 0 &&
    cedula.trim().length > 0 &&
    (modoPassword !== "manual" || passwordManual.trim().length > 0)

  function guardar() {
    toast({
      variant: "info",
      title: "Aún no disponible",
      description: "La edición de usuarios de la app se conectará próximamente.",
    })
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
            <TextField label="Correo" type="email" value={email} onChange={setEmail} />
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
          <Button size="sm" disabled={!puedeGuardar} onClick={guardar}>
            Guardar cambios
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
