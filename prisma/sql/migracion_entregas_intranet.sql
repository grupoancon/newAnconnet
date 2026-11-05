-- =============================================================================
-- Migración de ENTREGAS de la intranet antigua (u136515847_replica_ic24) a la nueva
-- =============================================================================
--
--   entr_process  (227) -> entrega_proceso
--   entr_reagend  ( 14) -> entrega_reagendamiento
--   lote_entr     (222) -> entrega_acta         (1 por proceso; los duplicados por
--                                                doble clic se funden en uno)
--   lote_pre_entr (218) -> entrega_pre_entrega  (1 por proceso; ídem)
--
-- PREPARACIÓN (una sola vez, en el servidor de la base nueva):
--   1. Cargar el dump viejo en una base aparte:
--        CREATE DATABASE migr_entr_tmp CHARACTER SET utf8mb4;
--        mysql --database=migr_entr_tmp < entr_process.sql
--   2. Llenar migr_entr_tmp.ofertas_ref (lote, cliente, tipo de venta y
--      ofrecimientos de cada oferta vieja): correr extraer_ofertas_intranet_vieja.sql
--      en la base VIEJA y ejecutar su salida en la base nueva.
--   3. Ejecutar ESTE archivo conectado a la base nueva (newAnconnet).
--
-- Es re-ejecutable: los procesos ya migrados quedan en migr_entr_tmp.map_proceso y
-- no se vuelven a insertar.
--
-- Decisiones de mapeo:
--   * process_id = NULL y lote/cliente guardados en el propio proceso (igual que los
--     procesos creados desde SAP): los ids de ofertas viejas no existen en la base nueva.
--   * origen = 'INTRANET' para distinguir lo migrado.
--   * encargado: nombre viejo -> user.id (vía email, tabla map_encargado).
--   * Estado del acta: Completo -> COMPLETO; Incompleto -> OBSERVACION si hay algún NO,
--     si no PENDIENTE.
--   * check_foto no tiene columna nueva: si era NO se anota en la observación.
--   * NO se crean filas en ofrecimientos_entrega (marcarían como pendientes entregas
--     ya hechas); el texto queda en entrega_proceso.ofrecimientos_oferta.
--   * ref1/ref2/ref3 vienen todos vacíos en el dump: no hay nada que llevar.
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- 0. Datos de la oferta vieja (lote / cliente / tipo de venta / ofrecimientos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migr_entr_tmp.ofertas_ref (
  ofert_id     INT PRIMARY KEY,
  cliente      VARCHAR(255),
  lote         VARCHAR(255),
  tipo_venta   VARCHAR(60),
  ofrecimiento TEXT
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Se llena desde la base vieja (ofertas + sale_process). Si la base vieja está en el
-- mismo servidor descomentar; si no, exportar esa consulta y cargarla aquí.
-- INSERT IGNORE INTO migr_entr_tmp.ofertas_ref (ofert_id, cliente, lote, tipo_venta, ofrecimiento)
-- SELECT o.id,
--        COALESCE(NULLIF(TRIM(sp.cli_name), ''), NULLIF(TRIM(o.cli_name), '')),
--        NULLIF(TRIM(sp.cli_lote), ''),
--        NULLIF(TRIM(o.cli_tipoVenta), ''),
--        NULLIF(TRIM(o.cli_ofrecimiento), '')
-- FROM u136515847_replica_ic24.ofertas o
-- LEFT JOIN u136515847_replica_ic24.sale_process sp
--        ON sp.id = (SELECT MAX(s.id) FROM u136515847_replica_ic24.sale_process s WHERE s.offert_id = o.id)
-- WHERE o.id IN (SELECT ofert_id FROM migr_entr_tmp.entr_process);

-- -----------------------------------------------------------------------------
-- 1. Nombre viejo del encargado -> email del usuario nuevo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migr_entr_tmp.map_encargado (
  nombre_viejo VARCHAR(60) PRIMARY KEY,
  email        VARCHAR(255) NOT NULL
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

INSERT IGNORE INTO migr_entr_tmp.map_encargado (nombre_viejo, email) VALUES
  ('BORJA MENDOZA MARCELO GEOVANNI',     'mborja@grupoancon.com'),
  ('SARMIENTO MORALES CLAUDIA ALEJANDRA', 'asarmiento@grupoancon.com'),
  ('ROSERO YASIG ANA BEATRIZ',           'arosero@grupoancon.com'),
  ('NARANJO VALENCIA JENNY MARCELA',     'mnanaranjo@grupoancon.com'),
  ('QUIMBAILA ANGULO MARIA GABRIELA',    'gquimbaila@grupoancon.com'),
  ('ALCAZAR SANTOS JHOANNA ELIZABETH',   'jalcazar@grupoancon.com'),
  ('RODRIGUEZ MENDOZA MARTHA ELIANA',    'erodriguez@grupoancon.com'),
  ('CUVI VAZQUES MARIBEL GUADALUPE',     'mcuvi@grupoancon.com'),
  ('NARANJO YASIG VERONICA PATRICIA',    'pnaranjo@grupoancon.com'),
  ('OCAÑA VARGAS GLORIA NOEMI',          'gocana@grupoancon.com'),
  ('MORA BADILLO JORGE ALEXANDER',       'jmora@grupoancon.com'),
  ('NARANJO YASIG MARCO VINICIO',        'mvnaranjo@grupoancon.com'),
  ('MAYORGA ORTIZ NANCY PATRICIA',       'pmayorga@grupoancon.com'),
  ('ANDRADE CONTRERAS MIRIAM GERALDINE', 'mgandrade@grupoancon.com'),
  ('MORA FRANKLIN',                      'fmora@grupoancon.com'),
  ('KARLA PAOLA ANDRADE',                'kandrade@grupoancon.com'),
  ('CRUZ PEREZ THAIS STEPHANY',          'tcruz@grupoancon.com'),
  ('SANDOVAL DIEGO',                     'dsandoval@grupoancon.com'),
  -- encargados de las actas (lote_entr)
  ('Administrador',                      'administrador@grupoancon.com'),
  ('COVEÑA KARINA',                      'kcovena@grupoancon.com');

-- -----------------------------------------------------------------------------
-- 2. Mapa proceso viejo -> id nuevo (ids nuevos a continuación del máximo actual)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS migr_entr_tmp.map_proceso (
  old_id INT PRIMARY KEY,
  new_id INT NOT NULL UNIQUE
);

START TRANSACTION;

SELECT COALESCE(MAX(id), 0) INTO @base FROM entrega_proceso FOR UPDATE;

INSERT INTO migr_entr_tmp.map_proceso (old_id, new_id)
SELECT p.id, @base + ROW_NUMBER() OVER (ORDER BY p.id)
FROM migr_entr_tmp.entr_process p
WHERE p.id NOT IN (SELECT old_id FROM migr_entr_tmp.map_proceso);

-- Usuario por nombre viejo (vacío si no hay coincidencia: encargado queda NULL)
CREATE TEMPORARY TABLE tmp_usuario AS
SELECT m.nombre_viejo, u.id AS user_id
FROM migr_entr_tmp.map_encargado m
JOIN `user` u ON u.email COLLATE utf8mb4_0900_ai_ci = m.email COLLATE utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 3. entr_process -> entrega_proceso
-- -----------------------------------------------------------------------------
INSERT INTO entrega_proceso
  (id, process_id, fecha, hora, encargado, creado_por, editado_por, extras,
   created_at, updated_at, tanque, huerto, tag, lote, cliente,
   tipo_financiamiento, ofrecimientos_oferta, comentario, origen)
SELECT
  mp.new_id,
  NULL,
  p.entr_fech,
  p.entr_hora,
  tu.user_id,
  NULL,
  NULL,
  NULLIF(TRIM(p.extras), ''),
  p.created_at,
  p.updated_at,
  NULLIF(TRIM(p.tanque), ''),
  NULLIF(TRIM(p.huerto), ''),
  NULLIF(TRIM(p.tag), ''),
  r.lote,
  r.cliente,
  CASE UPPER(TRIM(r.tipo_venta))
    WHEN 'CONTADO'         THEN 'Contado'
    WHEN 'CREDITO DIRECTO' THEN 'Crédito directo'
    WHEN 'BIESS'           THEN 'BIESS'
    WHEN 'CREDITO BIESS'   THEN 'BIESS'
    WHEN 'MIXTO'           THEN 'Mixto'
    WHEN 'TRUEQUE'         THEN 'Trueque'
    ELSE NULL
  END,
  r.ofrecimiento,
  NULLIF(TRIM(p.comments), ''),
  'INTRANET'
FROM migr_entr_tmp.entr_process p
JOIN migr_entr_tmp.map_proceso mp ON mp.old_id = p.id
LEFT JOIN migr_entr_tmp.ofertas_ref r ON r.ofert_id = p.ofert_id
LEFT JOIN tmp_usuario tu ON tu.nombre_viejo COLLATE utf8mb4_0900_ai_ci = p.entr_encarg COLLATE utf8mb4_0900_ai_ci
WHERE mp.new_id NOT IN (SELECT id FROM entrega_proceso);

-- -----------------------------------------------------------------------------
-- 4. entr_reagend -> entrega_reagendamiento
-- -----------------------------------------------------------------------------
INSERT INTO entrega_reagendamiento
  (id_entrega_proceso, fecha_anterior, hora_anterior, fecha, hora, motivo,
   creado_por, created_by)
SELECT mp.new_id, g.last_date, g.last_time, g.new_date, g.new_time,
       NULLIF(TRIM(g.reason), ''), NULL, g.created_at
FROM migr_entr_tmp.entr_reagend g
JOIN migr_entr_tmp.map_proceso mp ON mp.old_id = g.p_id
WHERE NOT EXISTS (
  SELECT 1 FROM entrega_reagendamiento x
  WHERE x.id_entrega_proceso = mp.new_id
    AND x.fecha = g.new_date AND x.hora = g.new_time
    AND x.fecha_anterior = g.last_date AND x.hora_anterior = g.last_time
);

-- -----------------------------------------------------------------------------
-- 5. lote_entr -> entrega_acta (la fila más reciente por proceso; si la más reciente
--    no tiene observación se toma la última observación no vacía del mismo proceso)
-- -----------------------------------------------------------------------------
INSERT INTO entrega_acta
  (id_entrega_proceso, fecha, encargado, estado, observacion,
   check_tanque, check_huerto, check_llave, check_naranjo, check_tarjeta, check_tag,
   creado_por, editado_por, created_at, updated_at)
SELECT
  mp.new_id,
  l.entr_fech,
  tu.user_id,
  CASE
    WHEN l.entr_estado = 'Completo' THEN 'COMPLETO'
    WHEN 'NO' IN (l.check_naranj, l.check_tarjet, l.check_foto, l.check_taging,
                  l.check_revhuer, l.check_revtanq, l.check_revllav) THEN 'OBSERVACION'
    ELSE 'PENDIENTE'
  END,
  NULLIF(CONCAT_WS(' | ',
    NULLIF(TRIM(COALESCE(NULLIF(TRIM(l.entr_observ), ''),
      (SELECT o.entr_observ FROM migr_entr_tmp.lote_entr o
       WHERE o.p_id = l.p_id AND TRIM(o.entr_observ) <> '' ORDER BY o.id DESC LIMIT 1))), ''),
    IF(l.check_foto = 'NO', 'Foto: NO (intranet anterior)', NULL)
  ), ''),
  l.check_revtanq, l.check_revhuer, l.check_revllav,
  l.check_naranj, l.check_tarjet, l.check_taging,
  tu.user_id, tu.user_id,
  l.created_at, l.updated_at
FROM migr_entr_tmp.lote_entr l
JOIN migr_entr_tmp.map_proceso mp ON mp.old_id = l.p_id
LEFT JOIN tmp_usuario tu ON tu.nombre_viejo COLLATE utf8mb4_0900_ai_ci = l.entr_encarg COLLATE utf8mb4_0900_ai_ci
WHERE l.id = (SELECT MAX(z.id) FROM migr_entr_tmp.lote_entr z WHERE z.p_id = l.p_id)
  AND mp.new_id NOT IN (SELECT id_entrega_proceso FROM entrega_acta);

-- -----------------------------------------------------------------------------
-- 6. lote_pre_entr -> entrega_pre_entrega (1 por proceso; la fila más reciente,
--    con la última observación no vacía si la más reciente no tiene)
-- -----------------------------------------------------------------------------
INSERT INTO entrega_pre_entrega
  (id_entrega_proceso, fecha, encargado, estado, observacion,
   check_limpieza, check_tanque, check_huerto, check_llave, check_linderos,
   creado_por, editado_por, created_at, updated_at)
SELECT
  mp.new_id,
  l.insp_fech,
  tu.user_id,
  CASE
    WHEN l.insp_estado = 'Completo' THEN 'COMPLETO'
    WHEN 'NO' IN (l.check_limp, l.check_tanque, l.check_huerto, l.check_llave, l.check_linderos) THEN 'OBSERVACION'
    ELSE 'PENDIENTE'
  END,
  NULLIF(TRIM(COALESCE(NULLIF(TRIM(l.insp_observ), ''),
    (SELECT o.insp_observ FROM migr_entr_tmp.lote_pre_entr o
     WHERE o.p_id = l.p_id AND TRIM(o.insp_observ) <> '' ORDER BY o.id DESC LIMIT 1))), ''),
  l.check_limp, l.check_tanque, l.check_huerto, l.check_llave, l.check_linderos,
  tu.user_id, tu.user_id,
  l.created_at, l.updated_at
FROM migr_entr_tmp.lote_pre_entr l
JOIN migr_entr_tmp.map_proceso mp ON mp.old_id = l.p_id
LEFT JOIN tmp_usuario tu ON tu.nombre_viejo COLLATE utf8mb4_0900_ai_ci = l.insp_encar COLLATE utf8mb4_0900_ai_ci
WHERE l.id = (SELECT MAX(z.id) FROM migr_entr_tmp.lote_pre_entr z WHERE z.p_id = l.p_id)
  AND mp.new_id NOT IN (SELECT id_entrega_proceso FROM entrega_pre_entrega);

-- En el sistema nuevo guardar la pre-entrega confirma la fecha de entrega.
UPDATE entrega_proceso e
JOIN migr_entr_tmp.map_proceso mp ON mp.new_id = e.id
JOIN entrega_pre_entrega pre ON pre.id_entrega_proceso = e.id
SET e.fecha_confirmada_at = pre.created_at,
    e.fecha_confirmada_por = pre.encargado
WHERE e.origen = 'INTRANET' AND e.fecha_confirmada_at IS NULL;

DROP TEMPORARY TABLE tmp_usuario;

COMMIT;

-- -----------------------------------------------------------------------------
-- 6b. Completar lote / cliente / tipo / ofrecimientos de procesos ya migrados que
--     quedaron vacíos (por si ofertas_ref se cargó después de la migración).
--     Solo toca campos en NULL: no pisa lo que se haya corregido a mano.
-- -----------------------------------------------------------------------------
UPDATE entrega_proceso e
JOIN migr_entr_tmp.map_proceso mp ON mp.new_id = e.id
JOIN migr_entr_tmp.entr_process p ON p.id = mp.old_id
JOIN migr_entr_tmp.ofertas_ref r ON r.ofert_id = p.ofert_id
SET e.lote    = COALESCE(e.lote, r.lote),
    e.cliente = COALESCE(e.cliente, r.cliente),
    e.ofrecimientos_oferta = COALESCE(e.ofrecimientos_oferta, r.ofrecimiento),
    e.tipo_financiamiento = COALESCE(e.tipo_financiamiento,
      CASE UPPER(TRIM(r.tipo_venta))
        WHEN 'CONTADO'         THEN 'Contado'
        WHEN 'CREDITO DIRECTO' THEN 'Crédito directo'
        WHEN 'BIESS'           THEN 'BIESS'
        WHEN 'CREDITO BIESS'   THEN 'BIESS'
        WHEN 'MIXTO'           THEN 'Mixto'
        WHEN 'TRUEQUE'         THEN 'Trueque'
      END)
WHERE e.origen = 'INTRANET'
  AND (e.lote IS NULL OR e.cliente IS NULL OR e.tipo_financiamiento IS NULL OR e.ofrecimientos_oferta IS NULL);

-- -----------------------------------------------------------------------------
-- 7. Verificación
-- -----------------------------------------------------------------------------
SELECT 'procesos migrados' AS que, COUNT(*) AS n FROM entrega_proceso WHERE origen = 'INTRANET'
UNION ALL SELECT 'procesos sin lote', COUNT(*) FROM entrega_proceso WHERE origen = 'INTRANET' AND lote IS NULL
UNION ALL SELECT 'procesos sin encargado', COUNT(*) FROM entrega_proceso WHERE origen = 'INTRANET' AND encargado IS NULL
UNION ALL SELECT 'reagendamientos', COUNT(*) FROM entrega_reagendamiento r JOIN migr_entr_tmp.map_proceso m ON m.new_id = r.id_entrega_proceso
UNION ALL SELECT 'actas', COUNT(*) FROM entrega_acta a JOIN migr_entr_tmp.map_proceso m ON m.new_id = a.id_entrega_proceso
UNION ALL SELECT 'pre-entregas', COUNT(*) FROM entrega_pre_entrega x JOIN migr_entr_tmp.map_proceso m ON m.new_id = x.id_entrega_proceso
UNION ALL SELECT 'fechas confirmadas', COUNT(*) FROM entrega_proceso WHERE origen = 'INTRANET' AND fecha_confirmada_at IS NOT NULL;
