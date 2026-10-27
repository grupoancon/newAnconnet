// Cache offline del plano de un proyecto (imagen + lotes ubicados) en IndexedDB del
// navegador — para que quien ya abrió esta pantalla con señal pueda seguir viéndola si
// después se queda sin conexión en el sitio (ej. un asesor mostrándole el plano a un
// cliente). Esto NO es un Service Worker: solo cubre "ya visité este proyecto antes
// con internet" — la primera carga de la app siempre necesita conexión.
import type { LoteInventario, ProyectoInventario } from "@/lib/api/inventario-api"

const DB_NAME = "anconnet-plano-cache"
const STORE_NAME = "planos"
const DB_VERSION = 1

export type PlanoCacheado = {
  idProyecto: number
  proyecto: ProyectoInventario
  lotes: LoteInventario[]
  // La imagen se guarda como Blob (no como URL ni data URL en base64): un Blob no
  // depende de que el navegador tenga acceso a S3, y IndexedDB lo guarda tal cual sin
  // el ~33% de peso extra que suma codificar a base64.
  imagen: Blob
  guardadoEn: number
}

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, DB_VERSION)
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "idProyecto" })
      }
    }
    solicitud.onsuccess = () => resolve(solicitud.result)
    solicitud.onerror = () => reject(solicitud.error)
  })
}

// Silencioso a propósito: si falla (ej. modo incógnito con IndexedDB bloqueado, o
// almacenamiento lleno) la pantalla ya está funcionando online igual — solo no va a
// quedar respaldo para la próxima vez sin conexión, no es un error que deba interrumpir
// al usuario.
export async function guardarPlanoEnCache(
  datos: Omit<PlanoCacheado, "guardadoEn">
): Promise<void> {
  try {
    await escribirPlano(datos)
  } catch {
    // ver comentario de la función
  }
}

// Igual que guardarPlanoEnCache pero propagando el error — respaldarPlanos lo necesita
// para contar cuáles fallaron.
async function escribirPlano(datos: Omit<PlanoCacheado, "guardadoEn">): Promise<void> {
  const db = await abrirDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put({ ...datos, guardadoEn: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function leerPlanoDeCache(idProyecto: number): Promise<PlanoCacheado | null> {
  try {
    const db = await abrirDb()
    return await new Promise<PlanoCacheado | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const solicitud = tx.objectStore(STORE_NAME).get(idProyecto)
      solicitud.onsuccess = () => resolve(solicitud.result ?? null)
      solicitud.onerror = () => reject(solicitud.error)
    })
  } catch {
    return null
  }
}

// Respaldo de TODOS los proyectos con plano, en segundo plano, cada vez que el catálogo
// carga con conexión — antes solo se cacheaba el proyecto que alguien abría en la vista
// Planos, así que sin señal "Ver planos guardados" solía no encontrar nada. La imagen
// solo se vuelve a bajar si cambió plano_url (o no estaba); los lotes se refrescan
// siempre para que los estados guardados sean los más recientes.
export type ProgresoRespaldo = {
  total: number
  // Procesados (guardados o fallidos) — llega a `total` al terminar.
  hechos: number
  fallidos: number
  // Imágenes bajadas de la red en esta pasada (0 = ya estaba todo guardado).
  descargados: number
}

export async function respaldarPlanos(
  proyectos: ProyectoInventario[],
  lotes: LoteInventario[],
  onProgreso?: (progreso: ProgresoRespaldo) => void
): Promise<ProgresoRespaldo> {
  const conPlano = proyectos.filter((p) => p.plano_url)
  const progreso: ProgresoRespaldo = {
    total: conPlano.length,
    hechos: 0,
    fallidos: 0,
    descargados: 0,
  }
  onProgreso?.({ ...progreso })
  for (const proyecto of conPlano) {
    const planoUrl = proyecto.plano_url as string
    try {
      const previo = await leerPlanoDeCache(proyecto.id)
      let imagen: Blob
      if (previo && previo.proyecto.plano_url === planoUrl) {
        imagen = previo.imagen
      } else {
        const respuesta = await fetch(planoUrl)
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
        imagen = await respuesta.blob()
        progreso.descargados++
      }
      await escribirPlano({
        idProyecto: proyecto.id,
        proyecto,
        lotes: lotes.filter(
          (l) => l.id_proyecto === proyecto.id && l.plano_x != null && l.plano_y != null
        ),
        imagen,
      })
    } catch {
      // Un plano que no se pudo bajar o guardar no frena el resto; se cuenta como fallido
      // para no avisar "listo" sobre algo que no quedó disponible sin conexión.
      progreso.fallidos++
    }
    progreso.hechos++
    onProgreso?.({ ...progreso })
  }
  return progreso
}

// Todos los planos guardados en este navegador — a diferencia de leerPlanoDeCache (un
// proyecto puntual, para el editor que ya sabe cuál), esto es para el catálogo
// (InventarioCatalogoContent): si falla la carga inicial no tiene forma de saber de
// antemano qué proyectos quedaron cacheados, así que lee todo lo que haya para armar una
// lista de proyectos/lotes de respaldo.
export async function listarPlanosCacheados(): Promise<PlanoCacheado[]> {
  try {
    const db = await abrirDb()
    return await new Promise<PlanoCacheado[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const solicitud = tx.objectStore(STORE_NAME).getAll()
      solicitud.onsuccess = () => resolve(solicitud.result ?? [])
      solicitud.onerror = () => reject(solicitud.error)
    })
  } catch {
    return []
  }
}
