// Mini store para la barra de progreso de navegación: cualquiera puede avisar que
// arrancó una navegación (`iniciarNavegacion`) y el componente <NavigationProgress />
// la termina cuando cambia la ruta. Sin dependencias.
type Listener = (activa: boolean) => void

const listeners = new Set<Listener>()

export function suscribirNavegacion(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function iniciarNavegacion(): void {
  listeners.forEach((listener) => listener(true))
}

export function terminarNavegacion(): void {
  listeners.forEach((listener) => listener(false))
}
