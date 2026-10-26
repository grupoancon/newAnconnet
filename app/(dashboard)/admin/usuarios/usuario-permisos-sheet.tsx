"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { ChevronRight, Search, ShieldEllipsis, X } from "lucide-react"

import { useToast } from "@/components/shared/toast-provider"
import { Spinner } from "@/components/shared/spinner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { UsuarioAdmin } from "@/lib/api/admin-api"
import type { ModoOverride, PermisoRow, RolRow } from "@/lib/rbac/service"
import {
  accionGetOverridesDeUsuario,
  accionGetRolesDeUsuario,
  accionListarDatos,
  accionSetOverridePermiso,
  accionSetRolesDeUsuario,
} from "@/server/actions/rbac"
import { cn } from "@/lib/utils"

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("")
}

type FiltroPermisos = "todos" | "excepciones" | "con-acceso"

// Control explícito de 3 estados (en vez de ciclar tocando un solo cuadrito): "Rol"
// deja que decidan los roles, "Permitir"/"Denegar" fijan una excepción puntual.
function OverrideSegmentado({
  modo,
  heredaDelRol,
  deshabilitado,
  onChange,
}: {
  modo: ModoOverride | null
  heredaDelRol: boolean
  deshabilitado: boolean
  onChange: (modo: ModoOverride | null) => void
}) {
  const opciones: {
    valor: ModoOverride | null
    etiqueta: string
    titulo: string
    activo: string
  }[] = [
    {
      valor: null,
      etiqueta: "Rol",
      titulo: heredaDelRol
        ? "Lo decide el rol — hoy un rol se lo da"
        : "Lo decide el rol — hoy ningún rol se lo da",
      activo: "bg-card text-foreground shadow-sm",
    },
    {
      valor: "conceder",
      etiqueta: "Permitir",
      titulo: "Concedido puntualmente a este usuario",
      activo: "bg-status-disponible-bg text-status-disponible-fg shadow-sm",
    },
    {
      valor: "denegar",
      etiqueta: "Denegar",
      titulo: "Denegado puntualmente (gana aunque un rol lo dé)",
      activo: "bg-status-bloqueado-bg text-status-bloqueado-fg shadow-sm",
    },
  ]
  return (
    <div
      role="radiogroup"
      className={cn(
        "bg-muted inline-flex shrink-0 rounded-md p-0.5",
        deshabilitado && "pointer-events-none opacity-60"
      )}
    >
      {opciones.map((opcion) => {
        const seleccionado = modo === opcion.valor
        return (
          <button
            key={opcion.etiqueta}
            type="button"
            role="radio"
            aria-checked={seleccionado}
            title={opcion.titulo}
            onClick={() => !seleccionado && onChange(opcion.valor)}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95",
              seleccionado ? opcion.activo : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opcion.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

export function UsuarioPermisosSheet({
  usuario,
  onOpenChange,
  onGuardado,
}: {
  usuario: UsuarioAdmin | null
  onOpenChange: (open: boolean) => void
  onGuardado: () => void
}) {
  const toast = useToast()
  const [roles, setRoles] = useState<RolRow[] | null>(null)
  const [permisos, setPermisos] = useState<PermisoRow[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Map<string, ModoOverride>>(new Map())
  const [permisoGuardando, setPermisoGuardando] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<FiltroPermisos>("todos")
  const [modulosAbiertos, setModulosAbiertos] = useState<Set<string>>(new Set())
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    if (!usuario) return
    setRoles(null)
    setBusqueda("")
    setFiltro("todos")
    setModulosAbiertos(new Set())
    Promise.all([
      accionListarDatos(),
      accionGetRolesDeUsuario(usuario.id),
      accionGetOverridesDeUsuario(usuario.id),
    ]).then(([datos, rolesUsuario, overridesUsuario]) => {
      if (datos.ok) {
        setRoles(datos.roles)
        setPermisos(datos.permisos)
      } else {
        toast({ variant: "error", title: "No se pudo cargar", description: datos.error })
      }
      if (rolesUsuario.ok) setSeleccionados(new Set(rolesUsuario.rolIds))
      if (overridesUsuario.ok) {
        setOverrides(
          new Map(overridesUsuario.overrides.map((o) => [o.permisoId, o.modo]))
        )
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  function alternarRol(rolId: string) {
    setSeleccionados((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(rolId)) siguiente.delete(rolId)
      else siguiente.add(rolId)
      return siguiente
    })
  }

  // Permisos que le llegan solo por los roles marcados (staged, aún sin guardar).
  const permisoIdsPorRol = useMemo(() => {
    const set = new Set<string>()
    for (const rol of roles ?? []) {
      if (!seleccionados.has(rol.id)) continue
      for (const permisoId of rol.permisoIds) set.add(permisoId)
    }
    return set
  }, [roles, seleccionados])

  // Vista previa del acceso efectivo: roles + concedidos - denegados.
  const permisosEfectivos = useMemo(() => {
    const porId = new Map(permisos.map((p) => [p.id, p]))
    const set = new Set<string>()
    for (const permisoId of Array.from(permisoIdsPorRol)) {
      const p = porId.get(permisoId)
      if (p) set.add(`${p.recurso}:${p.accion}`)
    }
    for (const [permisoId, modo] of Array.from(overrides)) {
      const p = porId.get(permisoId)
      if (!p) continue
      const token = `${p.recurso}:${p.accion}`
      if (modo === "conceder") set.add(token)
      else set.delete(token)
    }
    return Array.from(set).sort()
  }, [permisos, permisoIdsPorRol, overrides])

  function fijarOverride(permisoId: string, nuevo: ModoOverride | null) {
    if (!usuario) return
    const actual = overrides.get(permisoId) ?? null
    if (actual === nuevo) return

    setOverrides((prev) => {
      const copia = new Map(prev)
      if (nuevo === null) copia.delete(permisoId)
      else copia.set(permisoId, nuevo)
      return copia
    })

    setPermisoGuardando(permisoId)
    startSaving(async () => {
      const res = await accionSetOverridePermiso(usuario.id, permisoId, nuevo)
      setPermisoGuardando(null)
      if (!res.ok) {
        toast({ variant: "error", title: "No se pudo guardar", description: res.error })
        setOverrides((prev) => {
          const copia = new Map(prev)
          if (actual === null) copia.delete(permisoId)
          else copia.set(permisoId, actual)
          return copia
        })
      } else {
        onGuardado()
      }
    })
  }

  // Acceso final de un permiso: la excepción manda; si no hay, lo que digan los roles.
  function tieneAcceso(permisoId: string) {
    const modo = overrides.get(permisoId)
    if (modo === "conceder") return true
    if (modo === "denegar") return false
    return permisoIdsPorRol.has(permisoId)
  }

  // Permisos agrupados por módulo, ya filtrados por la búsqueda y el filtro activo.
  const modulosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const mapa = new Map<string, PermisoRow[]>()
    for (const p of permisos) {
      if (texto && !`${p.recurso}:${p.accion}`.toLowerCase().includes(texto)) continue
      if (filtro === "excepciones" && !overrides.has(p.id)) continue
      if (filtro === "con-acceso") {
        const modo = overrides.get(p.id)
        const acceso =
          modo === "conceder" || (modo !== "denegar" && permisoIdsPorRol.has(p.id))
        if (!acceso) continue
      }
      mapa.set(p.recurso, [...(mapa.get(p.recurso) ?? []), p])
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([recurso, lista]) => ({
        recurso,
        permisos: lista.sort((a, b) => a.accion.localeCompare(b.accion)),
      }))
  }, [permisos, busqueda, filtro, overrides, permisoIdsPorRol])

  // Con búsqueda o un filtro activo se muestran todos los módulos abiertos — si no,
  // encontrar un permiso obligaría a abrir módulo por módulo.
  const abrirTodo = busqueda.trim() !== "" || filtro !== "todos"

  function alternarModulo(recurso: string) {
    setModulosAbiertos((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(recurso)) nuevo.delete(recurso)
      else nuevo.add(recurso)
      return nuevo
    })
  }

  function guardarRoles() {
    if (!usuario) return
    startSaving(async () => {
      const res = await accionSetRolesDeUsuario(usuario.id, Array.from(seleccionados))
      if (res.ok) {
        toast({
          variant: "success",
          description: "Roles asignados y acceso recompilado.",
        })
        onGuardado()
      } else {
        toast({ variant: "error", title: "No se pudo guardar", description: res.error })
      }
    })
  }

  return (
    <Sheet open={Boolean(usuario)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {usuario ? (
          <>
            <SheetHeader className="border-border border-b p-5">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-accent text-accent-foreground text-[13px] font-bold">
                    {iniciales(usuario.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-[15px]">
                    Acceso de {usuario.name}
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {usuario.email}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="p-5">
              <p className="text-muted-foreground mb-4 text-[12px] leading-relaxed">
                Asigná roles a este usuario. Sus permisos efectivos son la union de los
                permisos de todos sus roles. Al guardar, se recompila su acceso real.
              </p>

              {!roles ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : roles.length === 0 ? (
                <p className="text-muted-foreground bg-muted/60 border-border rounded-md border px-3.5 py-4 text-center text-[12.5px]">
                  No hay roles todavía. Creá roles en la pestaña Roles y permisos primero.
                </p>
              ) : (
                <>
                  <span className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                    Roles ({seleccionados.size} asignados)
                  </span>
                  <div className="border-border overflow-hidden rounded-lg border">
                    {roles.map((rol, index) => (
                      <div
                        key={rol.id}
                        onClick={() => alternarRol(rol.id)}
                        className={cn(
                          "hover:bg-muted/60 flex cursor-pointer items-center gap-3 px-3.5 py-3",
                          index > 0 && "border-border border-t"
                        )}
                      >
                        <Checkbox
                          checked={seleccionados.has(rol.id)}
                          onCheckedChange={() => alternarRol(rol.id)}
                          aria-label={rol.nombre}
                        />
                        <ShieldEllipsis
                          className="text-muted-foreground size-4 shrink-0"
                          strokeWidth={1.8}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-bold">
                            {rol.nombre}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {rol.permisoIds.length} permiso
                            {rol.permisoIds.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" disabled={isSaving} onClick={guardarRoles}>
                      {isSaving ? "Guardando..." : "Guardar roles y recompilar"}
                    </Button>
                  </div>

                  <div className="mt-6">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold">Permisos individuales</span>
                      {overrides.size > 0 && (
                        <span className="text-muted-foreground text-[11px]">
                          {overrides.size} excepci{overrides.size === 1 ? "ón" : "ones"}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mb-3 text-[11.5px] leading-relaxed">
                      Excepciones puntuales, aparte de los roles. &ldquo;Rol&rdquo; deja
                      que decidan sus roles; &ldquo;Denegar&rdquo; gana siempre, aunque un
                      rol lo dé. Se guarda al instante.
                    </p>

                    <div className="relative">
                      <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        strokeWidth={2}
                      />
                      <input
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar permiso (ej. pago, ver, entregas)…"
                        className="border-input bg-card focus:border-primary focus:ring-ring/15 h-10 w-full rounded-md border pr-9 pl-9 text-sm outline-none focus:ring-3"
                      />
                      {busqueda && (
                        <button
                          type="button"
                          onClick={() => setBusqueda("")}
                          aria-label="Limpiar búsqueda"
                          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5"
                        >
                          <X className="size-3.5" strokeWidth={2.2} />
                        </button>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {(
                        [
                          ["todos", `Todos (${permisos.length})`],
                          ["con-acceso", `Con acceso (${permisosEfectivos.length})`],
                          ["excepciones", `Excepciones (${overrides.size})`],
                        ] as [FiltroPermisos, string][]
                      ).map(([valor, etiqueta]) => (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => setFiltro(valor)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                            filtro === valor
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted/60"
                          )}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>

                    <div className="border-border mt-3 overflow-hidden rounded-lg border">
                      {modulosFiltrados.length === 0 ? (
                        <p className="text-muted-foreground px-3.5 py-6 text-center text-[12.5px]">
                          {busqueda
                            ? `Ningún permiso coincide con "${busqueda}".`
                            : filtro === "excepciones"
                              ? "Este usuario no tiene excepciones."
                              : "Sin permisos para mostrar."}
                        </p>
                      ) : (
                        modulosFiltrados.map((modulo, indice) => {
                          const abierto = abrirTodo || modulosAbiertos.has(modulo.recurso)
                          const conAcceso = modulo.permisos.filter((p) =>
                            tieneAcceso(p.id)
                          ).length
                          const excepciones = modulo.permisos.filter((p) =>
                            overrides.has(p.id)
                          ).length
                          return (
                            <div
                              key={modulo.recurso}
                              className={cn(indice > 0 && "border-border border-t")}
                            >
                              <button
                                type="button"
                                onClick={() => alternarModulo(modulo.recurso)}
                                aria-expanded={abierto}
                                disabled={abrirTodo}
                                className="hover:bg-muted/50 flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                              >
                                <ChevronRight
                                  className={cn(
                                    "text-muted-foreground size-3.5 shrink-0 transition-transform duration-200",
                                    abierto && "rotate-90"
                                  )}
                                  strokeWidth={2.2}
                                />
                                <span className="font-mono text-[12.5px] font-bold">
                                  {modulo.recurso}
                                </span>
                                <span className="ml-auto flex items-center gap-1.5">
                                  {excepciones > 0 && (
                                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10.5px] font-bold">
                                      {excepciones} excepci
                                      {excepciones === 1 ? "ón" : "ones"}
                                    </span>
                                  )}
                                  <span
                                    className={cn(
                                      "text-[11px] tabular-nums",
                                      conAcceso > 0
                                        ? "text-foreground font-semibold"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {conAcceso}/{modulo.permisos.length}
                                  </span>
                                </span>
                              </button>
                              {abierto && (
                                <div className="bg-muted/20 pb-1">
                                  {modulo.permisos.map((permiso) => {
                                    const modo = overrides.get(permiso.id) ?? null
                                    const heredaDelRol = permisoIdsPorRol.has(permiso.id)
                                    const acceso = tieneAcceso(permiso.id)
                                    return (
                                      <div
                                        key={permiso.id}
                                        className="flex items-center gap-3 py-1.5 pr-3 pl-9"
                                      >
                                        <span
                                          className={cn(
                                            "size-1.5 shrink-0 rounded-full",
                                            acceso
                                              ? "bg-status-disponible-fg"
                                              : "bg-border"
                                          )}
                                          title={acceso ? "Tiene acceso" : "Sin acceso"}
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate font-mono text-[12px]">
                                            {permiso.accion}
                                          </div>
                                          {modo === null && (
                                            <div className="text-muted-foreground text-[10.5px]">
                                              {heredaDelRol
                                                ? "Lo da un rol"
                                                : "Ningún rol lo da"}
                                            </div>
                                          )}
                                        </div>
                                        <OverrideSegmentado
                                          modo={modo}
                                          heredaDelRol={heredaDelRol}
                                          deshabilitado={permisoGuardando === permiso.id}
                                          onChange={(nuevo) =>
                                            fijarOverride(permiso.id, nuevo)
                                          }
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <span className="text-muted-foreground mb-1.5 block text-xs font-semibold">
                      Acceso efectivo resultante ({permisosEfectivos.length})
                    </span>
                    {permisosEfectivos.length === 0 ? (
                      <p className="text-muted-foreground text-[12px]">Sin permisos.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {permisosEfectivos.map((token) => (
                          <span
                            key={token}
                            className="bg-muted rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold"
                          >
                            {token}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <SheetFooter className="border-border flex-row justify-end gap-2 border-t p-4">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
