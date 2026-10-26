"use client"

import { useEffect, useState, useTransition } from "react"

import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AdminApiError,
  createUser,
  setRole,
  updateUser,
  type UsuarioAdmin,
} from "@/lib/api/admin-api"

function Campo({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
        {label}
      </label>
      <input
        {...props}
        className="border-input bg-card focus:border-primary focus:ring-ring/15 disabled:bg-muted disabled:text-muted-foreground h-11 w-full rounded-md border px-3.5 text-sm outline-none focus:ring-3"
      />
    </div>
  )
}

export function UsuarioFormSheet({
  usuario,
  open,
  onOpenChange,
  onGuardado,
}: {
  usuario: UsuarioAdmin | null // null = crear
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuardado: (usuario: UsuarioAdmin) => void
}) {
  const toast = useToast()
  const esEdicion = Boolean(usuario)
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cargo, setCargo] = useState("")
  const [departamento, setDepartamento] = useState("")
  const [empresa, setEmpresa] = useState("")
  const [esAdmin, setEsAdmin] = useState(false)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (!open) return
    setNombre(usuario?.name ?? "")
    setEmail(usuario?.email ?? "")
    setPassword("")
    setCargo(usuario?.cargo ?? "")
    setDepartamento(usuario?.departamento ?? "")
    setEmpresa(usuario?.empresa ?? "IC")
    setEsAdmin(usuario?.role === "admin")
  }, [open, usuario])

  const puedeGuardar =
    nombre.trim().length > 0 &&
    email.trim().length > 0 &&
    (esEdicion || password.trim().length >= 8)

  function guardar() {
    startSaving(async () => {
      try {
        if (esEdicion && usuario) {
          const { user } = await updateUser(usuario.id, {
            name: nombre.trim(),
            cargo: cargo.trim(),
            departamento: departamento.trim(),
            empresa: empresa.trim(),
          })
          let usuarioFinal = user
          const rolDeseado = esAdmin ? "admin" : "user"
          if (usuario.role !== rolDeseado) {
            const resultadoRol = await setRole(usuario.id, rolDeseado)
            usuarioFinal = resultadoRol.user
          }
          toast({ variant: "success", description: "Usuario actualizado." })
          onGuardado(usuarioFinal)
        } else {
          const { user } = await createUser({
            email: email.trim(),
            password,
            name: nombre.trim(),
            role: esAdmin ? "admin" : "user",
            data: {
              cargo: cargo.trim(),
              departamento: departamento.trim(),
              empresa: empresa.trim() || "IC",
            },
          })
          toast({ variant: "success", description: "Usuario creado." })
          onGuardado(user)
        }
        onOpenChange(false)
      } catch (error) {
        toast({
          variant: "error",
          title: esEdicion ? "No se pudo actualizar" : "No se pudo crear",
          description:
            error instanceof AdminApiError ? error.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>{esEdicion ? "Editar usuario" : "Nuevo usuario"}</SheetTitle>
          <SheetDescription>
            {esEdicion
              ? "Actualiza los datos de este usuario."
              : "Crea la cuenta directamente (sin invitación por correo)."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <Campo
            label="Nombre completo"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Nombre Apellido"
          />
          <Campo
            label="Correo"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@grupoancon.com"
            disabled={esEdicion}
          />
          {!esEdicion ? (
            <Campo
              label="Contraseña inicial"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              label="Cargo"
              value={cargo}
              onChange={(event) => setCargo(event.target.value)}
            />
            <Campo
              label="Departamento"
              value={departamento}
              onChange={(event) => setDepartamento(event.target.value)}
            />
          </div>
          <Campo
            label="Empresa"
            value={empresa}
            onChange={(event) => setEmpresa(event.target.value)}
            placeholder="IC"
          />

          <div
            onClick={() => setEsAdmin((actual) => !actual)}
            className="border-border flex cursor-pointer items-center justify-between rounded-md border px-3.5 py-3"
          >
            <span className="text-sm font-semibold">Administrador</span>
            {/* El clic en la casilla sube a la fila, que es la que cambia el valor —
                antes la casilla también lo cambiaba y los dos cambios se anulaban. */}
            <Checkbox
              checked={esAdmin}
              onCheckedChange={() => {}}
              aria-label="Administrador"
            />
          </div>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!puedeGuardar || isSaving} onClick={guardar}>
            {isSaving ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
