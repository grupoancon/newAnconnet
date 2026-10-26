// Wrappers tipados sobre los endpoints reales de Better Auth del backend (montados en
// `/api/auth` — ver anconAPI `main.ts`). Todas las llamadas van con `credentials:
// "include"` porque el flujo es 100% por cookies (sign-in, el estado pendiente de 2FA,
// y la sesion final las maneja el navegador solo — nunca hay que pasar un email/userId
// a mano entre sign-in y two-factor/*).

const AUTH_BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/auth`

export class AuthApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "AuthApiError"
    this.status = status
    this.code = code
  }
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${AUTH_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
    })
  } catch {
    throw new AuthApiError("No se pudo conectar con el servidor", 0)
  }

  const esJson = response.headers.get("content-type")?.includes("application/json")
  const cuerpo = esJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const mensaje =
      cuerpo?.message ?? cuerpo?.error ?? response.statusText ?? "Error desconocido"
    throw new AuthApiError(mensaje, response.status, cuerpo?.code)
  }

  return cuerpo as T
}

export type UsuarioBetterAuth = {
  id: string
  email: string
  name: string
  role?: string | string[] | null
  permissions?: string | null
  activo?: boolean
  banned?: boolean | null
  [key: string]: unknown
}

type SesionCompleta = { token: string; user: UsuarioBetterAuth }
type SignInEmailResponse = SesionCompleta | { twoFactorRedirect: true; twoFactorMethods?: string[] }

export function esTwoFactorRedirect(
  respuesta: SignInEmailResponse
): respuesta is { twoFactorRedirect: true; twoFactorMethods?: string[] } {
  return "twoFactorRedirect" in respuesta && respuesta.twoFactorRedirect === true
}

// POST /api/auth/sign-in/email
export function signInEmail(email: string, password: string) {
  return authFetch<SignInEmailResponse>("/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    credentials: "include"
  })
}

// POST /api/auth/sign-up/email
export function signUpEmail(input: { email: string; password: string; name: string }) {
  return authFetch<SesionCompleta>("/sign-up/email", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

// POST /api/auth/two-factor/send-otp — no requiere body, el backend identifica al
// usuario pendiente de 2FA por la cookie que dejo sign-in/email.
export function sendTwoFactorOtp() {
  return authFetch<{ success: boolean }>("/two-factor/send-otp", {
    method: "POST",
    body: JSON.stringify({}),
    credentials: "include",
  })
}

// POST /api/auth/two-factor/verify-otp — completa el login: misma forma de respuesta
// que un sign-in exitoso normal.
export function verifyTwoFactorOtp(code: string) {
  return authFetch<SesionCompleta>("/two-factor/verify-otp", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}

// POST /api/auth/sign-out
export function signOut() {
  return authFetch<{ success: boolean }>("/sign-out", { method: "POST", credentials: "include" })
}

// GET /api/auth/get-session — misma fuente que usa el AuthGuard de intranet en el backend.
export function getSession() {
  return authFetch<{ session: { token: string; [key: string]: unknown }; user: UsuarioBetterAuth } | null>(
    "/get-session",
    { method: "GET" }
  )
}
