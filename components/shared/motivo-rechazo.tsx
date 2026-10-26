// Motivo con el que RRHH rechazó una solicitud (permiso, préstamo o vacaciones) — se
// muestra bajo el estado para que el colaborador sepa por qué. No renderiza nada si la
// solicitud no está rechazada o no trae motivo.
export function MotivoRechazo({
  estado,
  motivo,
}: {
  estado: string | null | undefined
  motivo: string | null | undefined
}) {
  const texto = motivo?.trim()
  if ((estado ?? "").trim().toLowerCase() !== "rechazado" || !texto) return null
  return (
    <p className="text-status-bloqueado-fg mt-1.5 max-w-64 text-[11.5px] leading-snug whitespace-normal">
      <span className="font-bold">Motivo:</span> {texto}
    </p>
  )
}
