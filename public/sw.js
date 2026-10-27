/* Service worker de ANCONnet.
 *
 * Conservador a propósito: la app es autenticada y los datos cambian a cada rato, así
 * que NO se cachea HTML ni respuestas del API (nunca servir una pantalla o un dato de
 * otra sesión). Solo se guardan los assets estáticos inmutables (/_next/static, íconos)
 * para que abra rápido, y si no hay red al navegar se muestra /offline.html.
 *
 * Única excepción: el catálogo de inventario (PAGINAS_OFFLINE), para poder mostrar los
 * planos en el sitio sin señal. Siempre se pide primero a la red; la copia guardada solo
 * se usa si no hay conexión, y los datos de los planos salen del IndexedDB que llena la
 * propia pantalla (lib/plano-cache.ts). Al cerrar sesión se borra este cache
 * (ver cerrarSesion en sidebar-nav.tsx). */
const VERSION = "v3"
const STATIC_CACHE = `anconnet-static-${VERSION}`
const PAGINAS_CACHE = "anconnet-paginas-offline"
const OFFLINE_URL = "/offline.html"
const PAGINAS_OFFLINE = ["/ventas/inventario/catalogo"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/logo-offline.png"])
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("anconnet-static-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Páginas disponibles offline: red primero (y se guarda la copia), sin conexión la
  // última copia guardada. Solo respuestas 200 sin redirección — nunca guardar el login
  // al que rebota una sesión vencida.
  if (request.mode === "navigate" && PAGINAS_OFFLINE.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copia = response.clone()
            caches.open(PAGINAS_CACHE).then((cache) => cache.put(url.pathname, copia))
          }
          return response
        })
        .catch(() =>
          caches
            .match(url.pathname, { cacheName: PAGINAS_CACHE })
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  // Navegación: siempre a la red; sin conexión, la página offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Assets estáticos con hash: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copia = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copia))
            }
            return response
          })
      )
    )
  }
})
