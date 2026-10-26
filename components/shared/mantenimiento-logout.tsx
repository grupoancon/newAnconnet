"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/api/auth-api"
import { borrarRespaldosLocales } from "@/lib/borradores/use-borrador-automatico"

// Mismo cierre de sesión que el del sidebar (ver cerrarSesion en sidebar-nav.tsx): en
// la pantalla de mantenimiento no hay sidebar, y sin esto el usuario no tendría cómo
// salir para entrar con otra cuenta.
export function LogoutButton() {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)

  async function cerrarSesion() {
    setSaliendo(true)
    // Respaldos locales de borradores (datos del cliente): no tienen que quedar en el
    // equipo. El borrador del servidor se conserva para cuando vuelva a entrar.
    borrarRespaldosLocales()
    try {
      await caches.delete("anconnet-paginas-offline")
    } catch {
      // sin Cache API: no hay nada que borrar
    }
    try {
      await signOut()
    } catch {
      // seguimos igual
    }
    router.push("/login")
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      onClick={cerrarSesion}
      disabled={saliendo}
      className="text-muted-foreground"
    >
      <LogOut className="size-4" />
      Cerrar sesión
    </Button>
  )
}
