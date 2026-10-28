"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Contact2,
  DollarSign,
  FileCheck,
  FileText,
  Flame,
  FolderKanban,
  Landmark,
  LogOut,
  Package,
  PieChart,
  Rocket,
  Search,
  Smartphone,
  Settings,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "@/lib/navigation"

import type { Permiso } from "@/components/shared/can"
import { useSession } from "@/components/shared/session-provider"
import { useSidebarMobile } from "@/components/shared/sidebar-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { can, tienePermisoExplicito } from "@/lib/auth/rbac"
import { cn } from "@/lib/utils"
import { signOut } from "@/lib/api/auth-api"
import { borrarRespaldosLocales } from "@/lib/borradores/use-borrador-automatico"
import type { AuthenticatedUser } from "@/types/auth"

type NavLeaf = {
  label: string
  href?: string
  permiso?: Permiso
  permisoExplicito?: boolean
  permisosAlguno?: Permiso[]
}

type NavItem = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  children?: NavLeaf[]
  rolesPermitidos?: string[]
  // Roles que NO ven el item aunque tengan el permiso — ej. Promociones/Convenios
  // para Administrador, que ya llega a ellos desde "Configuración".
  rolesExcluidos?: string[]
  permiso?: Permiso
  permisosAlguno?: Permiso[]
}

// Roles que ven el grupo "Ventas" completo. Quien no tiene ninguno igual llega al
// inventario (si tiene el permiso) por los accesos directos de afuera del grupo.
const ROLES_VENTAS = ["Administrador", "Asesor de Ventas", "Gestion"]

const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", icon: Rocket, href: "/" },
  { label: "Cotizaciones", icon: Calculator, href: "/gestion/cotizaciones" },
  {
    label: "Gestion",
    icon: FolderKanban,
    children: [
      {
        label: "Refinanciamientos",
        href: "/gestion/refinanciamiento",
        permiso: "refinanciamiento:crear",
      },
      {
        label: "Entregas",
        href: "/entregas",
        permisosAlguno: ["entregas:ver", "entregas:entregar", "entregas:cerrar"],
      },
      {
        label: "Encuestas",
        href: "/encuestas",
        permisosAlguno: ["encuestas:ver", "encuestas:crear"],
      },
    ],
  },
  {
    label: "Tesoreria",
    icon: Landmark,
    children: [
      {
        label: "Registro de depósitos",
        href: "/tesoreria/depositos",
        permiso: "depositos:ver",
      },
    ],
  },
  { label: "Reportes", icon: PieChart, href: "/reportes" },

  { label: "RRHH", icon: Contact2, href: "/rrhh" },
  {
    label: "Ventas",
    icon: DollarSign,
    rolesPermitidos: ROLES_VENTAS,
    children: [
      { label: "Nueva Venta", href: "/proyectos", permiso: "ventas:nueva" },
      {
        label: "Inventario",
        href: "/ventas/inventario/catalogo",
        permiso: "inventario:ver",
      },
      {
        label: "Gestión inventario",
        href: "/ventas/inventario",
        permiso: "inventario:gestion",
      },
    ],
  },
  // Las mismas páginas de inventario de arriba, pero sueltas para quien no tiene un rol
  // de ROLES_VENTAS (ese ya las ve dentro de "Ventas"); cada una sigue pidiendo su permiso.
  {
    label: "Inventario",
    icon: Package,
    href: "/ventas/inventario/catalogo",
    permiso: "inventario:ver",
    rolesExcluidos: ROLES_VENTAS,
  },
  {
    label: "Gestión inventario",
    icon: Package,
    href: "/ventas/inventario",
    permiso: "inventario:gestion",
    rolesExcluidos: ROLES_VENTAS,
  },
  {
    label: "Revisión de documentos",
    icon: FileCheck,
    href: "/ventas/revision-documentos",
    permiso: "documentos:revisar",
  },

  {
    label: "Ventas urgentes",
    icon: Flame,
    href: "/ventas/urgentes",
    permiso: "venta:urgente",
  },
  // Gestión de la app móvil de clientes. Por ahora solo administradores (igual que en
  // la intranet anterior); aquí se irán sumando las demás secciones de la app.
  {
    label: "App",
    icon: Smartphone,
    rolesPermitidos: ["Administrador"],
    children: [
      { label: "Gestión de usuarios", href: "/app/usuarios" },
      { label: "Notificaciones", href: "/app/notificaciones" },
      { label: "Diagnóstico", href: "/app/diagnostico" },
    ],
  },
]

