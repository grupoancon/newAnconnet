"use client"

import { useRef, useState } from "react"
import { Camera, Upload, X } from "lucide-react"

import { CapturaDocumentoDialog } from "@/components/shared/captura-documento-dialog"
import { PillTabs } from "@/components/shared/pill-tabs"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  VentasApiError,
  procesarDocumentoIdentidad,
  type DatosDocumentoIdentidad,
  type EntradaDocumentoIdentidad,
} from "@/lib/api/ventas-api"

type ImagenCapturada = { base64: string; previewSrc: string }

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => {
      const resultado = String(lector.result ?? "")
      // readAsDataURL siempre agrega el prefijo "data:image/...;base64," — el backend
      // espera el base64 plano, sin ese prefijo.
      resolve(resultado.split(",")[1] ?? resultado)
    }
    lector.onerror = () => reject(lector.error ?? new Error("No se pudo leer el archivo"))
    lector.readAsDataURL(blob)
  })
}

// "Subir imagen" deja pasar cualquier archivo que el selector del sistema operativo
// muestre como imagen — en el celular eso incluye formatos que el backend rechaza (ej.
// HEIC, el formato por defecto de fotos en iPhone; o WEBP en algunos Android), aunque el
// archivo en si sea una imagen valida. Por eso no se manda el archivo tal cual: se
// decodifica y se re-codifica a JPEG real via canvas antes de convertirlo a base64,
// para garantizar que lo que llega al backend siempre sea un JPEG valido sin importar
// el formato original. (La camara en vivo ya genera JPEG directo, asi que no necesita
// este paso, pero pasa por la misma funcion para no mantener dos caminos distintos.)
async function archivoAJpegBase64(archivo: File): Promise<string> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(archivo)
  } catch {
    throw new Error(
      "No se pudo leer esa imagen — probá con otra foto (algunos formatos, como HEIC, no son compatibles)."
    )
  }

  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const contexto = canvas.getContext("2d")
  if (!contexto) {
    bitmap.close()
    throw new Error("No se pudo procesar la imagen.")
  }
  contexto.drawImage(bitmap, 0, 0)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  )
  if (!blob) {
    throw new Error("No se pudo procesar la imagen.")
  }
  return blobABase64(blob)
}

