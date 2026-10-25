# Auditoría de seguridad del sistema de actualizaciones

**Fecha:** 2026-10-25  
**Autor:** wulflo  
**Tipo:** auditoria  
**Estado:** completed

Alcance: canal de publicación (GitHub Actions + GitHub Releases), actualizador
nativo de escritorio, flujo de descarga del APK en Android, manifiesto
`latest.json`, permisos de Tauri y manejo de claves. No cubre la seguridad del
contenido de las notas ni del vault.

## Resumen

El diseño prioriza **fallar cerrado**:

- Escritorio instala un paquete solo si su firma minisign coincide con la clave
  pública embebida en la app.
- Android descarga un APK solo desde el repositorio oficial, con tamaño máximo,
  timeout, tamaño declarado y SHA-256 coincidentes.
- La APK se guarda con un nombre fijo dentro de un scope de escritura fijo.
- La app no comprueba actualizaciones automáticamente ni envía telemetría.
- Los secretos de firma se inyectan únicamente en el paso de build que los
  necesita; nunca se suben como artefactos.

Riesgo residual principal: Android no verifica criptográficamente el manifiesto
`latest.json`. La autenticidad final depende de la firma del APK que impone el
instalador de Android y de la seguridad de la cuenta/organización de GitHub.

## Activos y fronteras de confianza

| Activo | Dónde vive | Quién puede modificarlo |
| --- | --- | --- |
| Clave privada del actualizador | `.tauri/sinnotas-updater.key` (local) y secreto `TAURI_SIGNING_PRIVATE_KEY` | Desarrollador y administradores del repo |
| Clave pública del actualizador | `src-tauri/tauri.conf.json` | Cualquiera que pueda publicar una versión; un cambio invalida las firmas anteriores |
| Keystore Android | Local y secreto `ANDROID_KEYSTORE_BASE64` | Desarrollador y administradores del repo |
| `latest.json` + paquetes | GitHub Releases | Cuenta/organización de GitHub y workflows con `contents: write` |
| APK instalada | Dispositivo del usuario | Usuario, firma Android del desarrollador |

Fronteras: WebView (JS) → IPC de Tauri (permisos y scopes) → Rust/plugin HTTP →
TLS → GitHub → assets. Cada salto tiene una validación independiente.

## Vectores de ataque y mitigaciones

### 1. Manipulación del manifiesto o de la URL de descarga

**Vector:** un `latest.json` alterado apunta a un servidor del atacante o a un
paquete distinto.

**Mitigaciones:**

- `parseReleaseManifest` exige `version` semántica, `platforms` objeto y una
  entrada para la plataforma actual.
- `isAllowedUpdateUrl` exige HTTPS, sin credenciales ni puerto no estándar, y
  solo permite `github.com`, `api.github.com` y hosts de assets de GitHub. Para
  `github.com` además exige el prefijo `/wulflo/sinnotas/releases/download/`.
- El plugin HTTP de Android tiene scope
  `https://github.com/wulflo/SinNotas/releases/*`; aunque el JS fuese
  manipulado, el proceso nativo rechaza otros orígenes.
- En escritorio, un manifiesto manipulado no basta: el paquete debe tener una
  firma minisign válida de la clave privada, que no está en GitHub.

**Residual:** si se compromete la cuenta de GitHub se puede publicar un
manifiesto y un APK nuevos. Ver el punto 5.

### 2. Paquete de escritorio adulterado o corrupto

**Vector:** se reemplaza el `.AppImage`, `.exe` o `.app.tar.gz` en la release.

**Mitigaciones:**

- `createUpdaterArtifacts` genera `.sig` para cada paquete; `latest.json`
  publica esas firmas.
- El plugin `updater` verifica la firma con la clave pública embebida antes de
  instalar. Sin firma válida no hay instalación.
- El script de publicación falla si falta un `.sig` o una plataforma.
- El script aborta si detecta material de clave privada en archivos de texto que
  se van a publicar.

**Residual:** si se filtra la clave privada, el atacante puede firmar paquetes
válidos. La rotación requiere publicar una versión con la clave nueva usando la
clave anterior.

### 3. APK adulterada en Android

**Vector:** se sirve un APK modificado con el mismo nombre.

**Mitigaciones:**

- `latest.json` declara `size` y `sha256`; la app rechaza el archivo si el
  tamaño no coincide, si supera 150 MB, si está vacío o si el SHA-256 no
  coincide.