const NAV_ITEMS_SECUNDARIOS: NavItem[] = [
  {
    label: "Promociones",
    icon: Tag,
    href: "/configuracion/promociones",
    permiso: "promociones:gestionar",
    rolesExcluidos: ["Administrador"],
  },
  // Mismo motivo que Promociones (ver comentario arriba): item independiente gateado
  // por permiso puntual, no anidado bajo "Admin" (rolesPermitidos-only).
  {
    label: "Convenios",
    icon: FileText,
    href: "/configuracion/convenios",
    permiso: "convenios:gestionar",
    rolesExcluidos: ["Administrador"],
  },
  {
    label: "Configuración",
    icon: Settings,
    href: "/configuracion",
    rolesPermitidos: ["Administrador"],
  },
  {
    label: "Auditoria",
    icon: ShieldCheck,
    href: "/admin/auditoria",
    rolesPermitidos: ["Administrador"],
  },
]

function usuarioPuedeVer(
  usuario: AuthenticatedUser,
  item: {
    rolesPermitidos?: string[]
    rolesExcluidos?: string[]
    permiso?: Permiso
    permisoExplicito?: boolean
    permisosAlguno?: Permiso[]
  }
): boolean {
  if (
    item.rolesPermitidos &&
    !item.rolesPermitidos.some((rol) => usuario.roles.includes(rol))
  ) {
    return false
  }
  if (item.rolesExcluidos?.some((rol) => usuario.roles.includes(rol))) return false
  if (item.permiso) {
    const [recurso, accion] = item.permiso.split(":")
    const autorizado = item.permisoExplicito
      ? tienePermisoExplicito(usuario, recurso ?? "", accion ?? "")
      : can(usuario, recurso ?? "", accion ?? "")
    if (!autorizado) return false
  }
  if (item.permisosAlguno) {
    const alguno = item.permisosAlguno.some((permiso) => {
      const [recurso, accion] = permiso.split(":")
      return tienePermisoExplicito(usuario, recurso ?? "", accion ?? "")
    })
    if (!alguno) return false
  }
  return true
}

// El rol (rolesPermitidos) habilita la sección en general; el permiso puntual de cada
// hijo decide si esa página concreta se ve, así un override por-usuario (denegar un
// permiso aunque el rol lo dé) puede ocultar un item sin tener que tocarle el rol.
// Si un grupo define hijos y ninguno sobrevive el filtro de permisos, se oculta el
// grupo entero (no tiene sentido mostrar una sección vacía).
function filtrarPorAcceso(items: NavItem[], usuario: AuthenticatedUser): NavItem[] {
  const resultado: NavItem[] = []
  for (const item of items) {
    if (!usuarioPuedeVer(usuario, item)) continue
    if (!item.children) {
      resultado.push(item)
      continue
    }
    const hijosVisibles = item.children.filter((hijo) => usuarioPuedeVer(usuario, hijo))
    if (item.children.length > 0 && hijosVisibles.length === 0) continue
    resultado.push({ ...item, children: hijosVisibles })
  }
  return resultado
}

function coincideConBusqueda(item: NavItem, query: string): boolean {
  if (!query) return true
  const texto = query.toLowerCase()
  if (item.label.toLowerCase().includes(texto)) return true
  return item.children?.some((hijo) => hijo.label.toLowerCase().includes(texto)) ?? false
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("")
}

function NavIcon({ icon: Icon }: { icon: NavItem["icon"] }) {
  return <Icon className="size-4 shrink-0" />
}

const SIDEBAR_COLLAPSED_KEY = "anconnet:sidebar-colapsado"
const ESCRITORIO_QUERY = "(min-width: 1024px)"

// El modo icono-solo (colapsado) solo tiene sentido en escritorio: en mobile/tablet el
// sidebar es un drawer que se abre/cierra encima del contenido, siempre a ancho
// completo. Sin esto, una preferencia de "colapsado" guardada en escritorio dejaria el
// drawer mobile mostrando solo iconos, que es inutilizable con dedos.
function useEsEscritorio(): boolean {
  const [esEscritorio, setEsEscritorio] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia(ESCRITORIO_QUERY)
    const actualizar = () => setEsEscritorio(mq.matches)
    actualizar()
    mq.addEventListener("change", actualizar)
    return () => mq.removeEventListener("change", actualizar)
  }, [])
  return esEscritorio
}

