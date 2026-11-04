# Publicación de releases

Guía mínima para publicar una nueva versión sin fallos de CI.

## 1. Sincronizar la versión

Antes de crear el tag, la versión debe coincidir en los cinco archivos:

- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/Cargo.lock` → entrada del paquete `sin-notas`
- `snapcraft.yaml` → `version` (el Snap se publica con este número)

Después de cambiar `Cargo.toml`, regenerar el lock:

```bash
cargo update -p sin-notas --manifest-path src-tauri/Cargo.toml
```

Verificar que el lock quedó actualizado:

```bash
grep -A1 'name = "sin-notas"' src-tauri/Cargo.lock
```

## 2. Validar localmente

```bash
scripts/fetch-pdfium.sh
npm ci --ignore-scripts
npx tsc --noEmit
npm test
npm run build
```

El workflow de release descarga PDFium automáticamente para Linux, Windows y
las dos arquitecturas de macOS antes de empaquetar.

## 3. Commit y tag

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock snapcraft.yaml
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin master
git push origin vX.Y.Z
```

El workflow `release.yml` se ejecuta al empujar el tag y compila/publica la release.

## 4. Snap y Flatpak

`release.yml` llama al workflow reutilizable
[`package-linux.yml`](../.github/workflows/package-linux.yml), que compila un
`.deb`, extrae su contenido y genera:

- `sin-notas_<versión>_amd64.snap`
- `SinNotas_<versión>_x86_64.flatpak`

Ambos se adjuntan a la release de GitHub junto al resto de instaladores. No
necesitan secretos: `snapcraft pack` y `flatpak-builder` producen paquetes sin
firmar y las tiendas los firman al publicarlos.

El botón **Buscar actualizaciones** de Ajustes se oculta en Snap y Flatpak: el
actualizador de Tauri instala un AppImage o un `.deb` con `dpkg`, algo que no
puede reemplazar un paquete de solo lectura ni actualizaría la revisión de la
tienda. La app detecta las variables `SNAP`/`FLATPAK_ID` y muestra un aviso de
que las actualizaciones llegan desde la tienda.

Para probar los empaquetados sin crear un tag, ejecuta el workflow
**Linux packages (Snap + Flatpak)** desde la pestaña Actions
(`workflow_dispatch`) y descarga los artefactos `release-snap` y
`release-flatpak`. Si marcas la casilla **Publicar el .snap en la Snap Store**
(canal `beta` por defecto) y el secreto está configurado, también lo sube a la
tienda en esa misma ejecución.

En local:

```bash
scripts/package-linux.sh             # compila el .deb y lo extrae
snapcraft pack                       # genera el .snap
flatpak-builder --force-clean --repo=repo flatpak_app \
  packaging/flatpak/com.sinnotas.desktop.yml
```

Publicar en las tiendas es un paso aparte y opcional:

- Snap Store: hace falta una cuenta de Ubuntu One (gratuita), verificar el
  correo y registrar el nombre del snap una sola vez:

  ```bash
  snapcraft login
  snapcraft register sin-notas
  ```

  Después, para que CI publique automáticamente en cada tag, crea una
  credencial acotada y guárdala como secreto `SNAPCRAFT_STORE_CREDENTIALS`:

  ```bash
  snapcraft export-login --snaps sin-notas \
    --channels stable,beta,edge \
    --acls package_access,package_push,package_update,package_release -
  ```

  Sin ese secreto, el workflow compila y adjunta el `.snap` a la release pero
  no sube nada a la tienda. Con el secreto, cada tag publica en `stable`; para
  probar antes, lanza el workflow a mano con «Publicar el .snap» activado y
  canal `beta`.
- Flathub: se envía el manifiesto a un repositorio de Flathub; su infraestructura
  compila y firma. No se sube un `.flatpak` firmado a mano.

## 5. Errores comunes

- `cannot update the lock file ... because --locked was passed`: falta actualizar `Cargo.lock` tras cambiar `Cargo.toml`.
- El tag no coincide con las versiones declaradas: revisar los cinco archivos de la sección 1.
- El APK no se firma o no aparece: verificar que los secretos de firma estén definidos en GitHub Actions.
- El Snap falla con `LXD`/`snapcraft`: relanzar el job; `snapcore/action-build` configura LXD en cada ejecución y a veces tarda en arrancar.
- El Flatpak falla al descargar el runtime: comprobar que el manifiesto usa la misma versión de GNOME que la imagen del job (`gnome-48` ↔ `runtime-version: '48'`).
- El Flatpak no encuentra PDFium: verificar que `packaging/linux/deb-root/usr/lib/Sin Notas/resources/pdfium/linux-x86_64/libpdfium.so` existe antes de empaquetar.

## Seguridad

No incluir secretos, keystores ni claves privadas en el repositorio. Usar únicamente los secretos configurados en GitHub Actions (`ANDROID_KEYSTORE_BASE64`, `TAURI_SIGNING_PRIVATE_KEY`, etc.). Para el backup completo, la verificación y las contraseñas pendientes de Sin Notas, ver [`KEYSTORES.md`](./KEYSTORES.md).
