"use client"

import { useMemo } from "react"
import { useRouter as useNextRouter } from "next/navigation"

import { iniciarNavegacion } from "@/lib/navigation-progress"

// Todo lo demás de next/navigation sale igual — así los archivos solo cambian la ruta
// del import. Lo único distinto es useRouter: antes de navegar avisa a la barra de
// progreso para que el usuario vea de inmediato que su toque/click hizo algo.
export * from "next/navigation"

function esMismaRuta(destino: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const url = new URL(destino, window.location.href)
    return (
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    )
  } catch {
    return false
  }
}

export function useRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter()

  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) => {
        if (!esMismaRuta(href)) iniciarNavegacion()
        router.push(href, options)
      },
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) => {
        if (!esMismaRuta(href)) iniciarNavegacion()
        router.replace(href, options)
      },
      back: () => {
        iniciarNavegacion()
        router.back()
      },
      forward: () => {
        iniciarNavegacion()
        router.forward()
      },
    }),
    [router]
  )
}
