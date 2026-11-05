-- Condiciones para aplicar una promoción (Configuración → Promociones):
--   tipos_financiamiento: lista JSON de tipos en los que aplica, ej.
--     ["Crédito directo", "Mixto"]. NULL = cualquier tipo.
--   abono_inicial_minimo: la suma de las filas "Abono inicial" de la tabla de
--     entrada tiene que ser igual o mayor a este monto. NULL = sin mínimo.
--   permite_abono_repartido: ver abajo.
-- Todas las que vengan cargadas se exigen a la vez.
--
-- IMPORTANTE: correr ANTES de desplegar newApi con este cambio — la entidad
-- Promocion ya lee estas columnas y sin ellas falla todo lo que liste promociones.
--
-- Idempotente: se puede correr más de una vez.
-- Correr en la base principal de la intranet (la que tiene la tabla `promociones`).

SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'promociones'
     AND COLUMN_NAME = 'tipos_financiamiento') = 0,
  'ALTER TABLE promociones ADD COLUMN tipos_financiamiento JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'promociones'
     AND COLUMN_NAME = 'abono_inicial_minimo') = 0,
  'ALTER TABLE promociones ADD COLUMN abono_inicial_minimo DECIMAL(12,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- permite_abono_repartido: 0 = solo aplica si el abono inicial va en UNA sola fila
-- (ej. $1000 repartido en 500 + 500 no califica). 1 (por defecto) = da igual.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'promociones'
     AND COLUMN_NAME = 'permite_abono_repartido') = 0,
  'ALTER TABLE promociones ADD COLUMN permite_abono_repartido TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
