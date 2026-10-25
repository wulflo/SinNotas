# Actualizaciones de Sin Notas

**Fecha:** 2026-10-25  
**Autor:** wulflo  
**Tipo:** guia  
**Estado:** completed

Sin Notas usa un sistema híbrido: el actualizador nativo de Tauri en escritorio
y una descarga manual del APK en Android. Ninguna comprobación se hace
automáticamente: el usuario debe pulsar **Buscar actualizaciones** en Ajustes.
Eso mantiene la postura local-first de la app y evita tráfico de red en segundo
plano.

## Arquitectura

| Plataforma | Detección | Descarga | Verificación | Instalación |
| --- | --- | --- | --- | --- |
| Windows / Linux / macOS | Plugin `updater` de Tauri | Plugin `updater` (Rust) | Firma minisign con la clave pública embebida | Automática; reinicio con `plugin-process` |
| Android (arm64) | `fetch` HTTPS de `latest.json` | Plugin HTTP nativo de Tauri | SHA-256 y tamaño declarados en el manifiesto | Manual: el usuario abre el APK desde Descargas |
| Navegador / iOS | — | — | — | La sección de actualizaciones se oculta |

Puntos de entrada:

- `src/services/updater.ts`: máquina de estados, flujos de escritorio y Android.
- `src/services/update-utils.ts`: comparación de versiones, allowlist de URLs y
  validación del manifiesto (funciones puras, con pruebas).
- `src/desktop.ts` / `src/mobile/review-app.ts`: interfaz.
- `src-tauri/tauri.conf.json`: endpoint, clave pública y CSP.
- `src-tauri/capabilities/`: permisos por plataforma.
- `.github/workflows/release.yml`: compilación, firma y publicación.
- `scripts/prepare-release-assets.mjs`: normaliza artefactos y genera
  `latest.json`.

## Manifiesto `latest.json`

Se publica como asset de la release con nombre fijo. El plugin de escritorio
lee las entradas por plataforma; Android lee `android-aarch64`.

```json
{
  "version": "0.2.0",
  "notes": "Sin Notas 0.2.0. Instaladores y actualizaciones automáticas.",
  "pub_date": "2026-10-25T00:00:00.000Z",
  "platforms": {
    "linux-x86_64": { "signature": "…", "url": "https://github.com/…" },
    "windows-x86_64": { "signature": "…", "url": "https://github.com/…" },
    "darwin-aarch64": { "signature": "…", "url": "https://github.com/…" },
    "darwin-x86_64": { "signature": "…", "url": "https://github.com/…" },
    "android-aarch64": {
      "signature": "<sha256>",
      "url": "https://github.com/…/app-release.apk",
      "size": 12345678,
      "sha256": "<sha256>"
    }
  }
}
```

El script **falla** si falta una plataforma, una firma `.sig`, la APK o si dos
artefactos comparten nombre. También aborta si detecta material de clave privada
en un `.txt`, `.md` o `.json` que se vaya a publicar.

### Artefactos publicados y compresión

No hace falta un paso manual de descompresión en el workflow:

1. `actions/upload-artifact` guarda la salida de cada job como un artefacto ZIP
   de GitHub Actions.
2. `actions/download-artifact` descarga y **extrae** esos ZIP en
   `release-assets/`.
3. `scripts/prepare-release-assets.mjs` recorre las subcarpetas, mueve los
   archivos a la raíz, renombra la APK a `app-release.apk` y genera
   `latest.json`.
4. `softprops/action-gh-release` publica `release-assets/*` como assets de la
   release.

Los paquetes del actualizador de escritorio se publican comprimidos a
propósito. El plugin de Tauri descarga y descomprime el `.AppImage.tar.gz` en
Linux o el `.app.tar.gz` en macOS; en Windows usa el instalador `.exe` de NSIS.
Android descarga directamente `app-release.apk`. Además de esos paquetes, la
release incluye los instaladores sin comprimir (`.AppImage`, `.deb`, `.exe`,
`.msi`, `.dmg` y `.apk`) para descarga manual.

## Publicar una versión

1. Actualizar la versión en los tres archivos y hacer commit:

   ```bash
   # Debe ser idéntica en los tres:
   # - package.json
   # - src-tauri/tauri.conf.json
   # - src-tauri/Cargo.toml
   ```

   El job `validate` compara la versión del tag con las tres y falla si no
   coinciden.

2. Crear y empujar un tag anotado:

   ```bash
   git tag -a v0.2.0 -m "Sin Notas v0.2.0"
   git push origin v0.2.0
   ```

