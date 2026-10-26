/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // html-to-docx (usado en convenio-reporte-content.tsx para exportar a Word) trae
    // como dependencias transitivas `image-size`/`image-to-base64`, que importan `fs`
    // a nivel de módulo aunque el branch que realmente corre en navegador (cuando
    // `typeof window !== "undefined"`) nunca lo use — webpack igual intenta resolverlo
    // al armar el bundle del cliente y el build se rompe. `fs`/`path` en false le dice
    // a webpack que los reemplace por un stub vacío del lado del cliente; del lado del
    // servidor (isServer) se dejan intactos porque ahí sí existen de verdad.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        // `encoding` es una dependencia opcional de node-fetch (llega transitivamente
        // vía image-to-base64, para bajar imágenes remotas por URL — algo que esta app
        // no usa en el contenido de un convenio) — sin este fallback, webpack la marca
        // como advertencia de build en vez de dejarla en su try/catch original.
        encoding: false,
      }
    }
    return config
  },
}

export default nextConfig
