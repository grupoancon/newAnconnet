"use client"

import { useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "@/lib/navigation"
import { useForm } from "react-hook-form"

import { BrandMark } from "@/components/shared/brand-mark"
import { Button } from "@/components/ui/button"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { useAuth } from "@/components/shared/auth-provider"
import { useToast } from "@/components/shared/toast-provider"
import {
  AuthApiError,
  esTwoFactorRedirect,
  signInEmail,
  type UsuarioBetterAuth,
} from "@/lib/api/auth-api"
import { destinoSeguro, leerSesionVencidaGuardada } from "@/lib/api/sesion-vencida"

const CORREO_DOMINIO = "@grupoancon.com"

// `destino`: pantalla a la que volver después de iniciar sesión (el `from` que agrega el
// middleware o avisarSiSesionVencida). `sesionVencida`: se llegó acá porque la sesión
// venció en medio del trabajo — se le explica al usuario en vez de mostrarle el login
// sin más.
export function LoginForm({
  destino: destinoUrl,
  sesionVencida: sesionVencidaUrl = false,
}: {
  destino?: string
  sesionVencida?: boolean
}) {
  const router = useRouter()
  // Lo guardado por avisarSiSesionVencida manda sobre la URL: la URL puede haber sido
  // pisada por otra navegación de la página anterior (ver lib/api/sesion-vencida.ts).
  const [vencidaGuardada, setVencidaGuardada] = useState<string | null>(null)
  useEffect(() => {
    // Solo se setea si hay algo: en desarrollo (StrictMode) el efecto corre dos veces y
    // la segunda lectura ya viene vacía — no tiene que pisar la primera.
    const desde = leerSesionVencidaGuardada()
    if (desde) setVencidaGuardada(desde)
  }, [])
  const destino = vencidaGuardada ?? destinoUrl
  const sesionVencida = sesionVencidaUrl || vencidaGuardada != null
  const [isPending, startTransition] = useTransition()
  const [mostrarPassword, setMostrarPassword] = useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const { iniciarSesion } = useAuth<UsuarioBetterAuth>()
  const toast = useToast()

  function onSubmit(values: LoginInput): void {
    startTransition(async () => {
      try {
        const respuesta = await signInEmail(values.email, values.password)

        if (esTwoFactorRedirect(respuesta)) {
          const params = new URLSearchParams({ email: values.email })
          if (destino) params.set("from", destinoSeguro(destino))
          router.push(`/verificar?${params.toString()}`)
          return
        }

        iniciarSesion({ usuario: respuesta.user, token: respuesta.token })
        router.push(destinoSeguro(destino))
        router.refresh()
      } catch (error) {
        if (error instanceof AuthApiError && error.message.includes("ACCOUNT_INACTIVE")) {
          toast({
            variant: "error",
            title: "Cuenta desactivada",
            description:
              "Tu cuenta de Intranet está desactivada. Contacta a administración.",
          })
          return
        }

        toast({
          variant: "error",
          title: "No se pudo iniciar sesión",
          description:
            error instanceof AuthApiError
              ? error.message
              : "No se pudo conectar con el servidor",
        })
      }
    })
  }

  const emailField = form.register("email", {
    setValueAs: (value: string) =>
      value && !value.includes("@") ? `${value}${CORREO_DOMINIO}` : value,
  })

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Panel de marca */}
      <div className="bg-brand-gradient relative hidden w-[44%] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="absolute -top-20 -right-20 size-80 rounded-full bg-white/8" />
        <div className="absolute right-10 bottom-30 size-45 rounded-full border border-white/16" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl border border-white/25 bg-white/16 backdrop-blur-sm">
            <BrandMark className="size-5.5" />
          </div>
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-wide">ANCONnet</div>
            <div className="text-xs tracking-[0.14em] opacity-85">GRUPO ANCON</div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="mb-3.5 text-[34px] leading-[1.1] font-extrabold tracking-tight">
            Intranet
            <br />
            corporativa
          </h1>
          <p className="max-w-85 text-[15px] leading-[1.55] opacity-90">
            Todos los aplicativos de Grupo Ancon en un solo lugar. Ventas, tesorería,
            colaboradores y proyectos.
          </p>
        </div>

        <div className="relative z-10 flex gap-8 border-t border-white/18 pt-5.5">
          <div>
            <div className="font-mono text-[26px] font-semibold">98%</div>
            <div className="text-xs font-medium opacity-80">Eficiencia</div>
          </div>
          <div>
            <div className="font-mono text-[26px] font-semibold">500+</div>
            <div className="text-xs font-medium opacity-80">Usuarios</div>
          </div>
          <div>
            <div className="font-mono text-[26px] font-semibold">24/7</div>
            <div className="text-xs font-medium opacity-80">Disponible</div>
          </div>
        </div>
      </div>

      {/* Mobile: el panel de marca se reduce a una franja con el logo. */}
      <div className="bg-brand-gradient relative flex shrink-0 items-center gap-3 overflow-hidden px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-5 text-white lg:hidden">
        <div className="absolute -top-10 -right-8 size-32 rounded-full bg-white/8" />
        <div className="relative z-10 flex size-10 items-center justify-center rounded-xl border border-white/25 bg-white/16">
          <BrandMark className="size-5" />
        </div>
        <div className="relative z-10 leading-tight">
          <div className="text-base font-extrabold tracking-wide">ANCONnet</div>
          <div className="text-[11px] tracking-[0.14em] opacity-85">
            INTRANET · GRUPO ANCON
          </div>
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="bg-card flex flex-1 items-start justify-center px-6 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:items-center sm:p-12 lg:items-center">
        <div className="w-full max-w-sm">
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Iniciar sesión</h1>
          <p className="text-muted-foreground mb-6 text-sm sm:mb-8">
            Accede a tu cuenta para continuar.
          </p>

          {sesionVencida ? (
            <div
              role="status"
              className="border-primary/30 bg-primary/5 text-foreground mb-5 rounded-md border px-3.5 py-3 text-[13px] leading-snug"
            >
              Tu sesión venció. Vuelve a iniciar sesión para continuar donde estabas.
            </div>
          ) : null}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4.5" noValidate>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Correo electrónico
              </label>
              <div className="border-input focus-within:border-primary focus-within:ring-ring/15 flex h-11.5 items-center gap-2.5 rounded-md border bg-transparent px-3 transition-colors focus-within:ring-3">
                <Mail
                  className="text-muted-foreground size-[17px] shrink-0"
                  strokeWidth={1.7}
                />
                <input
                  {...emailField}
                  type="text"
                  autoComplete="username"
                  placeholder="usuario"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
                />
                <span className="text-muted-foreground border-border shrink-0 border-l pl-2.5 text-[13px] font-medium">
                  {CORREO_DOMINIO}
                </span>
              </div>
              {form.formState.errors.email ? (
                <p className="text-destructive mt-1.5 text-xs font-medium">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                Contraseña
              </label>
              <div className="border-input focus-within:border-primary focus-within:ring-ring/15 flex h-11.5 items-center gap-2.5 rounded-md border bg-transparent px-3 transition-colors focus-within:ring-3">
                <Lock
                  className="text-muted-foreground size-[17px] shrink-0"
                  strokeWidth={1.7}
                />
                <input
                  {...form.register("password")}
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((value) => !value)}
                  className="text-muted-foreground shrink-0"
                  aria-label={
                    mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {mostrarPassword ? (
                    <EyeOff className="size-[17px]" strokeWidth={1.7} />
                  ) : (
                    <Eye className="size-[17px]" strokeWidth={1.7} />
                  )}
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-destructive mt-1.5 text-xs font-medium">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            {/* No hay recuperación por correo: solo un administrador puede cambiar
                contraseñas (Admin → Usuarios → Cambiar contraseña). */}
            <p className="text-muted-foreground -mt-1 text-xs">
              ¿Olvidaste tu contraseña? Pídele a un administrador que te asigne una nueva.
            </p>

            <Button type="submit" size="lg" className="mt-1 w-full" disabled={isPending}>
              {isPending ? "Ingresando..." : "Iniciar sesión"}
            </Button>
          </form>

          <div className="text-muted-foreground mt-5 flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-3.5" strokeWidth={1.7} />
            <span className="text-xs">Conexión segura y encriptada</span>
          </div>

          <div className="text-muted-foreground mt-5 flex items-center justify-center gap-3.5 text-xs">
            <Link href="/login" className="hover:text-foreground">
              Política de privacidad
            </Link>
            <span className="bg-border h-3 w-px" />
            <Link href="/login" className="hover:text-foreground">
              Soporte
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
