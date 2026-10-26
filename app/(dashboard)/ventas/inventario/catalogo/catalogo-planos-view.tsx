"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, MapPin, Search, X, ZoomIn, ZoomOut } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LoteInventario, ProyectoInventario } from "@/lib/api/inventario-api"
import { guardarPlanoEnCache } from "@/lib/plano-cache"
import { cn } from "@/lib/utils"
import { esConvenio, normalizarEstado, numeroDeLote } from "./catalogo-helpers"

// En el plano los lotes con estado "hipotecado" van en amarillo para distinguirlos de
// vendido/facturado, que comparten la variante "hipotecado" (azul) en el resto de la app.
const CLAVE_HIPOTECADO_PLANO = "hipotecado-plano"

const MARCADOR_COLOR: Record<string, string> = {
  disponible: "bg-status-disponible border-white",
  reservado: "bg-status-reservado border-white",
  hipotecado: "bg-status-hipotecado border-white",
  bloqueado: "bg-status-bloqueado border-white",
  [CLAVE_HIPOTECADO_PLANO]: "bg-yellow-400 border-white text-yellow-950",
}
const MARCADOR_COLOR_DEFAULT = "bg-muted-foreground border-white"

// Mismo criterio de color que MARCADOR_COLOR, pero para el relleno de una zona
// rectangular (ver plano_x2/plano_y2 en LoteInventario) en vez de un pin.
const ZONA_COLOR: Record<string, string> = {
  disponible: "border-status-disponible bg-status-disponible/25",
  reservado: "border-status-reservado bg-status-reservado/25",
  hipotecado: "border-status-hipotecado bg-status-hipotecado/25",
  bloqueado: "border-status-bloqueado bg-status-bloqueado/25",
  [CLAVE_HIPOTECADO_PLANO]: "border-yellow-400 bg-yellow-400/40",
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
  [CLAVE_HIPOTECADO_PLANO]: "fill-yellow-400/40 stroke-yellow-400",
}
const POLIGONO_COLOR_DEFAULT = "fill-muted-foreground/25 stroke-muted-foreground"

// Un lote en convenio ya está 100% vendido — se sigue mostrando en el plano (a pedido
// del usuario, para no perder la forma ya mapeada) pero deliberadamente discreto: azul
// en vez del verde/color de estado normal, muy transparente, y SIN el código encima —
// la marquita de check (ver CHECK_VENDIDO_CLASE) alcanza para distinguirlo sin competir
// visualmente con los lotes disponibles.
const ZONA_COLOR_VENDIDO = "border-blue-400/50 bg-blue-500/10"
const POLIGONO_COLOR_VENDIDO = "fill-blue-500/10 stroke-blue-400/50"
const CHECK_VENDIDO_CLASE =
  "flex size-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ring-2 ring-white"

// Leyenda del plano: qué significa cada color. El orden es el que se muestra; solo
// aparecen los que tiene al menos un lote del proyecto (ver clavesEnPlano).
const LEYENDA_PLANO: { clave: string; texto: string; muestra: string }[] = [
  {
    clave: "disponible",
    texto: "Libre",
    muestra: "border-status-disponible bg-status-disponible/25",
  },
  {
    clave: "reservado",
    texto: "Reservado",
    muestra: "border-status-reservado bg-status-reservado/25",
  },
  {
    clave: CLAVE_HIPOTECADO_PLANO,
    texto: "Hipotecado",
    muestra: "border-yellow-400 bg-yellow-400/40",
  },
  {
    clave: "hipotecado",
    texto: "Vendido / Facturado",
    muestra: "border-status-hipotecado bg-status-hipotecado/25",
  },
  {
    clave: "bloqueado",
    texto: "Bloqueado",
    muestra: "border-status-bloqueado bg-status-bloqueado/25",
  },
  {
    clave: "pronto",
    texto: "Sin estado",
    muestra: "border-muted-foreground bg-muted-foreground/25",
  },
]

// Misma regla que en el render: el amarillo es solo para estado "hipotecado" (no
// vendido/facturado, que comparten la variante azul).
function claveColorPlano(lote: LoteInventario): string {
  const { label, variant } = normalizarEstado(lote)
  return label === "Hipotecado" ? CLAVE_HIPOTECADO_PLANO : variant
}

const ESCALA_MIN = 1
// Cuánto hay que mover el mouse con el botón apretado para que cuente como arrastre
// (y no como click sobre un lote).
const UMBRAL_ARRASTRE_PX = 4
const ESCALA_MAX = 6
// En el celular los lotes se ven muy chicos, así que se deja acercar más.
const ESCALA_MAX_MOVIL = 8

// Y no se deja alejar por debajo de 300%: a menos zoom el plano queda ilegible.
const ESCALA_MIN_MOVIL = 3

function esPantallaAngostaAhora(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
}

function escalaMinima(): number {
  return esPantallaAngostaAhora() ? ESCALA_MIN_MOVIL : ESCALA_MIN
}

