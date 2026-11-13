# Firma electrónica de PDF (PAdES)

El sistema firma PDF con el certificado `.p12` de la empresa usando el estándar **PAdES**
(`/SubFilter /ETSI.CAdES.detached`, SHA-256 con RSA):

- **PAdES-B-B** siempre: incluye el certificado del firmante y la cadena de CA del `.p12`.
- **PAdES-B-T** si se configura una TSA (sello de tiempo RFC 3161). Es opcional.
- **Incremental**: firmar un PDF ya firmado agrega una revisión nueva sin tocar los bytes
  anteriores, así que las firmas previas siguen siendo válidas (varios firmantes).

Código: `lib/firma/` (servicio), `app/api/firma/route.ts` (endpoint),
`lib/firma-cliente.ts` (navegador), `scripts/firmar-lote.ts` (lote).

## 1. Configurar

### Opción recomendada: subir el certificado desde la intranet

1. Crea la tabla y el permiso corriendo una vez `prisma/sql/firma_certificado_app.sql`
   en la base de la intranet.
2. Genera una **clave maestra** y ponla en el entorno del servidor (`.env` o el gestor de
   secretos del servicio). Con ella se cifran el `.p12` y su contraseña:

   ```bash
   openssl rand -base64 32
   ```

   ```env
   FIRMA_CLAVE_MAESTRA=<el valor generado>
   FIRMA_RAZON=Aprobación de documento
   FIRMA_UBICACION=Quito, Ecuador
   ```

   La clave maestra vive **solo** en el servidor, nunca en la base de datos: así, aunque
   alguien obtenga una copia de la base, no puede usar el certificado. Guárdala también
   en un lugar seguro (gestor de contraseñas): si se pierde o cambia, hay que volver a
   subir el certificado.
3. Entra como Administrador a **Configuración → Firma electrónica**
   (`/configuracion/firma-electronica`), elige el `.p12`/`.pfx`, escribe la contraseña y
   pulsa **Validar y guardar**. Antes de guardar se comprueba que la contraseña sea
   correcta y que el certificado esté vigente; si algo falla no se guarda nada.
4. La pantalla muestra titular, entidad emisora, vigencia (avisa cuando faltan 30 días o
   menos) y quién lo subió. Con el interruptor activas o pausas la firma automática.
   La contraseña nunca se vuelve a mostrar ni viaja de vuelta al navegador.
5. Asigna el permiso **`firma:firmar`** (lo crea el SQL del paso 1) en Admin → Roles
   (`/admin/roles`) a los roles que pueden firmar con el certificado de la empresa (el
   Administrador lo tiene siempre). Sin ese permiso los documentos se descargan sin
   firmar, como antes.

En la base solo quedan en claro los datos públicos del certificado; el `.p12` y la
contraseña van juntos en un único bloque cifrado con AES-256-GCM, que además detecta
cualquier alteración.

### Alternativa: archivo en el servidor

Si no hay certificado subido desde la pantalla, se usa `FIRMA_P12_PATH` /
`FIRMA_P12_PASSWORD` (y `FIRMA_HABILITADA=true`). El `.p12` debe quedar fuera del
repositorio y con permisos restringidos:

```bash
sudo mkdir -p /etc/anconnet/firma
sudo cp empresa.p12 /etc/anconnet/firma/empresa.p12
sudo chown <usuario-del-servicio>:<usuario-del-servicio> /etc/anconnet/firma/empresa.p12
sudo chmod 600 /etc/anconnet/firma/empresa.p12
sudo chmod 700 /etc/anconnet/firma
```

Si el archivo queda legible por otros usuarios, el servidor lo advierte en el log.
`*.p12`, `*.pfx` y `/certificados-firma/` están en `.gitignore`.

Al primer uso se registra en el log qué certificado del `.p12` se eligió, por ejemplo:

```
[firma] Certificado seleccionado: CN="JUAN PEREZ" emisor="AUTORIDAD DE CERTIFICACION SUBCA-2 SECURITY DATA" serie=... alias=... usos=digitalSignature,nonRepudiation vence=...
```

Si el `.p12` trae varios certificados, se usa el que tiene su clave privada dentro del
archivo, no es de una CA y tiene el uso de clave *digitalSignature / nonRepudiation*.

## 2. Cómo se firma

- **Documentos que se firman**: solo la **oferta de compra**, el **financiamiento** y el
  **convenio**. En sus pantallas de reporte aparece el botón **PDF firmado** (solo para
  quien tiene el permiso `firma:firmar`): arma el PDF del documento tal como se ve, lo
  firma en el servidor y lo descarga. Si la firma no está activada, avisa y no descarga.
  - Oferta: *Ventas → Oferta → Reporte → Imprimir*.
  - Financiamiento: *Ventas → Financiamiento → Reporte → Imprimir* (cuando ya está
    listo para imprimir).
  - Convenio: junto al botón *Word*. El PDF lleva márgenes de 2,54 cm como el Word y
    los saltos de página evitan partir renglones.
  - En el teléfono, el botón *Imprimir* de oferta y financiamiento ya genera el PDF
    firmado antes de compartirlo.
  - En la computadora, *Imprimir* sigue usando la impresión del navegador (papel), sin
    firma electrónica.
  - El Word del convenio no lleva firma: PAdES es un estándar solo para PDF.
