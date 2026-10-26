import { LoginForm } from "@/components/shared/login-form"

export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; motivo?: string }
}) {
  return (
    <LoginForm
      destino={searchParams.from}
      sesionVencida={searchParams.motivo === "sesion-vencida"}
    />
  )
}