- La URL debe pertenecer a las releases del repositorio (allowlist + scope del
  plugin HTTP).
- Android rechaza instalar una actualización firmada con una clave distinta a la
  de la app instalada. Esa comprobación la hace el sistema, no la app.
- No se añade `REQUEST_INSTALL_PACKAGES`: la instalación siempre es una acción
  explícita del usuario.

**Residual:** el SHA-256 no autentica el manifiesto; un atacante con control de
la release puede publicar un APK y su hash. La barrera real es la firma Android:
el APK malicioso solo se instalaría si el usuario desinstala antes la app
original. Se recomienda no desinstalar y verificar el origen.

**Mejora futura:** firmar `latest.json` con la misma clave minisign y verificar
la firma en Android antes de descargar, o embeber el SHA-256 del certificado de
firma del APK y comprobarlo con un comando nativo antes de ofrecer la
instalación.

### 4. MITM, redirecciones y respuestas inesperadas

**Vector:** un proxy o DNS manipulado devuelve HTML, un archivo gigante o una
redirección a otro host.

**Mitigaciones:**

- Solo HTTPS; el WebView y el cliente nativo usan el almacén de confianza del
  sistema.
- Se rechazan respuestas con `content-type` que no sea JSON en el manifiesto y
  `text/html` en la descarga.
- Límite de 256 KB para el manifiesto y 150 MB para el APK, comprobado tanto por
  `Content-Length` como por bytes leídos.
- Timeout de 20 s para el manifiesto y 15 min para el APK. El temporizador cubre
  también la lectura del body, no solo la respuesta de cabeceras.
- El scope del plugin HTTP solo permite el host y la ruta iniciales; las
  redirecciones las sigue el cliente nativo hacia los hosts de assets de GitHub.

**Residual:** no hay certificate pinning. Un atacante con una CA comprometida o
un dispositivo con un almacén de confianza manipulado podría interceptar el
manifiesto; seguiría necesitando una firma minisign válida (escritorio) o la
firma Android del desarrollador (Android).

### 5. Compromiso de GitHub Actions o de la cuenta de GitHub

**Vector:** modificar el workflow, exfiltrar secretos o publicar una release
falsa.

**Mitigaciones:**

- `permissions: contents: read` a nivel de workflow; `contents: write` solo en
  `publish-release`.
- `persist-credentials: false` en todos los checkouts.
- Acciones fijadas por SHA.
- La clave privada del actualizador se pasa solo al paso
  `Build desktop bundles with updater artifacts`, no a nivel de job ni a otros
  pasos. El keystore Android se usa solo en el paso de firma y se borra con
  `if: always()`.
- `ci.yml` ya no se dispara con tags ni crea releases; solo `release.yml`
  publica, y solo con tags `v*`.
- El artefacto de release se descarga con un patrón (`release-*`) que excluye
  el APK de debug.

**Residual:** un colaborador con permiso para modificar workflows en `master`
puede cambiar el proceso. Se recomienda proteger tags y la rama principal,
exigir revisión para `.github/workflows/**` y usar un *environment* de GitHub
con revisores para los secretos de release.

### 6. Fuga de secretos en logs o artefactos

**Vector:** imprimir la clave, subirla como artefacto o incluirla en
`latest.json`.

**Mitigaciones:**

- Los secretos se leen de `secrets.*` solo en los pasos que los usan.
- Los pasos de verificación reciben únicamente un booleano derivado
  (`${{ secrets.X != '' }}`); el valor real se inyecta solo en el paso de firma.
- Los pasos imprimen únicamente nombres de secretos faltantes, nunca valores.
- `prepare-release-assets.mjs` inspecciona `.json`, `.txt` y `.md` antes de
  publicar y aborta si encuentra `PRIVATE KEY` o
  `minisign encrypted secret key`.
- `.tauri/` está en `.gitignore`; el keystore y `keystore.base64.txt` también.

**Residual:** un paso malicioso añadido al workflow podría exfiltrar secretos.
La mitigación es de gobernanza (revisión de cambios y environments).

### 7. Agotamiento de recursos o bloqueo de la interfaz

**Vector:** un APK enorme o una conexión que no termina deja la UI colgada.

**Mitigaciones:**

- Límite de tamaño y timeout total; el estado se emite de forma asíncrona y la
  UI no bloquea el hilo principal.
- `readResponseBytes` lee por chunks y aborta al superar 150 MB.
- Si `response.body` no está disponible, usa `arrayBuffer()` con el mismo
  límite.
