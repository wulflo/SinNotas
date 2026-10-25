# Publicar el APK Android firmado

El job **Build Android Release APK (signed)** de
`.github/workflows/ci.yml` compila un APK `arm64-v8a`, lo firma con el keystore
del repositorio, verifica el manifest y lo sube como artefacto. Solo crea un
GitHub Release cuando la ejecución viene de un tag `v*`; una ejecución manual
(`workflow_dispatch`) **no** crea release.

## Secretos

El repositorio necesita estos cuatro secretos de Actions (solo se muestran los
nombres; los valores nunca se imprimen ni se guardan en el repo):

| Nombre | Contenido |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Keystore `.jks` codificado en base64 (una sola línea o con saltos de línea). |
| `KEYSTORE_PASSWORD` | Contraseña del keystore. |
| `KEY_PASSWORD` | Contraseña de la clave. |
| `KEY_ALIAS` | Alias de la clave dentro del keystore. |

Carga inicial (ejecutar en una máquina de confianza, nunca en CI):

```bash
base64 -w0 sinnotas-release.jks | gh secret set ANDROID_KEYSTORE_BASE64 -R wulflo/SinNotas
gh secret set KEYSTORE_PASSWORD -R wulflo/SinNotas
gh secret set KEY_PASSWORD -R wulflo/SinNotas
gh secret set KEY_ALIAS -R wulflo/SinNotas
```

`gh secret set` pide el valor por stdin o de forma interactiva; no lo pases como
argumento en la línea de comandos. Para actualizar un secreto se repite el mismo
comando. Verifica solo los nombres con:

```bash
gh secret list -R wulflo/SinNotas
```

Si falta un secreto, el paso `Verify signing secrets are present` falla antes de
firmar e imprime únicamente los nombres faltantes.

## Probar sin publicar (workflow_dispatch)

1. Sube la rama con los cambios.
2. Lanza el workflow apuntando a esa rama:

```bash
gh workflow run ci.yml --ref ci/fix-signed-apk
gh run watch "$(gh run list --workflow=CI --branch ci/fix-signed-apk --limit 1 --json databaseId --jq '.[0].databaseId')"
```

3. Descarga el artefacto (el nombre usa la rama con `/` reemplazado por `-`):

```bash
mkdir -p /tmp/sinnotas-apk
gh run download <run-id> -R wulflo/SinNotas -n SinNotas-ci-fix-signed-apk -D /tmp/sinnotas-apk
```

El job verde deja en su resumen el paquete, `versionName`, `versionCode`,
`minSdk`, `targetSdk`, permisos, huella SHA-256 del certificado y SHA-256 del
APK. También verifica que `allowBackup=false`, que no haya `INTERNET` ni
permisos de almacenamiento y que no sea `debuggable` ni permita cleartext.
Además ejecuta `zipalign -c -v 4` y `apksigner verify --verbose`, y deja en el
log los esquemas de firma (con `minSdk 33` se usa la firma v3).

## Publicar (tag)

La versión del tag debe coincidir con `src-tauri/tauri.conf.json`,
`package.json` y `src-tauri/Cargo.toml`; el paso `Validate tag version` falla
temprano si no coinciden.

```bash
# 1. Actualiza las tres versiones, p. ej. a 0.2.0, y haz commit.
# 2. Crea y empuja el tag (esto lo hace una persona, no CI):
git tag -a v0.2.0 -m "SinNotas v0.2.0"
git push origin v0.2.0
```

El push del tag dispara `CI` (por `on.push.tags: ["v*"]`). El job de release
vuelve a pasar por `lint-and-test`, compila, firma, verifica, sube el artefacto y
**crea el GitHub Release** con el APK adjunto. No se crean tags ni releases
desde el workflow manual.

## Verificar la firma localmente

Con Android SDK/build-tools instalados:

```bash
APK=/tmp/sinnotas-apk/app-universal-release-unsigned-signed.apk
apksigner verify --verbose --print-certs "$APK"
zipalign -c -v 4 "$APK"
aapt2 dump badging "$APK"
sha256sum "$APK"
```

Comprueba en `aapt2 dump badging` que el paquete sea `com.sinnotas.desktop`,
que no aparezca `application-debuggable`, que no haya permisos `INTERNET` ni de
almacenamiento, y que `allowBackup` sea `false` (esto último se ve mejor con
`aapt2 dump xmltree "$APK" --file AndroidManifest.xml`). La huella del
certificado debe coincidir con la referencia que guardes fuera del repositorio.

## Qué hacer si falla

| Paso | Causa habitual | Acción |
| --- | --- | --- |
| `Verify signing secrets are present` | Falta uno de los cuatro secretos. | Cargarlo con `gh secret set`; el log solo lista nombres. |
| `Locate Android build tools` | El runner no tiene `build-tools` en `ANDROID_HOME`. | Revisar la imagen del runner; no se usa `setup-android` para no añadir acciones. |
| `Align android-fs plugin compileSdk` | Cambió la versión de `tauri-plugin-android-fs` o su ruta en el registry. | Ajustar el shim a la nueva versión; no bajar la app a una API incompatible. |
| `Patch Android safe-area insets` | No se encontró `MainActivity.kt` en `src-tauri/gen/android`. | Ejecutar `tauri android init -- --ci` antes del parche y comprobar que `scripts/patch-android-safe-area.mjs` sigue localizando el archivo generado. |
| `Build release APK (unsigned)` | Incompatibilidad Gradle/JDK/NDK o de versiones de Tauri. | Leer el primer error de Gradle; el job usa JDK 17 y NDK del runner. |
| `Sign APK with apksigner` | Keystore o contraseñas incorrectos, o APK sin firmar no encontrado. | Verificar los secretos y que el build haya producido exactamente un `.apk` en `*/release/*`. |
| `Inspect signed APK manifest` | Apareció un permiso peligroso, `debuggable`, cleartext o `allowBackup` distinto de `false`. | Corregir el manifest o la dependencia que lo aporta; no relajar el chequeo. |
| `APK summary` | No se pudo extraer la huella o el APK no contiene `arm64-v8a`. | Revisar la salida de `apksigner`/`unzip` en el log. |
| `Upload release APK artifact` / release | Nombre de artefacto inválido o permisos insuficientes. | El job usa `contents: write` solo para el release; el nombre se sanea. |
| `lint-and-test` | Clippy `-D warnings` o `cargo audit` reportan algo nuevo. | Resolver el aviso; el release depende de ese job (no se desactiva). |
