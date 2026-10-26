"use client"

import { createContext, useContext } from "react"

import type { AuthenticatedUser } from "@/types/auth"

const SessionContext = createContext<AuthenticatedUser | null>(null)

export function SessionProvider({
  user,
  children,
}: {
  user: AuthenticatedUser
  children: React.ReactNode
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
}

// Los datos de sesion llegan desde el server component que ya llamo a getCurrentUser();
// este hook solo los expone al arbol de cliente, nunca vuelve a confiar en si mismo
// para decidir autorizacion (eso es responsabilidad de can() en servidor).
export function useSession(): AuthenticatedUser {
  const user = useContext(SessionContext)
  if (!user) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>")
  }
  return user
}
