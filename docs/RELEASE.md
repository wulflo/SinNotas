# Publicación de releases

Guía mínima para publicar una nueva versión sin fallos de CI.

## 1. Sincronizar la versión

Antes de crear el tag, la versión debe coincidir en los cuatro archivos:

- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/Cargo.lock` → entrada del paquete `sin-notas`

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
npm ci --ignore-scripts
npx tsc --noEmit
npm test
npm run build
```

## 3. Commit y tag

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin master
git push origin vX.Y.Z
```

El workflow `release.yml` se ejecuta al empujar el tag y compila/publica la release.

## 4. Errores comunes

- `cannot update the lock file ... because --locked was passed`: falta actualizar `Cargo.lock` tras cambiar `Cargo.toml`.
- El tag no coincide con las versiones declaradas: revisar los cuatro archivos de la sección 1.
- El APK no se firma o no aparece: verificar que los secretos de firma estén definidos en GitHub Actions.

## Seguridad

No incluir secretos, keystores ni claves privadas en el repositorio. Usar únicamente los secretos configurados en GitHub Actions (`ANDROID_KEYSTORE_BASE64`, `TAURI_SIGNING_PRIVATE_KEY`, etc.). Para el backup completo, la verificación y las contraseñas pendientes de Sin Notas, ver [`KEYSTORES.md`](./KEYSTORES.md).
