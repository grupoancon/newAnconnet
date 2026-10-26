"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "@/lib/navigation"
import {
  ArrowLeft,
  Check,
  CloudOff,
  MapPin,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import { DashboardTopbar } from "@/components/shared/dashboard-topbar"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Spinner } from "@/components/shared/spinner"
import { type StatusVariant } from "@/components/shared/status-badge"
import { useToast } from "@/components/shared/toast-provider"
import { Button } from "@/components/ui/button"
import {
  InventarioApiError,
  actualizarPosicionLote,
  listarInventario,
  obtenerProyecto,
  subirPlanoProyecto,
  type LoteInventario,
  type ProyectoInventario,
  type PuntoPlano,
} from "@/lib/api/inventario-api"
import { pdfPrimeraPaginaAImagen } from "@/lib/pdf-a-imagen"
import { guardarPlanoEnCache, leerPlanoDeCache } from "@/lib/plano-cache"
import { cn } from "@/lib/utils"

function formatearFechaCache(timestamp: number): string {
  return new Date(timestamp).toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Mismo mapeo que inventario-content.tsx/catalogo-content.tsx (ESTADO_VARIANTE) — cada
// pantalla lo repite porque cada una lo consume de forma distinta (tabla, grilla,
// marcadores), no vale la pena forzar un helper compartido para 8 líneas.
const ESTADO_VARIANTE: Record<string, StatusVariant> = {
  disponible: "disponible",
  libre: "disponible",
  reservado: "reservado",
  convenio: "hipotecado",
  vendido: "hipotecado",
  hipotecado: "hipotecado",
  bloqueado: "bloqueado",
  inactivo: "bloqueado",
}

function varianteDeLote(lote: LoteInventario): StatusVariant {
  const facturado = Boolean(lote.numFac?.trim()) && Boolean(lote.anioFac?.trim())
  if (facturado) return "hipotecado"
  const clave = (lote.estado ?? "").trim().toLowerCase()
  return ESTADO_VARIANTE[clave] ?? "pronto"
}

// Un lote en convenio ya está 100% vendido, pero igual se puede ubicar en el plano (a
// pedido del usuario, para no perder la forma ya mapeada) — se muestra en "Sin ubicar"/
// "Ubicados" como cualquier otro, solo que en el plano se renderiza distinto (azul muy
// discreto + marquita de check, sin código encima — ver CHECK_VENDIDO_CLASE).
function esConvenio(lote: LoteInventario): boolean {
  return (lote.estado ?? "").trim().toLowerCase() === "convenio"
}

const MARCADOR_COLOR: Record<string, string> = {
  disponible: "bg-status-disponible border-white",
  reservado: "bg-status-reservado border-white",
  hipotecado: "bg-status-hipotecado border-white",
  bloqueado: "bg-status-bloqueado border-white",
}
const MARCADOR_COLOR_DEFAULT = "bg-muted-foreground border-white"

// Mismo criterio de color que MARCADOR_COLOR, pero para el relleno de una zona
// rectangular en vez de un pin.
const ZONA_COLOR: Record<string, string> = {
  disponible: "border-status-disponible bg-status-disponible/25",
  reservado: "border-status-reservado bg-status-reservado/25",
  hipotecado: "border-status-hipotecado bg-status-hipotecado/25",
  bloqueado: "border-status-bloqueado bg-status-bloqueado/25",
}
const ZONA_COLOR_DEFAULT = "border-muted-foreground bg-muted-foreground/25"

// Mismo criterio pero en clases fill-*/stroke-* para el <polygon> SVG de una zona
// poligonal (ver plano_poligono) — no se puede reusar ZONA_COLOR porque ahí son
// utilidades de fondo/borde de un <div>, no de relleno/trazo SVG.
const POLIGONO_COLOR: Record<string, string> = {
  disponible: "fill-status-disponible/25 stroke-status-disponible",
  reservado: "fill-status-reservado/25 stroke-status-reservado",
  hipotecado: "fill-status-hipotecado/25 stroke-status-hipotecado",
  bloqueado: "fill-status-bloqueado/25 stroke-status-bloqueado",
}
const POLIGONO_COLOR_DEFAULT = "fill-muted-foreground/25 stroke-muted-foreground"

// Estilo especial para un lote en convenio (ya vendido) — azul muy transparente en vez
// del color de estado normal, para que quede discreto y no compita visualmente con los
// lotes disponibles; el código no se muestra encima, solo la marquita de check.
const ZONA_COLOR_VENDIDO = "border-blue-400/50 bg-blue-500/10"
const POLIGONO_COLOR_VENDIDO = "fill-blue-500/10 stroke-blue-400/50"
const CHECK_VENDIDO_CLASE =
  "flex size-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ring-2 ring-white"

// Distancia en píxeles de PANTALLA (no del % de la imagen) por debajo de la cual un
// click cerca del primer punto del polígono en curso lo cierra en vez de agregar un
// vértice nuevo ahí encima. Tiene que ser en píxeles de pantalla y no en % de imagen:
// con zoom aplicado, un % fijo de la imagen ocupa muchísimos más píxeles visibles en
// pantalla mientras más acercado estés, así que un umbral en % terminaba cerrando la
// forma con clicks que a simple vista estaban lejos del primer punto.
const UMBRAL_CERRAR_POLIGONO_PX = 18

function puntosATexto(puntos: PuntoPlano[]): string {
  return puntos.map((p) => `${p.x},${p.y}`).join(" ")
}

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_PASO = 0.5

// Tamaño visual (relativo al tamaño "normal" de la marquita de check) sin zoom y al
// zoom máximo — a diferencia de las etiquetas de código (que se contra-escalan del todo
// para quedar SIEMPRE del mismo tamaño), el check se ve un poco más chico sin zoom (más
// discreto) y un poco más grande acercando (más fácil de tocar/leer al ubicar). Es una
// escala amortiguada, no 1:1 con el zoom real, para que nunca vuelva a quedar gigante
// como pasaba sin contra-escalar nada.
const CHECK_ESCALA_VISUAL_MIN = 0.7
const CHECK_ESCALA_VISUAL_MAX = 1.2

function escalaVisualCheck(escala: number): number {
  const progreso = (escala - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)
  const visual =
    CHECK_ESCALA_VISUAL_MIN +
    (CHECK_ESCALA_VISUAL_MAX - CHECK_ESCALA_VISUAL_MIN) * progreso
  return visual / escala
}

// Por debajo de este movimiento (en píxeles de pantalla, sin importar el zoom actual) un
// gesto de 1 dedo/mouse se considera un click y no un arrastre — mismo umbral estándar
// que distingue "click" de "drag" en cualquier UI de mapas.
const UMBRAL_CLICK_PX = 6

type Punto = { x: number; y: number }

function distanciaEntrePuntos(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function puntoMedio(a: Touch, b: Touch): Punto {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

export function PlanoEditorContent({ idProyecto }: { idProyecto: number }) {
  const router = useRouter()
  const toast = useToast()
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  // visorRef = viewport fijo (overflow hidden, donde se enganchan los gestos).
  // imagenRef = capa interna con el transform scale/translate (imagen + marcadores) —
  // mismo esquema que CatalogoPlanosView, para que el zoom/pan se sienta igual en las
  // dos pantallas.
  const visorRef = useRef<HTMLDivElement>(null)
  const imagenRef = useRef<HTMLDivElement>(null)

  const [proyecto, setProyecto] = useState<ProyectoInventario | null>(null)
  const [lotes, setLotes] = useState<LoteInventario[]>([])
  const [imagenUrl, setImagenUrl] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subiendoPlano, setSubiendoPlano] = useState(false)
  const [loteActivoId, setLoteActivoId] = useState<number | null>(null)
  const [guardandoLoteId, setGuardandoLoteId] = useState<number | null>(null)

  const [escala, setEscala] = useState(ZOOM_MIN)
  const [translate, setTranslate] = useState<Punto>({ x: 0, y: 0 })
  const [interactuando, setInteractuando] = useState(false)
  const [dimensionesImagen, setDimensionesImagen] = useState<{
    ancho: number
    alto: number
  } | null>(null)

  // Rectángulo en progreso mientras se arrastra (porcentajes 0-100, sin normalizar —
  // x0/y0 es donde arrancó el gesto, x1/y1 sigue al puntero). null cuando no se está
  // dibujando. Ver crearGestorPuntero.
  const [dibujando, setDibujando] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)
  // "rapido" = click ubica un punto, arrastrar dibuja un rectángulo (comportamiento de
  // siempre). "poligono" = cada click agrega un vértice a puntosPoligono; se cierra
  // clickeando cerca del primer punto o con el botón "Guardar zona" del panel lateral.
  const [modoDibujo, setModoDibujo] = useState<"rapido" | "poligono">("rapido")
  const [puntosPoligono, setPuntosPoligono] = useState<PuntoPlano[]>([])
  // Solo true cuando se está mostrando la copia guardada en IndexedDB porque la carga
  // online falló (ver leerPlanoDeCache) — ahí se bloquea la edición porque cualquier
  // guardado contra el backend va a fallar igual sin conexión.
  const [modoOffline, setModoOffline] = useState(false)
  const [fechaCache, setFechaCache] = useState<number | null>(null)
  const [imagenCargada, setImagenCargada] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  // Refs espejo de los estados que el gestor de puntero (agregado una sola vez más
  // abajo) necesita leer en vivo — mismo motivo que en CatalogoPlanosView: los listeners
  // nativos se agregan en un efecto que corre una sola vez, así que leer el estado por
  // closure ahí adentro quedaría pegado al valor de cuando se agregaron.
  const escalaRef = useRef(escala)
  const translateRef = useRef(translate)
  const dimensionesRef = useRef(dimensionesImagen)
  const loteActivoIdRef = useRef(loteActivoId)
  const modoDibujoRef = useRef(modoDibujo)
  const puntosPoligonoRef = useRef(puntosPoligono)
  const modoOfflineRef = useRef(modoOffline)
  const pinchRef = useRef<{
    distanciaInicial: number
    escalaInicial: number
    medio: Punto
    translateInicial: Punto
  } | null>(null)
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    escalaRef.current = escala
  }, [escala])
  useEffect(() => {
    translateRef.current = translate
  }, [translate])
  useEffect(() => {
    dimensionesRef.current = dimensionesImagen
  }, [dimensionesImagen])
  useEffect(() => {
    loteActivoIdRef.current = loteActivoId
  }, [loteActivoId])
  useEffect(() => {
    modoDibujoRef.current = modoDibujo
  }, [modoDibujo])
  useEffect(() => {
    puntosPoligonoRef.current = puntosPoligono
  }, [puntosPoligono])
  useEffect(() => {
    modoOfflineRef.current = modoOffline
  }, [modoOffline])

  const cargar = useCallback(() => {
    setCargando(true)
    setError(null)
    setModoOffline(false)

    Promise.all([obtenerProyecto(idProyecto), listarInventario()])
      .then(([proyectoRes, lotesRes]) => {
        const lotesProyecto = lotesRes.filter((lote) => lote.id_proyecto === idProyecto)
        setProyecto(proyectoRes)
        setLotes(lotesProyecto)
        setImagenUrl(proyectoRes.plano_url)

        // Respaldo para la próxima vez que se abra este plano sin señal — si el
        // proyecto todavía no tiene plano subido no hay nada que cachear.
        if (proyectoRes.plano_url) {
          fetch(proyectoRes.plano_url)
            .then((respuesta) => respuesta.blob())
            .then((imagen) =>
              guardarPlanoEnCache({
                idProyecto,
                proyecto: proyectoRes,
                lotes: lotesProyecto,
                imagen,
              })
            )
            .catch(() => {
              // No se pudo bajar la imagen para cachearla — la pantalla ya está
              // funcionando online igual, solo no habrá respaldo para offline.
            })
        }
      })
      .catch(async (err) => {
        const cache = await leerPlanoDeCache(idProyecto)
        if (cache) {
          setProyecto(cache.proyecto)
          setLotes(cache.lotes)
          const url = URL.createObjectURL(cache.imagen)
          objectUrlRef.current = url
          setImagenUrl(url)
          setModoOffline(true)
          setFechaCache(cache.guardadoEn)
        } else {
          setError(
            err instanceof InventarioApiError
              ? err.message
              : "No se pudo conectar con el servidor"
          )
        }
      })
      .finally(() => setCargando(false))
  }, [idProyecto])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Cada vez que cambia la imagen (carga inicial, o se sube un plano nuevo) se resetea
  // todo (carga, zoom, pan) — si no, al cambiar de plano se vería el anterior "cargado"
  // un instante con la imagen nueva todavía en blanco, o con el zoom/pan viejo.
  useEffect(() => {
    setImagenCargada(false)
    setDimensionesImagen(null)
    setEscala(ZOOM_MIN)
    setTranslate({ x: 0, y: 0 })
  }, [imagenUrl])

  // El object URL de la imagen cacheada solo sirve mientras dure esta pestaña — hay
  // que liberarlo al salir de la pantalla o al reemplazarlo por otro para no dejar
  // memoria reservada de más.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  // Los lotes en convenio ya NO se excluyen acá — se pueden ubicar igual que cualquier
  // otro (ver esConvenio arriba), solo cambia cómo se dibujan en el plano.
  const lotesSinUbicar = useMemo(
    () => lotes.filter((l) => l.plano_x == null || l.plano_y == null),
    [lotes]
  )
  const lotesUbicados = useMemo(
    () => lotes.filter((l) => l.plano_x != null && l.plano_y != null),
    [lotes]
  )
  const loteActivo = useMemo(
    () => lotes.find((l) => l.id === loteActivoId) ?? null,
    [lotes, loteActivoId]
  )

  // Al cambiar de lote activo (o deseleccionar) se descarta cualquier polígono a medio
  // dibujar y se vuelve al modo rápido — dibujar el polígono de un lote no debe dejar
  // "arrastrado" ni el modo ni los vértices sueltos al pasar a ubicar otro.
  useEffect(() => {
    setModoDibujo("rapido")
    setPuntosPoligono([])
  }, [loteActivoId])

  async function manejarSeleccionArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    event.target.value = ""
    if (!archivo) return

    setSubiendoPlano(true)
    try {
      const imagen =
        archivo.type === "application/pdf"
          ? await pdfPrimeraPaginaAImagen(archivo)
          : archivo
      const actualizado = await subirPlanoProyecto(idProyecto, imagen)
      setProyecto(actualizado)
      toast({ variant: "success", description: "Plano actualizado." })
    } catch (err) {
      toast({
        variant: "error",
        title: "No se pudo subir el plano",
        description:
          err instanceof InventarioApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Intenta de nuevo en unos segundos.",
      })
    } finally {
      setSubiendoPlano(false)
    }
  }

  const guardarZona = useCallback(
    (
      id: number,
      zona: {
        planoX: number | null
        planoY: number | null
        planoX2?: number | null
        planoY2?: number | null
        planoPoligono?: PuntoPlano[] | null
      }
    ) => {
      setGuardandoLoteId(id)
      actualizarPosicionLote(id, zona)
        .then((actualizado) => {
          setLotes((anterior) => anterior.map((l) => (l.id === id ? actualizado : l)))
          setLoteActivoId(null)
        })
        .catch((err) => {
          toast({
            variant: "error",
            title: "No se pudo guardar la ubicación",
            description:
              err instanceof InventarioApiError
                ? err.message
                : "Intenta de nuevo en unos segundos.",
          })
        })
        .finally(() => setGuardandoLoteId(null))
    },
    [toast]
  )

  const guardarPoligono = useCallback(
    (id: number, puntos: PuntoPlano[]) => {
      if (puntos.length < 3) return
      const minX = Math.min(...puntos.map((p) => p.x))
      const minY = Math.min(...puntos.map((p) => p.y))
      guardarZona(id, { planoX: minX, planoY: minY, planoPoligono: puntos })
      setPuntosPoligono([])
    },
    [guardarZona]
  )

  function calcularPorcentajeEnImagen(clientX: number, clientY: number) {
    const rect = imagenRef.current!.getBoundingClientRect()
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  // Inversa de calcularPorcentajeEnImagen — para comparar un click (en píxeles de
  // pantalla) contra un punto ya guardado (en % de imagen), como al detectar si se
  // clickeó cerca del primer vértice del polígono en curso.
  function porcentajeAPantalla(punto: PuntoPlano) {
    const rect = imagenRef.current!.getBoundingClientRect()
    return {
      x: rect.left + (punto.x / 100) * rect.width,
      y: rect.top + (punto.y / 100) * rect.height,
    }
  }

  // Evita que el plano se pueda arrastrar/pellizcar hasta quedar fuera del visor —
  // idéntico a CatalogoPlanosView (ver comentario ahí).
  const limitarTranslate = useCallback((nuevaEscala: number, propuesto: Punto): Punto => {
    const visor = visorRef.current
    const dimensiones = dimensionesRef.current
    if (!visor || !dimensiones) return propuesto
    const anchoVisor = visor.clientWidth
    const altoVisor = visor.clientHeight
    const anchoImagen = anchoVisor * nuevaEscala
    const altoImagen = anchoVisor * (dimensiones.alto / dimensiones.ancho) * nuevaEscala

    const x =
      anchoImagen <= anchoVisor
        ? (anchoVisor - anchoImagen) / 2
        : Math.min(0, Math.max(anchoVisor - anchoImagen, propuesto.x))
    const y =
      altoImagen <= altoVisor
        ? (altoVisor - altoImagen) / 2
        : Math.min(0, Math.max(altoVisor - altoImagen, propuesto.y))
    return { x, y }
  }, [])

  // Cambia la escala manteniendo fijo el punto (en coordenadas del visor) bajo los
  // dedos/cursor — idéntico a CatalogoPlanosView.
  const aplicarZoom = useCallback(
    (escalaSinClamp: number, centro: Punto, escalaBase: number, translateBase: Punto) => {
      const nuevaEscala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, escalaSinClamp))
      const factor = nuevaEscala / escalaBase
      const nuevoTranslate = {
        x: centro.x - (centro.x - translateBase.x) * factor,
        y: centro.y - (centro.y - translateBase.y) * factor,
      }
      setEscala(nuevaEscala)
      setTranslate(limitarTranslate(nuevaEscala, nuevoTranslate))
    },
    [limitarTranslate]
  )

  // Listeners nativos (no onTouchStart/onWheel de React: se registran pasivos por
  // default y un preventDefault ahí adentro no hace nada — mismo motivo que en
  // CatalogoPlanosView). Combinan pellizco/arrastre/rueda/doble-click para mover el
  // plano (igual que el catálogo de solo lectura) CON la ubicación de lotes: un gesto de
  // 1 dedo/mouse dibuja un rectángulo o agrega un vértice de polígono si hay un lote
  // activo y el movimiento fue chico (~click); si no, es un arrastre y sirve para mover
  // el plano, no para ubicar nada.
  useEffect(() => {
    const visor = visorRef.current
    if (!visor) return

    // Arranca un gesto de 1 dedo/mouse — decide de una sola vez, al inicio, si este
    // gesto puede terminar dibujando un rectángulo o agregando un vértice (según haya
    // un lote activo y en qué modo), y devuelve las funciones para alimentarlo con cada
    // movimiento y con el final.
    function crearGestorPuntero(inicioX: number, inicioY: number) {
      const inicio = { x: inicioX, y: inicioY }
      const translateInicial = translateRef.current
      const idLote = loteActivoIdRef.current
      const puedeDibujarRectangulo =
        !modoOfflineRef.current && idLote != null && modoDibujoRef.current === "rapido"
      const puedeAgregarVertice =
        !modoOfflineRef.current && idLote != null && modoDibujoRef.current === "poligono"
      let movimientoMax = 0

      function mover(clientX: number, clientY: number) {
        movimientoMax = Math.max(
          movimientoMax,
          Math.hypot(clientX - inicio.x, clientY - inicio.y)
        )
        if (puedeDibujarRectangulo) {
          const desde = calcularPorcentajeEnImagen(inicio.x, inicio.y)
          const hasta = calcularPorcentajeEnImagen(clientX, clientY)
          setDibujando({ x0: desde.x, y0: desde.y, x1: hasta.x, y1: hasta.y })
        } else {
          setTranslate(
            limitarTranslate(escalaRef.current, {
              x: translateInicial.x + (clientX - inicio.x),
              y: translateInicial.y + (clientY - inicio.y),
            })
          )
          setInteractuando(true)
        }
      }

      function terminar(clientX: number, clientY: number) {
        setInteractuando(false)
        const esClick = movimientoMax < UMBRAL_CLICK_PX
        const redondear = (n: number) => Math.round(n * 10) / 10

        if (puedeDibujarRectangulo && idLote != null) {
          setDibujando(null)
          const desde = calcularPorcentajeEnImagen(inicio.x, inicio.y)
          const hasta = calcularPorcentajeEnImagen(clientX, clientY)
          if (esClick) {
            guardarZona(idLote, {
              planoX: redondear(hasta.x),
              planoY: redondear(hasta.y),
            })
          } else {
            const x0 = Math.min(desde.x, hasta.x)
            const x1 = Math.max(desde.x, hasta.x)
            const y0 = Math.min(desde.y, hasta.y)
            const y1 = Math.max(desde.y, hasta.y)
            guardarZona(idLote, {
              planoX: redondear(x0),
              planoY: redondear(y0),
              planoX2: redondear(x1),
              planoY2: redondear(y1),
            })
          }
          return
        }

        if (puedeAgregarVertice && esClick && idLote != null) {
          const punto = calcularPorcentajeEnImagen(clientX, clientY)
          const puntos = puntosPoligonoRef.current
          if (puntos.length >= 3) {
            const primeroPantalla = porcentajeAPantalla(puntos[0])
            const distanciaPx = Math.hypot(
              clientX - primeroPantalla.x,
              clientY - primeroPantalla.y
            )
            if (distanciaPx < UMBRAL_CERRAR_POLIGONO_PX) {
              guardarPoligono(idLote, puntos)
              return
            }
          }
          setPuntosPoligono((anterior) => [
            ...anterior,
            { x: Math.round(punto.x * 10) / 10, y: Math.round(punto.y * 10) / 10 },
          ])
        }
      }

      return { mover, terminar }
    }

    function onTouchStart(event: TouchEvent) {
      setInteractuando(true)
      if (event.touches.length === 2) {
        const [t1, t2] = [event.touches[0], event.touches[1]]
        const rect = visor!.getBoundingClientRect()
        const medioAbsoluto = puntoMedio(t1, t2)
        pinchRef.current = {
          distanciaInicial: distanciaEntrePuntos(t1, t2),
          escalaInicial: escalaRef.current,
          medio: { x: medioAbsoluto.x - rect.left, y: medioAbsoluto.y - rect.top },
          translateInicial: translateRef.current,
        }
        gestorTactilRef.current = null
      } else if (event.touches.length === 1) {
        gestorTactilRef.current = crearGestorPuntero(
          event.touches[0].clientX,
          event.touches[0].clientY
        )
        pinchRef.current = null
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault()
        const [t1, t2] = [event.touches[0], event.touches[1]]
        const { distanciaInicial, escalaInicial, medio, translateInicial } =
          pinchRef.current
        const nuevaEscala =
          escalaInicial * (distanciaEntrePuntos(t1, t2) / distanciaInicial)
        aplicarZoom(nuevaEscala, medio, escalaInicial, translateInicial)
      } else if (event.touches.length === 1) {
        event.preventDefault()
        if (!gestorTactilRef.current) {
          gestorTactilRef.current = crearGestorPuntero(
            event.touches[0].clientX,
            event.touches[0].clientY
          )
        }
        gestorTactilRef.current.mover(event.touches[0].clientX, event.touches[0].clientY)
      }
    }

    function onTouchEndOCancel(event: TouchEvent) {
      if (event.touches.length === 2) return
      pinchRef.current = null
      if (event.touches.length === 1) {
        gestorTactilRef.current = crearGestorPuntero(
          event.touches[0].clientX,
          event.touches[0].clientY
        )
      } else {
        // changedTouches trae la posición final del último dedo que se levantó.
        const ultimo = event.changedTouches[0]
        if (gestorTactilRef.current && ultimo) {
          gestorTactilRef.current.terminar(ultimo.clientX, ultimo.clientY)
        }
        gestorTactilRef.current = null
        setInteractuando(false)
      }
    }

    function onMouseDown(event: MouseEvent) {
      if (event.button !== 0) return
      const gestor = crearGestorPuntero(event.clientX, event.clientY)

      function onMove(moveEvent: MouseEvent) {
        gestor.mover(moveEvent.clientX, moveEvent.clientY)
      }
      function onUp(upEvent: MouseEvent) {
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
        gestor.terminar(upEvent.clientX, upEvent.clientY)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    }

    // Doble click para acercar de un salto — desactivado con un lote activo, donde un
    // doble click normalmente son 2 clicks de ubicación seguidos, no una intención de
    // zoom.
    function onDoubleClick(event: MouseEvent) {
      if (loteActivoIdRef.current != null) return
      const rect = visor!.getBoundingClientRect()
      const centro = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      aplicarZoom(
        escalaRef.current + ZOOM_PASO * 2,
        centro,
        escalaRef.current,
        translateRef.current
      )
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = visor!.getBoundingClientRect()
      const centro = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const nuevaEscalaSinClamp = escalaRef.current * Math.exp(-event.deltaY * 0.0015)
      aplicarZoom(nuevaEscalaSinClamp, centro, escalaRef.current, translateRef.current)

      setInteractuando(true)
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
      wheelTimeoutRef.current = setTimeout(() => setInteractuando(false), 200)
    }

    visor.addEventListener("touchstart", onTouchStart, { passive: true })
    visor.addEventListener("touchmove", onTouchMove, { passive: false })
    visor.addEventListener("touchend", onTouchEndOCancel, { passive: true })
    visor.addEventListener("touchcancel", onTouchEndOCancel, { passive: true })
    visor.addEventListener("mousedown", onMouseDown, { passive: true })
    visor.addEventListener("dblclick", onDoubleClick, { passive: true })
    visor.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      visor.removeEventListener("touchstart", onTouchStart)
      visor.removeEventListener("touchmove", onTouchMove)
      visor.removeEventListener("touchend", onTouchEndOCancel)
      visor.removeEventListener("touchcancel", onTouchEndOCancel)
      visor.removeEventListener("mousedown", onMouseDown)
      visor.removeEventListener("dblclick", onDoubleClick)
      visor.removeEventListener("wheel", onWheel)
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gestorTactilRef se declara
    // más abajo (junto a los demás refs de gesto) para no reordenar todo el archivo;
    // el efecto igual solo depende de los callbacks memoizados de la lista.
  }, [imagenUrl, aplicarZoom, limitarTranslate, guardarZona, guardarPoligono])

  // Gesto táctil de 1 dedo en curso (pan, o dibujo si hay lote activo) — separado del
  // mouse porque touchend no siempre trae el mismo evento que touchstart/touchmove.
  const gestorTactilRef = useRef<{
    mover: (x: number, y: number) => void
    terminar: (x: number, y: number) => void
  } | null>(null)

  function zoomBoton(delta: number) {
    const visor = visorRef.current
    const centro = visor
      ? { x: visor.clientWidth / 2, y: visor.clientHeight / 2 }
      : { x: 0, y: 0 }
    aplicarZoom(escala + delta, centro, escala, translate)
  }

  function restablecerZoom() {
    setEscala(ZOOM_MIN)
    setTranslate({ x: 0, y: 0 })
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardTopbar />
      <PageHeader
        eyebrow="Ventas · Inventario"
        title={proyecto ? `Plano — ${proyecto.nombre}` : "Plano del proyecto"}
        actions={
          <>
            <input
              ref={inputArchivoRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={manejarSeleccionArchivo}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={subiendoPlano || modoOffline}
              onClick={() => inputArchivoRef.current?.click()}
            >
              <Upload className="size-3.5" strokeWidth={1.8} />
              {subiendoPlano
                ? "Subiendo..."
                : proyecto?.plano_url
                  ? "Cambiar plano"
                  : "Subir plano"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="size-3.5" strokeWidth={1.8} />
              Volver
            </Button>
          </>
        }
      />

      {cargando ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center p-4 sm:p-6.5">
          <EmptyState title="No se pudo cargar el proyecto" description={error} dashed />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5 lg:flex-row lg:gap-5 lg:overflow-hidden lg:p-6.5">
          <div className="flex shrink-0 flex-col gap-2.5 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            {modoOffline ? (
              <div className="bg-status-reservado-bg text-status-reservado-fg flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[12.5px] font-semibold">
                <CloudOff className="size-4 shrink-0" strokeWidth={1.8} />
                Sin conexión — mostrando la última versión guardada
                {fechaCache ? ` (${formatearFechaCache(fechaCache)})` : ""}. No se puede
                editar hasta reconectarte.
              </div>
            ) : null}

            {imagenUrl ? (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={escala <= ZOOM_MIN}
                  onClick={() => zoomBoton(-ZOOM_PASO)}
                >
                  <ZoomOut className="size-3.5" strokeWidth={1.8} />
                </Button>
                <span className="text-muted-foreground w-11 text-center text-[12px] font-semibold">
                  {Math.round(escala * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={escala >= ZOOM_MAX}
                  onClick={() => zoomBoton(ZOOM_PASO)}
                >
                  <ZoomIn className="size-3.5" strokeWidth={1.8} />
                </Button>
                {escala !== ZOOM_MIN ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={restablecerZoom}
                  >
                    Restablecer
                  </Button>
                ) : null}
                <span className="text-muted-foreground hidden text-[11px] sm:inline">
                  Pellizcá o girá la rueda para acercar/alejar, arrastrá para moverte
                  (doble click también acerca)
                </span>
              </div>
            ) : null}

            <div className="h-[55vh] min-h-[320px] overflow-hidden lg:h-auto lg:flex-1">
              {!imagenUrl ? (
                <EmptyState
                  title="Este proyecto todavía no tiene un plano"
                  description="Subí un PDF (se toma la primera página) o una imagen con el botón 'Subir plano'."
                  dashed
                />
              ) : (
                <div
                  ref={visorRef}
                  className={cn(
                    "border-border relative h-full min-h-[420px] w-full touch-none overflow-hidden rounded-lg border select-none",
                    loteActivo && !modoOffline
                      ? "cursor-crosshair"
                      : escala > ZOOM_MIN
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-default"
                  )}
                >
                  {!imagenCargada ? (
                    <div className="bg-muted absolute inset-0 z-10 flex items-center justify-center">
                      <Spinner />
                    </div>
                  ) : null}

                  <div
                    ref={imagenRef}
                    style={{
                      transform: `translate(${translate.x}px, ${translate.y}px) scale(${escala})`,
                      transformOrigin: "0 0",
                    }}
                    className={cn(
                      "absolute top-0 left-0 w-full",
                      !interactuando && "transition-transform duration-150 ease-out"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- imagen dinámica (S3 online, o Blob cacheado offline), no un asset del proyecto */}
                    <img
                      src={imagenUrl}
                      alt={`Plano de ${proyecto?.nombre ?? "proyecto"}`}
                      onLoad={(event) => {
                        setImagenCargada(true)
                        setDimensionesImagen({
                          ancho: event.currentTarget.naturalWidth,
                          alto: event.currentTarget.naturalHeight,
                        })
                      }}
                      className={cn(
                        "block w-full transition-opacity duration-200",
                        imagenCargada ? "opacity-100" : "opacity-0"
                      )}
                      draggable={false}
                    />
                    {imagenCargada &&
                      lotesUbicados.map((lote) => {
                        const variante = varianteDeLote(lote)
                        const vendido = esConvenio(lote)
                        const esPoligono = (lote.plano_poligono?.length ?? 0) >= 3
                        const esZona =
                          !esPoligono && lote.plano_x2 != null && lote.plano_y2 != null

                        if (esPoligono) {
                          const puntos = lote.plano_poligono!
                          const minX = Math.min(...puntos.map((p) => p.x))
                          const maxX = Math.max(...puntos.map((p) => p.x))
                          const maxY = Math.max(...puntos.map((p) => p.y))
                          const cx =
                            puntos.reduce((suma, p) => suma + p.x, 0) / puntos.length
                          const cy =
                            puntos.reduce((suma, p) => suma + p.y, 0) / puntos.length
                          return (
                            <Fragment key={lote.id}>
                              <svg
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                                className="pointer-events-none absolute inset-0 h-full w-full"
                              >
                                <polygon
                                  points={puntosATexto(puntos)}
                                  vectorEffect="non-scaling-stroke"
                                  strokeWidth={2}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setLoteActivoId(lote.id)
                                  }}
                                  className={cn(
                                    "pointer-events-auto cursor-pointer",
                                    vendido
                                      ? POLIGONO_COLOR_VENDIDO
                                      : (POLIGONO_COLOR[variante] ??
                                          POLIGONO_COLOR_DEFAULT),
                                    guardandoLoteId === lote.id && "opacity-50",
                                    loteActivoId === lote.id &&
                                      "stroke-primary stroke-[3]"
                                  )}
                                >
                                  <title>{`${lote.codigo} — click para redibujar`}</title>
                                </polygon>
                              </svg>
                              {vendido ? (
                                <div
                                  style={{
                                    left: `${(minX + maxX) / 2}%`,
                                    top: `${maxY}%`,
                                    transform: `translate(-50%, -50%) scale(${escalaVisualCheck(escala)})`,
                                  }}
                                  className={cn(
                                    "pointer-events-none absolute",
                                    CHECK_VENDIDO_CLASE
                                  )}
                                >
                                  <Check className="size-3" strokeWidth={3} />
                                </div>
                              ) : (
                                // Etiqueta como HTML aparte (no dentro del SVG, que estira x/y de
                                // forma distinta según el aspect ratio de la imagen y deformaría el
                                // texto) — centrada en el centroide del polígono. Se contra-escala
                                // (scale(1/escala)) para que su tamaño en pantalla no crezca con el
                                // zoom del plano. translate y scale van en el MISMO elemento: el
                                // translate(-50%,-50%) centra el div sobre el punto y, como el
                                // origen de la escala es el centro (default), ese punto queda fijo
                                // sin importar cuánto se achique/agrande el contenido.
                                <div
                                  style={{
                                    left: `${cx}%`,
                                    top: `${cy}%`,
                                    transform: `translate(-50%, -50%) scale(${1 / escala})`,
                                  }}
                                  className="bg-card/90 pointer-events-none absolute rounded px-1 font-mono text-[10px] font-bold whitespace-nowrap shadow-sm"
                                >
                                  {lote.codigo}
                                </div>
                              )}
                            </Fragment>
                          )
                        }

                        if (esZona) {
                          return (
                            <button
                              key={lote.id}
                              type="button"
                              disabled={modoOffline}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                setLoteActivoId(lote.id)
                              }}
                              title={
                                modoOffline
                                  ? lote.codigo
                                  : `${lote.codigo} — click para redibujar`
                              }
                              style={{
                                left: `${lote.plano_x}%`,
                                top: `${lote.plano_y}%`,
                                width: `${lote.plano_x2! - lote.plano_x!}%`,
                                height: `${lote.plano_y2! - lote.plano_y!}%`,
                              }}
                              className={cn(
                                "absolute flex items-start justify-center border-2",
                                vendido
                                  ? ZONA_COLOR_VENDIDO
                                  : (ZONA_COLOR[variante] ?? ZONA_COLOR_DEFAULT),
                                guardandoLoteId === lote.id && "opacity-50",
                                loteActivoId === lote.id &&
                                  "ring-primary ring-2 ring-offset-1"
                              )}
                            >
                              {vendido ? (
                                // translate y scale van en el MISMO transform (no mezclados con
                                // utilidades -translate-x-1/2 de Tailwind: un style.transform
                                // inline pisa por completo cualquier transform de clase).
                                <div
                                  style={{
                                    left: "50%",
                                    top: "100%",
                                    transform: `translate(-50%, -50%) scale(${escalaVisualCheck(escala)})`,
                                  }}
                                  className={cn("absolute", CHECK_VENDIDO_CLASE)}
                                >
                                  <Check className="size-3" strokeWidth={3} />
                                </div>
                              ) : (
                                // Mismo motivo de contra-escala que en el polígono de arriba — acá
                                // el origen es "top center" porque el botón ya centra la etiqueta
                                // arriba con items-start/justify-center.
                                <div
                                  style={{
                                    transform: `scale(${1 / escala})`,
                                    transformOrigin: "top center",
                                  }}
                                  className="mt-0.5"
                                >
                                  <span className="bg-card/90 rounded px-1 font-mono text-[10px] font-bold whitespace-nowrap shadow-sm">
                                    {lote.codigo}
                                  </span>
                                </div>
                              )}
                            </button>
                          )
                        }

                        if (vendido) {
                          // Sin pin, sin código — solo la marquita de check en el punto ubicado,
                          // bien discreta para no competir con los lotes disponibles.
                          return (
                            <button
                              key={lote.id}
                              type="button"
                              disabled={modoOffline}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                setLoteActivoId(lote.id)
                              }}
                              title={
                                modoOffline
                                  ? lote.codigo
                                  : `${lote.codigo} — click para reubicar`
                              }
                              style={{
                                left: `${lote.plano_x}%`,
                                top: `${lote.plano_y}%`,
                                transform: `translate(-50%, -50%) scale(${escalaVisualCheck(escala)})`,
                              }}
                              className={cn(
                                "absolute",
                                CHECK_VENDIDO_CLASE,
                                guardandoLoteId === lote.id && "opacity-50",
                                loteActivoId === lote.id && "ring-primary ring-2"
                              )}
                            >
                              <Check className="size-3" strokeWidth={3} />
                            </button>
                          )
                        }

                        return (
                          // Mismo motivo de contra-escala que arriba — translate y scale van en el
                          // MISMO elemento con transform-origin "bottom center" (el punto del pin,
                          // que es lo que translate(-50%,-100%) ancla ahí): eso deja ese punto fijo
                          // sin importar cuánto se achique/agrande el pin. Iba en 2 divs anidados
                          // antes, pero eso hacía que el offset de anclaje se encogiera junto con
                          // el pin y el punto se corriera del lote a medida que se hacía zoom.
                          <button
                            key={lote.id}
                            type="button"
                            disabled={modoOffline}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation()
                              setLoteActivoId(lote.id)
                            }}
                            title={
                              modoOffline
                                ? lote.codigo
                                : `${lote.codigo} — click para reubicar, arrastrá para dibujar una zona`
                            }
                            style={{
                              left: `${lote.plano_x}%`,
                              top: `${lote.plano_y}%`,
                              transform: `translate(-50%, -100%) scale(${1 / escala})`,
                              transformOrigin: "bottom center",
                            }}
                            className={cn(
                              "absolute flex flex-col items-center",
                              guardandoLoteId === lote.id && "opacity-50"
                            )}
                          >
                            <span
                              className={cn(
                                "rounded-full border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold whitespace-nowrap text-white shadow-sm",
                                MARCADOR_COLOR[variante] ?? MARCADOR_COLOR_DEFAULT,
                                loteActivoId === lote.id &&
                                  "ring-primary ring-2 ring-offset-1"
                              )}
                            >
                              {lote.codigo}
                            </span>
                            <MapPin
                              className={cn(
                                "-mt-px size-5 drop-shadow",
                                loteActivoId === lote.id
                                  ? "text-primary"
                                  : "text-foreground"
                              )}
                              strokeWidth={2}
                              fill="currentColor"
                            />
                          </button>
                        )
                      })}

                    {dibujando ? (
                      <div
                        style={{
                          left: `${Math.min(dibujando.x0, dibujando.x1)}%`,
                          top: `${Math.min(dibujando.y0, dibujando.y1)}%`,
                          width: `${Math.abs(dibujando.x1 - dibujando.x0)}%`,
                          height: `${Math.abs(dibujando.y1 - dibujando.y0)}%`,
                        }}
                        className="border-primary bg-primary/15 pointer-events-none absolute border-2 border-dashed"
                      />
                    ) : null}

                    {modoDibujo === "poligono" && puntosPoligono.length > 0 ? (
                      <>
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          className="pointer-events-none absolute inset-0 h-full w-full"
                        >
                          {puntosPoligono.length >= 2 ? (
                            <polyline
                              points={puntosATexto(puntosPoligono)}
                              fill="none"
                              vectorEffect="non-scaling-stroke"
                              strokeWidth={2}
                              strokeDasharray="4 3"
                              className="stroke-primary"
                            />
                          ) : null}
                          {puntosPoligono.length >= 3 ? (
                            <polygon
                              points={puntosATexto(puntosPoligono)}
                              className="fill-primary/15 pointer-events-none"
                            />
                          ) : null}
                        </svg>
                        {puntosPoligono.map((punto, indice) => (
                          <div
                            key={indice}
                            style={{ left: `${punto.x}%`, top: `${punto.y}%` }}
                            className={cn(
                              "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm",
                              indice === 0 && puntosPoligono.length >= 3
                                ? "bg-primary size-3.5 animate-pulse"
                                : "bg-primary size-2.5"
                            )}
                          />
                        ))}
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-border bg-card max-h-[50vh] w-full shrink-0 overflow-y-auto rounded-lg border p-4 lg:max-h-none lg:w-72">
            {loteActivo ? (
              <div className="bg-accent text-accent-foreground mb-4 rounded-md p-3 text-[12.5px]">
                <div className="font-bold">Ubicando {loteActivo.codigo}</div>

                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setModoDibujo("rapido")
                      setPuntosPoligono([])
                    }}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-bold transition-colors",
                      modoDibujo === "rapido"
                        ? "border-primary bg-card"
                        : "border-transparent opacity-70 hover:opacity-100"
                    )}
                  >
                    Punto / rectángulo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoDibujo("poligono")}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-bold transition-colors",
                      modoDibujo === "poligono"
                        ? "border-primary bg-card"
                        : "border-transparent opacity-70 hover:opacity-100"
                    )}
                  >
                    Polígono
                  </button>
                </div>

                {modoDibujo === "rapido" ? (
                  <div className="mt-2">
                    Click rápido para un punto simple, o arrastrá para dibujar el
                    rectángulo del lote.
                  </div>
                ) : (
                  <div className="mt-2">
                    Click en el plano para ir marcando cada esquina del lote. Con 3 o más
                    puntos, cerrá clickeando cerca del primero (parpadea) o con
                    &quot;Guardar zona&quot;.
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={puntosPoligono.length === 0}
                        onClick={() =>
                          setPuntosPoligono((anterior) => anterior.slice(0, -1))
                        }
                        className="rounded-md border border-current px-2 py-1 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Deshacer punto
                      </button>
                      <button
                        type="button"
                        disabled={puntosPoligono.length < 3}
                        onClick={() => guardarPoligono(loteActivo.id, puntosPoligono)}
                        className="rounded-md border border-current px-2 py-1 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Guardar zona
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setLoteActivoId(null)}
                  className="mt-2 text-[11px] font-bold underline"
                >
                  Cancelar
                </button>
              </div>
            ) : null}

            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase">
                Sin ubicar ({lotesSinUbicar.length})
              </h3>
            </div>
            <div className="mb-5 space-y-1">
              {lotesSinUbicar.length === 0 ? (
                <p className="text-muted-foreground text-[12px]">
                  Todos los lotes ya están en el plano.
                </p>
              ) : (
                lotesSinUbicar.map((lote) => (
                  <button
                    key={lote.id}
                    type="button"
                    disabled={modoOffline}
                    onClick={() => setLoteActivoId(lote.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      loteActivoId === lote.id
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <span className="font-mono">{lote.codigo}</span>
                    <MapPin
                      className="text-muted-foreground size-3.5"
                      strokeWidth={1.8}
                    />
                  </button>
                ))
              )}
            </div>

            <h3 className="mb-1.5 text-xs font-extrabold uppercase">
              Ubicados ({lotesUbicados.length})
            </h3>
            <div className="space-y-1">
              {lotesUbicados.map((lote) => (
                <div
                  key={lote.id}
                  className="border-border flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold"
                >
                  <span className="font-mono">{lote.codigo}</span>
                  <button
                    type="button"
                    disabled={modoOffline}
                    onClick={() => guardarZona(lote.id, { planoX: null, planoY: null })}
                    title="Quitar del plano"
                    className="text-muted-foreground hover:text-status-bloqueado-fg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
