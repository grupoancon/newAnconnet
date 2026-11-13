"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Eye,
  EyeOff,
  FileKey2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { PageHeader } from "@/components/shared/page-header"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EstadoCertificadoGuardado } from "@/lib/firma/almacen"
import { cn } from "@/lib/utils"
import {
  accionActivarFirma,
  accionEliminarCertificado,
  accionSubirCertificado,
} from "@/server/actions/firma"

const DIA = 24 * 3600_000

function formatearFecha(iso: string | null, conHora = false): string {
  if (!iso) return ""
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    ...(conHora ? { timeStyle: "short" } : {}),
    timeZone: "America/Guayaquil",
  }).format(new Date(iso))
}

function vigencia(validoHasta: string | null) {
  if (!validoHasta) return null
  const dias = Math.floor((new Date(validoHasta).getTime() - Date.now()) / DIA)
  if (dias < 0) return { texto: "Vencido", tono: "error" as const }
  if (dias <= 30) return { texto: `Vence en ${dias} días`, tono: "aviso" as const }
  return { texto: `Vigente · ${dias} días restantes`, tono: "ok" as const }
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-status-reservado-fg/30 bg-status-reservado-bg text-status-reservado-fg flex items-start gap-2.5 rounded-lg border p-3 text-[13px]">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
      <div>{children}</div>
    </div>
  )
}