- Todos los errores del flujo Android se capturan en `errorState` y se registran
  con `console.error`; la máquina de estados vuelve a `error` y permite
  reintentar.
- `checkInFlight` e `installInFlight` evitan comprobaciones/instalaciones
  concurrentes.

**Residual:** el APK se mantiene en memoria para calcular el SHA-256 antes de
escribirlo. En dispositivos con poca RAM, un APK cercano a 150 MB podría causar
presión de memoria. Una mejora futura es escribir a un archivo temporal
mientras se calcula el hash y borrarlo si no coincide.

### 8. Escritura arbitraria o path traversal

**Vector:** el manifiesto intenta controlar el nombre o la ruta del archivo
guardado.

**Mitigaciones:**

- El nombre es la constante `SinNotas-update.apk`; no se toma del manifiesto.
- `fs:allow-write-file` solo permite `$DOWNLOAD/SinNotas-update.apk`, y
  `fs:allow-mkdir` solo `$DOWNLOAD` y `$DOWNLOAD/**`.
- No se usa ninguna ruta proporcionada por el servidor para el filesystem.

### 9. Escalada de permisos en Android

**Vector:** la app pide permisos de instalación o almacenamiento para
“automatizar” la actualización.

**Mitigaciones:**

- No se declara `REQUEST_INSTALL_PACKAGES`,
  `MANAGE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE` ni
  `WRITE_EXTERNAL_STORAGE`.
- `INTERNET` es el único permiso de red y es necesario para descargar
  `latest.json` y el APK.
- El CI inspecciona el APK con `aapt2` y falla si aparece cualquiera de esos
  permisos, si `allowBackup` no es `false`, si es `debuggable` o si permite
  cleartext.

### 10. Privacidad y comportamiento inesperado

**Vector:** la app consulta GitHub en segundo plano y revela IP, versión o
hábitos de uso.

**Mitigaciones:**

- No hay comprobación automática ni temporizadores. Solo se hace red cuando el
  usuario pulsa **Buscar actualizaciones**.
- No hay telemetría ni identificadores.
- El manifiesto es público y no contiene datos del usuario.
- La CSP no permite conexiones de red del WebView (`connect-src` solo `self` e
  IPC): las descargas las hacen los plugins nativos, así que una XSS no tiene
  un canal directo para exfiltrar datos.

## Decisiones defensivas relevantes

- **Fail closed en el checksum:** si `latest.json` no trae `sha256`, Android no
  descarga nada (no se acepta “sin verificación”).
- **URL allowlist doble:** validación en JS (`isAllowedUpdateUrl`) y scope nativo
  del plugin HTTP en Android.
- **Timeout que cubre el body:** evita conexiones que envían cabeceras y luego
  se quedan colgadas.
- **Sin instalación automática en Android:** se elimina la superficie de
  `REQUEST_INSTALL_PACKAGES` y el usuario conserva el control.
- **Secretos por paso:** reduce el impacto de un paso comprometido y evita
  filtrarlos en artefactos.

## Recomendaciones pendientes

1. Firmar `latest.json` con minisign y verificarlo en Android (o publicar un
   `.sig` junto al manifiesto y validarlo con un comando Rust).
2. Embeber el SHA-256 del certificado de firma del APK y comprobarlo antes de
   ofrecer la instalación.
3. Proteger tags `v*` y `.github/workflows/**` con reglas de rama y revisión
   obligatoria; usar un environment con revisores para
   `TAURI_SIGNING_PRIVATE_KEY` y el keystore.
4. Activar 2FA obligatorio en la organización/cuenta de GitHub y revisar
   periódicamente los colaboradores con permiso de escritura.
5. Documentar y ensayar la rotación de la clave del actualizador y del keystore.
6. Evaluar escribir el APK de forma incremental (hash + archivo temporal) para
   reducir el pico de memoria.
7. Evaluar `MediaStore` (o un FileProvider) para que el APK quede en una carpeta
   accesible sin permisos de almacenamiento, en lugar de
   `Android/data/.../files/Download`.

## Verificación

- `npx tsc --noEmit`: sin errores.
- `npm test`: 22 archivos, 204 pruebas aprobadas.
- `npm run build`: correcto.
- `cargo check --locked`: correcto.
- `cargo fmt --check`: sin cambios.
- Pruebas unitarias de `update-utils`: comparación de versiones, allowlist de
  URLs, validación de tamaño/SHA-256 y rechazo de manifiestos inválidos.
