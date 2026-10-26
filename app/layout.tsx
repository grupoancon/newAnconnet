import type { Metadata, Viewport } from "next"
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google"

import { AuthProvider } from "@/components/shared/auth-provider"
import { AvisoSinConexion } from "@/components/shared/aviso-sin-conexion"
import { NavigationProgress } from "@/components/shared/navigation-progress"
import { PwaRegister } from "@/components/shared/pwa-register"
import { ToastProvider } from "@/components/shared/toast-provider"

import "./globals.css"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "ANCONnet",
  description: "Intranet corporativa de Grupo Ancon",
  applicationName: "ANCONnet",
  // Safari/iOS ignora parte del manifest: estos metadatos hacen que "Añadir a
  // pantalla de inicio" abra en pantalla completa y con el nombre/ícono correctos.
  appleWebApp: {
    capable: true,
    title: "ANCONnet",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#f5891f",
  // Deja que la app se dibuje bajo el notch / barra de gestos; cada pantalla reserva
  // ese espacio con env(safe-area-inset-*) (valen 0 donde no hay recorte, p. ej. escritorio).
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`font-sans ${plusJakartaSans.variable} ${jetBrainsMono.variable}`}
    >
      {/* Extensiones del navegador (gestores de contraseñas, Grammarly, etc.) inyectan
          atributos en <body> antes de que React hidrate — no es un mismatch real. */}
      <body className="antialiased" suppressHydrationWarning>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
          <PwaRegister />
          <NavigationProgress />
          <AvisoSinConexion />
        </ToastProvider>
      </body>
    </html>
  )
}
