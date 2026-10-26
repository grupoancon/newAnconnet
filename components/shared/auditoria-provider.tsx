"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { registrarEvento, vaciarCola } from "@/lib/auditoria/tracker"

const INTERVALO_ENVIO_MS = 4_000
const MAX_ETIQUETA = 80

// Elementos que cuentan como "algo que el usuario accionó". Un clic en un <div> sin
// rol ni `data-audit` no es una acción (suele ser fondo/espaciado) y solo sería ruido.
const SELECTOR_ACCIONABLE = [
  "a[href]",
  "button",
  "summary",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  "[data-audit]",
].join(",")

function limpiar(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_ETIQUETA)
}

// Etiqueta legible del elemento, sin leer nunca el valor de un input.
function etiquetaDe(el: Element): string {
  const explicita = el.getAttribute("data-audit")
  if (explicita) return limpiar(explicita)

  const aria = el.getAttribute("aria-label") ?? el.getAttribute("title")
  if (aria) return limpiar(aria)

  if (el instanceof HTMLInputElement) {
    const label = el.labels?.[0]?.textContent
    return limpiar(label || el.name || el.id || el.type)
  }

  return limpiar(el.textContent) || limpiar(el.id) || el.tagName.toLowerCase()
}

function rutaDeHref(href: string | null): string | undefined {
  if (!href) return undefined
  try {
    // Solo pathname: la query puede traer tokens o datos de filtros.
    const url = new URL(href, window.location.origin)
    return url.origin === window.location.origin
      ? url.pathname
      : url.origin + url.pathname
  } catch {
    return undefined
  }
}

// Se monta una vez en el shell del dashboard. Registra: ingreso a cada vista, clics en
// elementos accionables y envíos de formulario. Las peticiones al API y sus respuestas
// las audita el backend por su cuenta; aquí no se duplican.
export function AuditoriaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const rutaAnterior = useRef<string | null>(null)

  useEffect(() => {
    registrarEvento({
      tipo: "PAGE_VIEW",
      ruta: pathname,
      detalle: rutaAnterior.current ? { desde: rutaAnterior.current } : undefined,
    })
    rutaAnterior.current = pathname
  }, [pathname])

  useEffect(() => {
    function alHacerClic(evento: MouseEvent) {
      const origen = evento.target
      if (!(origen instanceof Element)) return

      const el = origen.closest(SELECTOR_ACCIONABLE)
      if (!el) return
      // Zonas que no deben auditarse (ej. el propio visor de auditoría, donde cada
      // filtro generaría un evento nuevo que aparece en la lista que se está viendo).
      if (el.closest("[data-audit-ignore]")) return

      registrarEvento({
        tipo: "CLICK",
        ruta: window.location.pathname,
        etiqueta: etiquetaDe(el),
        elemento: {
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          role: el.getAttribute("role") || undefined,
          href:
            el instanceof HTMLAnchorElement
              ? rutaDeHref(el.getAttribute("href"))
              : undefined,
          name: el.getAttribute("name") || undefined,
        },
      })
    }

    function alEnviarFormulario(evento: SubmitEvent) {
      const form = evento.target
      if (!(form instanceof HTMLFormElement)) return
      if (form.closest("[data-audit-ignore]")) return

      registrarEvento({
        tipo: "FORM_SUBMIT",
        ruta: window.location.pathname,
        etiqueta: limpiar(
          form.getAttribute("data-audit") ||
            form.getAttribute("aria-label") ||
            form.id ||
            form.getAttribute("name")
        ),
        elemento: {
          tag: "form",
          id: form.id || undefined,
          name: form.getAttribute("name") || undefined,
          href: rutaDeHref(form.getAttribute("action")),
        },
      })
    }

    // Fase de captura: se registra aunque otro handler detenga la propagación.
    document.addEventListener("click", alHacerClic, true)
    document.addEventListener("submit", alEnviarFormulario, true)

    const intervalo = setInterval(() => void vaciarCola(), INTERVALO_ENVIO_MS)

    function alOcultar() {
      if (document.visibilityState === "hidden") void vaciarCola(true)
    }
    function alSalir() {
      void vaciarCola(true)
    }
    document.addEventListener("visibilitychange", alOcultar)
    window.addEventListener("pagehide", alSalir)

    return () => {
      document.removeEventListener("click", alHacerClic, true)
      document.removeEventListener("submit", alEnviarFormulario, true)
      document.removeEventListener("visibilitychange", alOcultar)
      window.removeEventListener("pagehide", alSalir)
      clearInterval(intervalo)
      void vaciarCola(true)
    }
  }, [])

  return <>{children}</>
}
