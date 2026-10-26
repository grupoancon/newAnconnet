"use client"

import { useEffect, useState } from "react"
import { Info } from "lucide-react"

import { DatePickerField } from "@/components/shared/date-picker-field"
import { SelectField } from "@/components/shared/select-field"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { MOTIVOS_CIERRE_SESION, type UsuarioApp } from "./datos"
import { hoyISO } from "./formato"

function avisoPendiente(toast: ReturnType<typeof useToast>) {
  toast({
    variant: "info",
    title: "Aún no disponible",
    description: "Esta acción se conectará próximamente.",
  })
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/60 border-border text-muted-foreground flex gap-2 rounded-md border px-3 py-2.5 text-xs leading-relaxed">
      <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} />
      <p>{children}</p>
    </div>
  )
}

// Solo manda la notificación push de "lote entregado" al cliente; no cierra su sesión.
export function LoteEntregadoSheet({
  usuario,
  onOpenChange,
}: {
  usuario: UsuarioApp | null
  onOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  const [lote, setLote] = useState("")
  const [fecha, setFecha] = useState("")

  useEffect(() => {
    if (!usuario) return
    setLote(usuario.lotes[0] ?? "")
    setFecha(hoyISO())
  }, [usuario])

  return (
    <Sheet open={usuario !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Lote entregado</SheetTitle>
          <SheetDescription>
            Avisa a <strong>{usuario?.nombre}</strong> que su lote pasó a la administración.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <SelectField
            label="Lote entregado"
            placeholder="Selecciona el lote"
            options={usuario?.lotes ?? []}
            value={lote}
            onValueChange={setLote}
          />
          <DatePickerField label="Fecha de entrega" value={fecha} onChange={setFecha} />
          <Nota>Le llega una notificación en la app. Su sesión sigue abierta.</Nota>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!lote || !fecha} onClick={() => avisoPendiente(toast)}>
            Enviar aviso
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// Cierra todas las sesiones del usuario en la app; el cliente ve un aviso según el
// motivo. Con "Lote entregado" además le llega el aviso de entrega (lote + fecha).
export function CerrarSesionSheet({
  usuario,
  onOpenChange,
}: {
  usuario: UsuarioApp | null
  onOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  const [motivo, setMotivo] = useState(MOTIVOS_CIERRE_SESION[0]!.value)
  const [lote, setLote] = useState("")
  const [fecha, setFecha] = useState("")

  useEffect(() => {
    if (!usuario) return
    setMotivo(MOTIVOS_CIERRE_SESION[0]!.value)
    setLote(usuario.lotes[0] ?? "")
    setFecha(hoyISO())
  }, [usuario])

  const esEntrega = motivo === "LOTE_ENTREGADO"

  return (
    <Sheet open={usuario !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-5">
          <SheetTitle>Cerrar sesión del usuario</SheetTitle>
          <SheetDescription>
            Se cerrarán todas las sesiones de <strong>{usuario?.nombre}</strong> (cédula{" "}
            {usuario?.cedula}).
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <SelectField
            label="Motivo"
            placeholder="Selecciona el motivo"
            opciones={MOTIVOS_CIERRE_SESION}
            value={motivo}
            onValueChange={setMotivo}
          />
          {esEntrega ? (
            <>
              <SelectField
                label="Lote entregado"
                placeholder="Selecciona el lote"
                options={usuario?.lotes ?? []}
                value={lote}
                onValueChange={setLote}
              />
              <DatePickerField label="Fecha de entrega" value={fecha} onChange={setFecha} />
            </>
          ) : null}
          <Nota>El usuario verá un aviso en la app según el motivo elegido.</Nota>
        </div>

        <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={esEntrega && (!lote || !fecha)}
            onClick={() => avisoPendiente(toast)}
          >
            Cerrar sesión
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
