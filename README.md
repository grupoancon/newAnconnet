# Anconnet

Cimientos de infraestructura para el nuevo ERP inmobiliario (reemplazo del legacy de
ventas, financiamiento, refinanciamiento e inventario de lotes). Esta fase **no**
incluye modulos de negocio: solo auth, RBAC, validaciones compartidas y el layout base
sobre los que se construyen en la siguiente fase.

## Stack

- Next.js 14 (App Router) + TypeScript en modo estricto
- Tailwind CSS v4 + shadcn/ui (unico sistema de componentes, base Radix)
- Prisma ORM sobre MySQL (la BD legacy real, ver seccion "Base de datos" abajo)
- react-hook-form + zod (mismo schema en cliente y servidor)
- Better Auth (en anconAPI) para login, 2FA por correo y sesion
- Vitest + Testing Library

## Convencion de nombrado

Capa tecnica/infra en ingles (`lib`, `session`, `password`, `email`), dominio de
negocio en español (`Usuario` conceptualmente, `Rol`, `Permiso`, `lote`,
`financiamiento`). Las tablas legacy introspectadas (`user`, `sale_process`, etc.)
mantienen sus nombres originales tal como estan en la base de datos real.

## Base de datos: MySQL compartido con el legacy

`prisma/schema.prisma` esta dividido en dos bloques, marcados con comentarios:

1. **Tablas legacy** (arriba): son las ~47 tablas reales del ERP actual, obtenidas con
   `prisma db pull` desde la base de datos de trabajo. Incluyen `user`, `session`,
   `account`, `verification`, `twoFactor` (esquema de better-auth, login legacy) y
   todas las tablas de negocio (`sale_process`, `finan_cabec`, `refinancian_cabec`,
   `cotizador`, etc.). **Esta app nunca las altera** — solo lee/referencia `user`.
2. **Tablas nuevas de esta app** (abajo, sufijo `_app` o tabla `credenciales_acceso`):
   100% aditivas. La identidad del usuario sigue siendo la tabla legacy `user` (mismos
   empleados, mismo email); esta app agrega su propio RBAC relacional
   (`Rol`/`Permiso`/`RolPermiso`/`UsuarioRol`) y su propio password
   (`CredencialAcceso`, independiente del `account.password` de better-auth) y sus
   propias sesiones (`Sesion` → tabla `sesiones_app`, independiente de `session`).

`user.role` y `user.permissions` (columnas de texto del legacy) **no se usan** para
autorizar nada en esta app: el RBAC vive por completo en las tablas nuevas.

### Por que no se usa `prisma migrate`

Esta base de datos ya tiene datos reales y tablas con configuraciones (defaults tipo
`'0000-00-00'`, colaciones mixtas) incompatibles con el modo estricto que usa la
shadow database de `prisma migrate dev`. Por eso las tablas nuevas se crearon con
`prisma migrate diff --script` (para generar el SQL) aplicado a mano, verificando
antes que el diff **solo genera `CREATE TABLE` nuevas**, nunca `ALTER`/`DROP` sobre
tablas legacy. Si se necesita agregar una columna a las tablas `_app` en el futuro,
seguir el mismo patron: generar el diff, revisarlo, aplicarlo a mano.

Los `usuarioId` de `credenciales_acceso`, `sesiones_app` y `usuarios_roles_app` usan
`VARCHAR(36)` con collation `utf8mb4_0900_ai_ci` explicito (igual que `user.id`):
sin esto, `db push`/`migrate` fallan al crear la foreign key por mismatch de collation
con el resto de la base.

## Requisitos

- Node.js 20+
- Acceso a la base de datos MySQL de trabajo (local o compartida)

## Levantar el proyecto

```bash
npm install
cp .env.example .env
# Edita .env: DATABASE_URL (mysql://usuario:password@host:puerto/bd) y
# NEXT_PUBLIC_API_URL (URL de anconAPI)

npm run db:generate   # genera el cliente de Prisma
npm run db:seed       # catalogo de roles/permisos (roles_app/permisos_app)

npm run dev
```

