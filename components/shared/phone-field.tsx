"use client"

import { ComboboxField, type ComboboxOption } from "@/components/shared/combobox-field"
import { TextField } from "@/components/shared/text-field"
import { CODIGOS_TELEFONICOS } from "@/lib/const/codigos-telefonicos"
import { validarTelefono } from "@/lib/validations/telefono"

const OPCIONES_PREFIJO: ComboboxOption[] = CODIGOS_TELEFONICOS.map((c) => ({
  value: c.codigo,
  label: `${c.codigo} ${c.pais}`,
  keywords: c.pais,
}))

// Input de teléfono reutilizable: selector de prefijo de país (buscable, todo el mundo)
// + número validado a solo dígitos. El valor completo para guardar es
// `${prefijo}${numero}` — quien use este campo arma esa concatenación al enviar el
// payload (ver oferta-compra-content.tsx), no lo hace este componente.
export function PhoneField({
  label,
  prefijo,
  numero,
  onChangePrefijo,
  onChangeNumero,
  requerido,
}: {
  label: string
  prefijo: string
  numero: string
  onChangePrefijo: (value: string) => void
  onChangeNumero: (value: string) => void
  requerido?: boolean
}) {
  return (
    <div>
      <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
        {requerido ? `${label} *` : label}
      </label>
      <div className="flex gap-2">
        <ComboboxField
          placeholder="Prefijo"
          searchPlaceholder="Buscar país…"
          options={OPCIONES_PREFIJO}
          value={prefijo}
          onChange={onChangePrefijo}
          className="w-32 shrink-0"
        />
        <div className="flex-1">
          <TextField
            value={numero}
            onChange={onChangeNumero}
            placeholder="999999999"
            error={validarTelefono(numero)}
          />
        </div>
      </div>
    </div>
  )
}