function escalaMaxima(): number {
  return esPantallaAngostaAhora() ? ESCALA_MAX_MOVIL : ESCALA_MAX
}

const PASO_BOTON = 0.5

// Tamaño visual (relativo al tamaño "normal" de la marquita de check) sin zoom y al
// zoom máximo — a diferencia de las etiquetas de código (que se contra-escalan del
// todo para quedar SIEMPRE del mismo tamaño), el check se ve un poco más chico sin zoom
// (más discreto, no compite con los lotes disponibles) y un poco más grande acercando
// (más fácil de tocar/leer). Es una escala amortiguada, no 1:1 con el zoom real, para
// que nunca vuelva a quedar gigante como pasaba sin contra-escalar nada.
const CHECK_ESCALA_VISUAL_MIN = 0.7
const CHECK_ESCALA_VISUAL_MAX = 1.2

function escalaVisualCheck(escala: number): number {
  const progreso = Math.min(1, (escala - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN))
  const visual =
    CHECK_ESCALA_VISUAL_MIN +
    (CHECK_ESCALA_VISUAL_MAX - CHECK_ESCALA_VISUAL_MIN) * progreso
  return visual / escala
}

// En el celular los lotes ocupan muy pocos píxeles en pantalla, así que las marcas
// (checks, etiquetas, bordes) se achican para no taparse entre sí ni tapar el plano.
const FACTOR_CHECK_MOVIL = 0.6
const FACTOR_ETIQUETA_MOVIL = 0.8
const BORDE_ZONA_PX = 2
const BORDE_ZONA_MOVIL_PX = 1

type Punto = { x: number; y: number }

