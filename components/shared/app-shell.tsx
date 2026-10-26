import { AuditoriaProvider } from "@/components/shared/auditoria-provider"
import { PresenciaProvider } from "@/components/shared/presencia-provider"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { SesionGuardian } from "@/components/shared/sesion-guardian"
import { SessionProvider } from "@/components/shared/session-provider"
import { SidebarMobileProvider } from "@/components/shared/sidebar-context"
import { SidebarNav } from "@/components/shared/sidebar-nav"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { AuthenticatedUser } from "@/types/auth"

// Cada pagina define su propio encabezado (topbar de saludo, banner degradado, barra de
// tabs de proyecto, etc.) — el shell solo aporta el sidebar persistente. El boton para
// abrir el sidebar en mobile/tablet vive DENTRO de ese encabezado (ver AppTopbar /
// ProjectTabsBar), no flotando encima del contenido — de ahi el SidebarMobileProvider.
export function AppShell({
  usuario,
  aviso,
  children,
}: {
  usuario: AuthenticatedUser
  // Banner global (hoy: el de mantenimiento) arriba del contenido de cualquier página.
  aviso?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <SessionProvider user={usuario}>
      <SesionGuardian />
      <PresenciaProvider>
        <AuditoriaProvider>
          <TooltipProvider>
            <SidebarMobileProvider>
              {/* Márgenes de área segura (notch, barra de gestos, esquinas en horizontal): el
                fondo del propio contenedor es el que se ve en esas franjas. Va `fixed
                inset-0` y no con una altura (h-screen / h-dvh): así ocupa exactamente la
                pantalla y el documento no se puede desplazar. Con una altura, en la PWA
                instalada (iOS) el documento quedaba unos píxeles más alto que la
                pantalla, se desplazaba y la barra superior se salía de vista. */}
              <div
                className="bg-card fixed inset-0 flex overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
                data-app-shell-root
              >
                {/* display:contents: envuelve solo para poder targetear "ocultar en
                impresión" sin agregar un nodo real al layout flex (SidebarNav depende
                de ser hijo directo del flex row para su ancho). */}
                <div className="contents" data-app-sidebar>
                  <SidebarNav />
                </div>
                <main
                  className="bg-muted flex-1 overflow-y-auto overscroll-contain"
                  data-app-shell-main
                >
                  <PullToRefresh />
                  {aviso}
                  {children}
                </main>
              </div>
            </SidebarMobileProvider>
          </TooltipProvider>
        </AuditoriaProvider>
      </PresenciaProvider>
    </SessionProvider>
  )
}