export function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())
  const pathname = usePathname()
  const router = useRouter()
  const usuario = useSession()
  const esEscritorio = useEsEscritorio()
  const { mobileOpen, cerrarMenu } = useSidebarMobile()

  // El colapsado icono-solo es una preferencia de escritorio: se recuerda entre
  // recargas/sesiones del navegador (localStorage), no entre dispositivos.
  useEffect(() => {
    const guardado = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (guardado !== null) setCollapsed(guardado === "1")
  }, [])

  // El efecto de arriba corrige `collapsed` de forma asincrona (setState), asi que en
  // el primer render este efecto de escritura todavia veria el valor por defecto
  // (false) y pisaria lo guardado antes de que la lectura llegue a aplicarse. Se salta
  // su primera corrida para no correr esa carrera; despues escribe en cada cambio real.
  const primerRenderRef = useRef(true)
  useEffect(() => {
    if (primerRenderRef.current) {
      primerRenderRef.current = false
      return
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0")
  }, [collapsed])

  // Al pasar a escritorio con el drawer mobile abierto (ej. rotar/agrandar la ventana),
  // lo cerramos: en escritorio el sidebar ya es parte fija del layout.
  useEffect(() => {
    if (esEscritorio) cerrarMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esEscritorio])

  // Cierra el drawer al navegar (mobile/tablet) — en escritorio no hace nada porque el
  // drawer ya esta cerrado.
  useEffect(() => {
    cerrarMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const modoIconoSolo = collapsed && esEscritorio

  // Cierra la sesion de Better Auth (fetch al backend, que la revoca y limpia su cookie
  // via Set-Cookie) y navega a /login con el router del cliente.
  async function cerrarSesion() {
    // La copia offline del catálogo (ver public/sw.js) es de este usuario — no debe
    // quedar en el dispositivo para el siguiente que inicie sesión.
    // Respaldos locales de borradores (datos del cliente): no tienen que quedar en el
    // equipo. El borrador del servidor se conserva para cuando vuelva a entrar.
    borrarRespaldosLocales()
    try {
      await caches.delete("anconnet-paginas-offline")
    } catch {
      // sin Cache API (http en red local, navegador viejo): no hay nada que borrar
    }
    try {
      await signOut()
    } catch {
      // seguimos igual: navegamos a /login de todas formas
    }
    router.push("/login")
    router.refresh()
  }

  function alternarGrupo(label: string) {
    setGruposAbiertos((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(label)) siguiente.delete(label)
      else siguiente.add(label)
      return siguiente
    })
  }

  const principales = useMemo(
    () =>
      filtrarPorAcceso(NAV_ITEMS, usuario).filter((item) =>
        coincideConBusqueda(item, busqueda)
      ),
    [busqueda, usuario]
  )
  const secundarios = useMemo(
    () =>
      filtrarPorAcceso(NAV_ITEMS_SECUNDARIOS, usuario).filter((item) =>
        coincideConBusqueda(item, busqueda)
      ),
    [busqueda, usuario]
  )

  function renderItem(item: NavItem) {
    const activo = item.href ? pathname === item.href : false
    const abierto = gruposAbiertos.has(item.label)
    const tieneHijos = (item.children?.length ?? 0) > 0
    const disponible = Boolean(item.href) || tieneHijos

    const contenidoBase = (
      <span
        className={cn(
          "flex flex-1 items-center gap-3 truncate",
          modoIconoSolo && "justify-center"
        )}
      >
        <NavIcon icon={item.icon} />
        {!modoIconoSolo && (
          <span className="flex-1 truncate text-left">{item.label}</span>
        )}
      </span>
    )

    const clasesFila = cn(
      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors",
      disponible && "hover:bg-sidebar-accent",
      !disponible && "cursor-default opacity-60",
      activo && "bg-sidebar-accent text-sidebar-accent-foreground",
      modoIconoSolo && "justify-center px-0"
    )

    const fila = item.href ? (
      <Link key={item.label} href={item.href} className={clasesFila}>
        {contenidoBase}
      </Link>
    ) : (
      <button
        key={item.label}
        type="button"
        onClick={() => tieneHijos && alternarGrupo(item.label)}
        className={clasesFila}
      >
        {contenidoBase}
        {!modoIconoSolo && tieneHijos && (
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform",
              abierto && "rotate-180"
            )}
          />
        )}
        {!modoIconoSolo && !tieneHijos && (
          <Badge variant="outline" className="shrink-0 text-[0.65rem]">
            Pronto
          </Badge>
        )}
      </button>
    )

    // Colapsado + con hijos: un tooltip no alcanza (solo muestra el nombre, no deja
    // llegar a "Nueva Venta" etc.) — se abre un flyout a la derecha con los hijos, en
    // vez del acordeon que se usa cuando el sidebar esta expandido.
    if (modoIconoSolo && tieneHijos) {
      return (
        <div key={item.label}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{fila}</DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={8}
              className="min-w-52"
            >
              <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
              {item.children!.map((hijo) =>
                hijo.href ? (
                  <DropdownMenuItem key={hijo.label} asChild>
                    <Link href={hijo.href}>{hijo.label}</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={hijo.label} disabled className="justify-between">
                    <span>{hijo.label}</span>
                    <Badge variant="outline" className="shrink-0 text-[0.6rem]">
                      Pronto
                    </Badge>
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }

    const filaConTooltip = modoIconoSolo ? (
      <Tooltip key={item.label}>
        <TooltipTrigger asChild>{fila}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    ) : (
      fila
    )

    if (modoIconoSolo || !tieneHijos || !abierto) {
      return <div key={item.label}>{filaConTooltip}</div>
    }

    return (
      <div key={item.label}>
        {filaConTooltip}
        <div className="border-sidebar-border ml-4 space-y-0.5 border-l pl-3">
          {item.children!.map((hijo) => {
            const hijoActivo = hijo.href ? pathname === hijo.href : false
            const contenidoHijo = (
              <>
                <span className="truncate">{hijo.label}</span>
                {!hijo.href && (
                  <Badge variant="outline" className="shrink-0 text-[0.65rem]">
                    Pronto
                  </Badge>
                )}
              </>
            )

            if (hijo.href) {
              return (
                <Link
                  key={hijo.label}
                  href={hijo.href}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    hijoActivo
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {contenidoHijo}
                </Link>
              )
            }

            return (
              <div
                key={hijo.label}
                className="text-muted-foreground flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                {contenidoHijo}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Fondo oscuro detras del drawer en mobile/tablet — tocarlo lo cierra. En
          escritorio el sidebar es parte fija del layout, nunca se renderiza. El boton
          que ABRE el drawer vive en el encabezado de cada pagina (AppTopbar /
          ProjectTabsBar), no aca — ver SidebarMobileProvider. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={cerrarMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col border-r pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:h-full lg:translate-x-0 lg:pt-0 lg:pb-0 lg:transition-[width]",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <div className="border-sidebar-border flex h-14 items-center gap-2 border-b px-4">
          <Image
            src="/icons/ancon-isotipo.png"
            alt="Grupo Ancon"
            width={24}
            height={22}
            className="size-6 shrink-0 object-contain"
            priority
          />
          {!modoIconoSolo && (
            <div className="min-w-0 flex-1 truncate leading-tight">
              <p className="text-sidebar-foreground truncate text-sm font-semibold">
                Anconnet
              </p>
              <p className="text-muted-foreground truncate text-[0.7rem] uppercase">
                Grupo Inmobiliario
              </p>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Cerrar menu"
            onClick={cerrarMenu}
          >
            <X className="size-5" />
          </Button>
        </div>

        {!modoIconoSolo && (
          <div className="border-sidebar-border border-b p-2">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar..."
                className="pl-8"
              />
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {principales.map(renderItem)}
        </nav>

        <div className="border-sidebar-border space-y-1 border-t p-2">
          {secundarios.map(renderItem)}
        </div>

        <div className="border-sidebar-border border-t p-2">
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-1 py-1",
              modoIconoSolo && "hidden"
            )}
          >
            <Avatar className="size-8">
              <AvatarFallback>{iniciales(usuario.nombre)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate leading-tight">
              <p className="text-sidebar-foreground truncate text-sm font-medium">
                {usuario.nombre}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {usuario.roles.join(", ") || "Sin rol"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesion"
              onClick={() => void cerrarSesion()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>

          <div
            className={cn("hidden flex-col items-center gap-2", modoIconoSolo && "flex")}
          >
            <Avatar className="size-8">
              <AvatarFallback>{iniciales(usuario.nombre)}</AvatarFallback>
            </Avatar>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesion"
              onClick={() => void cerrarSesion()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="mt-1 hidden w-full lg:flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>
      </aside>
    </>
  )
}
