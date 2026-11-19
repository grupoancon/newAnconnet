-- Firma electrónica: certificado .p12 subido desde Configuración → Firma electrónica,
-- y el permiso "firma:firmar" para poder firmar con él.
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.
-- Correr en la base principal de la intranet (la que tiene `permisos_app`).
--
-- `contenidoCifrado` guarda el .p12 Y su contraseña cifrados (AES-256-GCM) con la clave
-- FIRMA_CLAVE_MAESTRA del entorno del servidor: sin esa clave los datos no sirven.

CREATE TABLE IF NOT EXISTS firma_certificado_app (
  id               INT          NOT NULL DEFAULT 1,
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  contenidoCifrado MEDIUMBLOB   NOT NULL,
  titular          VARCHAR(191) NULL,
  identificacion   VARCHAR(64)  NULL,
  emisor           VARCHAR(191) NULL,
  serie            VARCHAR(128) NULL,
  validoDesde      DATETIME(3)  NULL,
  validoHasta      DATETIME(3)  NULL,
  nombreArchivo    VARCHAR(191) NULL,
  subidoPorId      VARCHAR(36)  NULL,
  subidoPor        VARCHAR(191) NULL,
  updatedAt        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO permisos_app (id, recurso, accion)
SELECT 'clpermfirmafirmar', 'firma', 'firmar'
WHERE NOT EXISTS (
  SELECT 1 FROM permisos_app WHERE recurso = 'firma' AND accion = 'firmar'
);
