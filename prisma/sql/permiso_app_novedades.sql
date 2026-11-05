-- Permiso "app:novedades": crear, editar, ocultar y borrar las novedades del Inicio
-- de la app móvil (App → Novedades y /novedades en newApi).
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.
-- Correr en la base principal de la intranet (la que tiene `permisos_app`).

INSERT INTO permisos_app (id, recurso, accion)
SELECT 'clpermappnovedades', 'app', 'novedades'
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_app WHERE recurso = 'app' AND accion = 'novedades'
);

-- El API no le da bypass al rol Administrador: sin esto, Administrador vería la
-- sección (el frontend sí le da bypass) pero el API le respondería 403.
INSERT IGNORE INTO roles_permisos_app (rolId, permisoId)
SELECT r.id, p.id
FROM roles_app r
JOIN permisos_app p ON p.recurso = 'app' AND p.accion = 'novedades'
WHERE r.nombre = 'Administrador';
