-- Teléfono (celular) de cada usuario de la intranet. Lo usa la oferta de compra para
-- precargar "Teléfono del asesor" con el del primer asesor del proceso. Se guarda con
-- prefijo, igual que los demás teléfonos ("+593987654321").
--
-- Idempotente: se puede correr más de una vez.
-- Correr en la base principal de la intranet (la que tiene la tabla `user`).

SET @existe := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'telefono'
);
SET @sql := IF(@existe = 0,
  'ALTER TABLE `user` ADD COLUMN telefono VARCHAR(30) NULL AFTER departamento',
  'SELECT 1');
PREPARE paso FROM @sql;
EXECUTE paso;
DEALLOCATE PREPARE paso;
