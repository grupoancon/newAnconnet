"use client"

import { createContext, useContext, useState } from "react"

type SidebarMobileContextValue = {
  mobileOpen: boolean
  abrirMenu: () => void
  cerrarMenu: () => void
}

const SidebarMobileContext = createContext<SidebarMobileContextValue | null>(null)

export function SidebarMobileProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <SidebarMobileContext.Provider
      value={{
        mobileOpen,
        abrirMenu: () => setMobileOpen(true),
        cerrarMenu: () => setMobileOpen(false),
      }}
    >
      {children}
    </SidebarMobileContext.Provider>
  )
}

// El boton para abrir el drawer del sidebar vive en el encabezado de cada pagina (no
// flota encima del contenido) — este hook es lo que conecta ese boton con el drawer que
// renderiza <SidebarNav>, sin acoplar ambos componentes directamente entre si.
export function useSidebarMobile(): SidebarMobileContextValue {
  const contexto = useContext(SidebarMobileContext)
  if (!contexto) {
    throw new Error("useSidebarMobile debe usarse dentro de <SidebarMobileProvider>")
  }
  return contexto
}
