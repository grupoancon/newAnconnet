"use client"

import { Fragment, useEffect, useMemo, useState, useTransition } from "react"
import {
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Shield,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Spinner } from "@/components/shared/spinner"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  accionCrearPermiso,
  accionCrearRol,
  accionEliminarPermiso,
  accionEliminarRol,
  accionListarDatos,
  accionRenombrarRol,
  accionSetPermisosDeRol,
} from "@/server/actions/rbac"
import type { PermisoRow, RolRow } from "@/lib/rbac/service"
import { cn } from "@/lib/utils"

// El rol con acceso total (bypass en can()) — su columna se resalta en la matriz.
const ROL_ADMIN = "Administrador"

type Modulo = { recurso: string; permisos: PermisoRow[] }

function plural(n: number, singular: string, pluralTexto: string) {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

// Pares de nombres que probablemente son el mismo permiso escrito distinto — uno es
// prefijo del otro con una terminación corta (venta/ventas, gestion/gestionar).
function posiblesDuplicados(nombres: string[]): [string, string][] {
  const unicos = Array.from(new Set(nombres)).sort()
  const pares: [string, string][] = []
  for (let i = 0; i < unicos.length; i++) {
    for (let j = 0; j < unicos.length; j++) {
      if (i === j) continue
      const a = normalizar(unicos[i])
      const b = normalizar(unicos[j])
      if (a.length >= 3 && b.startsWith(a) && b.length - a.length <= 3) {
        pares.push([unicos[i], unicos[j]])
      }
    }
  }
  return pares
}

function mismosIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

export function RolesContent() {
  const toast = useToast()
  const [roles, setRoles] = useState<RolRow[] | null>(null)
  const [permisos, setPermisos] = useState<PermisoRow[]>([])
  const [error, setError] = useState<string | null>(null)
  // Borrador de permisos por rol — los clics en la matriz solo tocan esto; recién
  // "Guardar cambios" lo persiste (y recompila el acceso de los usuarios afectados).
  const [borrador, setBorrador] = useState<Record<string, string[]>>({})
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [nuevoRecurso, setNuevoRecurso] = useState("")
  const [nuevaAccion, setNuevaAccion] = useState("")
  const [nuevoRolNombre, setNuevoRolNombre] = useState("")
  const [popoverRolAbierto, setPopoverRolAbierto] = useState(false)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    cargar()
  }, [])

  function cargar() {
    setError(null)
    accionListarDatos().then((res) => {
      if (res.ok) {
        setRoles(res.roles)
        setPermisos(res.permisos)
        setBorrador(Object.fromEntries(res.roles.map((r) => [r.id, r.permisoIds])))
      } else {
        setError(res.error)
      }
    })
  }

  // Administrador primero (como en la comparativa), el resto alfabético.
  const rolesOrdenados = useMemo(
    () =>
      [...(roles ?? [])].sort((a, b) =>
        a.nombre === ROL_ADMIN
          ? -1
          : b.nombre === ROL_ADMIN
            ? 1
            : a.nombre.localeCompare(b.nombre)
      ),
    [roles]
  )

  const modulos = useMemo<Modulo[]>(() => {
    const mapa = new Map<string, PermisoRow[]>()
    for (const p of permisos) {
      mapa.set(p.recurso, [...(mapa.get(p.recurso) ?? []), p])
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([recurso, lista]) => ({
        recurso,
        permisos: lista.sort((a, b) => a.accion.localeCompare(b.accion)),
      }))
  }, [permisos])

  const duplicados = useMemo(() => {
    const recursos = posiblesDuplicados(permisos.map((p) => p.recurso))
    const acciones = posiblesDuplicados(permisos.map((p) => p.accion))
    return [...recursos, ...acciones]
  }, [permisos])

  const rolesModificados = useMemo(
    () =>
      (roles ?? []).filter(
        (r) => borrador[r.id] && !mismosIds(r.permisoIds, borrador[r.id])
      ),
    [roles, borrador]
  )
  const hayCambios = rolesModificados.length > 0

  // Aviso del navegador si se intenta salir con cambios sin guardar.
  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", avisar)
    return () => window.removeEventListener("beforeunload", avisar)
  }, [hayCambios])

  function tiene(rolId: string, permisoId: string) {
    return borrador[rolId]?.includes(permisoId) ?? false
  }

  function celdaModificada(rol: RolRow, permisoId: string) {
    return rol.permisoIds.includes(permisoId) !== tiene(rol.id, permisoId)
  }

  function togglePermiso(rolId: string, permisoId: string) {
    setBorrador((actual) => {
      const ids = actual[rolId] ?? []
      return {
        ...actual,
        [rolId]: ids.includes(permisoId)
          ? ids.filter((id) => id !== permisoId)
          : [...ids, permisoId],
      }
    })
  }

  // Clic en el resumen de un módulo: si el rol ya tiene todas sus acciones se las
  // quita; si no, se las asigna todas.
  function toggleModulo(rolId: string, modulo: Modulo) {
    const idsModulo = modulo.permisos.map((p) => p.id)
    setBorrador((actual) => {
      const ids = actual[rolId] ?? []
      const tieneTodas = idsModulo.every((id) => ids.includes(id))
      return {
        ...actual,
        [rolId]: tieneTodas
          ? ids.filter((id) => !idsModulo.includes(id))
          : Array.from(new Set([...ids, ...idsModulo])),
      }
    })
  }

  function toggleExpandido(recurso: string) {
    setExpandidos((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(recurso)) nuevo.delete(recurso)
      else nuevo.add(recurso)
      return nuevo
    })
  }

  function guardarCambios() {
    if (!hayCambios) return
    startSaving(async () => {
      for (const rol of rolesModificados) {
        const res = await accionSetPermisosDeRol(rol.id, borrador[rol.id])
        if (!res.ok) {
          toast({
            variant: "error",
            title: `No se pudo guardar "${rol.nombre}"`,
            description: res.error,
          })
          cargar()
          return
        }
      }
      toast({
        variant: "success",
        description: `Se guardaron los permisos de ${plural(rolesModificados.length, "rol", "roles")}.`,
      })
      cargar()
    })
  }

  function descartarCambios() {
    setBorrador(Object.fromEntries((roles ?? []).map((r) => [r.id, r.permisoIds])))
  }

  // Las acciones que recargan desde el servidor (crear/renombrar/eliminar) pisarían
  // el borrador — se pide confirmación si hay cambios sin guardar.
  function confirmarPerderBorrador() {
    return (
      !hayCambios ||
      window.confirm(
        "Tenés cambios de permisos sin guardar que se van a perder. ¿Continuar?"
      )
    )
  }

  function crearRol() {
    const nombre = nuevoRolNombre.trim()
    if (!nombre || !confirmarPerderBorrador()) return
    startSaving(async () => {
      const res = await accionCrearRol(nombre, null, [])
      if (res.ok) {
        setNuevoRolNombre("")
        setPopoverRolAbierto(false)
        toast({ variant: "success", description: `Rol "${nombre}" creado.` })
        cargar()
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: res.error })
      }
    })
  }

  function eliminarRol(rol: RolRow) {
    if (
      !window.confirm(
        `¿Eliminar el rol "${rol.nombre}"? Sus ${rol.totalUsuarios} usuario(s) perderán los permisos que venían de este rol.`
      ) ||
      !confirmarPerderBorrador()
    ) {
      return
    }
    startSaving(async () => {
      const res = await accionEliminarRol(rol.id)
      if (res.ok) {
        toast({ variant: "success", description: "Rol eliminado." })
        cargar()
      } else {
        toast({ variant: "error", title: "No se pudo eliminar", description: res.error })
      }
    })
  }

  function renombrar(rol: RolRow) {
    const nombre = window.prompt("Nuevo nombre del rol:", rol.nombre)?.trim()
    if (!nombre || nombre === rol.nombre || !confirmarPerderBorrador()) return
    startSaving(async () => {
      const res = await accionRenombrarRol(rol.id, nombre, rol.descripcion)
      if (res.ok) {
        toast({ variant: "success", description: "Rol renombrado." })
        cargar()
      } else {
        toast({ variant: "error", title: "No se pudo renombrar", description: res.error })
      }
    })
  }

  function crearPermiso() {
    const recurso = nuevoRecurso.trim().toLowerCase()
    const accion = nuevaAccion.trim()
    if (!recurso || !accion) return
    if (permisos.some((p) => p.recurso === recurso && p.accion === accion)) {
      toast({ variant: "warning", description: "Ese permiso ya existe." })
      return
    }
    if (!confirmarPerderBorrador()) return
    startSaving(async () => {
      const res = await accionCrearPermiso(recurso, accion)
      if (res.ok) {
        setNuevoRecurso("")
        setNuevaAccion("")
        toast({
          variant: "success",
          description: `Permiso "${recurso}:${accion}" agregado.`,
        })
        cargar()
      } else {
        toast({ variant: "error", title: "No se pudo crear", description: res.error })
      }
    })
  }

  function eliminarPermiso(p: PermisoRow) {
    if (
      !window.confirm(
        `¿Eliminar el permiso "${p.recurso}:${p.accion}" del catálogo? Se quitará de todos los roles que lo usan.`
      ) ||
      !confirmarPerderBorrador()
    ) {
      return
    }
    startSaving(async () => {
      const res = await accionEliminarPermiso(p.id)
      if (res.ok) {
        toast({ variant: "success", description: "Permiso eliminado." })
        cargar()
      } else {
        toast({ variant: "error", title: "No se pudo eliminar", description: res.error })
      }
    })
  }

  const todosExpandidos = modulos.length > 0 && expandidos.size === modulos.length

  const acciones = (
    <>
      <Popover open={popoverRolAbierto} onOpenChange={setPopoverRolAbierto}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <Plus className="size-4" strokeWidth={2} />
            Nuevo rol
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
            Nombre del rol
          </label>
          <input
            autoFocus
            value={nuevoRolNombre}
            onChange={(e) => setNuevoRolNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crearRol()}
            placeholder="ej. Supervisor de cobranzas"
            className="border-input bg-card focus:border-primary focus:ring-ring/15 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3"
          />
          <Button
            className="mt-2.5 w-full"
            onClick={crearRol}
            disabled={!nuevoRolNombre.trim() || isSaving}
          >
            Crear rol
          </Button>
        </PopoverContent>
      </Popover>
      {hayCambios && (
        <Button variant="ghost" onClick={descartarCambios} disabled={isSaving}>
          Descartar
        </Button>
      )}
      <Button onClick={guardarCambios} disabled={!hayCambios || isSaving}>
        {isSaving ? (
          <Spinner className="border-primary-foreground/40 border-t-primary-foreground size-3.5 border-2" />
        ) : null}
        Guardar cambios
        {hayCambios ? (
          <span className="bg-primary-foreground/25 rounded-full px-1.5 text-[11px] font-bold">
            {rolesModificados.length}
          </span>
        ) : null}
      </Button>
    </>
  )

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6.5">
        <div className="bg-card border-border overflow-hidden rounded-lg border shadow-sm">
          <PageHeader
            eyebrow="Admin · Roles y permisos"
            title="Roles y permisos"
            actions={roles ? acciones : undefined}
          />

          {!roles && !error ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-4 sm:p-6.5">
              <EmptyState title="No se pudo cargar" description={error} dashed />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px]">
              {/* Matriz comparativa */}
              <div className="min-w-0 p-4 sm:p-5 lg:p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-muted-foreground text-[13px] leading-relaxed">
                    Compará qué puede hacer cada rol. Hacé clic en una celda para asignar
                    o quitar el permiso; al guardar se recompila el acceso de los usuarios
                    afectados.
                  </p>
                  {modulos.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandidos(
                          todosExpandidos
                            ? new Set()
                            : new Set(modulos.map((m) => m.recurso))
                        )
                      }
                      className="text-primary shrink-0 text-xs font-semibold hover:underline"
                    >
                      {todosExpandidos ? "Contraer todo" : "Expandir todo"}
                    </button>
                  )}
                </div>

                {rolesOrdenados.length === 0 ? (
                  <EmptyState
                    title="Todavía no hay roles"
                    description='Creá el primero con "Nuevo rol".'
                    dashed
                  />
                ) : (
                  <div className="border-border overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-border border-b">
                          <th className="bg-muted/60 text-muted-foreground sticky left-0 z-10 w-[240px] px-4 py-3 text-left align-bottom text-[11px] font-bold tracking-wide">
                            PERMISO
                          </th>
                          {rolesOrdenados.map((rol) => {
                            const esAdmin = rol.nombre === ROL_ADMIN
                            const totalBorrador = borrador[rol.id]?.length ?? 0
                            const modificado = rolesModificados.some(
                              (r) => r.id === rol.id
                            )
                            return (
                              <th
                                key={rol.id}
                                className={cn(
                                  "min-w-[150px] px-3 py-3 text-left align-top font-normal",
                                  esAdmin ? "bg-primary/10" : "bg-muted/60"
                                )}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 text-[13px] font-bold",
                                        esAdmin && "text-primary"
                                      )}
                                    >
                                      <Shield
                                        className="size-3.5 shrink-0"
                                        strokeWidth={2}
                                      />
                                      <span className="truncate">{rol.nombre}</span>
                                      {modificado && (
                                        <span
                                          className="bg-primary size-1.5 shrink-0 rounded-full"
                                          title="Cambios sin guardar"
                                        />
                                      )}
                                    </div>
                                    <div className="text-muted-foreground mt-0.5 text-[11.5px]">
                                      {plural(rol.totalUsuarios, "usuario", "usuarios")} ·{" "}
                                      {plural(totalBorrador, "permiso", "permisos")}
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground -mt-1 -mr-1 size-7 shrink-0"
                                        aria-label={`Opciones de ${rol.nombre}`}
                                      >
                                        <MoreHorizontal className="size-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      <DropdownMenuItem onSelect={() => renombrar(rol)}>
                                        <Pencil className="size-3.5" />
                                        Renombrar
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onSelect={() => eliminarRol(rol)}
                                        className="text-status-bloqueado-fg focus:text-status-bloqueado-fg"
                                      >
                                        <Trash2 className="size-3.5" />
                                        Eliminar rol
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {modulos.map((modulo) => {
                          const abierto = expandidos.has(modulo.recurso)
                          return (
                            <Fragment key={modulo.recurso}>
                              <tr className="border-border group border-b last:border-b-0">
                                <td className="bg-card group-hover:bg-muted/40 sticky left-0 z-10 p-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandido(modulo.recurso)}
                                    aria-expanded={abierto}
                                    className="flex w-full items-center gap-2 px-4 py-3 text-left"
                                  >
                                    <ChevronRight
                                      className={cn(
                                        "text-muted-foreground size-3.5 shrink-0 transition-transform duration-200",
                                        abierto && "rotate-90"
                                      )}
                                      strokeWidth={2.2}
                                    />
                                    <span className="font-mono text-[13px] font-bold">
                                      {modulo.recurso}
                                    </span>
                                    <span className="text-muted-foreground text-[11.5px]">
                                      {plural(
                                        modulo.permisos.length,
                                        "acción",
                                        "acciones"
                                      )}
                                    </span>
                                  </button>
                                </td>
                                {rolesOrdenados.map((rol) => {
                                  const esAdmin = rol.nombre === ROL_ADMIN
                                  const asignadas = modulo.permisos.filter((p) =>
                                    tiene(rol.id, p.id)
                                  ).length
                                  const total = modulo.permisos.length
                                  const modificado = modulo.permisos.some((p) =>
                                    celdaModificada(rol, p.id)
                                  )
                                  return (
                                    <td
                                      key={rol.id}
                                      className={cn(
                                        "px-3 py-2 text-center",
                                        esAdmin
                                          ? "bg-primary/5"
                                          : "group-hover:bg-muted/40"
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => toggleModulo(rol.id, modulo)}
                                        title={
                                          asignadas === total
                                            ? `Quitar todo ${modulo.recurso} a ${rol.nombre}`
                                            : `Asignar todo ${modulo.recurso} a ${rol.nombre}`
                                        }
                                        className={cn(
                                          "focus-visible:ring-ring/40 inline-flex h-6 min-w-11 items-center justify-center rounded-full px-2.5 text-[11.5px] font-bold transition-colors outline-none focus-visible:ring-3",
                                          asignadas === 0 &&
                                            "text-muted-foreground/60 hover:bg-muted font-normal",
                                          asignadas > 0 &&
                                            asignadas < total &&
                                            "bg-primary/12 text-primary hover:bg-primary/20",
                                          asignadas === total &&
                                            "bg-primary text-primary-foreground hover:bg-primary/90",
                                          modificado &&
                                            "ring-primary/40 ring-2 ring-offset-1"
                                        )}
                                      >
                                        {asignadas === 0
                                          ? "—"
                                          : asignadas === total
                                            ? "Todo"
                                            : `${asignadas}/${total}`}
                                      </button>
                                    </td>
                                  )
                                })}
                              </tr>
                              {abierto &&
                                modulo.permisos.map((permiso) => (
                                  <tr
                                    key={permiso.id}
                                    className="border-border group/fila border-b"
                                  >
                                    <td className="bg-card text-foreground/80 sticky left-0 z-10 py-2.5 pr-4 pl-11 font-mono text-[12.5px]">
                                      {permiso.accion}
                                    </td>
                                    {rolesOrdenados.map((rol) => {
                                      const esAdmin = rol.nombre === ROL_ADMIN
                                      const incluido = tiene(rol.id, permiso.id)
                                      return (
                                        <td
                                          key={rol.id}
                                          className={cn(
                                            "py-2.5 text-center",
                                            esAdmin
                                              ? "bg-primary/5"
                                              : "group-hover/fila:bg-muted/50"
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              "inline-flex rounded-md p-0.5",
                                              celdaModificada(rol, permiso.id) &&
                                                "ring-primary/40 ring-2"
                                            )}
                                          >
                                            <Checkbox
                                              checked={incluido}
                                              onCheckedChange={() =>
                                                togglePermiso(rol.id, permiso.id)
                                              }
                                              aria-label={`${rol.nombre}: ${permiso.recurso}:${permiso.accion}`}
                                            />
                                          </span>
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Catálogo de permisos */}
              <aside className="border-border bg-muted/30 border-t p-4 sm:p-5 xl:border-t-0 xl:border-l">
                <h2 className="text-[17px] font-extrabold tracking-tight">
                  Catálogo de permisos
                </h2>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                  {plural(permisos.length, "permiso", "permisos")} en{" "}
                  {plural(modulos.length, "módulo", "módulos")}
                </p>

                <div className="bg-card border-border mt-4 rounded-lg border p-3.5">
                  <label className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Módulo
                  </label>
                  <input
                    value={nuevoRecurso}
                    onChange={(e) => setNuevoRecurso(e.target.value)}
                    placeholder="ej. ventas"
                    list="catalogo-modulos"
                    className="border-input bg-card focus:border-primary focus:ring-ring/15 h-10 w-full rounded-md border px-3 font-mono text-sm outline-none focus:ring-3"
                  />
                  <datalist id="catalogo-modulos">
                    {modulos.map((m) => (
                      <option key={m.recurso} value={m.recurso} />
                    ))}
                  </datalist>
                  <label className="text-muted-foreground mt-3 mb-1.5 block text-xs font-semibold">
                    Acción
                  </label>
                  <input
                    value={nuevaAccion}
                    onChange={(e) => setNuevaAccion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && crearPermiso()}
                    placeholder="ej. ver"
                    className="border-input bg-card focus:border-primary focus:ring-ring/15 h-10 w-full rounded-md border px-3 font-mono text-sm outline-none focus:ring-3"
                  />
                  <Button
                    className="mt-3 w-full"
                    onClick={crearPermiso}
                    disabled={!nuevoRecurso.trim() || !nuevaAccion.trim() || isSaving}
                  >
                    Agregar al catálogo
                  </Button>
                </div>

                {duplicados.length > 0 && (
                  <div className="border-status-bloqueado-fg/20 bg-status-bloqueado-bg text-status-bloqueado-fg mt-4 flex gap-2 rounded-lg border p-3 text-[12.5px] leading-relaxed">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
                    <p>
                      <span className="font-bold">Posibles duplicados: </span>
                      {duplicados.map(([a, b], i) => (
                        <span key={`${a}-${b}`}>
                          <span className="font-mono">
                            {a} / {b}
                          </span>
                          {i < duplicados.length - 2
                            ? ", "
                            : i === duplicados.length - 2
                              ? " y "
                              : "."}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  {modulos.map((modulo) => (
                    <div key={modulo.recurso}>
                      <div className="mb-1.5 font-mono text-[12.5px] font-bold">
                        {modulo.recurso}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {modulo.permisos.map((p) => (
                          <span
                            key={p.id}
                            className="bg-card border-border flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 font-mono text-[12px]"
                          >
                            {p.accion}
                            <button
                              type="button"
                              onClick={() => eliminarPermiso(p)}
                              aria-label={`Eliminar ${p.recurso}:${p.accion}`}
                              className="text-muted-foreground hover:text-status-bloqueado-fg rounded p-0.5 transition-colors"
                            >
                              <Trash2 className="size-3" strokeWidth={2} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
