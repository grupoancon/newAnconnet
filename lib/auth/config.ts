// Cookie real que deja Better Auth (backend, anconAPI) tras login + 2FA. Nombre fijo
// mientras `useSecureCookies: false` en anconAPI lib/auth.ts — con cookies seguras
// pasaria a `__Secure-better-auth.session_token`.
export const BETTER_AUTH_COOKIE_NAME = "better-auth.session_token"
