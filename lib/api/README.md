# lib/api — cómo centralizar peticiones al backend

Regla del proyecto: **ninguna pantalla hace `fetch(...)` directo**. Cada dominio del
backend (auth, admin, procesos, ventas/inventario, …) tiene su propio archivo acá con
la URL base, el manejo de errores y las funciones tipadas. Las pantallas solo importan
y llaman esas funciones.

Por qué: antes `procesos-content.tsx` tenía una IP hardcodeada
(`http://192.168.18.52:3001`) y `lotes-content.tsx` armaba la URL a mano en el
componente. Cuando cambió `NEXT_PUBLIC_API_URL` en `.env`, lotes lo agarró solo pero
procesos siguió apuntando a la IP vieja porque nunca leía la variable. Con todo detrás
de `lib/api/*.ts`, cambiar el backend es editar **una sola línea en `.env`**.

## Archivos existentes

| Archivo | Dominio backend | Base URL |
| --- | --- | --- |
| `auth-api.ts` | Better Auth (`/api/auth/*`) | `NEXT_PUBLIC_API_URL` + `/api/auth` |
| `admin-api.ts` | Better Auth admin plugin (`/api/auth/admin/*`) | `NEXT_PUBLIC_API_URL` + `/api/auth` |
| `procesos-api.ts` | Procesos de venta (`/processSale/*`) | `NEXT_PUBLIC_API_URL` + `/processSale` |
| `ventas-api.ts` | Inventario/lotes (`/inventarios/*`) | `NEXT_PUBLIC_API_URL` + `/inventarios` |

`NEXT_PUBLIC_API_URL` vive en `.env` (documentada en `.env.example`). Todos los
archivos la leen con el mismo fallback (`?? "http://localhost:3001"`) y le agregan
su propio prefijo de ruta.

## Anatomía de un archivo (usar `procesos-api.ts` como plantilla)

Cada archivo tiene siempre las mismas 4 piezas, en este orden:

1. **Constante de URL base** — `NEXT_PUBLIC_API_URL` + el prefijo fijo de ese dominio.
2. **Clase de error propia** (`XxxApiError`) — para poder distinguir "esto fue un
   error de esta API" de cualquier otro error con `instanceof`.
3. **Wrapper de fetch privado** (`xxxFetch`) — hace el `fetch`, valida `response.ok`,
   parsea el JSON, y lanza `XxxApiError` si algo falla. No se exporta.
4. **Funciones exportadas, una por endpoint** — tipadas, con un comentario arriba
   indicando el verbo HTTP y la ruta real del backend.

```ts
// lib/api/mi-dominio-api.ts

const MI_DOMINIO_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/mi-prefijo`

export class MiDominioApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "MiDominioApiError"
    this.status = status
    this.code = code
  }
}

async function miDominioFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${MI_DOMINIO_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  } catch {
    throw new MiDominioApiError("No se pudo conectar con el servidor", 0)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const mensaje =
      cuerpo?.message ?? cuerpo?.error ?? response.statusText ?? "Error desconocido"
    throw new MiDominioApiError(mensaje, response.status, cuerpo?.code)
  }

  return cuerpo as T
}

// Forma real de la respuesta del backend — copiar del cuerpo real, no inventar campos.
export type MiEntidad = {
  id: number
  nombre: string
}

// GET /mi-prefijo/listar
export function listarMiEntidad() {
  return miDominioFetch<MiEntidad[]>("/listar")
}

// POST /mi-prefijo/crear
export function crearMiEntidad(input: { nombre: string }) {
  return miDominioFetch<MiEntidad>("/crear", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
```

### ¿Cuándo agrego una función a un archivo existente vs creo uno nuevo?

Un archivo por prefijo de ruta del backend, no por pantalla. Si el endpoint nuevo
vive bajo `/inventarios/*`, va en `ventas-api.ts` aunque lo consuma una pantalla
distinta a lotes. Si es un prefijo nuevo (`/processSale/*`, `/reportes/*`, etc.),
es un archivo nuevo siguiendo la plantilla de arriba.

### ¿Cuándo uso `credentials: "include"`?

En los endpoints que dependen de la cookie de sesión (Better Auth: `auth-api.ts`,
`admin-api.ts`) y en los que el backend audita e identifica al actor por sesión
(`procesos-api.ts`, `ventas-api.ts` — el backend graba cada request en
`audit_logs` e intenta resolver el usuario desde la cookie). Si agregás un
wrapper nuevo para un endpoint que el backend también audite así, agregalo ahí
también, no pantalla por pantalla.

## Cómo consumirlo desde una pantalla

```tsx
"use client"

import { useEffect, useState } from "react"
import { listarMiEntidad, MiDominioApiError, type MiEntidad } from "@/lib/api/mi-dominio-api"

export function MiPantalla() {
  const [items, setItems] = useState<MiEntidad[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    listarMiEntidad()
      .then((data) => {
        if (!cancelado) setItems(data)
      })
      .catch((err) => {
        if (cancelado) return
        const mensaje =
          err instanceof MiDominioApiError ? err.message : "No se pudo cargar la información."
        setError(mensaje)
      })

    return () => {
      cancelado = true
    }
  }, [])

  // ...
}
```

Puntos clave:

- La pantalla nunca arma la URL ni hace `fetch` — solo importa la función.
- El flag `cancelado` evita `setState` sobre un componente ya desmontado si el
  usuario navega antes de que responda el fetch (mismo patrón que ya usan
  `procesos-content.tsx` y otras pantallas).
- Capturar el error como `instanceof MiDominioApiError` te da `.status` y `.code`
  tipados si necesitás distinguir un 404 de un 500, por ejemplo.

## Cambiar el servidor de backend

Editar `NEXT_PUBLIC_API_URL` en `.env` (o en las variables de entorno del deploy).
Ningún archivo de `lib/api/` ni ninguna pantalla necesita tocarse.
