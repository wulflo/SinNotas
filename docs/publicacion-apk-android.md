# Publicar el APK Android firmado

**Fecha:** 2026-10-25  
**Autor:** wulflo  
**Tipo:** guia  
**Estado:** completed

La publicación de una versión vive en `.github/workflows/release.yml` y solo se
dispara con tags `v*`. El job **Build Android Release APK (signed)** de
`.github/workflows/ci.yml` sigue compilando, firmando y verificando la APK en
`master` o por `workflow_dispatch`, pero **no publica** nada: es una validación.

Para el sistema de actualizaciones completo (escritorio + Android) y el
manifiesto `latest.json`, ver [actualizaciones.md](actualizaciones.md).

## Secretos

El repositorio necesita estos secretos de Actions (solo se muestran los nombres;
los valores nunca se imprimen ni se guardan en el repo):

| Nombre | Uso | Obligatorio |
| --- | --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Keystore `.jks` codificado en base64 (una sola línea o con saltos de línea). | Sí |
| `KEYSTORE_PASSWORD` | Contraseña del keystore. | Sí |
| `KEY_PASSWORD` | Contraseña de la clave. | Sí |
| `KEY_ALIAS` | Alias de la clave dentro del keystore. | Sí |
| `TAURI_SIGNING_PRIVATE_KEY` | Clave privada del actualizador de escritorio (contenido del archivo generado por `tauri signer generate`). | Sí |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña de la clave del actualizador, si tiene una. | No |

Carga inicial (ejecutar en una máquina de confianza, nunca en CI):

```bash
base64 -w0 sinnotas-release.jks | gh secret set ANDROID_KEYSTORE_BASE64 -R wulflo/SinNotas
gh secret set KEYSTORE_PASSWORD -R wulflo/SinNotas
gh secret set KEY_PASSWORD -R wulflo/SinNotas
gh secret set KEY_ALIAS -R wulflo/SinNotas
gh secret set TAURI_SIGNING_PRIVATE_KEY -R wulflo/SinNotas < .tauri/sinnotas-updater.key
# Solo si la clave del actualizador tiene contraseña:
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD -R wulflo/SinNotas
```

`gh secret set` pide el valor por stdin o de forma interactiva; no lo pases como
argumento en la línea de comandos. Para actualizar un secreto se repite el mismo
comando. Verifica solo los nombres con:

```bash
gh secret list -R wulflo/SinNotas
```

Si falta un secreto, el paso `Verify signing secrets are present` (Android) o
`Verify updater signing key is present` (escritorio) falla antes de compilar e
imprime únicamente los nombres faltantes.

La clave privada del actualizador se inyecta solo en el paso
`Build desktop bundles with updater artifacts`; no se sube como artefacto y
`.tauri/` está en `.gitignore`.

## Probar sin publicar (workflow_dispatch)

1. Sube la rama con los cambios.
2. Lanza `ci.yml` apuntando a esa rama:

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
APK. También verifica que `allowBackup=false`, que **sí** exista `INTERNET`
(necesario para descargar actualizaciones) y que no haya permisos de instalación
ni de almacenamiento. Además comprueba que no sea `debuggable` ni permita
cleartext, ejecuta `zipalign -c -v 4` y `apksigner verify --verbose`, y deja en
el log los esquemas de firma (con `minSdk 33` se usa la firma v3).

## Publicar (tag)

La versión del tag debe coincidir con `src-tauri/tauri.conf.json`,
`package.json` y `src-tauri/Cargo.toml`; el job `validate` de `release.yml`
falla temprano si no coinciden.

```bash
# 1. Actualiza las tres versiones, p. ej. a 0.2.0, y haz commit.
# 2. Crea y empuja el tag (esto lo hace una persona, no CI):
git tag -a v0.2.0 -m "SinNotas v0.2.0"
git push origin v0.2.0
```

El push del tag dispara **solo** `release.yml`:

1. `validate`: versiones + `tsc` + pruebas.
2. `build-android`: compila, firma, verifica y sube la APK como
   `release-android`.
3. `build-desktop`: Linux (`appimage`, `deb`), Windows (`nsis`, `msi`) y macOS
   universal (`app`, `dmg`) con sus `.sig` del actualizador.
4. `publish-release`: descarga los artefactos `release-*`, ejecuta
   `scripts/prepare-release-assets.mjs` y publica la release con el APK
   renombrado a `app-release.apk` y `latest.json`.

`ci.yml` ya no se dispara con tags ni crea releases. Una ejecución manual de
`ci.yml` **no** publica.

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
que no aparezca `application-debuggable`, que **sí** aparezca
`android.permission.INTERNET`, que no haya permisos de almacenamiento ni
`REQUEST_INSTALL_PACKAGES`, y que `allowBackup` sea `false` (esto último se ve
mejor con `aapt2 dump xmltree "$APK" --file AndroidManifest.xml`). La huella del
certificado debe coincidir con la referencia que guardes fuera del repositorio.

## Qué hacer si falla

| Paso | Causa habitual | Acción |
| --- | --- | --- |
| `Verify signing secrets are present` | Falta uno de los cuatro secretos de Android. | Cargarlo con `gh secret set`; el log solo lista nombres. |
| `Verify updater signing key is present` | Falta `TAURI_SIGNING_PRIVATE_KEY`. | Cargarlo con `gh secret set` desde `.tauri/sinnotas-updater.key`. |
| `Locate Android build tools` | El runner no tiene `build-tools` en `ANDROID_HOME`. | Revisar la imagen del runner; no se usa `setup-android` para no añadir acciones. |
| `Align android-fs plugin compileSdk` | Cambió la versión de `tauri-plugin-android-fs` o su ruta en el registry. | Ajustar el shim a la nueva versión; no bajar la app a una API incompatible. |
| `Patch Android safe-area insets` | No se encontró `MainActivity.kt` en `src-tauri/gen/android`. | Ejecutar `tauri android init -- --ci` antes del parche y comprobar que `scripts/patch-android-safe-area.mjs` sigue localizando el archivo generado. |
| `Build release APK (unsigned)` | Incompatibilidad Gradle/JDK/NDK o de versiones de Tauri. | Leer el primer error de Gradle; el job usa JDK 17 y NDK del runner. |
| `Sign APK with apksigner` | Keystore o contraseñas incorrectos, o APK sin firmar no encontrado. | Verificar los secretos y que el build haya producido exactamente un `.apk` en `*/release/*`. |
| `Inspect signed APK manifest` | Apareció un permiso peligroso, `debuggable`, cleartext o `allowBackup` distinto de `false`; o falta `INTERNET`. | Corregir el manifest o la dependencia que lo aporta; no relajar el chequeo. |
| `APK summary` | No se pudo extraer la huella o el APK no contiene `arm64-v8a`. | Revisar la salida de `apksigner`/`unzip` en el log. |
| `Normalize assets and generate latest.json` | Falta una plataforma, un `.sig`, la APK, o dos artefactos comparten nombre. | Revisar qué subió cada job de build; el script indica el archivo faltante. |
| `Publish GitHub Release` | Falta `contents: write`, el tag no es válido o un asset no coincide. | Revisar permisos del job y la salida de `softprops/action-gh-release`. |
| `lint-and-test` (CI) | Clippy `-D warnings` o `cargo audit` reportan algo nuevo. | Resolver el aviso; `release.yml` ejecuta `validate` antes de compilar. |
