-- Permiso "app:usuarios": gestionar los usuarios de la app móvil desde la intranet,
-- incluido cerrar sus sesiones (POST /users/force-logout en newApi) y DELETE /users.
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.
-- Correr en la base principal de la intranet (la que tiene `permisos_app`).

INSERT INTO permisos_app (id, recurso, accion)
SELECT 'clpermappusuarios', 'app', 'usuarios'
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_app WHERE recurso = 'app' AND accion = 'usuarios'
);

-- El API no le da bypass al rol Administrador: sin esto, Administrador vería la
-- sección (el frontend sí le da bypass) pero el API le respondería 403.
INSERT IGNORE INTO roles_permisos_app (rolId, permisoId)
SELECT r.id, p.id
FROM roles_app r
JOIN permisos_app p ON p.recurso = 'app' AND p.accion = 'usuarios'
WHERE r.nombre = 'Administrador';
