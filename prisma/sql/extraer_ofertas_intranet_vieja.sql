-- =============================================================================
-- EXTRAER de la intranet VIEJA (u136515847_replica_ic24) los datos de las ofertas
-- que necesita la migración de entregas: cliente, lote, tipo de venta y ofrecimientos.
-- =============================================================================
--
-- DÓNDE SE CORRE: en la base VIEJA (la que tiene las tablas `ofertas` y
-- `sale_process`). Solo lee, no modifica nada.
--
-- QUÉ DEVUELVE: una columna `sentencia` con un REPLACE INTO por oferta, listo para
-- pegar y ejecutar en la base NUEVA. Llenan migr_entr_tmp.ofertas_ref, que es de donde
-- migracion_entregas_intranet.sql toma lote y cliente.
--
-- CÓMO USARLO
--   Opción A (terminal):
--     mysql -N -r -h <host_viejo> -u <usuario> -p u136515847_replica_ic24 \
--       < extraer_ofertas_intranet_vieja.sql > ofertas_ref.sql
--     mysql -h <host_nuevo> -u <usuario> -p newAnconnet < ofertas_ref.sql
--
--   Opción B (TablePlus): abrir la base vieja, ejecutar este archivo, seleccionar
--   todas las filas de la columna `sentencia`, copiarlas y ejecutarlas en la base nueva.
--
-- Después de cargar ofertas_ref, volver a correr migracion_entregas_intranet.sql
-- (o el UPDATE del final de ese archivo si la migración ya se hizo).
-- =============================================================================

SELECT 'CREATE TABLE IF NOT EXISTS migr_entr_tmp.ofertas_ref (ofert_id INT PRIMARY KEY, cliente VARCHAR(255), lote VARCHAR(255), tipo_venta VARCHAR(60), ofrecimiento TEXT) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;' AS sentencia
UNION ALL
SELECT CONCAT(
  'REPLACE INTO migr_entr_tmp.ofertas_ref (ofert_id, cliente, lote, tipo_venta, ofrecimiento) VALUES (',
  o.id, ', ',
  QUOTE(COALESCE(NULLIF(TRIM(sp.cli_name), ''), NULLIF(TRIM(o.cli_name), ''))), ', ',
  QUOTE(NULLIF(TRIM(sp.cli_lote), '')), ', ',
  QUOTE(NULLIF(TRIM(o.cli_tipoVenta), '')), ', ',
  QUOTE(NULLIF(TRIM(o.cli_ofrecimiento), '')),
  ');'
)
FROM ofertas o
LEFT JOIN sale_process sp
       ON sp.id = (SELECT MAX(s.id) FROM sale_process s WHERE s.offert_id = o.id)
WHERE o.id IN (
  7,33,66,83,86,123,142,161,167,175,182,192,197,213,219,222,223,238,248,255,265,275,
  277,278,283,286,287,292,303,326,329,336,364,366,367,371,377,381,383,421,448,457,458,
  460,467,468,483,487,489,491,492,493,499,501,504,525,526,528,529,530,531,534,538,542,
  543,547,548,551,554,557,560,562,565,566,567,569,573,574,578,582,585,591,592,593,597,
  599,600,602,604,607,608,609,610,611,617,620,621,622,624,625,630,631,633,643,644,645,
  647,652,653,654,656,657,661,663,666,669,670,671,672,674,676,677,678,681,682,688,689,
  690,704,706,708,711,713,714,715,718,720,721,724,725,726,727,733,740,743,744,746,747,
  750,752,753,757,758,765,769,772,776,779,780,784,785,789,790,792,793,794,795,806,834,
  835,836,841,842,846,850,853,857,859,869,874,876,885,887,888,890,892,893,895,896,898,
  899,900,904,907,914,915,920,921,923,926,928,939,940,942,944,945,949,950,951,953,956,
  957,964,975,976,977,981,984,987,1012,1033,1078,1088,1098,1114,1127
);

-- Control: deben salir 227 filas (1 CREATE TABLE + 226 ofertas). Si salen menos, esta
-- base no tiene todas las ofertas (por ejemplo, una réplica desactualizada).
