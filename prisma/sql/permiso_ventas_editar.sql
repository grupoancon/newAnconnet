-- Permiso "ventas:editar": editar un proceso ya creado (lápiz "Editar proceso" de la
-- tabla de Procesos y PATCH /procesos/:id del API). Separado de "ventas:crear".
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.
-- Correr en la base principal de la intranet (la que tiene `permisos_app`).

INSERT INTO permisos_app (id, recurso, accion)
SELECT 'clpermventaseditar', 'ventas', 'editar'
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_app WHERE recurso = 'ventas' AND accion = 'editar'
);

-- El API no le da bypass al rol Administrador: sin esto, Administrador seguiría viendo
-- el lápiz (el frontend sí le da bypass) pero el API le respondería 403 al guardar.
INSERT IGNORE INTO roles_permisos_app (rolId, permisoId)
SELECT r.id, p.id
FROM roles_app r
JOIN permisos_app p ON p.recurso = 'ventas' AND p.accion = 'editar'
WHERE r.nombre = 'Administrador';
