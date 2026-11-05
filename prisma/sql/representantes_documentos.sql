-- Representantes de la empresa (Configuración → Convenios → Representantes): en qué
-- documentos aparece cada uno en el selector de firma.
--   documentos: lista JSON, ej. ["refinanciamiento"] o ["convenio","oferta"].
--   NULL = aparece en todos (convenio, oferta, financiamiento y refinanciamiento),
--   como hasta ahora — los representantes existentes no cambian.
--
-- IMPORTANTE: correr ANTES de desplegar newApi con este cambio — la entidad
-- RepresentanteEmpresa ya lee esta columna y sin ella falla todo lo que liste
-- representantes (incluido el reporte del convenio).
--
-- Idempotente: se puede correr más de una vez.
-- Correr en la base principal de la intranet (la que tiene `convenio_representantes`).

SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'convenio_representantes'
     AND COLUMN_NAME = 'documentos') = 0,
  'ALTER TABLE convenio_representantes ADD COLUMN documentos JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