- **Desde código de servidor**:

  ```ts
  import { firmarPdf } from "@/lib/firma"

  const { pdf, nivel } = await firmarPdf(bytes)                    // con la config del .env
  await firmarPdf("entrada.pdf", "salida.pdf", { razon: "Contrato" })
  ```

- **Desde el navegador**: `firmarPdfEnServidor(blob, opciones)` de `lib/firma-cliente.ts`
  (llama a `POST /api/firma` con el PDF en el cuerpo).
- **Por lote** (PDF existentes; lee las variables de `.env`):

  ```bash
  npm run firma:lote -- ./carpeta-con-pdfs --salida ./firmados
  ```

  Opciones: `--visible`, `--invisible`, `--pagina primera|ultima|N`, `--x`, `--y`,
  `--ancho`, `--alto`, `--razon "..."`, `--ubicacion "..."`, `--sufijo -firmado`,
  `--env otro.env`. Requiere Node 20.12 o superior.

## 3. Firma visible

**Oferta, financiamiento, refinanciamiento y convenio**: en la vista previa aparece un recuadro punteado
azul **"Firma electrónica"** encima de la línea de firma del representante de la empresa
(solo lo ven quienes tienen `firma:firmar`; no sale al imprimir en papel ni en el Word).
Ese recuadro es exactamente donde queda el sello del PDF firmado: al generarlo se mide
su posición (página, x, y, tamaño) y el servidor dibuja ahí el QR y el nombre del firmante. Las variables de abajo solo se usan cuando el documento
no tiene ese recuadro (por ejemplo, la firma por lote).


```env
FIRMA_VISIBLE=true
FIRMA_PAGINA=ultima      # primera | ultima | número de página
FIRMA_X=340              # puntos PDF desde el borde izquierdo (vacío = abajo a la derecha)
FIRMA_Y=36               # puntos PDF desde el borde inferior
FIRMA_ANCHO=220
FIRMA_ALTO=70
```

El sello impreso muestra un código QR y "Firmado electrónicamente por:" con el nombre del
CN del certificado. La fecha y hora (America/Guayaquil, GMT-5), la razón y la ubicación
no se imprimen: van dentro del QR y en los datos de la firma (FirmaEC y Acrobat las
muestran al validar). Una hoja A4 mide 595 × 842 puntos.

Desde código: `firmarPdf(bytes, { visible: { pagina: 1, x: 40, y: 40, ancho: 240, alto: 80 } })`.
Por endpoint: `POST /api/firma?visible=1&pagina=ultima&x=340&y=36`.

## 4. Sello de tiempo (opcional)

```env
FIRMA_TSA_URL=https://tsa.ejemplo.ec/tsa
FIRMA_TSA_USUARIO=          # si la TSA usa autenticación básica
FIRMA_TSA_CLAVE=
FIRMA_TSA_OBLIGATORIA=false # true = si la TSA falla, no firmar
```

## 5. Errores

| Código | Significado |
| --- | --- |
| `CONTRASENA_INCORRECTA` | La contraseña del `.p12` no es la correcta |
| `CERTIFICADO_VENCIDO` / `CERTIFICADO_NO_VIGENTE` | El certificado venció o aún no es válido |
| `CERTIFICADO_NO_ENCONTRADO` / `CONFIGURACION_INCOMPLETA` | Falta el archivo o las variables |
| `CERTIFICADO_SIN_CLAVE` / `CERTIFICADO_INVALIDO` | El `.p12` no tiene una clave de firma utilizable |
| `PDF_CORRUPTO` / `PDF_PROTEGIDO` | PDF dañado, o cifrado/con contraseña |
| `PAGINA_INVALIDA` | La página pedida para la firma visible no existe |
| `TSA_ERROR` | Falló el servidor de sello de tiempo |

## 6. Validar el resultado

- **FirmaEC**: entra a <https://www.firmadigital.gob.ec>, opción *Validar documento*
  (o la app FirmaEC → *Verificar documento*), sube el PDF firmado. Debe mostrar cada
  firma como válida, con el firmante, la entidad emisora y la fecha.
- **Adobe Acrobat Reader**: abre el PDF → *Panel de firmas*. Para que Acrobat la muestre
  como "válida" (check verde) la raíz de la entidad ecuatoriana debe estar entre los
  certificados de confianza: *Preferencias → Firmas → Identidades y certificados de
  confianza → Más… → Importar* el certificado raíz de la CA (BCE, Security Data, etc.).
  Sin eso, Acrobat indica "documento no modificado" pero "identidad desconocida".
- **Línea de comandos** (Poppler): `pdfsig documento.pdf`.

## 7. Pruebas

```bash
npm test -- tests/lib/firma
```

Usan un `.p12` autofirmado de **prueba** generado al vuelo (nunca el real). Para tener
uno en disco: `npm run firma:certificado-prueba` → `certificados-firma/prueba.p12`
(contraseña `prueba123`). FirmaEC y Acrobat lo mostrarán como "no confiable": es
esperado, solo sirve para probar.
