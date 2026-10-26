"use client"

import { useEffect, useState } from "react"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { buscarConflictosAgenda, type ResultadoConflictos } from "@/lib/api/entregas-api"

function formatearFecha(valor: string): string {
  const [anio, mes, dia] = valor.split("-")
  return `${dia}/${mes}/${anio}`
}

// Advertencia (no bloquea) cuando el asesor ya tiene otra entrega abierta que choca con
// la fecha/hora elegida. Cada entrega ocupa 60 min; la sugerencia es la primera hora
// libre de ese dia. Se consulta al backend con un pequeno retraso al teclear.
export function AdvertenciaAgenda({
  asesorId,
  fecha,
  hora,
  excluirId,
  onSugerir,
}: {
  asesorId: string | null | undefined
  fecha: string
  hora: string
  // Proceso que se esta re-agendando o confirmando: no cuenta como conflicto consigo mismo.
  excluirId?: number
  onSugerir: (sugerencia: { fecha: string; hora: string }) => void
}) {
  const [resultado, setResultado] = useState<ResultadoConflictos | null>(null)

  useEffect(() => {
    setResultado(null)
    if (!asesorId || !fecha || !hora) return
    let vigente = true
    const temporizador = setTimeout(() => {
      buscarConflictosAgenda({ asesorId, fecha, hora, excluirId })
        .then((r) => vigente && setResultado(r))
        .catch(() => vigente && setResultado(null))
    }, 400)
    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
  }, [asesorId, fecha, hora, excluirId])

  if (!resultado || resultado.conflictos.length === 0) return null

  return (
    <div
      role="alert"
      className="bg-status-reservado-bg text-status-reservado-fg flex gap-3 rounded-md px-4 py-3 text-[13px]"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <div className="space-y-1.5">
        <p className="font-bold">Este asesor ya tiene una entrega en ese horario</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {resultado.conflictos.map((c) => (
            <li key={c.id}>
              Entrega {c.estado === "CONFIRMADA" ? "confirmada" : "planificada"} el{" "}
              {formatearFecha(c.fecha)} a las {c.hora} con el cliente{" "}
              <span className="font-semibold">{c.cliente ?? "—"}</span>
              {c.lote ? ` (lote ${c.lote})` : ""}.
            </li>
          ))}
        </ul>
        {resultado.sugerencia ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span>
              Sugerencia: programarla a las{" "}
              <span className="font-bold">{resultado.sugerencia.hora}</span>.
            </span>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => onSugerir(resultado.sugerencia!)}
            >
              Usar {resultado.sugerencia.hora}
            </Button>
          </div>
        ) : (
          <p>No queda una hora libre ese día: prueba con otra fecha.</p>
        )}
      </div>
    </div>
  )
}
