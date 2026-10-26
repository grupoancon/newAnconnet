"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  MonitorSmartphone,
  ShieldEllipsis,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { PageHeader } from "@/components/shared/page-header"
import { useEstaEnLinea } from "@/components/shared/presencia-provider"
import { RowActionButton, RowActions } from "@/components/shared/row-actions"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AdminApiError,
  banUser,
  listUsers,
  removeUser,
  unbanUser,
  type UsuarioAdmin,
} from "@/lib/api/admin-api"
import { cn } from "@/lib/utils"
import { accionContarPermisosDeUsuarios } from "@/server/actions/rbac"

import { UsuarioFormSheet } from "./usuario-form-sheet"
import { UsuarioPasswordSheet } from "./usuario-password-sheet"
import { UsuarioPermisosSheet } from "./usuario-permisos-sheet"
import { UsuarioSesionesSheet } from "./usuario-sesiones-sheet"

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("")
}

export function UsuariosContent() {
  const estaEnLinea = useEstaEnLinea()
  const toast = useToast()
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<UsuarioAdmin | null>(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [usuarioPermisos, setUsuarioPermisos] = useState<UsuarioAdmin | null>(null)
  const [usuarioSesiones, setUsuarioSesiones] = useState<UsuarioAdmin | null>(null)
  const [usuarioPassword, setUsuarioPassword] = useState<UsuarioAdmin | null>(null)
  const [idsEnAccion, setIdsEnAccion] = useState<Set<string>>(new Set())
  const [conteoPermisos, setConteoPermisos] = useState<Record<string, number>>({})

  useEffect(() => {
    cargarUsuarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cargarUsuarios() {
    setError(null)
    listUsers({ limit: 200, sortBy: "name", sortDirection: "asc" })
      .then((respuesta) => {
        setUsuarios(respuesta.users)
        return accionContarPermisosDeUsuarios(respuesta.users.map((u) => u.id))
      })
      .then((res) => {
        if (res?.ok) setConteoPermisos(res.conteos)
      })
      .catch((err) => {
        setError(
          err instanceof AdminApiError
            ? err.message
            : "No se pudo conectar con el servidor"
        )
      })
  }

  function marcarEnAccion(id: string, activo: boolean) {
    setIdsEnAccion((actual) => {
      const siguiente = new Set(actual)
      if (activo) siguiente.add(id)
      else siguiente.delete(id)
      return siguiente
    })
  }

  function actualizarEnLista(usuarioActualizado: UsuarioAdmin) {
    setUsuarios((actual) =>
      actual
        ? actual.map((u) => (u.id === usuarioActualizado?.id ? usuarioActualizado : u))
        : actual
    )
  }

  async function alternarBaneo(usuario: UsuarioAdmin) {
    marcarEnAccion(usuario.id, true)
    try {
      const { user } = usuario.banned
        ? await unbanUser(usuario.id)
        : await banUser(usuario.id)
      actualizarEnLista(user)
      toast({
        variant: "success",
        description: usuario.banned ? "Usuario reactivado." : "Usuario suspendido.",
      })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo actualizar el estado",
        description: err instanceof AdminApiError ? err.message : "Intenta de nuevo.",
      })
    } finally {
      marcarEnAccion(usuario.id, false)
    }
  }

  async function eliminar(usuario: UsuarioAdmin) {
    if (
      !window.confirm(`¿Eliminar a ${usuario.name}? Esta acción no se puede deshacer.`)
    ) {
      return
    }
    marcarEnAccion(usuario.id, true)
    try {
      await removeUser(usuario.id)
      setUsuarios((actual) =>
        actual ? actual.filter((u) => u.id !== usuario.id) : actual
      )
      toast({ variant: "success", description: "Usuario eliminado." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo eliminar",
        description: err instanceof AdminApiError ? err.message : "Intenta de nuevo.",
      })
      marcarEnAccion(usuario.id, false)
    }
  }

  const usuariosFiltrados = useMemo(() => {
    if (!usuarios) return []
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return usuarios
    return usuarios.filter(
      (u) =>
        u.name.toLowerCase().includes(termino) || u.email.toLowerCase().includes(termino)
    )
  }, [usuarios, busqueda])

  const kpis = useMemo(() => {
    const lista = usuarios ?? []
    return {
      total: lista.length,
      activos: lista.filter((u) => !u.banned).length,
      suspendidos: lista.filter((u) => u.banned).length,
      administradores: lista.filter((u) => u.role === "admin").length,
    }
  }, [usuarios])

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 sm:gap-3.5 lg:grid-cols-4">
          <div className="bg-card border-border border-status-hipotecado rounded-lg border border-l-[3px] p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="bg-status-hipotecado-bg flex size-7.5 items-center justify-center rounded-md">
                <Users
                  className="text-status-hipotecado-fg size-[15px]"
                  strokeWidth={1.6}
                />
              </div>
              <span className="text-muted-foreground text-[12.5px] font-bold">Total</span>
            </div>
            <div className="font-mono text-2xl font-semibold">{kpis.total}</div>
            <div className="text-muted-foreground text-[11.5px]">Usuarios</div>
          </div>

          <div className="bg-card border-border border-status-disponible rounded-lg border border-l-[3px] p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="bg-status-disponible-bg flex size-7.5 items-center justify-center rounded-md">
                <CheckCircle2
                  className="text-status-disponible-fg size-[15px]"
                  strokeWidth={1.6}
                />
              </div>
              <span className="text-muted-foreground text-[12.5px] font-bold">
                Activos
              </span>
            </div>
            <div className="font-mono text-2xl font-semibold">{kpis.activos}</div>
            <div className="text-muted-foreground text-[11.5px]">Usuarios</div>
          </div>

          <div className="bg-card border-border border-status-bloqueado rounded-lg border border-l-[3px] p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="bg-status-bloqueado-bg flex size-7.5 items-center justify-center rounded-md">
                <Ban className="text-status-bloqueado-fg size-[15px]" strokeWidth={1.6} />
              </div>
              <span className="text-muted-foreground text-[12.5px] font-bold">
                Suspendidos
              </span>
            </div>
            <div className="font-mono text-2xl font-semibold">{kpis.suspendidos}</div>
            <div className="text-muted-foreground text-[11.5px]">Usuarios</div>
          </div>

          <div className="bg-card border-border border-primary rounded-lg border border-l-[3px] p-4">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="bg-accent flex size-7.5 items-center justify-center rounded-md">
                <ShieldCheck
                  className="text-accent-foreground size-[15px]"
                  strokeWidth={1.6}
                />
              </div>
              <span className="text-muted-foreground text-[12.5px] font-bold">
                Administradores
              </span>
            </div>
            <div className="font-mono text-2xl font-semibold">{kpis.administradores}</div>
            <div className="text-muted-foreground text-[11.5px]">Acceso total</div>
          </div>
        </div>

        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Admin · Usuarios"
            title="Usuarios"
            actions={
              <Button
                size="sm"
                onClick={() => {
                  setUsuarioEnEdicion(null)
                  setFormularioAbierto(true)
                }}
              >
                <UserPlus className="size-3.5" strokeWidth={2} />
                Nuevo usuario
              </Button>
            }
          />

          <FilterBar>
            <div className="border-input bg-card focus-within:border-primary focus-within:ring-ring/15 flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-md border px-3 focus-within:ring-3 sm:w-65 sm:flex-none">
              <Search
                className="text-muted-foreground size-[15px] shrink-0"
                strokeWidth={1.7}
              />
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por nombre o correo…"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
              />
            </div>
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {usuarios ? `${usuariosFiltrados.length} usuarios` : "…"}
            </span>
          </FilterBar>

          {!usuarios && !error ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-4 sm:p-6.5">
              <EmptyState title="No se pudo cargar la lista" description={error} dashed />
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="p-4 sm:p-6.5">
              <EmptyState title="Sin resultados" description="Ningún usuario coincide." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="text-muted-foreground bg-muted/60 border-border hidden min-w-[900px] grid-cols-[2.2fr_1.3fr_1fr_1fr_170px] border-b px-6.5 py-2.75 text-[11px] font-bold tracking-wide md:grid">
                <span>USUARIO</span>
                <span>CARGO / DEPTO.</span>
                <span>ROL</span>
                <span>ESTADO</span>
                <span className="text-right">ACCIONES</span>
              </div>
              {usuariosFiltrados.map((usuario, index) => {
                const enAccion = idsEnAccion.has(usuario.id)
                const totalPermisos = conteoPermisos[usuario.id] ?? 0

                return (
                  <div
                    key={usuario.id}
                    className={cn(
                      "hover:bg-muted/60 grid grid-cols-2 items-center gap-x-3 gap-y-2.5 px-4 py-3.5 text-[13px] transition-colors md:min-w-[900px] md:grid-cols-[2.2fr_1.3fr_1fr_1fr_170px] md:gap-y-0 md:px-6.5",
                      index < usuariosFiltrados.length - 1 && "border-border border-b",
                      enAccion && "opacity-60"
                    )}
                  >
                    <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                      <div className="relative">
                        <Avatar className="size-8.5">
                          <AvatarFallback className="bg-accent text-accent-foreground text-[11px] font-bold">
                            {iniciales(usuario.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "border-card absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2",
                            estaEnLinea(usuario.id)
                              ? "bg-status-disponible"
                              : "bg-muted-foreground/40"
                          )}
                          title={estaEnLinea(usuario.id) ? "En línea" : "Desconectado"}
                          role="img"
                          aria-label={
                            estaEnLinea(usuario.id) ? "En línea" : "Desconectado"
                          }
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-bold">{usuario.name}</div>
                        <div className="text-muted-foreground truncate text-[11.5px]">
                          {usuario.email}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <div className="truncate text-[12.5px]">{usuario.cargo || "—"}</div>
                      <div className="text-muted-foreground truncate text-[11px]">
                        {usuario.departamento || "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={usuario.role === "admin" ? "default" : "secondary"}
                        className="rounded-full text-[10.5px] font-bold"
                      >
                        {usuario.role === "admin" ? "Administrador" : "Usuario"}
                      </Badge>
                      {totalPermisos > 0 ? (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10.5px] font-bold"
                        >
                          {totalPermisos} permiso{totalPermisos === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="justify-self-end md:justify-self-auto">
                      <StatusBadge variant={usuario.banned ? "bloqueado" : "disponible"}>
                        {usuario.banned ? "Suspendido" : "Activo"}
                      </StatusBadge>
                    </span>
                    <RowActions className="border-border col-span-2 justify-end border-t pt-2.5 md:col-span-1 md:border-t-0 md:pt-0">
                      <RowActionButton
                        icon={<Pencil className="size-3.5" strokeWidth={1.8} />}
                        label="Editar usuario"
                        onClick={() => {
                          setUsuarioEnEdicion(usuario)
                          setFormularioAbierto(true)
                        }}
                      />
                      <RowActionButton
                        icon={<ShieldEllipsis className="size-3.5" strokeWidth={1.8} />}
                        label="Permisos"
                        onClick={() => setUsuarioPermisos(usuario)}
                      />
                      <RowActionButton
                        icon={
                          <MonitorSmartphone className="size-3.5" strokeWidth={1.8} />
                        }
                        label="Sesiones y dispositivos"
                        onClick={() => setUsuarioSesiones(usuario)}
                      />
                      <RowActionButton
                        icon={<KeyRound className="size-3.5" strokeWidth={1.8} />}
                        label="Cambiar contraseña"
                        onClick={() => setUsuarioPassword(usuario)}
                      />
                      {usuario.banned ? (
                        <RowActionButton
                          variant="success"
                          icon={<CheckCircle2 className="size-3.5" strokeWidth={1.8} />}
                          label="Reactivar usuario"
                          onClick={() => void alternarBaneo(usuario)}
                        />
                      ) : (
                        <RowActionButton
                          variant="danger"
                          icon={<Ban className="size-3.5" strokeWidth={1.8} />}
                          label="Suspender usuario"
                          onClick={() => void alternarBaneo(usuario)}
                        />
                      )}
                      <RowActionButton
                        variant="danger"
                        icon={<Trash2 className="size-3.5" strokeWidth={1.8} />}
                        label="Eliminar usuario"
                        onClick={() => void eliminar(usuario)}
                      />
                    </RowActions>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <UsuarioFormSheet
        usuario={usuarioEnEdicion}
        open={formularioAbierto}
        onOpenChange={setFormularioAbierto}
        onGuardado={(usuario) => {
          if (usuarioEnEdicion) {
            actualizarEnLista(usuario)
          } else {
            setUsuarios((actual) => (actual ? [usuario, ...actual] : [usuario]))
          }
        }}
      />

      <UsuarioPasswordSheet
        usuario={usuarioPassword}
        onOpenChange={(abierto) => {
          if (!abierto) setUsuarioPassword(null)
        }}
      />

      <UsuarioSesionesSheet
        usuario={usuarioSesiones}
        onOpenChange={(open) => {
          if (!open) setUsuarioSesiones(null)
        }}
      />

      <UsuarioPermisosSheet
        usuario={usuarioPermisos}
        onOpenChange={(open) => {
          if (!open) setUsuarioPermisos(null)
        }}
        onGuardado={cargarUsuarios}
      />
    </div>
  )
}
