import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import {
  estadoCertificadoGuardado,
  type EstadoCertificadoGuardado,
} from "@/lib/firma/almacen"
import { claveMaestraConfigurada } from "@/lib/firma/cifrado"

import { FirmaElectronicaContent } from "./firma-electronica-content"

const VACIO: EstadoCertificadoGuardado = {
  cargado: false,
  activo: false,
  titular: null,
  identificacion: null,
  emisor: null,
  serie: null,
  validoDesde: null,
  validoHasta: null,
  nombreArchivo: null,
  subidoPor: null,
  actualizadoEn: null,
}

export default async function ConfiguracionFirmaElectronicaPage() {
  // Solo Administrador: quien sube el certificado decide con qué firma la empresa.
  const usuario = await getCurrentUser()
  if (!usuario || !usuario.roles.includes("Administrador")) {
    redirect("/")
  }

  let estado = VACIO
  let tablaDisponible = true
  try {
    estado = await estadoCertificadoGuardado()
  } catch {
    // La tabla firma_certificado_app todavía no se creó (prisma/sql/firma_certificado_app.sql).
    tablaDisponible = false
  }

  return (
    <FirmaElectronicaContent
      estadoInicial={estado}
      claveMaestraConfigurada={claveMaestraConfigurada()}
      tablaDisponible={tablaDisponible}
    />
  )
}
