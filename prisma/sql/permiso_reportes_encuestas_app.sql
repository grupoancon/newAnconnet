-- Permiso "reportes:encuestas-app": ver (solo lectura) los resultados de las encuestas
-- de la app desde la página /reportes de la intranet, sin poder crear, editar ni
-- asignar encuestas (eso es "app:encuestas"). El backend (/app-encuestas en newApi,
-- listado y resultados) acepta cualquiera de los dos.
--
-- Como los demás reportes:<id>, NO se asigna a ningún rol aquí: se le da a cada
-- usuario o rol desde Admin → Usuarios / Roles (los reportes son de acceso explícito,
-- ni el Administrador los ve sin asignárselos; ver lib/reportes/catalogo.ts).
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.
-- Correr en la base principal de la intranet (la que tiene `permisos_app`).

INSERT INTO permisos_app (id, recurso, accion)
SELECT 'clpermrepencuestasapp', 'reportes', 'encuestas-app'
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_app WHERE recurso = 'reportes' AND accion = 'encuestas-app'
);