export function FirmaElectronicaContent({
  estadoInicial,
  claveMaestraConfigurada,
  tablaDisponible,
}: {
  estadoInicial: EstadoCertificadoGuardado
  claveMaestraConfigurada: boolean
  tablaDisponible: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [estado, setEstado] = useState(estadoInicial)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [contrasena, setContrasena] = useState("")
  const [verContrasena, setVerContrasena] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cambiandoActivo, setCambiandoActivo] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)

  const habilitado = claveMaestraConfigurada && tablaDisponible
  const v = vigencia(estado.validoHasta)

  async function subir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!archivo || !contrasena) return
    setGuardando(true)
    const datos = new FormData()
    datos.set("archivo", archivo)
    datos.set("contrasena", contrasena)
    const resultado = await accionSubirCertificado(datos)
    setGuardando(false)
    if (!resultado.ok) {
      toast({
        variant: "error",
        title: "No se guardó el certificado",
        description: resultado.error,
      })
      return
    }
    // La contraseña no queda en memoria de la pantalla.
    setContrasena("")
    setArchivo(null)
    formRef.current?.reset()
    setEstado(resultado.estado)
    toast({
      variant: "success",
      description: `Certificado de ${resultado.estado.titular} guardado y cifrado.`,
    })
    router.refresh()
  }

  async function cambiarActivo() {
    setCambiandoActivo(true)
    const resultado = await accionActivarFirma(!estado.activo)
    setCambiandoActivo(false)
    if (!resultado.ok) {
      toast({ variant: "error", description: resultado.error })
      return
    }
    setEstado(resultado.estado)
    toast({
      variant: "success",
      description: resultado.estado.activo
        ? "Firma electrónica activada."
        : "Firma electrónica desactivada.",
    })
  }

  async function eliminar() {
    setConfirmarEliminar(false)
    const resultado = await accionEliminarCertificado()
    if (!resultado.ok) {
      toast({ variant: "error", description: resultado.error })
      return
    }
    setEstado(resultado.estado)
    toast({ variant: "success", description: "Certificado eliminado." })
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader eyebrow="Configuración" title="Firma electrónica" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mx-auto max-w-2xl space-y-4">
          {!tablaDisponible ? (
            <Aviso>
              Falta crear la tabla <code>firma_certificado_app</code> en la base de datos
              (script <code>prisma/sql/firma_certificado_app.sql</code>).
            </Aviso>
          ) : null}
          {!claveMaestraConfigurada ? (
            <Aviso>
              El servidor no tiene <code>FIRMA_CLAVE_MAESTRA</code> configurada. Es la
              clave con la que se cifra el certificado; sin ella no se puede guardar.
              Pídele al administrador del servidor que la agregue al entorno.
            </Aviso>
          ) : null}

          {/* Estado actual */}
          <div className="bg-card border-border rounded-lg border p-4">
            {estado.cargado ? (
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-md",
                      v?.tono === "error"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    <ShieldCheck className="size-[18px]" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="truncate text-sm font-bold">{estado.titular}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      Emitido por {estado.emisor}
                      {estado.identificacion ? ` · ${estado.identificacion}` : ""}
                    </div>
                    <div className="text-xs">
                      Válido del {formatearFecha(estado.validoDesde)} al{" "}
                      {formatearFecha(estado.validoHasta)}
                      {v ? (
                        <span
                          className={cn(
                            "ml-1.5 font-semibold",
                            v.tono === "error" && "text-destructive",
                            v.tono === "aviso" && "text-status-reservado-fg",
                            v.tono === "ok" && "text-primary"
                          )}
                        >
                          · {v.texto}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {estado.nombreArchivo} · subido por {estado.subidoPor} ·{" "}
                      {formatearFecha(estado.actualizadoEn, true)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={estado.activo}
                  aria-label="Activar la firma electrónica"
                  disabled={cambiandoActivo || !tablaDisponible}
                  onClick={cambiarActivo}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50",
                    estado.activo ? "bg-primary" : "bg-input"
                  )}
                >
                  <span
                    className={cn(
                      "bg-card inline-block size-5 rounded-full shadow transition-transform",
                      estado.activo ? "translate-x-[22px]" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
                  <FileKey2 className="size-[18px]" strokeWidth={1.8} />
                </span>
                <div>
                  <div className="text-sm font-bold">No hay certificado cargado</div>
                  <div className="text-muted-foreground text-xs">
                    Sube el archivo .p12 de la firma electrónica para que los documentos
                    se firmen automáticamente.
                  </div>
                </div>
              </div>
            )}
            {estado.cargado ? (
              <p className="text-muted-foreground border-border mt-3 border-t pt-3 text-xs">
                {estado.activo
                  ? "Firma activada: la oferta, el financiamiento y el convenio se pueden descargar como PDF firmado (usuarios con el permiso firma:firmar)."
                  : "Firma desactivada: no se generan PDF firmados."}
              </p>
            ) : null}
          </div>

          {/* Subir / reemplazar */}
          <form
            ref={formRef}
            onSubmit={subir}
            className="bg-card border-border space-y-4 rounded-lg border p-4"
          >
            <div className="text-sm font-bold">
              {estado.cargado ? "Reemplazar certificado" : "Subir certificado"}
            </div>
            <div>
              <label
                htmlFor="archivo-p12"
                className="text-muted-foreground mb-1.5 block text-xs font-semibold"
              >
                Archivo de la firma (.p12 o .pfx)
              </label>
              <Input
                id="archivo-p12"
                type="file"
                accept=".p12,.pfx,application/x-pkcs12"
                disabled={!habilitado || guardando}
                onChange={(event) => setArchivo(event.target.files?.[0] ?? null)}
                className="pt-1.5"
              />
            </div>
            <div>
              <label
                htmlFor="contrasena-p12"
                className="text-muted-foreground mb-1.5 block text-xs font-semibold"
              >
                Contraseña del certificado
              </label>
              <div className="relative">
                <Input
                  id="contrasena-p12"
                  type={verContrasena ? "text" : "password"}
                  autoComplete="new-password"
                  value={contrasena}
                  disabled={!habilitado || guardando}
                  onChange={(event) => setContrasena(event.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={verContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setVerContrasena((x) => !x)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer"
                >
                  {verContrasena ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} />
              Antes de guardar se comprueba que la contraseña sea correcta y que el
              certificado esté vigente. El archivo y la contraseña se guardan cifrados
              (AES-256) y la contraseña no se vuelve a mostrar.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {estado.cargado ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmarEliminar(true)}
                  disabled={guardando || !tablaDisponible}
                >
                  <Trash2 className="size-4" /> Eliminar certificado
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                disabled={!habilitado || !archivo || !contrasena || guardando}
              >
                {guardando ? "Validando…" : "Validar y guardar"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        abierto={confirmarEliminar}
        titulo="¿Eliminar el certificado de firma?"
        descripcion="Los documentos dejarán de firmarse con este certificado. Para volver a firmar tendrás que subirlo otra vez con su contraseña."
        textoConfirmar="Eliminar"
        destructivo
        onConfirmar={eliminar}
        onCancelar={() => setConfirmarEliminar(false)}
      />
    </div>
  )
}
