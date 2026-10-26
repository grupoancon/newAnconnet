"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Mail, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "@/lib/navigation"

import { BrandMark } from "@/components/shared/brand-mark"
import { useAuth } from "@/components/shared/auth-provider"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  AuthApiError,
  sendTwoFactorOtp,
  verifyTwoFactorOtp,
  type UsuarioBetterAuth,
} from "@/lib/api/auth-api"
import { destinoSeguro } from "@/lib/api/sesion-vencida"
import { cn } from "@/lib/utils"

const LONGITUD_CODIGO = 6

// `destino`: pantalla a la que volver tras verificar el código (ver LoginForm).
export function VerificacionForm({
  correo,
  destino,
}: {
  correo: string
  destino?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const { iniciarSesion } = useAuth<UsuarioBetterAuth>()

  const [codigo, setCodigo] = useState<string[]>(Array(LONGITUD_CODIGO).fill(""))
  const [isVerifying, startVerificacion] = useTransition()
  const [isReenviando, startReenvio] = useTransition()
  // true mientras se manda el primer OTP al entrar a esta pantalla — mientras tanto
  // no tiene sentido mostrar los casilleros (no hay nada que escribir todavía).
  const [enviandoInicial, setEnviandoInicial] = useState(true)
  // Solo true una vez que algún envío (el inicial o un reenvío) terminó bien — si el
  // inicial falla, "Verificar" queda deshabilitado hasta reenviar con éxito: no tiene
  // sentido dejar verificar un código que nunca llegó a mandarse.
  const [codigoEnviado, setCodigoEnviado] = useState(false)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const otpEnviadoRef = useRef(false)

  // El primer OTP se manda solo al entrar a esta pantalla (sign-in/email ya dejo la
  // cookie de 2FA pendiente; este endpoint no necesita el email/userId a mano).
  useEffect(() => {
    if (otpEnviadoRef.current) return
    otpEnviadoRef.current = true
    sendTwoFactorOtp()
      .then(() => {
        setCodigoEnviado(true)
        toast({ variant: "info", description: "Código enviado a tu correo." })
      })
      .catch((error) => {
        toast({
          variant: "error",
          title: "No se pudo enviar el código",
          description:
            error instanceof AuthApiError
              ? error.message
              : "Intenta de nuevo en unos segundos.",
        })
      })
      .finally(() => {
        setEnviandoInicial(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function actualizarDigito(index: number, valor: string) {
    const digito = valor.replace(/\D/g, "").slice(-1)
    setCodigo((actual) => {
      const siguiente = [...actual]
      siguiente[index] = digito
      return siguiente
    })
    if (digito && index < LONGITUD_CODIGO - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function alPresionarTecla(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !codigo[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    } else if (event.key === "Enter") {
      // Desde cualquier casillero, no solo el último — si ya escribió o pegó los 6
      // dígitos, Enter dispara la verificación igual que el botón.
      event.preventDefault()
      verificar()
    }
  }

  // Pegar el código completo (copiado del correo) en cualquiera de los 6
  // casilleros — antes no había ningún manejador de paste, así que el navegador
  // solo insertaba el primer carácter en el casillero enfocado.
  function alPegar(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const digitos = event.clipboardData.getData("text").replace(/\D/g, "")
    if (!digitos) return
    event.preventDefault()
    // Si pegan el código completo (lo más común: copiarlo del correo y pegarlo con
    // cualquier casillero enfocado), se llena desde el primero — si pegan menos
    // dígitos que el total, se insertan a partir de donde se hizo el paste.
    const inicio = digitos.length >= LONGITUD_CODIGO ? 0 : index
    setCodigo((actual) => {
      const siguiente = [...actual]
      for (let i = 0; i < LONGITUD_CODIGO - inicio && i < digitos.length; i++) {
        siguiente[inicio + i] = digitos[i]
      }
      return siguiente
    })
    const ultimoIndice = Math.min(LONGITUD_CODIGO - 1, inicio + digitos.length - 1)
    inputsRef.current[ultimoIndice]?.focus()
  }

  function verificar() {
    if (!codigoEnviado || enviandoInicial || isReenviando) {
      toast({
        variant: "warning",
        description: "Espera a que se envíe el código antes de verificar.",
      })
      return
    }
    const codigoCompleto = codigo.join("")
    if (codigoCompleto.length < LONGITUD_CODIGO) {
      toast({ variant: "warning", description: "Ingresa los 6 dígitos del código." })
      return
    }

    startVerificacion(async () => {
      try {
        const { user, token } = await verifyTwoFactorOtp(codigoCompleto)
        iniciarSesion({ usuario: user, token })
        router.push(destinoSeguro(destino))
        router.refresh()
      } catch (error) {
        toast({
          variant: "error",
          title: "Código inválido",
          description:
            error instanceof AuthApiError
              ? error.message
              : "No se pudo verificar el código, intenta de nuevo.",
        })
        setCodigo(Array(LONGITUD_CODIGO).fill(""))
        inputsRef.current[0]?.focus()
      }
    })
  }

  function reenviarCodigo() {
    startReenvio(async () => {
      try {
        await sendTwoFactorOtp()
        setCodigoEnviado(true)
        toast({ variant: "success", description: "Te reenviamos el código a tu correo." })
      } catch (error) {
        toast({
          variant: "error",
          title: "No se pudo reenviar el código",
          description:
            error instanceof AuthApiError ? error.message : "Intenta de nuevo.",
        })
      }
    })
  }

  return (
    <div className="bg-muted flex min-h-dvh items-center justify-center p-4 sm:p-10">
      <div className="bg-card w-full max-w-110 rounded-xl px-5 pt-8 pb-6 text-center shadow-lg sm:px-10 sm:pt-10 sm:pb-8">
        <div className="bg-brand-gradient shadow-brand mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl">
          <BrandMark className="size-7 text-white" />
        </div>
        <h1 className="mb-1.5 text-[23px] font-extrabold tracking-tight">
          Verificación de seguridad
        </h1>
        <p className="text-muted-foreground mb-6.5 text-sm">
          Confirma tu identidad para continuar
        </p>

        <div className="border-border rounded-xl border p-4 sm:p-6">
          <div className="mb-1.5 flex items-center justify-center gap-2 text-sm font-bold">
            <Mail className="text-accent-foreground size-4" strokeWidth={1.8} />
            Código de verificación
          </div>
          <p className="text-muted-foreground mb-3.5 text-[12.5px]">
            {enviandoInicial
              ? "Enviando el código a tu correo…"
              : "Código de 6 dígitos enviado a tu correo"}
          </p>
          {correo ? (
            <div className="bg-accent text-accent-foreground mb-5.5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold">
              <span className="bg-primary size-1.5 rounded-full" />
              {correo}
            </div>
          ) : null}

          {enviandoInicial ? (
            // Mientras se manda el primer OTP no hay nada que escribir todavía — un
            // spinner en vez de los casilleros deja claro que hay que esperar, en vez
            // de mostrar casilleros vacíos que parecen listos para usarse.
            <div className="mb-5 flex items-center justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <div className="mb-3.5 flex justify-center gap-1.5 sm:gap-2">
              {codigo.map((digito, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el
                  }}
                  value={digito}
                  onChange={(event) => actualizarDigito(index, event.target.value)}
                  onKeyDown={(event) => alPresionarTecla(index, event)}
                  onPaste={(event) => alPegar(index, event)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  disabled={isVerifying}
                  className={cn(
                    "border-input h-12 w-10 rounded-md border text-center text-lg font-bold outline-none disabled:opacity-50 sm:h-13 sm:w-11",
                    "focus:border-primary focus:ring-ring/15 focus:ring-3"
                  )}
                />
              ))}
            </div>
          )}
          <p className="text-muted-foreground mb-5 text-[11.5px]">
            No se solicitará verificación en este dispositivo por 30 días
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={isVerifying || enviandoInicial || isReenviando || !codigoEnviado}
            onClick={verificar}
          >
            {isVerifying
              ? "Verificando..."
              : enviandoInicial || isReenviando
                ? "Enviando código..."
                : "Verificar"}
          </Button>
        </div>

        <div className="mt-5.5 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isReenviando}
            onClick={reenviarCodigo}
            className="text-primary text-sm font-bold disabled:opacity-50"
          >
            {isReenviando ? "Reenviando..." : "Reenviar código"}
          </button>
          <Link href="/login" className="text-muted-foreground text-sm font-semibold">
            Volver al inicio de sesión
          </Link>
        </div>
        <div className="border-border text-muted-foreground mt-5.5 flex items-center justify-center gap-1.5 border-t pt-4.5">
          <ShieldCheck className="size-3.5" strokeWidth={1.7} />
          <span className="text-[11.5px]">Conexión segura de extremo a extremo</span>
        </div>
      </div>
    </div>
  )
}
