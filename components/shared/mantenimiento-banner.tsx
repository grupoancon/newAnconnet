import { Wrench } from "lucide-react"

import { MENSAJE_AVISO_POR_DEFECTO } from "@/lib/mantenimiento/constantes"
import type { EstadoMantenimiento } from "@/lib/mantenimiento/estado"

// Franja arriba del contenido mientras el mantenimiento está activo en modo "aviso".
// Un Administrador la ve también en modo "bloqueo" (él sí puede seguir entrando), con
// un texto que le recuerda que el resto de usuarios está bloqueado.
export function MantenimientoBanner({
  estado,
  esAdminEnBloqueo,
}: {
  estado: EstadoMantenimiento
  esAdminEnBloqueo: boolean
}) {
  return (
    <div
      role="status"
      className="bg-status-reservado-bg border-status-reservado-border text-status-reservado-fg flex items-start gap-2.5 border-b px-4 py-2.5 sm:px-6"
    >
      <Wrench className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} />
      <div className="min-w-0 text-[12.5px] leading-snug">
        <span className="font-bold">
          {esAdminEnBloqueo
            ? "Intranet bloqueada por mantenimiento. "
            : "Mantenimiento: "}
        </span>
        {esAdminEnBloqueo
          ? "Solo los administradores pueden entrar. Desactívalo en Configuración → Mantenimiento."
          : estado.mensaje || MENSAJE_AVISO_POR_DEFECTO}
      </div>
    </div>
  )
}
