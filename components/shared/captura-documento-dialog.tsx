"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, X } from "lucide-react"

import { Button } from "@/components/ui/button"

// El <video> se muestra con object-cover: se escala (por el lado mas chico) para llenar
// su caja y recorta lo que sobra del otro lado, centrado. Para saber que parte del
// frame nativo de la camara corresponde al recuadro guia (dibujado encima, en pixeles
// CSS) hay que deshacer ese mismo escalado/recorte. Devuelve el area en pixeles nativos
// del video lista para pasarle a drawImage como source rect.
function calcularRecorte(
  video: HTMLVideoElement,
  marco: HTMLElement
): { sx: number; sy: number; sWidth: number; sHeight: number } | null {
  const cajaVideo = video.getBoundingClientRect()
  const cajaMarco = marco.getBoundingClientRect()
  if (cajaVideo.width === 0 || cajaVideo.height === 0) return null

  const escala = Math.max(
    cajaVideo.width / video.videoWidth,
    cajaVideo.height / video.videoHeight
  )
  const anchoVirtual = video.videoWidth * escala
  const altoVirtual = video.videoHeight * escala
  const recorteX = (anchoVirtual - cajaVideo.width) / 2
  const recorteY = (altoVirtual - cajaVideo.height) / 2

  // Posicion del marco relativa a la caja del video, en pixeles CSS.
  const relX = cajaMarco.left - cajaVideo.left
  const relY = cajaMarco.top - cajaVideo.top

  const sx = (relX + recorteX) / escala
  const sy = (relY + recorteY) / escala
  const sWidth = cajaMarco.width / escala
  const sHeight = cajaMarco.height / escala

  // Clamp por si el recuadro quedara fuera del frame real (no deberia pasar con el
  // layout actual, pero evita pedirle a drawImage un area invalida).
  const sxClamped = Math.max(0, Math.min(sx, video.videoWidth))
  const syClamped = Math.max(0, Math.min(sy, video.videoHeight))
  const sWidthClamped = Math.max(0, Math.min(sWidth, video.videoWidth - sxClamped))
  const sHeightClamped = Math.max(0, Math.min(sHeight, video.videoHeight - syClamped))

  return { sx: sxClamped, sy: syClamped, sWidth: sWidthClamped, sHeight: sHeightClamped }
}

// Camara en vivo con un recuadro guia superpuesto (proporcion tipo tarjeta de
// identidad, ~1.6:1) para que el usuario alinee el documento antes de disparar. La
// foto capturada se recorta a lo que queda dentro del recuadro. Es solo ayuda visual —
// no hay deteccion de bordes ni bloqueo automatico si el documento queda fuera del
// recuadro, eso requeriria vision por computadora (fuera de alcance).
export function CapturaDocumentoDialog({
  titulo,
  onCapturar,
  onCerrar,
}: {
  titulo: string
  onCapturar: (archivo: File) => void
  onCerrar: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const marcoRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    // getUserMedia solo existe en un "contexto seguro" (HTTPS, o localhost). Si el
    // sitio se sirve por HTTP en una IP de red (ej. abrir la app desde el celular con
    // http://192.168.x.x:3002), navigator.mediaDevices queda undefined y el navegador
    // ni siquiera llega a pedir el permiso — por eso el error distingue este caso del
    // de un navegador realmente sin soporte.
    if (!window.isSecureContext) {
      setError(
        "La cámara requiere una conexión segura (HTTPS). Este sitio se está abriendo por HTTP, así que el navegador no la expone. Prueba en localhost o publica el sitio con HTTPS."
      )
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no puede acceder a la cámara.")
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(() => {
        setError("No se pudo acceder a la cámara. Revisa los permisos del navegador.")
      })

    return () => {
      cancelado = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function capturar() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement("canvas")
    const contexto = canvas.getContext("2d")
    if (!contexto) return

    const recorte = marcoRef.current ? calcularRecorte(video, marcoRef.current) : null
    if (recorte && recorte.sWidth > 0 && recorte.sHeight > 0) {
      canvas.width = recorte.sWidth
      canvas.height = recorte.sHeight
      contexto.drawImage(
        video,
        recorte.sx,
        recorte.sy,
        recorte.sWidth,
        recorte.sHeight,
        0,
        0,
        recorte.sWidth,
        recorte.sHeight
      )
    } else {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      contexto.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapturar(new File([blob], "captura.jpg", { type: "image/jpeg" }))
      },
      "image/jpeg",
      0.92
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-semibold text-white">{titulo}</span>
        <button
          type="button"
          onClick={onCerrar}
          className="text-white"
          aria-label="Cerrar cámara"
        >
          <X className="size-5" strokeWidth={2} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <p className="max-w-xs text-center text-sm text-white">{error}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div
                ref={marcoRef}
                className="aspect-[1.6/1] w-full max-w-sm rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              />
            </div>
            <p className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 text-center text-xs text-white/90">
              Alinea el documento dentro del recuadro
            </p>
          </>
        )}
      </div>

      <div className="flex justify-center p-6">
        <Button
          type="button"
          size="lg"
          disabled={!!error}
          onClick={capturar}
          className="rounded-full"
        >
          <Camera className="size-4" strokeWidth={2} />
          Capturar
        </Button>
      </div>
    </div>
  )
}
