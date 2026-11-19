-- Permiso "app:mantenimiento": activar o desactivar el modo mantenimiento de la app
-- móvil (PUT /users/mantenimiento en newApi). GET /users/mantenimiento sigue público
-- porque lo consulta la app.
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.
-- Correr en la base principal de la intranet (la que tiene `permisos_app`).

INSERT INTO permisos_app (id, recurso, accion)
SELECT 'clpermappmantenimiento', 'app', 'mantenimiento'
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_app WHERE recurso = 'app' AND accion = 'mantenimiento'
);

-- El API no le da bypass al rol Administrador: sin esto, Administrador vería la
-- sección (el frontend sí le da bypass) pero el API le respondería 403.
INSERT IGNORE INTO roles_permisos_app (rolId, permisoId)
SELECT r.id, p.id
FROM roles_app r
JOIN permisos_app p ON p.recurso = 'app' AND p.accion = 'mantenimiento'
WHERE r.nombre = 'Administrador';