// Una casilla de foto individual: miniatura una vez capturada (con boton para
// quitarla), o los botones de camara/subir mientras esta vacia. "Tomar foto" abre
// CapturaDocumentoDialog (camara en vivo con recuadro guia); "Subir imagen" sigue
// siendo un input de archivo normal.
function CasillaImagen({
  titulo,
  imagen,
  disabled,
  onSeleccionar,
  onQuitar,
}: {
  titulo: string
  imagen: ImagenCapturada | null
  disabled: boolean
  onSeleccionar: (archivo: File) => void
  onQuitar: () => void
}) {
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  const [camaraAbierta, setCamaraAbierta] = useState(false)

  function manejarSeleccion(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    event.target.value = ""
    if (archivo) onSeleccionar(archivo)
  }

  return (
    <div className="border-input bg-card flex items-center gap-3 rounded-md border p-2.5">
      <input
        ref={inputArchivoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={manejarSeleccion}
      />

      {imagen ? (
        <button
          type="button"
          onClick={onQuitar}
          disabled={disabled}
          className="group relative size-12 shrink-0 overflow-hidden rounded-md"
          aria-label={`Quitar foto de ${titulo}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- preview local del archivo elegido, no una imagen remota que Next deba optimizar */}
          <img src={imagen.previewSrc} alt={titulo} className="size-full object-cover" />
          <span className="absolute inset-0 hidden items-center justify-center bg-black/50 group-hover:flex">
            <X className="size-4 text-white" strokeWidth={2} />
          </span>
        </button>
      ) : (
        <div className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-md">
          <Camera className="size-4" strokeWidth={1.6} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{titulo}</p>
        <p className="text-muted-foreground truncate text-[11px]">
          {imagen ? "Foto lista" : "Sin foto todavía"}
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled}
          onClick={() => setCamaraAbierta(true)}
          aria-label={`Tomar foto de ${titulo}`}
        >
          <Camera className="size-3.5" strokeWidth={1.8} />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled}
          onClick={() => inputArchivoRef.current?.click()}
          aria-label={`Subir imagen de ${titulo}`}
        >
          <Upload className="size-3.5" strokeWidth={1.8} />
        </Button>
      </div>

      {camaraAbierta ? (
        <CapturaDocumentoDialog
          titulo={titulo}
          onCapturar={(archivo) => {
            setCamaraAbierta(false)
            onSeleccionar(archivo)
          }}
          onCerrar={() => setCamaraAbierta(false)}
        />
      ) : null}
    </div>
  )
}

// El frontal de la cedula alcanza para nombre + numero de identificacion (el reverso
// no aportaba datos confiables, ver comentario en DOCUMENTO_IDENTIDAD_QUERIES del
// backend); el pasaporte es una sola pagina. Al completar la foto que corresponda se
// procesa automaticamente, sin un boton extra de "Enviar".
export function DocumentoIdentidadUploader({
  onDatos,
}: {
  onDatos: (datos: DatosDocumentoIdentidad) => void
}) {
  const toast = useToast()
  const [tipoDocumento, setTipoDocumento] = useState<"cedula" | "pasaporte">("cedula")
  const [frontal, setFrontal] = useState<ImagenCapturada | null>(null)
  // Solo se captura y se guarda en memoria — todavia no hay a donde mandarla, asi que
  // no pasa por procesarDocumentoIdentidad ni por ningun otro endpoint.
  const [papeletaVotacion, setPapeletaVotacion] = useState<ImagenCapturada | null>(null)
  const [pasaporte, setPasaporte] = useState<ImagenCapturada | null>(null)
  const [procesando, setProcesando] = useState(false)

  function cambiarTipo(siguiente: string) {
    setTipoDocumento(siguiente as "cedula" | "pasaporte")
    setFrontal(null)
    setPapeletaVotacion(null)
    setPasaporte(null)
  }

  async function procesar(entrada: EntradaDocumentoIdentidad) {
    setProcesando(true)
    try {
      const datos = await procesarDocumentoIdentidad(entrada)
      onDatos(datos)
      toast({
        variant: "success",
        description: "Documento procesado — revisa los datos rellenados.",
      })
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo procesar el documento",
        description:
          error instanceof VentasApiError ? error.message : "Intenta de nuevo.",
      })
    } finally {
      setProcesando(false)
    }
  }

  async function convertirOAvisar(archivo: File): Promise<string | null> {
    try {
      return await archivoAJpegBase64(archivo)
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo procesar la imagen",
        description: error instanceof Error ? error.message : "Intenta con otra foto.",
      })
      return null
    }
  }

  async function manejarFrontal(archivo: File) {
    const base64 = await convertirOAvisar(archivo)
    if (!base64) return
    setFrontal({ base64, previewSrc: `data:image/jpeg;base64,${base64}` })
    await procesar({ tipo: "cedula", imagenFrontal: base64 })
  }

  async function manejarPasaporte(archivo: File) {
    const base64 = await convertirOAvisar(archivo)
    if (!base64) return
    setPasaporte({ base64, previewSrc: `data:image/jpeg;base64,${base64}` })
    await procesar({ tipo: "pasaporte", imagen: base64 })
  }

  // Solo guarda la imagen localmente, no dispara ningun POST.
  async function manejarPapeletaVotacion(archivo: File) {
    const base64 = await convertirOAvisar(archivo)
    if (!base64) return
    setPapeletaVotacion({ base64, previewSrc: `data:image/jpeg;base64,${base64}` })
  }

  return (
    <div className="border-border bg-muted/40 mb-6 rounded-lg border border-dashed p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Escanear documento de identidad</p>
          <p className="text-muted-foreground text-xs">
            {tipoDocumento === "cedula"
              ? "Sube el frontal de la cédula para autocompletar nombre y cédula, y la papeleta de votación."
              : "Sube la página de datos del pasaporte para autocompletar los datos."}
          </p>
        </div>
        <PillTabs
          tabs={[
            { id: "cedula", label: "Cédula" },
            { id: "pasaporte", label: "Pasaporte" },
          ]}
          value={tipoDocumento}
          onChange={cambiarTipo}
        />
      </div>

      {tipoDocumento === "cedula" ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <CasillaImagen
            titulo="Frontal"
            imagen={frontal}
            disabled={procesando}
            onSeleccionar={(archivo) => void manejarFrontal(archivo)}
            onQuitar={() => setFrontal(null)}
          />
          <CasillaImagen
            titulo="Papeleta de votación"
            imagen={papeletaVotacion}
            disabled={procesando}
            onSeleccionar={(archivo) => void manejarPapeletaVotacion(archivo)}
            onQuitar={() => setPapeletaVotacion(null)}
          />
        </div>
      ) : (
        <CasillaImagen
          titulo="Documento"
          imagen={pasaporte}
          disabled={procesando}
          onSeleccionar={(archivo) => void manejarPasaporte(archivo)}
          onQuitar={() => setPasaporte(null)}
        />
      )}
    </div>
  )
}
