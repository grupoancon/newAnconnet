"use client"

import { useEffect, useState, useTransition } from "react"
import { Check, Circle, Eye, EyeOff, Wand2 } from "lucide-react"

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
  revokeUserSessions,
  setUserPassword,
  type UsuarioAdmin,
} from "@/lib/api/admin-api"
import { cn } from "@/lib/utils"
import { REGLAS_PASSWORD, passwordSchema } from "@/lib/validations/auth"

// Sin caracteres que se confunden al dictarla o copiarla a mano (0/O, 1/l/I).
const MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const MINUSCULAS = "abcdefghijkmnpqrstuvwxyz"
const NUMEROS = "23456789"

function aleatorio(caracteres: string): string {
  const indice = crypto.getRandomValues(new Uint32Array(1))[0]! % caracteres.length
  return caracteres[indice]!
}

// 12 caracteres que siempre cumplen REGLAS_PASSWORD (al menos una mayúscula y un número).
function generarPassword(): string {
  const todos = MAYUSCULAS + MINUSCULAS + NUMEROS
  const caracteres = [aleatorio(MAYUSCULAS), aleatorio(NUMEROS)]
  while (caracteres.length < 12) caracteres.push(aleatorio(todos))
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1)
    ;[caracteres[i], caracteres[j]] = [caracteres[j]!, caracteres[i]!]
  }
  return caracteres.join("")
}

// El administrador escribe la contraseña nueva directamente (POST
// admin/set-user-password), en vez de mandarle al usuario un enlace por correo.
export function UsuarioPasswordSheet({
  usuario,
  onOpenChange,
}: {
  usuario: UsuarioAdmin | null
  onOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  const [password, setPassword] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [cerrarSesiones, setCerrarSesiones] = useState(true)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (!usuario) return
    setPassword("")
    setConfirmacion("")
    setMostrar(false)
    setCerrarSesiones(true)
  }, [usuario])

  const esValida = passwordSchema.safeParse(password).success
  const coinciden = password.length > 0 && password === confirmacion
  const puedeGuardar = Boolean(usuario) && esValida && coinciden && !isSaving

  function generar() {
    const nueva = generarPassword()
    setPassword(nueva)
    setConfirmacion(nueva)
    // Recién generada no la conoce nadie: se muestra para poder copiarla o dictarla.
    setMostrar(true)
  }

  function guardar() {
    if (!usuario || !puedeGuardar) return
    startSaving(async () => {
      try {
        await setUserPassword(usuario.id, password)
      } catch (err) {
        toast({
          variant: "error",
          title: "No se pudo cambiar la contraseña",
          description: err instanceof AdminApiError ? err.message : "Intenta de nuevo.",
        })
        return
      }

      // La contraseña ya cambió: si falla cerrar las sesiones se avisa aparte, sin
      // presentarlo como si el cambio de contraseña hubiera fallado.
      if (cerrarSesiones) {
        try {
          await revokeUserSessions(usuario.id)
        } catch {
          toast({
            variant: "error",
            title: "Contraseña cambiada, pero no se cerraron sus sesiones",
            description: 'Ciérralas desde "Sesiones y dispositivos".',
          })
          onOpenChange(false)
          return
        }
      }

      toast({
        variant: "success",
        description: cerrarSesiones
          ? `Contraseña de ${usuario.name} actualizada y sesiones cerradas.`
          : `Contraseña de ${usuario.name} actualizada.`,
      })
      onOpenChange(false)
    })
  }

  const claseInput =
    "border-input bg-card focus:border-primary focus:ring-ring/15 h-11 w-full rounded-md border px-3.5 pr-11 text-sm outline-none focus:ring-3"

  return (
    <Sheet open={usuario !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Cambiar contraseña</SheetTitle>
          <SheetDescription>
            {usuario ? (
              <>
                Define la nueva contraseña de <strong>{usuario.name}</strong> (
                {usuario.email}). No se le envía ningún correo: compártesela tú.
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault()
            guardar()
          }}
        >
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="nueva-password"
                className="text-muted-foreground text-xs font-semibold"
              >
                Nueva contraseña
              </label>
              <button
                type="button"
                onClick={generar}
                className="text-accent-foreground hover:text-primary inline-flex items-center gap-1 text-xs font-semibold"
              >
                <Wand2 className="size-3.5" strokeWidth={1.8} />
                Generar una segura
              </button>
            </div>
            <div className="relative">
              <input
                id="nueva-password"
                type={mostrar ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(claseInput, mostrar && "font-mono")}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMostrar((actual) => !actual)}
                aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-11 items-center justify-center"
              >
                {mostrar ? (
                  <EyeOff className="size-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="size-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {REGLAS_PASSWORD.map((regla) => {
                const cumple = regla.cumple(password)
                return (
                  <li
                    key={regla.texto}
                    className={cn(
                      "flex items-center gap-1.5 text-xs transition-colors",
                      cumple ? "text-status-disponible-fg" : "text-muted-foreground"
                    )}
                  >
                    {cumple ? (
                      <Check className="size-3.5" strokeWidth={2.2} />
                    ) : (
                      <Circle className="size-3" strokeWidth={1.8} />
                    )}
                    {regla.texto}
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <label
              htmlFor="confirmar-password"
              className="text-muted-foreground mb-1.5 block text-xs font-semibold"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirmar-password"
              type={mostrar ? "text" : "password"}
              autoComplete="new-password"
              value={confirmacion}
              onChange={(event) => setConfirmacion(event.target.value)}
              aria-invalid={confirmacion.length > 0 && !coinciden}
              className={cn(claseInput, "pr-3.5", mostrar && "font-mono")}
            />
            {confirmacion.length > 0 && !coinciden ? (
              <p className="text-destructive mt-1.5 text-xs">Las contraseñas no coinciden.</p>
            ) : null}
          </div>

          <div
            onClick={() => setCerrarSesiones((actual) => !actual)}
            className="border-border flex cursor-pointer items-start justify-between gap-3 rounded-md border px-3.5 py-3"
          >
            <span>
              <span className="block text-sm font-semibold">Cerrar sus sesiones abiertas</span>
              <span className="text-muted-foreground block text-xs">
                Tendrá que entrar de nuevo con la contraseña nueva en todos sus dispositivos.
              </span>
            </span>
            {/* El clic (o Espacio/Enter) en la casilla sube a la fila, que es la que
                cambia el valor — si la casilla también lo cambiara, se anularían. */}
            <Checkbox
              checked={cerrarSesiones}
              onCheckedChange={() => {}}
              aria-label="Cerrar sus sesiones abiertas"
              className="mt-0.5"
            />
          </div>
        </form>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!puedeGuardar} onClick={guardar}>
            {isSaving ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