3. `.github/workflows/release.yml` se dispara solo con tags `v*`:

   - `validate`: versiones, `tsc` y pruebas.
   - `build-android`: APK arm64 firmada con el keystore de Android.
   - `build-desktop`: Linux (AppImage + deb), Windows (NSIS + MSI) y macOS
     universal (app + dmg), con artefactos y firmas del actualizador.
   - `publish-release`: descarga los artefactos, ejecuta
     `prepare-release-assets.mjs` y publica la release con
     `softprops/action-gh-release`.

Los tags de release **no** pasan por `ci.yml`; ese workflow ya no crea
releases. `ci.yml` sigue compilando un APK firmado en `master` o por
`workflow_dispatch` solo como verificación, sin publicar.

## Secretos de GitHub Actions

| Nombre | Uso | Obligatorio |
| --- | --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Firma los paquetes del actualizador de escritorio. | Sí |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña de la clave, si tiene una. | No |
| `ANDROID_KEYSTORE_BASE64` | Keystore Android en base64. | Sí |
| `KEYSTORE_PASSWORD` | Contraseña del keystore. | Sí |
| `KEY_PASSWORD` | Contraseña de la clave. | Sí |
| `KEY_ALIAS` | Alias de la clave. | Sí |

Generar un par de claves nuevo (solo si se rota; la clave pública debe
actualizarse en `tauri.conf.json` y publicarse en una versión firmada con la
clave anterior):

```bash
npm run tauri signer generate -- -w .tauri/sinnotas-updater.key
# La clave pública queda en .tauri/sinnotas-updater.key.pub
```

Cargar los secretos sin exponerlos en el historial del shell:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY -R wulflo/SinNotas < .tauri/sinnotas-updater.key
# Si la clave tiene contraseña:
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD -R wulflo/SinNotas
```

La clave privada se inyecta **solo** en el paso
`Build desktop bundles with updater artifacts`. No se imprime, no se sube como
artefacto y `.tauri/` está en `.gitignore`.

## Android: dónde queda el APK

`writeFile` usa `BaseDirectory.Download`, que en Android resuelve a la carpeta
privada de la app:

```
/storage/emulated/0/Android/data/com.sinnotas.desktop/files/Download/SinNotas-update.apk
```

No es la carpeta pública `Download`. Desde Android 11, `Android/data` está
restringido para muchos gestores de archivos; el usuario necesita uno que pueda
entrar en esa ruta (algunos gestores del fabricante o con acceso especial) o
conectar el teléfono por USB. Es una limitación conocida del uso de
`BaseDirectory.Download` sin permisos de almacenamiento.

No se añaden `REQUEST_INSTALL_PACKAGES` ni permisos de almacenamiento: la app
solo descarga el archivo y el usuario lo instala manualmente.

## Por qué Android usa el plugin HTTP

GitHub sirve los assets de sus releases desde
`release-assets.githubusercontent.com` sin cabeceras CORS. Un `fetch()` del
WebView (`https://tauri.localhost`) no puede leer ni `latest.json` ni el APK.
Por eso `src/services/updater.ts` usa el `fetch` de
`@tauri-apps/plugin-http`, que ejecuta la petición en Rust y respeta el scope de
`src-tauri/capabilities/android.json`:

```
https://github.com/wulflo/SinNotas/releases/*
```

La validación del manifiesto y del checksum es la misma que en escritorio.

El WebView no necesita acceso de red: la CSP solo permite `self` e IPC, y todas
las descargas las hacen los plugins nativos (`updater` en escritorio, `http` en
Android). Así, un fallo de XSS en el frontend no puede exfiltrar datos a GitHub
ni a ningún otro host.

## Limitaciones conocidas

- **Linux `.deb`:** el actualizador nativo solo reemplaza instalaciones
  AppImage. Quien haya instalado el `.deb` debe descargar el paquete nuevo y
  reinstalarlo a mano; la app le mostrará la versión disponible, pero
  `downloadAndInstall` fallará porque el paquete publicado para
  `linux-x86_64` es el `.AppImage.tar.gz`.
- **macOS:** el actualizador reemplaza el `.app`, pero para distribución
  pública conviene firmar y notarizar la app. Un binario sin firma puede ser
  bloqueado por Gatekeeper al abrirlo por primera vez.
- **Android:** la APK se guarda en `Android/data/.../files/Download`, no en la
  carpeta pública `Download` (ver arriba). La instalación es manual y el sistema
  puede pedir habilitar “instalar apps desconocidas” para el gestor de archivos.
- **Android:** la actualización solo se instala si la APK nueva está firmada con
  el mismo keystore que la instalada. Si se pierde `sinnotas-release.jks`, los
  usuarios deberán desinstalar y volver a instalar la app.
- **Integridad del manifiesto en Android:** `latest.json` no está firmado; el
  SHA-256 detecta corrupción, no autentica el origen. La autenticidad final la
  impone la firma Android del APK. Ver
  [`2026-10-25-auditoria-actualizaciones.md`](2026-10-25-auditoria-actualizaciones.md).