`db:seed` NO crea usuarios (la identidad es la tabla legacy `user`, con empleados
reales). Solo crea el catalogo de roles/permisos y, si existe, le asigna el rol
Administrador a `administrador@grupoancon.com` para poder probar el flujo completo.

## Scripts

```bash
npm run dev           # servidor de desarrollo
npm run build         # build de produccion (falla si hay errores de tipos o lint)
npm run lint          # ESLint
npm run format        # Prettier --write
npm run test          # Vitest (una vez)
npm run test:watch    # Vitest en watch

npm run db:generate   # regenerar el cliente de Prisma
npm run db:seed       # catalogo de roles/permisos
npm run db:studio     # explorar la base de datos
```

No hay script de migraciones a proposito: la base es compartida con anconAPI y su
esquema lo manejan los scripts de ese repo. Nunca correr `prisma migrate dev` (ni
`db push`) contra esta base — Prisma puede proponer resetearla.

## Estructura

```
app/                  rutas (App Router): (auth)/login|verificar, (dashboard)/...
components/ui/        primitivos de shadcn/ui (no editar a mano salvo tema/compat React 18)
components/shared/    compuestos reutilizables (AppShell, Sidebar, Header, Can, ...)
lib/auth/             sesion (via Better Auth), guards, RBAC (can)
lib/db/               cliente Prisma
lib/validations/      schemas de zod compartidos cliente/servidor
server/actions/       server actions (rbac: roles/permisos, mantenimiento)
types/                tipos compartidos
tests/                specs de Vitest (misma estructura que lib/)
prisma/               schema.prisma (legacy + tablas _app) + seed.ts
```

## Auth y RBAC

- **Identidad**: tabla legacy `user` (empleados reales). No se crea una tabla
  "Usuario" nueva.
- **Login y sesion**: Better Auth, montado en anconAPI (`/api/auth/*`). La pantalla
  de login (`components/shared/login-form.tsx`) llama a `/api/auth/sign-in/email` y
  despues al codigo 2FA por correo (`/verificar`). La sesion dura 30 dias fijos desde
  el login (ver `session` en `lib/auth.ts` de anconAPI). En esta app,
  `getCurrentUser()` (`lib/auth/session.ts`) valida la cookie contra
  `/api/auth/get-session` y suma los roles/permisos de las tablas `*_app` via Prisma.
- **Permisos**: `lib/auth/rbac.ts` expone `can(usuario, recurso, accion, contexto?)`.
  Incluye separacion de funciones: `can(usuario, "financiamiento", "aprobar", { creadoPorId })`
  deniega si `creadoPorId === usuario.id`, sin importar el permiso asignado.
- **Middleware** (`middleware.ts`): filtro rapido en edge por presencia de la cookie
  de Better Auth (UX, redirige a `/login`). La verificacion real siempre ocurre en
  servidor con `getCurrentUser()` + `can()`.
- **UI**: `<Can permiso="recurso:accion">` (`components/shared/can.tsx`) solo oculta o
  deshabilita elementos en cliente; nunca sustituye la verificacion de servidor.

## Notas

- Prisma se fijo en la ultima 6.x estable (no 7.x) para evitar el cambio de config
  (`prisma.config.ts`, ESM-only) recien introducido en la major mas nueva.
- Los primitivos en `components/ui/` generados por el CLI de shadcn asumen React 19
  (ref como prop normal). El proyecto usa React 18 (requerido por Next.js 14): `Button`
  e `Input` se ajustaron con `React.forwardRef` explicito para que `asChild`/`Slot`
  (DropdownMenuTrigger, FormControl, etc.) sigan funcionando. Si se agregan mas
  primitivos con `npx shadcn add`, revisar si necesitan el mismo ajuste.
