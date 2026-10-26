import { VerificacionForm } from "@/components/shared/verificacion-form"

export default function VerificarPage({
  searchParams,
}: {
  searchParams: { email?: string; from?: string }
}) {
  return <VerificacionForm correo={searchParams.email ?? ""} destino={searchParams.from} />
}
