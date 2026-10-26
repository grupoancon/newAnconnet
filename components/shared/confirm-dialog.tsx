"use client"

import { AlertDialog } from "radix-ui"

import { Button } from "@/components/ui/button"

// Reemplazo de window.confirm con el estilo de la app — el nativo muestra la IP/host
// ("192.168.x.x dice") y no sigue el tema.
export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  textoConfirmar = "Confirmar",
  destructivo = false,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean
  titulo: string
  descripcion?: React.ReactNode
  textoConfirmar?: string
  destructivo?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <AlertDialog.Root
      open={abierto}
      onOpenChange={(abrir) => {
        if (!abrir) onCancelar()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-xs" />
        <AlertDialog.Content className="bg-card border-border data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-xl duration-100">
          <AlertDialog.Title className="text-base font-bold">{titulo}</AlertDialog.Title>
          {descripcion ? (
            <AlertDialog.Description className="text-muted-foreground mt-1.5 text-sm">
              {descripcion}
            </AlertDialog.Description>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" size="sm">
                Cancelar
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                type="button"
                variant={destructivo ? "destructive" : "default"}
                size="sm"
                onClick={onConfirmar}
              >
                {textoConfirmar}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
