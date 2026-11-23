"use client"

import { useState } from "react"
import { CheckCircle2, Clock, MessageSquareText, Send } from "lucide-react"

import { cn } from "@/lib/utils"

import type { Pregunta } from "./datos"

// Vista previa de cómo verá la encuesta el cliente en la app móvil. Replica las dos
// pantallas de AnconApp: el aviso que aparece sobre el inicio
// (src/components/app/SurveyPromptOverlay.tsx) y la pantalla de responder
// (src/pages/SurveyAnswer.tsx + css/pages/SurveyAnswer.css). Los colores son los de la
// app, no los de la intranet, a propósito. Se puede tocar: las respuestas son solo de
// prueba y no se guardan.

const ROSA = "#eb4c76"

type Pantalla = "aviso" | "encuesta" | "gracias"

type Estado = { valor?: string; opciones: number[]; otro: boolean; otroTexto: string }

export function VistaPreviaApp({
  titulo,
  descripcion,
  preguntas,
}: {
  titulo: string
  descripcion: string
  preguntas: Pregunta[]
}) {
  const [pantalla, setPantalla] = useState<Pantalla>("encuesta")
  const [estados, setEstados] = useState<Record<number, Estado>>({})

  const estadoDe = (i: number): Estado =>
    estados[i] ?? { opciones: [], otro: false, otroTexto: "" }
  const cambiar = (i: number, cambios: Partial<Estado>) =>
    setEstados((actual) => ({ ...actual, [i]: { ...estadoDe(i), ...cambios } }))

  const respondida = (p: Pregunta, i: number) => {
    const e = estadoDe(i)
    if (p.type === "single_choice" || p.type === "multiple_choice") {
      return e.opciones.length > 0 || (e.otro && e.otroTexto.trim().length > 0)
    }
    return Boolean(e.valor?.trim())
  }
  const faltanObligatorias = preguntas.some((p, i) => p.required && !respondida(p, i))

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-muted flex rounded-full p-1 text-[11.5px] font-semibold">
        {(
          [
            ["aviso", "Aviso"],
            ["encuesta", "Encuesta"],
            ["gracias", "Al enviar"],
          ] as [Pantalla, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPantalla(id)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              pantalla === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Marco de teléfono */}
      <div className="w-[300px] rounded-[2.6rem] bg-neutral-900 p-2.5 shadow-xl">
        <div className="relative h-[600px] overflow-hidden rounded-[2.1rem] bg-[#f4f5f7] font-sans text-[#1e293b]">
          <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />

          {pantalla === "aviso" ? (
            <Aviso
              titulo={titulo}
              descripcion={descripcion}
              onResponder={() => setPantalla("encuesta")}
            />
          ) : pantalla === "gracias" ? (
            <Gracias onContinuar={() => setPantalla("aviso")} />
          ) : (
            <div className="h-full [scrollbar-width:none] overflow-y-auto px-4 pt-10 pb-6">
              <div className="mb-5 text-center">
                <p
                  className="mb-1 text-[10px] font-extrabold tracking-[0.06em] uppercase"
                  style={{ color: ROSA }}
                >
                  Encuesta
                </p>
                <h1 className="mb-1.5 text-[18px] leading-tight font-extrabold break-words">
                  {titulo.trim() || "Título de la encuesta"}
                </h1>
                {descripcion.trim() ? (
                  <p className="text-[12px] leading-normal break-words text-[#64748b]">
                    {descripcion}
                  </p>
                ) : null}
              </div>

              {preguntas.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-[#64748b]">
                  Agrega preguntas para verlas aquí.
                </p>
              ) : (
                <div className="mb-5 flex flex-col gap-3.5">
                  {preguntas.map((p, i) => (
                    <PreguntaApp
                      key={i}
                      numero={i + 1}
                      pregunta={p}
                      estado={estadoDe(i)}
                      onCambio={(c) => cambiar(i, c)}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={faltanObligatorias || preguntas.length === 0}
                onClick={() => {
                  setPantalla("gracias")
                  setEstados({})
                }}
                className="w-full rounded-[12px] py-3 text-[13px] font-extrabold text-white disabled:opacity-40"
                style={{ background: ROSA }}
              >
                Enviar respuestas
              </button>
              {faltanObligatorias ? (
                <p className="mt-2 text-center text-[10.5px] text-[#64748b]">
                  El botón se activa cuando se responden las obligatorias (*).
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <p className="text-muted-foreground max-w-[300px] text-center text-[11px]">
        Así la verá el cliente en la app. Puedes tocar las respuestas; no se guardan.
      </p>
    </div>
  )
}

function PreguntaApp({
  numero,
  pregunta: p,
  estado,
  onCambio,
}: {
  numero: number
  pregunta: Pregunta
  estado: Estado
  onCambio: (cambios: Partial<Estado>) => void
}) {
  const esSeleccion = p.type === "single_choice" || p.type === "multiple_choice"
  const unica = p.type === "single_choice"
  const opciones = p.options.filter((o) => o.label.trim())

  return (
    <div className="rounded-[14px] bg-white p-3.5 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
      <p className="mb-3 text-[13px] leading-snug font-bold break-words">
        {numero}. {p.text.trim() || "Pregunta sin texto"}
        {p.required ? <span style={{ color: ROSA }}> *</span> : null}
      </p>

      {p.type === "rating" ? (
        <div className="flex justify-between gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const elegido = estado.valor === String(n)
            return (
              <button
                key={n}
                type="button"
                onClick={() => onCambio({ valor: String(n) })}
                className="aspect-square flex-1 rounded-[10px] border-[1.5px] text-[13px] font-extrabold"
                style={
                  elegido
                    ? { background: ROSA, borderColor: ROSA, color: "#fff" }
                    : { background: "#f8f9fb", borderColor: "#e2e8f0" }
                }
              >
                {n}
              </button>
            )
          })}
        </div>
      ) : null}

      {esSeleccion ? (
        <div className="flex flex-col gap-1.5">
          {opciones.length === 0 ? (
            <p className="text-[11px] text-[#94a3b8]">Sin opciones todavía.</p>
          ) : null}
          {opciones.map((o, idx) => {
            const elegido = estado.opciones.includes(idx)
            return (
              <OpcionApp
                key={idx}
                etiqueta={o.label}
                elegido={elegido}
                unica={unica}
                onClick={() =>
                  onCambio(
                    unica
                      ? { opciones: [idx], otro: false }
                      : {
                          opciones: elegido
                            ? estado.opciones.filter((x) => x !== idx)
                            : [...estado.opciones, idx],
                        }
                  )
                }
              />
            )
          })}
          {p.config?.allow_other ? (
            <>
              <OpcionApp
                etiqueta="Otro"
                elegido={estado.otro}
                unica={unica}
                onClick={() =>
                  onCambio(unica ? { otro: true, opciones: [] } : { otro: !estado.otro })
                }
              />
              {estado.otro ? (
                <input
                  value={estado.otroTexto}
                  onChange={(e) => onCambio({ otroTexto: e.target.value })}
                  placeholder="Escribe tu respuesta"
                  className="w-full rounded-[10px] border-[1.5px] bg-[#fdf3f5] px-2.5 py-2 text-[12px] outline-none"
                  style={{ borderColor: ROSA }}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {p.type === "yesno" ? (
        <div className="flex gap-1.5">
          {["Sí", "No"].map((label) => {
            const elegido = estado.valor === label
            return (
              <button
                key={label}
                type="button"
                onClick={() => onCambio({ valor: label })}
                className="flex-1 rounded-[10px] border-[1.5px] px-2.5 py-2.5 text-[12.5px] font-bold"
                style={
                  elegido
                    ? { background: "#fdf3f5", borderColor: ROSA, color: ROSA }
                    : { background: "#f8f9fb", borderColor: "#e2e8f0" }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : null}

      {p.type === "text" ? (
        <textarea
          value={estado.valor ?? ""}
          onChange={(e) => onCambio({ valor: e.target.value })}
          placeholder="Escribe tu respuesta"
          className="min-h-[70px] w-full resize-none rounded-[10px] border-[1.5px] border-[#e2e8f0] bg-[#f8f9fb] p-2.5 text-[12px] outline-none"
        />
      ) : null}
    </div>
  )
}

function OpcionApp({
  etiqueta,
  elegido,
  unica,
  onClick,
}: {
  etiqueta: string
  elegido: boolean
  unica: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[10px] border-[1.5px] px-2.5 py-2.5 text-left text-[12.5px] font-bold break-words"
      style={
        elegido
          ? { background: "#fdf3f5", borderColor: ROSA, color: ROSA }
          : { background: "#f8f9fb", borderColor: "#e2e8f0" }
      }
    >
      <span
        className={cn(
          "size-4 shrink-0 border-[1.5px]",
          unica ? "rounded-full" : "rounded-[4px]"
        )}
        style={
          elegido
            ? { borderColor: ROSA, background: ROSA, boxShadow: "inset 0 0 0 3px #fff" }
            : { borderColor: "#cbd5e1", background: "#fff" }
        }
      />
      {etiqueta}
    </button>
  )
}

function Aviso({
  titulo,
  descripcion,
  onResponder,
}: {
  titulo: string
  descripcion: string
  onResponder: () => void
}) {
  return (
    <div className="flex h-full flex-col justify-end bg-black/40">
      <div className="relative overflow-hidden rounded-t-[26px] bg-white px-5 pt-6 pb-7 text-center">
        <div className="pointer-events-none absolute -top-14 -left-10 size-36 rounded-full bg-[radial-gradient(circle,rgba(251,71,97,0.14)_0%,transparent_70%)]" />
        <div className="relative">
          <div className="mx-auto mb-3.5 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-white to-[#fde8eb] shadow-[0_10px_25px_rgba(178,44,62,0.14)]">
            <MessageSquareText
              className="size-7"
              style={{ color: ROSA }}
              strokeWidth={1.8}
            />
          </div>
          <p
            className="mb-1 text-[10px] font-extrabold tracking-[0.06em] uppercase"
            style={{ color: ROSA }}
          >
            Encuesta de satisfacción
          </p>
          <h2 className="mb-1.5 text-[17px] leading-tight font-extrabold break-words">
            {titulo.trim() || "Título de la encuesta"}
          </h2>
          <p className="mb-4 text-[12px] leading-normal break-words text-[#64748b]">
            {descripcion.trim() ||
              "Tu opinión nos ayuda a mejorar. Cuéntanos cómo fue tu experiencia."}
          </p>
          <div className="mb-4 flex items-center gap-2.5 rounded-[12px] bg-[#f8f9fb] p-2.5 text-left">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#fde8eb]">
              <Clock className="size-4" style={{ color: ROSA }} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11.5px] font-bold">Solo te tomará un minuto</p>
              <p className="text-[10.5px] text-[#64748b]">
                Tus respuestas son confidenciales.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onResponder}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[13px] font-bold text-white"
            style={{ background: ROSA }}
          >
            <Send className="size-4" strokeWidth={2} />
            Responder encuesta
          </button>
        </div>
      </div>
    </div>
  )
}

function Gracias({ onContinuar }: { onContinuar: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
      <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-white to-[#fde8eb] shadow-[0_10px_25px_rgba(178,44,62,0.14)]">
        <CheckCircle2 className="size-10 text-[#22c55e]" strokeWidth={1.8} />
      </div>
      <p
        className="mb-1 text-[10px] font-extrabold tracking-[0.06em] uppercase"
        style={{ color: ROSA }}
      >
        Respuesta enviada
      </p>
      <h2 className="mb-2 text-[20px] font-extrabold">¡Gracias por tu tiempo!</h2>
      <p className="mb-6 text-[12.5px] leading-relaxed text-[#64748b]">
        Tu opinión nos ayuda a seguir mejorando nuestros procesos.
      </p>
      <button
        type="button"
        onClick={onContinuar}
        className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[13px] font-bold text-white"
        style={{ background: ROSA }}
      >
        <Send className="size-4" strokeWidth={2} />
        Continuar
      </button>
    </div>
  )
}
