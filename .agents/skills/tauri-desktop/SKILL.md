---
name: tauri-desktop
description: Revisar cambios Tauri v2 de SinNotas (config y CSP, capabilities/ACL, IPC, portapapeles, sistema de archivos, diálogos, opener, HTTP, updater, Android y build) usando las rutas y decisiones reales del repo; usar al tocar src-tauri, tauri.conf.json, capabilities o comandos invoke.
---

# Tauri de escritorio y móvil — SinNotas

Propósito: que un cambio en la capa Tauri respete el modelo de permisos, el vault y el empaquetado de esta app. **Revisa y reporta**; no cambies código salvo petición explícita.

**Origen:** adaptado y fusionado de las skills descargadas `tauri-config`, `tauri-ipc`, `tauri-security`, `tauri-framework-security`, `tauri-app-plugin-permissions`, `tauri-app-clipboard`, `tauri-app-file-system`, `tauri-app-dialog`, `tauri-app-opener`, `tauri-app-http-client`, `tauri-app-updater`, `tauri-mobile`, `tauri-build`, `tauri-app-develop`, `tauri-window` y `tauri-app-splashscreen` (paquete `tauri-skills`, licencia Apache-2.0; copia en `LICENSE.txt`).

## 1. Configuración y CSP

- `src-tauri/tauri.conf.json` es la fuente de verdad; los perfiles por plataforma van en sus secciones. No relajar la CSP para permitir portadas remotas: la decisión del repo es validar hosts en código y dejar que Tauri bloquee las remotas (§A1 del checklist consolidado).
- `vite.config.ts` decide `desktop` vs `flashcards` con `VITE_APP_MODE` / `TAURI_ENV_PLATFORM`. Un cambio aquí afecta al APK de repaso.
- Verificar siempre con `npm run build` y `cargo check --manifest-path src-tauri/Cargo.toml --lib`.

## 2. Capabilities y ACL (mínimo privilegio)

- `src-tauri/capabilities/default.json` declara los permisos; `desktop.json` y `android.json` son específicos. `src-tauri/gen/schemas/` es generado: no editar a mano.
- Plugins activos reales: `clipboard-manager`, `fs`, `dialog`, `os`, `opener`, `process`, `updater`, `http`, `android-fs`. Añadir solo el permiso que la función necesita, con scope al vault.
- Antes de proponer un permiso nuevo, comprobar si ya existe (`allow-read-image`, `allow-read-text`, etc.). Un aviso de permiso del WebView **no** se arregla añadiendo capabilities de Tauri.

## 3. IPC (frontend ↔ Rust)

- Comandos `#[tauri::command]` en `src-tauri/src/lib.rs`, registrados en `invoke_handler`; tipos compartidos en `src/types.ts`; llamadas desde `src/desktop.ts` y vistas.
- Si se añade/quita un comando, revisar los tres sitios (definición, registro, llamada). Los tipos del payload deben coincidir con la interfaz TS.
- **La validación de contención vive en Rust**: `resolve_vault_path`, `write_file_atomically`, `validate_image_file`. Una validación solo en frontend no cierra un hallazgo de seguridad.

## 4. Portapapeles (caso real del repo)

- `readImage`/`readText` del plugin no piden permiso al WebView; `navigator.clipboard.read()` sí lo pide en Windows/WebView2.
- Toda lectura debe estar ligada a una acción del usuario. El menú contextual de Pegar debe usar el mismo camino que Ctrl+V (`pasteNativeClipboardImage`), no una API distinta.
- Para **escribir** texto, usar `writeClipboardText()` de `desktop.ts`: en Tauri llama a `writeText` del plugin (declarado en `capabilities/default.json` como `clipboard-manager:allow-write-text`), luego Clipboard API y por último textarea + `execCommand`. No llamar a `navigator.clipboard.writeText` directamente en handlers: en WebView puede rechazarse sin promesa manejada y el botón parece no hacer nada (caso real del menú «Copiar enlace [[...]»).

## 5. Sistema de archivos

- Toda ruta del vault pasa por `resolve_vault_path`; rechazar symlinks que salgan del vault y componentes `..`. Escritura atómica y `create_new` para no seguir symlinks de archivo.
- El frontend solo recibe rutas relativas o identificadores `link:<id>`; nunca rutas absolutas (decisión D4).
- Bóvedas de prueba solo en `/tmp/opencode`; no tocar una bóveda real para pruebas destructivas.

## 6. Diálogos, opener y HTTP

- Confirmaciones y selectores de archivo pasan por el plugin `dialog`; en modo web hay alternativas. Comprobar cancelación y mensajes de error.
- Enlaces externos: allowlist de protocolos y hosts, sin `javascript:`/`file:` arbitrarios.
- Búsqueda de metadatos (`src-tauri/src/bibliography_lookup.rs`): hosts constantes, HTTPS, sin redirecciones, `rustls`, timeouts, límite de respuesta, rate limit y caché. El frontend nunca construye la URL.

## 7. Updater, build y release

- La clave privada de firma vive en GitHub Secrets; en el repo solo la pública de `tauri.conf.json`. Ver `docs/KEYSTORES.md` y `docs/RELEASE.md`.
- No tocar `dist/`, `src-tauri/target/`, `node_modules/` ni APKs firmadas. Los binarios de PDFium se descargan en el release, no se versionan.

## 8. Android / modo repaso

- La APK usa `VITE_APP_MODE=flashcards` (o `TAURI_ENV_PLATFORM=android`). El safe-area se parchea con `scripts/patch-android-safe-area.mjs`.
- Cambios en el editor de escritorio no deberían alterar la vista de repaso; verificar ambos modos.
- Permisos de Android se declaran aparte: revisar `capabilities/android.json` y el manifiesto generado.

## 9. Ventana y splash

- Barra de título personalizada en `index.html`; `src/splash.ts` controla el splash. La biblioteca de diálogos propios usa `hasMountedModal` para evitar abrir unos sobre otros.
- Los atajos globales de la app se registran en `src/desktop.ts`; no duplicarlos con `global-shortcut` del plugin salvo decisión explícita.

## Checklist antes de responder

- [ ] ¿El cambio toca `tauri.conf.json` o capabilities? → verificar CSP y permiso mínimo.
- [ ] ¿Añade/quita un `#[tauri::command]`? → definición + `invoke_handler` + tipos TS + llamada.
- [ ] ¿Lee/escribe archivos? → pasa por `resolve_vault_path`, sin rutas absolutas al frontend.
- [ ] ¿Toca portapapeles? → mismo camino que Ctrl+V, sin `navigator.clipboard.read()` en Tauri.
- [ ] ¿Hace red? → allowlist, HTTPS, timeouts y sin datos sensibles en logs.
- [ ] ¿Afecta al build o al APK? → `npm run build`, `cargo check`, modo flashcards.

## Referencias

`src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/`, `src/desktop.ts`, `src/types.ts`, `docs/CHECKLIST-CONSOLIDADO.md`, `docs/RELEASE.md`, `docs/KEYSTORES.md`.
