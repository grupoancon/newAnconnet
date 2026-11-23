"use client"

import { useMemo, useState } from "react"
import { ClipboardPaste, Search, X } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import type { Destinatario } from "./datos"

const MAX_VISIBLES = 80

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

// Elige usuarios de la app por nombre/cédula, o pegando una lista de cédulas. Solo se
// pueden elegir usuarios que existen (el backend también lo valida).
export function SelectorDestinatarios({
  destinatarios,
  cargando,
  seleccion,
  onCambio,
  excluir,
}: {
  destinatarios: Destinatario[]
  cargando: boolean
  seleccion: string[]
  onCambio: (cedulas: string[]) => void
  // Cédulas que ya tienen la encuesta pendiente: se muestran pero no se pueden elegir.
  excluir: Set<string>
}) {
  const [busqueda, setBusqueda] = useState("")
  const [pegando, setPegando] = useState(false)
  const [textoPegado, setTextoPegado] = useState("")
  const [noEncontradas, setNoEncontradas] = useState<string[]>([])

  const porCedula = useMemo(
    () => new Map(destinatarios.map((d) => [d.cedula, d])),
    [destinatarios]
  )
  const elegidas = useMemo(() => new Set(seleccion), [seleccion])

  const filtrados = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    if (!termino) return destinatarios
    return destinatarios.filter(
      (d) => d.cedula.includes(termino) || normalizar(d.nombre).includes(termino)
    )
  }, [destinatarios, busqueda])
  const visibles = filtrados.slice(0, MAX_VISIBLES)
  const elegiblesFiltrados = filtrados.filter((d) => !excluir.has(d.cedula))
  const todosFiltradosElegidos =
    elegiblesFiltrados.length > 0 && elegiblesFiltrados.every((d) => elegidas.has(d.cedula))

  function alternar(cedula: string) {
    onCambio(
      elegidas.has(cedula) ? seleccion.filter((c) => c !== cedula) : [...seleccion, cedula]
    )
  }

  function alternarFiltrados() {
    const cedulas = elegiblesFiltrados.map((d) => d.cedula)
    if (todosFiltradosElegidos) {
      const quitar = new Set(cedulas)
      onCambio(seleccion.filter((c) => !quitar.has(c)))
    } else {
      onCambio(Array.from(new Set([...seleccion, ...cedulas])))
    }
  }

  function aplicarPegado() {
    const cedulas = Array.from(
      new Set(
        textoPegado
          .split(/[\s,;]+/)
          .map((c) => c.trim())
          .filter(Boolean)
      )
    )
    const validas = cedulas.filter((c) => porCedula.has(c) && !excluir.has(c))
    setNoEncontradas(cedulas.filter((c) => !porCedula.has(c)))
    onCambio(Array.from(new Set([...seleccion, ...validas])))
    setTextoPegado("")
    setPegando(false)
  }

  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
            strokeWidth={1.8}
          />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cédula"
            className="bg-card pl-8"
          />
        </div>
        <button
          type="button"
          onClick={() => setPegando((v) => !v)}
          className={cn(
            "border-border text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold",
            pegando && "border-primary text-primary"
          )}
        >
          <ClipboardPaste className="size-3.5" strokeWidth={1.8} />
          Pegar cédulas
        </button>
      </div>

      {pegando ? (
        <div className="bg-muted/60 border-border space-y-2 rounded-md border p-3">
          <Textarea
            value={textoPegado}
            onChange={(e) => setTextoPegado(e.target.value)}
            placeholder="Pega cédulas separadas por coma, espacio o salto de línea (por ejemplo, desde Excel)."
            className="bg-card min-h-[72px] text-xs"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!textoPegado.trim()}
              onClick={aplicarPegado}
              className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              Agregar a la selección
            </button>
          </div>
        </div>
      ) : null}

      {noEncontradas.length > 0 ? (
        <p className="text-destructive flex items-start justify-between gap-2 text-xs">
          <span>
            No son usuarios de la app: {noEncontradas.slice(0, 8).join(", ")}
            {noEncontradas.length > 8 ? ` y ${noEncontradas.length - 8} más` : ""}.
          </span>
          <button
            type="button"
            aria-label="Ocultar aviso"
            onClick={() => setNoEncontradas([])}
          >
            <X className="size-3.5" />
          </button>
        </p>
      ) : null}

      <div className="border-border overflow-hidden rounded-md border">
        <div className="bg-muted/60 border-border flex items-center justify-between border-b px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <Checkbox
              checked={todosFiltradosElegidos}
              disabled={elegiblesFiltrados.length === 0}
              onCheckedChange={alternarFiltrados}
            />
            {busqueda.trim() ? "Elegir los resultados" : "Elegir a todos"} (
            {elegiblesFiltrados.length})
          </label>
          <span className="text-muted-foreground text-xs">
            {seleccion.length} elegido{seleccion.length === 1 ? "" : "s"}
          </span>
        </div>
        {cargando ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-xs">
            Cargando usuarios de la app…
          </p>
        ) : visibles.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-xs">
            Sin resultados.
          </p>
        ) : (
          <ul className="divide-border max-h-60 divide-y overflow-y-auto">
            {visibles.map((d) => {
              const yaPendiente = excluir.has(d.cedula)
              return (
                <li key={d.cedula}>
                  <label
                    className={cn(
                      "hover:bg-muted/60 flex cursor-pointer items-center gap-2.5 px-3 py-2",
                      yaPendiente && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <Checkbox
                      checked={elegidas.has(d.cedula)}
                      disabled={yaPendiente}
                      onCheckedChange={() => alternar(d.cedula)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {d.nombre}
                      </span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {d.cedula}
                      </span>
                    </span>
                    {yaPendiente ? (
                      <span className="text-muted-foreground text-[11px]">
                        Ya la tiene pendiente
                      </span>
                    ) : null}
                  </label>
                </li>
              )
            })}
            {filtrados.length > MAX_VISIBLES ? (
              <li className="text-muted-foreground px-3 py-2 text-center text-[11px]">
                Mostrando {MAX_VISIBLES} de {filtrados.length}. Busca para afinar o usa
                “Elegir {busqueda.trim() ? "los resultados" : "a todos"}”.
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  )
}