function distanciaEntrePuntos(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function puntoMedio(a: Touch, b: Touch): Punto {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

// Vista "Planos": solo lectura, un proyecto a la vez — el editor con click-para-ubicar
// vive aparte en /ventas/inventario/plano/[id] (gateado por "proyectos:gestion"); acá
// cualquiera con acceso al catálogo puede ver dónde está cada lote sin poder moverlo.
//
// Zoom con pellizco (2 dedos) + arrastre con 1 dedo, pensado para verse bien en el
// celular (un asesor mostrándole el plano a un cliente en el sitio) — más los botones
// +/- para cuando no hay pantalla táctil. Implementado con transform:scale/translate
// sobre un visor de alto fijo (overflow hidden) en vez de zoom nativo del navegador,
// porque necesitamos que los marcadores (posicionados en % sobre la misma capa) se
// sigan viendo alineados en cualquier nivel de zoom.
//
// Los listeners de touch se agregan "a mano" con addEventListener (no onTouchStart/
// onTouchMove de React) porque React registra touchstart/touchmove como pasivos por
// default — un event.preventDefault() adentro de un handler de React ahí no hace nada,
// y sin eso el navegador termina scrolleando la página en vez de mover el plano. Por el
// mismo motivo la lectura de escala/translate/dimensiones adentro de esos handlers usa
// refs en vez del estado directo: el efecto que los agrega corre una sola vez (no en
// cada render), así que si leyera el estado por closure quedaría pegado al valor de
// cuando se agregó el listener.
export function CatalogoPlanosView({
  proyectos,
  lotes,
  onSeleccionarLote,
  modoOffline = false,
}: {
  proyectos: ProyectoInventario[]
  lotes: LoteInventario[]
  onSeleccionarLote: (lote: LoteInventario) => void
  // true cuando el padre (InventarioCatalogoContent) ya está mostrando el respaldo
  // offline — en ese caso proyecto.plano_url es un object URL de un Blob (no una URL de
  // red real), así que no tiene sentido volver a cachearlo.
  modoOffline?: boolean
}) {
  const proyectosConPlano = useMemo(
    () => proyectos.filter((p) => p.plano_url),
    [proyectos]
  )
  const [proyectoId, setProyectoId] = useState<string>("")
  const [imagenCargada, setImagenCargada] = useState(false)
  const [dimensionesImagen, setDimensionesImagen] = useState<{
    ancho: number
    alto: number
  } | null>(null)
  const [escala, setEscala] = useState(ESCALA_MIN)
  const [translate, setTranslate] = useState<Punto>({ x: 0, y: 0 })
  const [interactuando, setInteractuando] = useState(false)
  // Mobile: el plano suele ser apaisado y a "ancho completo" queda diminuto en un visor
  // alto. Al cargar se ajusta el alto del visor al plano y se arranca con zoom para que
  // se lea; `vistaInicialRef` guarda ese encuadre para "Restablecer".
  const [altoVisorMovil, setAltoVisorMovil] = useState<number | null>(null)
  const [esPantallaAngosta, setEsPantallaAngosta] = useState(false)
  const vistaInicialRef = useRef<{ escala: number; translate: Punto } | null>(null)
  const [busquedaLote, setBusquedaLote] = useState("")
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [loteResaltadoId, setLoteResaltadoId] = useState<number | null>(null)
  const resaltadoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visorRef = useRef<HTMLDivElement>(null)
  const escalaRef = useRef(escala)
  const translateRef = useRef(translate)
  const dimensionesRef = useRef(dimensionesImagen)
  const pinchRef = useRef<{
    distanciaInicial: number
    escalaInicial: number
    medio: Punto
    translateInicial: Punto
  } | null>(null)
  const panRef = useRef<{ punto: Punto; translateInicial: Punto } | null>(null)
  const mousePanRef = useRef<{
    punto: Punto
    translateInicial: Punto
    movido: boolean
  } | null>(null)
  // true justo después de soltar un arrastre de mouse que sí movió el plano — el click
  // que el navegador dispara a continuación NO debe abrir el lote que quedó debajo.
  const ignorarSiguienteClickRef = useRef(false)
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

  const proyectoSeleccionado = useMemo(
    () =>
      proyectosConPlano.find((p) => String(p.id) === proyectoId) ??
      proyectosConPlano[0] ??
      null,
    [proyectosConPlano, proyectoId]
  )

  // Se resetea todo (carga, zoom, pan, búsqueda) cada vez que cambia el plano mostrado
  // — si no, al cambiar de proyecto se vería el plano anterior "cargado" (o con el zoom
  // o la búsqueda viejos) un instante con la imagen nueva todavía en blanco.
  useEffect(() => {
    setImagenCargada(false)
    setDimensionesImagen(null)
    setEscala(ESCALA_MIN)
    setTranslate({ x: 0, y: 0 })
    setAltoVisorMovil(null)
    vistaInicialRef.current = null
    setBusquedaLote("")
    setMostrarSugerencias(false)
    setLoteResaltadoId(null)
  }, [proyectoSeleccionado?.plano_url])

  // El timeout que apaga el resaltado no debe seguir corriendo si el componente ya se
  // desmontó (ej. se cambió de pestaña del catálogo).
  useEffect(() => {
    return () => {
      if (resaltadoTimeoutRef.current) clearTimeout(resaltadoTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 639px)")
    const actualizar = () => setEsPantallaAngosta(consulta.matches)
    actualizar()
    consulta.addEventListener("change", actualizar)
    return () => consulta.removeEventListener("change", actualizar)
  }, [])
  const factorCheck = esPantallaAngosta ? FACTOR_CHECK_MOVIL : 1
  const factorEtiqueta = esPantallaAngosta ? FACTOR_ETIQUETA_MOVIL : 1
  // Los bordes de las zonas rectangulares son de un <div> que se escala con el plano —
  // se divide por el zoom para que en pantalla queden siempre del mismo grosor.
  const bordeZona = (esPantallaAngosta ? BORDE_ZONA_MOVIL_PX : BORDE_ZONA_PX) / escala

  // Los lotes en convenio ya NO se excluyen acá — se muestran en el plano con estilo
  // discreto (ver ZONA_COLOR_VENDIDO/POLIGONO_COLOR_VENDIDO/CHECK_VENDIDO_CLASE en el
  // render) en vez de ocultarse por completo.
  const lotesDelProyecto = useMemo(
    () =>
      proyectoSeleccionado
        ? lotes.filter(
            (l) =>
              l.id_proyecto === proyectoSeleccionado.id &&
              l.plano_x != null &&
              l.plano_y != null
          )
        : [],
    [lotes, proyectoSeleccionado]
  )

  const clavesEnPlano = useMemo(
    () =>
      new Set(
        lotesDelProyecto.filter((l) => !esConvenio(l)).map((l) => claveColorPlano(l))
      ),
    [lotesDelProyecto]
  )
  const hayConvenioEnPlano = useMemo(
    () => lotesDelProyecto.some((l) => esConvenio(l)),
    [lotesDelProyecto]
  )

  const sugerenciasLote = useMemo(() => {
    const termino = busquedaLote.trim().toLowerCase()
    if (!termino) return []
    return lotesDelProyecto
      .filter((l) => l.codigo?.toLowerCase().includes(termino))
      .slice(0, 8)
  }, [lotesDelProyecto, busquedaLote])

  // Evita que el plano se pueda arrastrar/pellizcar hasta quedar fuera del visor — a
  // escala 1 siempre queda fijo en {0,0}; si la imagen (ya escalada) es más chica que
  // el visor en algún eje, se centra en ese eje en vez de pegarse a una esquina.
  // Envuelto en useCallback (deps vacías): solo lee de refs y del DOM, nunca de
  // estado/props por closure, así que es seguro que el efecto de más abajo lo use sin
  // volver a agregar los listeners en cada render.
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
  // dedos o el cursor — sin esto, cada pellizco "saltaría" el plano hacia la esquina en
  // vez de acercarse hacia donde el usuario puso los dedos. Mismo motivo de useCallback
  // que limitarTranslate: solo usa sus parámetros y setters estables.
  const aplicarZoom = useCallback(
    (escalaSinClamp: number, centro: Punto, escalaBase: number, translateBase: Punto) => {
      const nuevaEscala = Math.min(
        escalaMaxima(),
        Math.max(escalaMinima(), escalaSinClamp)
      )
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

  // Listeners nativos (ver comentario grande arriba) — se agregan una sola vez que el
  // visor está montado y se limpian al desmontar o al cambiar de proyecto.
  useEffect(() => {
    const visor = visorRef.current
    if (!visor) return

    function iniciarPan(touch: Touch) {
      panRef.current = {
        punto: { x: touch.clientX, y: touch.clientY },
        translateInicial: translateRef.current,
      }
    }

    function onTouchStart(event: TouchEvent) {
      setInteractuando(true)
      if (event.touches.length === 2) {
        const [t1, t2] = [event.touches[0], event.touches[1]]
        // visor no puede ser null acá: este listener se agrega en el mismo efecto que
        // ya comprobó `if (!visor) return` arriba, TS solo no lo sigue a través de la
        // función anidada.
        const rect = visor!.getBoundingClientRect()
        const medioAbsoluto = puntoMedio(t1, t2)
        pinchRef.current = {
          distanciaInicial: distanciaEntrePuntos(t1, t2),
          escalaInicial: escalaRef.current,
          medio: { x: medioAbsoluto.x - rect.left, y: medioAbsoluto.y - rect.top },
          translateInicial: translateRef.current,
        }
        panRef.current = null
      } else if (event.touches.length === 1) {
        iniciarPan(event.touches[0])
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
        // Si no hay pan arrancado (ej. se venía de un pellizco de 2 dedos y se acaba
        // de levantar uno), se arranca acá mismo con la posición actual en vez de
        // quedarse sin hacer nada hasta que el usuario suelte y vuelva a tocar.
        if (!panRef.current) iniciarPan(event.touches[0])
        const base = panRef.current
        if (!base) return
        const dx = event.touches[0].clientX - base.punto.x
        const dy = event.touches[0].clientY - base.punto.y
        setTranslate(
          limitarTranslate(escalaRef.current, {
            x: base.translateInicial.x + dx,
            y: base.translateInicial.y + dy,
          })
        )
      }
    }

    function onTouchEndOCancel(event: TouchEvent) {
      if (event.touches.length === 2) {
        // Quedan 2 dedos todavía (se agregó/sacó uno raro) — no hay nada que reiniciar
        // acá, el próximo touchstart/touchmove lo resuelve.
        return
      }
      pinchRef.current = null
      if (event.touches.length === 1) {
        // Quedó un dedo (se soltó uno de los dos del pellizco) — se retoma el pan desde
        // la posición actual de ese dedo para no perder el gesto.
        iniciarPan(event.touches[0])
      } else {
        panRef.current = null
        setInteractuando(false)
      }
    }

    // Arrastrar con el mouse (desktop) — mismo criterio que el pan táctil, pero
    // escuchando mousemove/mouseup en `window` en vez del visor: si sueltas o el mouse
    // se te va rápido fuera del recuadro durante el arrastre, hay que seguir
    // recibiendo esos eventos igual para no dejar el pan "pegado".
    // Se puede arrastrar con el botón izquierdo o el derecho: el derecho nunca abre un
    // lote, así que sirve para moverse cuando el mouse está encima de varios lotes.
    function onMouseDown(event: MouseEvent) {
      if (event.button !== 0 && event.button !== 2) return
      // Por si el arrastre anterior se soltó fuera del visor y su click nunca llegó.
      ignorarSiguienteClickRef.current = false
      mousePanRef.current = {
        punto: { x: event.clientX, y: event.clientY },
        translateInicial: translateRef.current,
        movido: false,
      }
      setInteractuando(true)
    }

    function onWindowMouseMove(event: MouseEvent) {
      const base = mousePanRef.current
      if (!base) return
      const dx = event.clientX - base.punto.x
      const dy = event.clientY - base.punto.y
      if (Math.hypot(dx, dy) > UMBRAL_ARRASTRE_PX) base.movido = true
      setTranslate(
        limitarTranslate(escalaRef.current, {
          x: base.translateInicial.x + dx,
          y: base.translateInicial.y + dy,
        })
      )
    }

    function onWindowMouseUp() {
      if (!mousePanRef.current) return
      ignorarSiguienteClickRef.current = mousePanRef.current.movido
      mousePanRef.current = null
      setInteractuando(false)
    }

    // En captura, antes de que el click llegue al lote: si venía de un arrastre, se
    // descarta para no abrir el detalle del lote donde se soltó el mouse.
    function onClickCaptura(event: MouseEvent) {
      if (!ignorarSiguienteClickRef.current) return
      ignorarSiguienteClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
    }

    // Sin menú contextual del navegador en el plano — el click derecho es para arrastrar.
    function onContextMenu(event: MouseEvent) {
      event.preventDefault()
    }

    // Doble click para acercar de un salto, centrado en el punto donde se hizo click —
    // convención estándar de cualquier visor de mapas/imágenes.
    function onDoubleClick(event: MouseEvent) {
      const rect = visor!.getBoundingClientRect()
      const centro = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      aplicarZoom(
        escalaRef.current + PASO_BOTON * 2,
        centro,
        escalaRef.current,
        translateRef.current
      )
    }

    // Rueda/trackpad — equivalente de escritorio del pellizco. Se limpia el
    // "interactuando" con un debounce corto porque la rueda no tiene un evento de
    // "solté" como el touch/mouse; sin el debounce, cada scroll individual dispararía
    // la transición CSS y se vería con tirones en vez de suave.
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
    window.addEventListener("mousemove", onWindowMouseMove, { passive: true })
    window.addEventListener("mouseup", onWindowMouseUp, { passive: true })
    visor.addEventListener("dblclick", onDoubleClick, { passive: true })
    visor.addEventListener("click", onClickCaptura, { capture: true })
    visor.addEventListener("contextmenu", onContextMenu)
    visor.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      visor.removeEventListener("touchstart", onTouchStart)
      visor.removeEventListener("touchmove", onTouchMove)
      visor.removeEventListener("touchend", onTouchEndOCancel)
      visor.removeEventListener("touchcancel", onTouchEndOCancel)
      visor.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onWindowMouseMove)
      window.removeEventListener("mouseup", onWindowMouseUp)
      visor.removeEventListener("dblclick", onDoubleClick)
      visor.removeEventListener("click", onClickCaptura, { capture: true })
      visor.removeEventListener("contextmenu", onContextMenu)
      visor.removeEventListener("wheel", onWheel)
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current)
    }
  }, [proyectoSeleccionado, aplicarZoom, limitarTranslate])

  function zoomBoton(delta: number) {
    const visor = visorRef.current
    const centro = visor
      ? { x: visor.clientWidth / 2, y: visor.clientHeight / 2 }
      : { x: 0, y: 0 }
    aplicarZoom(escala + delta, centro, escala, translate)
  }

  function restablecerZoom() {
    const inicial = vistaInicialRef.current
    setEscala(inicial?.escala ?? ESCALA_MIN)
    setTranslate(inicial?.translate ?? { x: 0, y: 0 })
  }

  // Centra el visor sobre un lote encontrado por el buscador y lo resalta un rato — el
  // punto se calcula en coordenadas "base" (escala 1, sin desplazar) y de ahí se despeja
  // el translate necesario para que ese punto quede en el centro a la escala objetivo.
  function centrarEnLote(lote: LoteInventario) {
    const visor = visorRef.current
    const dimensiones = dimensionesRef.current
    if (!visor || !dimensiones || lote.plano_x == null || lote.plano_y == null) return

    const anchoVisor = visor.clientWidth
    const altoVisor = visor.clientHeight
    const escalaObjetivo = Math.max(escalaRef.current, 2)

    // Si es una zona (rectángulo o polígono) se centra en su medio en vez de la esquina
    // superior izquierda de plano_x/plano_y — mismo punto que usaría un pin ahí.
    const puntosPoligono = lote.plano_poligono
    const centroXPct =
      puntosPoligono && puntosPoligono.length >= 3
        ? puntosPoligono.reduce((suma, p) => suma + p.x, 0) / puntosPoligono.length
        : lote.plano_x2 != null
          ? (lote.plano_x + lote.plano_x2) / 2
          : lote.plano_x
    const centroYPct =
      puntosPoligono && puntosPoligono.length >= 3
        ? puntosPoligono.reduce((suma, p) => suma + p.y, 0) / puntosPoligono.length
        : lote.plano_y2 != null
          ? (lote.plano_y + lote.plano_y2) / 2
          : lote.plano_y

    const baseX = (centroXPct / 100) * anchoVisor
    const baseY =
      (centroYPct / 100) * (anchoVisor * (dimensiones.alto / dimensiones.ancho))

    const nuevoTranslate = {
      x: anchoVisor / 2 - baseX * escalaObjetivo,
      y: altoVisor / 2 - baseY * escalaObjetivo,
    }

    setEscala(escalaObjetivo)
    setTranslate(limitarTranslate(escalaObjetivo, nuevoTranslate))
    setLoteResaltadoId(lote.id)
    setBusquedaLote("")
    setMostrarSugerencias(false)

    if (resaltadoTimeoutRef.current) clearTimeout(resaltadoTimeoutRef.current)
    resaltadoTimeoutRef.current = setTimeout(() => setLoteResaltadoId(null), 3000)
  }

  if (proyectosConPlano.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay planos cargados"
        description="Subí el plano de un proyecto desde Gestión inventario → Proyectos (ícono de pin) para poder verlo acá."
        dashed
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Select
          value={proyectoSeleccionado ? String(proyectoSeleccionado.id) : ""}
          onValueChange={setProyectoId}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Elegí un proyecto" />
          </SelectTrigger>
          <SelectContent>
            {proyectosConPlano.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {proyectoSeleccionado ? (
          <div className="relative w-full sm:w-auto">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <input
              type="text"
              value={busquedaLote}
              onChange={(event) => {
                setBusquedaLote(event.target.value)
                setMostrarSugerencias(true)
              }}
              onFocus={() => setMostrarSugerencias(true)}
              // El timeout deja que el click en una sugerencia (más abajo) registre
              // antes de que el blur del input la haga desaparecer.
              onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && sugerenciasLote.length > 0) {
                  centrarEnLote(sugerenciasLote[0])
                } else if (event.key === "Escape") {
                  setMostrarSugerencias(false)
                }
              }}
              placeholder="Buscar lote..."
              className="border-input bg-card focus:border-primary focus:ring-ring/15 h-9 w-full rounded-md border pr-7 pl-8 sm:w-44 text-[12.5px] outline-none focus:ring-3"
            />
            {busquedaLote ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setBusquedaLote("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <X className="size-3.5" strokeWidth={1.8} />
              </button>
            ) : null}

            {mostrarSugerencias && busquedaLote.trim() ? (
              <div className="border-border bg-card absolute top-full left-0 z-20 mt-1 w-56 overflow-hidden rounded-md border shadow-md">
                {sugerenciasLote.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-2 text-[12px]">
                    Sin resultados en este plano.
                  </p>
                ) : (
                  sugerenciasLote.map((lote) => {
                    const { label } = normalizarEstado(lote)
                    return (
                      <button
                        key={lote.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => centrarEnLote(lote)}
                        className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px]"
                      >
                        <span className="font-mono font-bold">{lote.codigo}</span>
                        <span className="text-muted-foreground text-[11px]">{label}</span>
                      </button>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {proyectoSeleccionado ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={escala <= (esPantallaAngosta ? ESCALA_MIN_MOVIL : ESCALA_MIN)}
              onClick={() => zoomBoton(-PASO_BOTON)}
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
              disabled={escala >= (esPantallaAngosta ? ESCALA_MAX_MOVIL : ESCALA_MAX)}
              onClick={() => zoomBoton(PASO_BOTON)}
            >
              <ZoomIn className="size-3.5" strokeWidth={1.8} />
            </Button>
            {escala !== (vistaInicialRef.current?.escala ?? ESCALA_MIN) ? (
              <Button type="button" variant="outline" size="sm" onClick={restablecerZoom}>
                Restablecer
              </Button>
            ) : null}
            <span className="text-muted-foreground hidden text-[11px] sm:inline">
              Pellizcá o girá la rueda para acercar/alejar, arrastrá (click izquierdo o
              derecho) para moverte (doble click también acerca)
            </span>
          </div>
        ) : null}
      </div>

      {proyectoSeleccionado && lotesDelProyecto.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
          {LEYENDA_PLANO.filter((item) => clavesEnPlano.has(item.clave)).map((item) => (
            <span key={item.clave} className="flex items-center gap-1.5">
              <span className={cn("size-3.5 rounded-sm border-2", item.muestra)} />
              {item.texto}
            </span>
          ))}
          {hayConvenioEnPlano ? (
            <span className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-full bg-blue-600 text-white">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
              Convenio (vendido)
            </span>
          ) : null}
        </div>
      ) : null}

      {proyectoSeleccionado ? (
        <div
          ref={visorRef}
          className={cn(
            "border-border relative h-[60vh] min-h-[280px] w-full touch-none overflow-hidden rounded-lg border select-none sm:h-[70vh] sm:min-h-[420px]",
            escala > ESCALA_MIN ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          )}
          style={altoVisorMovil ? { height: altoVisorMovil } : undefined}
        >
          {!imagenCargada ? (
            <div className="bg-muted absolute inset-0 z-10 flex items-center justify-center">
              <Spinner />
            </div>
          ) : null}

          <div
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${escala})`,
              transformOrigin: "0 0",
            }}
            className={cn(
              "absolute top-0 left-0 w-full",
              !interactuando && "transition-transform duration-150 ease-out"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen dinámica subida por el usuario (S3), no un asset del proyecto */}
            <img
              src={proyectoSeleccionado.plano_url ?? undefined}
              alt={`Plano de ${proyectoSeleccionado.nombre}`}
              onLoad={(event) => {
                setImagenCargada(true)
                const ancho = event.currentTarget.naturalWidth
                const alto = event.currentTarget.naturalHeight
                setDimensionesImagen({ ancho, alto })

                // Solo en pantallas angostas (ver comentario de altoVisorMovil).
                const anchoVisor = visorRef.current?.clientWidth ?? 0
                if (anchoVisor > 0 && anchoVisor < 640 && ancho > 0) {
                  const altoAjustado = anchoVisor * (alto / ancho)
                  const altoMax = Math.max(280, window.innerHeight * 0.62)
                  const altoVisor = Math.round(
                    Math.min(altoMax, Math.max(280, altoAjustado * 3))
                  )
                  const escalaInicial = Math.max(
                    ESCALA_MIN_MOVIL,
                    Math.min(escalaMaxima(), altoVisor / altoAjustado)
                  )
                  const translateInicial = {
                    x: (anchoVisor - anchoVisor * escalaInicial) / 2,
                    y: (altoVisor - altoAjustado * escalaInicial) / 2,
                  }
                  vistaInicialRef.current = {
                    escala: escalaInicial,
                    translate: translateInicial,
                  }
                  setAltoVisorMovil(altoVisor)
                  setEscala(escalaInicial)
                  setTranslate(translateInicial)
                }

                // Respaldo para verlo offline la próxima vez — se cachea cada vez que
                // alguien lo mira acá (no solo desde el editor de mapeo), así el celular
                // que lo abrió una vez ya lo tiene guardado si después se corta la señal
                // en el sitio. Si ya estamos en modoOffline, plano_url es un object URL
                // de un Blob (no una red real) — cachearlo de nuevo no aportaría nada.
                if (!modoOffline && proyectoSeleccionado?.plano_url) {
                  const { id: idProyecto, plano_url: planoUrl } = proyectoSeleccionado
                  const proyectoParaCache = proyectoSeleccionado
                  const lotesParaCache = lotesDelProyecto
                  fetch(planoUrl)
                    .then((respuesta) => respuesta.blob())
                    .then((imagen) =>
                      guardarPlanoEnCache({
                        idProyecto,
                        proyecto: proyectoParaCache,
                        lotes: lotesParaCache,
                        imagen,
                      })
                    )
                    .catch(() => {
                      // No se pudo bajar la imagen para cachearla — la pantalla ya está
                      // funcionando online igual, solo no habrá respaldo offline.
                    })
                }
              }}
              className={cn(
                "block w-full transition-opacity duration-200",
                imagenCargada ? "opacity-100" : "opacity-0"
              )}
              draggable={false}
            />
            {imagenCargada &&
              lotesDelProyecto.map((lote) => {
                const { label } = normalizarEstado(lote)
                const variant = claveColorPlano(lote)
                // Los hipotecados se distinguen solo por el amarillo — sin número encima.
                const sinNumero = variant === CLAVE_HIPOTECADO_PLANO
                const vendido = esConvenio(lote)
                const esPoligono = (lote.plano_poligono?.length ?? 0) >= 3
                const esZona =
                  !esPoligono && lote.plano_x2 != null && lote.plano_y2 != null

                // Contra-escala total (queda SIEMPRE del mismo tamaño en pantalla) para las
                // etiquetas de código — translate y scale en el MISMO elemento, con el punto
                // que debe quedar fijo (el propio centro) como transform-origin, para que no
                // se corra con el zoom.
                function estiloContraescala(px: number, py: number) {
                  return {
                    left: `${px}%`,
                    top: `${py}%`,
                    transform: `translate(-50%, -50%) scale(${factorEtiqueta / escala})`,
                  }
                }

                // Mismo mecanismo, pero con la escala AMORTIGUADA de escalaVisualCheck (más
                // chico sin zoom, un poco más grande acercando) para la marquita de check de un
                // lote vendido.
                function estiloCheck(px: number, py: number) {
                  return {
                    left: `${px}%`,
                    top: `${py}%`,
                    transform: `translate(-50%, -50%) scale(${escalaVisualCheck(escala) * factorCheck})`,
                  }
                }

                if (esPoligono) {
                  const puntos = lote.plano_poligono!
                  const minX = Math.min(...puntos.map((p) => p.x))
                  const maxX = Math.max(...puntos.map((p) => p.x))
                  const maxY = Math.max(...puntos.map((p) => p.y))
                  const cx = puntos.reduce((suma, p) => suma + p.x, 0) / puntos.length
                  const cy = puntos.reduce((suma, p) => suma + p.y, 0) / puntos.length
                  return (
                    <Fragment key={lote.id}>
                      <svg
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      >
                        <polygon
                          points={puntos.map((p) => `${p.x},${p.y}`).join(" ")}
                          vectorEffect="non-scaling-stroke"
                          strokeWidth={
                            esPantallaAngosta ? BORDE_ZONA_MOVIL_PX : BORDE_ZONA_PX
                          }
                          onClick={() => onSeleccionarLote(lote)}
                          className={cn(
                            "pointer-events-auto cursor-pointer transition-colors",
                            vendido
                              ? POLIGONO_COLOR_VENDIDO
                              : (POLIGONO_COLOR[variant] ?? POLIGONO_COLOR_DEFAULT),
                            loteResaltadoId === lote.id &&
                              "stroke-primary animate-pulse stroke-[3]"
                          )}
                        >
                          <title>{`Ver detalle de ${lote.codigo} · ${label}`}</title>
                        </polygon>
                      </svg>
                      {vendido ? (
                        <div
                          style={estiloCheck((minX + maxX) / 2, maxY)}
                          className={cn(
                            "pointer-events-none absolute",
                            CHECK_VENDIDO_CLASE
                          )}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </div>
                      ) : sinNumero ? null : (
                        // La etiqueta se contra-escala (scale(1/escala)) para que su tamaño en
                        // pantalla no crezca con el zoom del plano — si no, a zoom alto el texto
                        // queda gigante y se solapa con los lotes de al lado. translate y scale
                        // van en el MISMO elemento (no en un wrapper aparte): el
                        // translate(-50%,-50%) centra el div sobre el punto y, como el origen de
                        // la escala es el centro (default), ese punto queda fijo sin importar
                        // cuánto se achique/agrande el contenido.
                        <div
                          style={estiloContraescala(cx, cy)}
                          className="bg-card/90 pointer-events-none absolute rounded px-1 font-mono text-[10px] font-bold whitespace-nowrap shadow-sm"
                        >
                          {numeroDeLote(lote.codigo)}
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
                      onClick={() => onSeleccionarLote(lote)}
                      title={`Ver detalle de ${lote.codigo} · ${label}`}
                      style={{
                        left: `${lote.plano_x}%`,
                        top: `${lote.plano_y}%`,
                        width: `${lote.plano_x2! - lote.plano_x!}%`,
                        height: `${lote.plano_y2! - lote.plano_y!}%`,
                        borderWidth: `${bordeZona}px`,
                      }}
                      className={cn(
                        "absolute flex cursor-pointer items-start justify-center border-solid transition-colors",
                        vendido
                          ? ZONA_COLOR_VENDIDO
                          : (ZONA_COLOR[variant] ?? ZONA_COLOR_DEFAULT),
                        loteResaltadoId === lote.id && "ring-primary animate-pulse ring-4"
                      )}
                    >
                      {vendido ? (
                        // translate y scale van en el MISMO transform (no mezclados con las
                        // utilidades -translate-x-1/2 de Tailwind: un style.transform inline
                        // pisa por completo cualquier transform de clase, no se combinan).
                        <div
                          style={{
                            left: "50%",
                            top: "100%",
                            transform: `translate(-50%, -50%) scale(${escalaVisualCheck(escala) * factorCheck})`,
                          }}
                          className={cn("absolute", CHECK_VENDIDO_CLASE)}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </div>
                      ) : sinNumero ? null : (
                        // Mismo motivo de contra-escala que en el polígono de arriba — acá el
                        // origen es "top center" porque el botón ya centra la etiqueta arriba
                        // con items-start/justify-center.
                        <div
                          style={{
                            transform: `scale(${factorEtiqueta / escala})`,
                            transformOrigin: "top center",
                          }}
                          className="mt-0.5"
                        >
                          <span className="bg-card/90 rounded px-1 font-mono text-[10px] font-bold whitespace-nowrap shadow-sm">
                            {numeroDeLote(lote.codigo)}
                          </span>
                        </div>
                      )}
                    </button>
                  )
                }

                if (vendido) {
                  // Sin pin, sin código — solo la marquita de check en el punto ubicado, bien
                  // discreta para no competir con los lotes disponibles.
                  return (
                    <button
                      key={lote.id}
                      type="button"
                      onClick={() => onSeleccionarLote(lote)}
                      title={`Ver detalle de ${lote.codigo} · ${label}`}
                      style={estiloCheck(lote.plano_x!, lote.plano_y!)}
                      className={cn("absolute cursor-pointer", CHECK_VENDIDO_CLASE)}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </button>
                  )
                }

                return (
                  // Mismo motivo de contra-escala que arriba — translate y scale van en el
                  // MISMO elemento con transform-origin "bottom center" (el punto del pin, que
                  // es lo que translate(-50%,-100%) ancla ahí): eso deja ese punto fijo sin
                  // importar cuánto se achique/agrande el pin. Iba en 2 divs anidados antes,
                  // pero eso hacía que el offset de anclaje se encogiera junto con el pin y el
                  // punto se corriera del lote a medida que se hacía zoom.
                  <button
                    key={lote.id}
                    type="button"
                    onClick={() => onSeleccionarLote(lote)}
                    title={`Ver detalle de ${lote.codigo} · ${label}`}
                    style={{
                      left: `${lote.plano_x}%`,
                      top: `${lote.plano_y}%`,
                      transform: `translate(-50%, -100%) scale(${factorEtiqueta / escala})`,
                      transformOrigin: "bottom center",
                    }}
                    className="absolute flex cursor-pointer flex-col items-center"
                  >
                    <span
                      className={cn(
                        "rounded-full border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold whitespace-nowrap text-white shadow-sm",
                        sinNumero && "size-4 p-0",
                        MARCADOR_COLOR[variant] ?? MARCADOR_COLOR_DEFAULT,
                        loteResaltadoId === lote.id &&
                          "ring-primary animate-pulse ring-4 ring-offset-2"
                      )}
                    >
                      {sinNumero ? null : numeroDeLote(lote.codigo)}
                    </span>
                    <MapPin
                      className={cn(
                        "-mt-px size-5 drop-shadow",
                        loteResaltadoId === lote.id ? "text-primary" : "text-foreground"
                      )}
                      strokeWidth={2}
                      fill="currentColor"
                    />
                  </button>
                )
              })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
