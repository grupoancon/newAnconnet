import type { MetadataRoute } from "next"

// Se sirve como /manifest.webmanifest — lo que permite "Instalar app" / "Añadir a
// pantalla de inicio" y abrir ANCONnet sin la barra del navegador.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ANCONnet · Intranet Grupo Ancon",
    short_name: "ANCONnet",
    description: "Intranet corporativa de Grupo Ancon",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f7",
    theme_color: "#f5891f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
