"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Search, Smartphone, UserRound, X } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PillTabs } from "@/components/shared/pill-tabs"
import { Spinner } from "@/components/shared/spinner"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  listarEventos,
  listarUsuariosRecientes,
  TelemetriaApiError,
} from "@/lib/api/telemetria-api"
import { cn } from "@/lib/utils"

import { NIVEL_LABELS, type Evento, type Nivel } from "./datos"
import { formatearFechaHora, formatearHora, haceCuanto, VARIANTE_NIVEL } from "./formato"

const formatoDia = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

type FiltroNivel = "todos" | "problemas" | Nivel

// Todas las interacciones de un cliente: resumen (dispositivos, versiones, conteos) y
// su línea de tiempo agrupada por día. La lista del backend no trae la sesión de cada
// evento, por eso se agrupa por día; la sesión completa sigue disponible desde el
// detalle de cualquier evento.
export function VistaUsuario({
  usuarioId,
  onCambiarUsuario,
  onAbrirEvento,
}: {
  usuarioId: string | null
  onCambiarUsuario: (usuarioId: string | null) => void
  onAbrirEvento: (evento: Evento) => void
}) {
  const [texto, setTexto] = useState("")
  const [filtro, setFiltro] = useState<FiltroNivel>("todos")
  const [recientes, setRecientes] = useState<
    { userId: string; email: string | null; ultimo: string }[] | null
  >(null)
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setError(null)
    if (usuarioId) {
      setEventos(null)
      // El backend filtra exacto por user_id (cédula) y devuelve como máximo 500
      // registros de los últimos 7 días.
      listarEventos({ ventana: "7d", usuario: usuarioId, limite: 500 })
        .then(({ eventos: filas }) => vigente && setEventos(filas))
        .catch((err) => vigente && setError(mensajeDeError(err)))
    } else if (!recientes) {
      listarUsuariosRecientes()
        .then((lista) => vigente && setRecientes(lista))
        .catch((err) => vigente && setError(mensajeDeError(err)))
    }
    return () => {
      vigente = false
    }
    // recientes se carga una sola vez; no hace falta volver a pedirlo al cambiar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId])

  function buscar() {
    const cedula = texto.trim()
    if (cedula) onCambiarUsuario(cedula)
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          buscar()
        }}
      >
        <div className="border-input bg-card focus-within:border-primary focus-within:ring-ring/15 flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-md border px-3 focus-within:ring-3 sm:max-w-sm">
          <Search
            className="text-muted-foreground size-[15px] shrink-0"
            strokeWidth={1.7}
          />
          <input
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            inputMode="numeric"
            placeholder="Cédula del cliente…"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
          />
        </div>
        <Button type="submit" size="sm" className="h-[38px]" disabled={!texto.trim()}>
          Ver interacciones
        </Button>
      </form>

      {error ? (
        <EmptyState title="No se pudo cargar" description={error} dashed />
      ) : !usuarioId ? (
        !recientes ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : recientes.length === 0 ? (
          <EmptyState
            title="Sin actividad reciente"
            description="Ningún cliente identificado usó la app en los últimos 7 días. Busca por cédula."
            dashed
          />
        ) : (
          <div>
            <p className="text-muted-foreground mb-2 text-[11px] font-bold tracking-wide uppercase">
              Con actividad reciente
            </p>
            <ul className="border-border divide-border divide-y rounded-md border">
              {recientes.map((u) => (
                <li key={u.userId}>
                  <button
                    type="button"
                    onClick={() => onCambiarUsuario(u.userId)}
                    className="hover:bg-muted/60 group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <div className="bg-accent flex size-8 shrink-0 items-center justify-center rounded-full">
                      <UserRound
                        className="text-accent-foreground size-4"
                        strokeWidth={1.7}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] font-semibold">{u.userId}</p>
                      {u.email ? (
                        <p className="text-muted-foreground truncate text-xs">
                          {u.email}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {haceCuanto(u.ultimo)}
                    </span>
                    <ChevronRight
                      className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
                      strokeWidth={1.8}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : !eventos ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : eventos.length === 0 ? (
        <>
          <EncabezadoUsuario
            usuarioId={usuarioId}
            onQuitar={() => onCambiarUsuario(null)}
          />
          <EmptyState
            title="Sin interacciones"
            description="Este usuario no registró actividad en la app en los últimos 7 días."
            dashed
          />
        </>
      ) : (
        <ResumenYLineaDeTiempo
          usuarioId={usuarioId}
          eventos={eventos}
          filtro={filtro}
          onFiltro={setFiltro}
          onQuitar={() => onCambiarUsuario(null)}
          onAbrirEvento={onAbrirEvento}
        />
      )}
    </div>
  )
}

function mensajeDeError(err: unknown): string {
  return err instanceof TelemetriaApiError
    ? err.message
    : "No se pudo conectar con el servidor"
}

function EncabezadoUsuario({
  usuarioId,
  email,
  onQuitar,
}: {
  usuarioId: string
  email?: string | null
  onQuitar: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-brand-gradient flex size-10 shrink-0 items-center justify-center rounded-full">
        <UserRound className="size-5 text-white" strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-base font-bold">{usuarioId}</p>
        {email ? <p className="text-muted-foreground truncate text-xs">{email}</p> : null}
      </div>
      <Button variant="outline" size="sm" onClick={onQuitar}>
        <X className="size-3.5" strokeWidth={1.8} />
        Cambiar usuario
      </Button>
    </div>
  )
}

function ResumenYLineaDeTiempo({
  usuarioId,
  eventos,
  filtro,
  onFiltro,
  onQuitar,
  onAbrirEvento,
}: {
  usuarioId: string
  eventos: Evento[]
  filtro: FiltroNivel
  onFiltro: (filtro: FiltroNivel) => void
  onQuitar: () => void
  onAbrirEvento: (evento: Evento) => void
}) {
  const conteo = (nivel: Nivel) => eventos.filter((e) => e.level === nivel).length
  const errores = conteo("error")
  const advertencias = conteo("warn")
  const dispositivos = Array.from(
    new Set(
      eventos
        .map((e) =>
          [e.platform, e.deviceModel, e.osVersion && `SO ${e.osVersion}`]
            .filter(Boolean)
            .join(" · ")
        )
        .filter(Boolean)
    )
  )
  const versiones = Array.from(new Set(eventos.map((e) => e.appVersion).filter(Boolean)))
  const pantallas = Array.from(new Set(eventos.map((e) => e.screen).filter(Boolean)))
  const primero = eventos[eventos.length - 1]?.receivedAt
  const ultimo = eventos[0]?.receivedAt

  const visibles = eventos.filter((e) =>
    filtro === "todos"
      ? true
      : filtro === "problemas"
        ? e.level === "error" || e.level === "warn"
        : e.level === filtro
  )

  // Agrupa por día (los eventos ya vienen del más reciente al más antiguo).
  const porDia: { dia: string; eventos: Evento[] }[] = []
  for (const evento of visibles) {
    const dia = evento.receivedAt.slice(0, 10)
    const grupo = porDia[porDia.length - 1]
    if (grupo && grupo.dia === dia) grupo.eventos.push(evento)
    else porDia.push({ dia, eventos: [evento] })
  }

  return (
    <div className="space-y-4">
      <EncabezadoUsuario
        usuarioId={usuarioId}
        email={eventos.find((e) => e.userEmail)?.userEmail}
        onQuitar={onQuitar}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato titulo="Interacciones" valor={String(eventos.length)} />
        <Dato
          titulo="Errores / advertencias"
          valor={`${errores} / ${advertencias}`}
          resaltar={errores > 0}
        />
        <Dato titulo="Primera actividad" valor={formatearFechaHora(primero)} />
        <Dato titulo="Última actividad" valor={haceCuanto(ultimo)} />
      </div>

      <div className="bg-muted/60 border-border grid gap-3 rounded-md border p-3.5 text-xs sm:grid-cols-3">
        <Lista
          titulo="Dispositivos"
          icono={<Smartphone className="size-3.5" strokeWidth={1.8} />}
          items={dispositivos}
        />
        <Lista titulo="Versiones de la app" items={versiones as string[]} mono />
        <Lista titulo="Pantallas visitadas" items={pantallas as string[]} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <PillTabs
          tabs={[
            { id: "todos", label: `Todo (${eventos.length})` },
            {
              id: "problemas",
              label: `Errores y advertencias (${errores + advertencias})`,
            },
            { id: "event", label: `Eventos (${conteo("event")})` },
          ]}
          value={
            filtro === "todos" || filtro === "problemas" || filtro === "event"
              ? filtro
              : "todos"
          }
          onChange={(id) => onFiltro(id as FiltroNivel)}
        />
        <span className="text-muted-foreground text-xs">Últimos 7 días</span>
      </div>

      {porDia.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="No hay interacciones con este filtro."
        />
      ) : (
        <div className="space-y-4">
          {porDia.map(({ dia, eventos: delDia }) => (
            <section key={dia}>
              <h3 className="text-muted-foreground mb-1.5 text-[11px] font-bold tracking-wide uppercase first-letter:uppercase">
                {formatoDia.format(new Date(`${dia}T12:00:00`))} · {delDia.length}
              </h3>
              <ol className="border-border ml-1.5 border-l-2">
                {delDia.map((evento) => (
                  <li key={evento.id} className="relative pl-4">
                    <span
                      className={cn(
                        "border-card absolute top-3.5 -left-[6px] size-2.5 rounded-full border-2",
                        evento.level === "error"
                          ? "bg-chart-error"
                          : evento.level === "warn"
                            ? "bg-chart-warn"
                            : evento.level === "event"
                              ? "bg-status-hipotecado"
                              : "bg-muted-foreground/40"
                      )}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => onAbrirEvento(evento)}
                      className="hover:bg-muted/60 group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors"
                    >
                      <span className="text-muted-foreground w-16 shrink-0 font-mono text-[11.5px] whitespace-nowrap">
                        {formatearHora(evento.receivedAt)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          {evento.message}
                        </p>
                        <p className="text-muted-foreground truncate text-[11.5px]">
                          {[
                            evento.screen,
                            evento.statusCode != null
                              ? `HTTP ${evento.statusCode}`
                              : null,
                            evento.appVersion ? `v${evento.appVersion}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </div>
                      <StatusBadge variant={VARIANTE_NIVEL[evento.level]}>
                        {NIVEL_LABELS[evento.level]}
                      </StatusBadge>
                      <ChevronRight
                        className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors"
                        strokeWidth={1.8}
                      />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Dato({
  titulo,
  valor,
  resaltar,
}: {
  titulo: string
  valor: string
  resaltar?: boolean
}) {
  return (
    <div className="border-border rounded-md border p-3">
      <p className="text-muted-foreground text-[11px] font-bold">{titulo}</p>
      <p
        className={cn(
          "mt-1 font-mono text-[15px] font-semibold",
          resaltar && "text-status-bloqueado-fg"
        )}
      >
        {valor}
      </p>
    </div>
  )
}

function Lista({
  titulo,
  items,
  icono,
  mono,
}: {
  titulo: string
  items: string[]
  icono?: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground mb-1 inline-flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase">
        {icono}
        {titulo}
      </p>
      {items.length === 0 ? (
        <p>—</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item} className={cn("truncate", mono && "font-mono")}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
