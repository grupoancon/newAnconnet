// Manejo común de la sesión vencida (401) para todos los clientes de lib/api/*.ts —
// cada wrapper (ventasFetch, inventarioFetch, ...) lo llama antes de lanzar su error.
// Antes ninguno lo manejaba: si la sesión vencía mientras el asesor trabajaba, solo
// veía un toast de error y no sabía que tenía que volver a iniciar sesión.
//
// NO se usa en auth-api.ts: ahí un 401 es "correo o contraseña incorrectos" en el
// propio login, no una sesión vencida. Un 403 (sin permiso) tampoco cuenta: la sesión
// sigue siendo válida.

// Varias llamadas en paralelo (ej. Promise.all al cargar una pantalla) pueden recibir
// el 401 a la vez — solo la primera redirige.
let redirigiendo = false

// El aviso y la pantalla de origen también se guardan en sessionStorage, no solo en la
// URL: mientras carga /login, la página anterior sigue viva y puede disparar su propia
// navegación (ej. un router.push a /sin-acceso), que pasa por el middleware sin cookie
// y termina en /login?from=<otra ruta> — pisando la URL con el aviso. Ver
// leerSesionVencidaGuardada, que lo lee (y lo borra) en el login.
const CLAVE_SESION_VENCIDA = "anconnet-sesion-vencida"

export function avisarSiSesionVencida(status: number): void {
  if (status !== 401 || typeof window === "undefined" || redirigiendo) return
  redirigiendo = true
  const desde = `${window.location.pathname}${window.location.search}`
  try {
    sessionStorage.setItem(CLAVE_SESION_VENCIDA, desde)
  } catch {
    // sin sessionStorage (modo privado estricto): queda solo lo que va en la URL
  }
  // Navegación completa (no router.push): /api/auth/clear-session es un route handler
  // que borra la cookie y recién ahí manda a /login, con el aviso y la pantalla a la que
  // volver después de iniciar sesión.
  const params = new URLSearchParams({ motivo: "sesion-vencida", from: desde })
  window.location.href = `/api/auth/clear-session?${params.toString()}`
}

// Para el login: si se llegó por una sesión vencida, devuelve la pantalla en la que
// estaba el usuario (y borra el dato, para que no vuelva a aparecer en el próximo
// login); null si no.
export function leerSesionVencidaGuardada(): string | null {
  try {
    const desde = sessionStorage.getItem(CLAVE_SESION_VENCIDA)
    sessionStorage.removeItem(CLAVE_SESION_VENCIDA)
    return desde
  } catch {
    return null
  }
}

// Solo rutas internas de la app como destino de "volver a donde estabas" — nunca una
// URL externa ("//otro-sitio.com", "https://...") ni una ruta de la API.
export function destinoSeguro(from: string | null | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/api")) {
    return "/"
  }
  return from
}
