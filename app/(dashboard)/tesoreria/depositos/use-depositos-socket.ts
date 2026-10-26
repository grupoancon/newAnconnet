"use client"

import { useCallback, useEffect, useRef } from "react"

import { usePresencia } from "@/components/shared/presencia-provider"

type Opciones = {
  // Se llama cada vez que el backend avisa que entró un depósito nuevo.
  onNuevoDeposito: () => void
}

// Usa el socket único de la pestaña (PresenciaProvider): la identificación del usuario
// y la sala `empresa_<id>` ya las resolvió el provider al conectar.
export function useDepositosSocket({ onNuevoDeposito }: Opciones) {
  const { socket, conectado } = usePresencia()
  // Ref para no re-suscribir cada vez que el callback cambia de identidad.
  const callbackRef = useRef(onNuevoDeposito)
  callbackRef.current = onNuevoDeposito

  useEffect(() => {
    if (!socket) return
    const manejador = () => callbackRef.current()
    socket.on("actualizar_lista_depositos", manejador)
    return () => {
      socket.off("actualizar_lista_depositos", manejador)
    }
  }, [socket])

  // Al abrir los comprobantes de un depósito pendiente el backend lo pasa a "En
  // Revision" y avisa a la app del cliente (`receipt_status_updated`).
  const marcarEnRevision = useCallback(
    (receiptId: number, status: string) => {
      socket?.emit("update_receip_status", { receiptId, status })
    },
    [socket]
  )

  return { conectado, marcarEnRevision }
}
