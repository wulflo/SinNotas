# Keystores y backups de firma

## Regla de oro

Los keystores, archivos `.gpg`, `.base64.txt`, `keystore.properties`, `key.properties`
y las contraseñas **no se guardan en el repositorio**. Ni en una carpeta ignorada,
ni "solo para la primera compilación". Si se commitean una vez, quedan en el
historial de Git para siempre. Este repositorio es público.

- Backups: `/home/alonso/Documentos/Archivos/Otros/Repos/keystores-3-apps-2026-10-27/` (fuera del repo).
- Secretos locales recomendados: `~/.config/sinnotas/secrets/` (700/600).
- CI: GitHub Secrets.

`.gitignore` es solo una red de seguridad, no el mecanismo de protección.

## Backup completo

`/home/alonso/Documentos/Archivos/Otros/Repos/keystores-3-apps-2026-10-27/sinnotas/sinnotas-keystore-2026-10-28.tar.gz.gpg`

Contiene:

- `sinnotas-release.jks` (JKS, key nueva del 2026-10-28)
- `sinnotas-release.base64.txt`
- `sinnotas-updater.key` (sin contraseña) y `sinnotas-updater.pub.txt`
- `credentials.txt`, `README.txt`, `SHA256SUMS.txt`

Este backup **sí incluye** las contraseñas store/key del keystore nuevo.

El backup está cifrado con GPG simétrico AES-256. La passphrase está en
Bitwarden y hay una copia local en
`~/.config/keystore-backups/GPG-PASSPHRASE-FINAL-2026-10-27.txt`. No la subas a
Drive junto a los `.gpg` ni la guardes en el repo.

Restaurar y verificar:

```bash
cd /home/alonso/Documentos/Archivos/Otros/Repos/keystores-3-apps-2026-10-27/sinnotas
./restore.sh
# o indicando archivo y destino:
./restore.sh sinnotas-keystore-2026-10-28.tar.gz.gpg /tmp/restore-sn
```

## Identidad de firma

### Key nueva (en el backup, pendiente de subir a CI)

| Dato | Valor |
|---|---|
| Package | `com.sinnotas.desktop` |
| Alias | `sinnotas-key` |
| Tipo | JKS |
| Cert SHA-256 | `A8:E5:D4:52:23:63:AD:3C:F6:7F:0C:8D:70:FB:C9:76:F1:CC:BC:A4:86:0C:D7:53:50:5E:EE:45:7F:3C:83:1A` |
| Cert SHA-1 | `75:DC:85:DA:B8:16:CC:9C:C0:67:C6:7D:CE:39:B5:55:E1:FA:DE:F1` |
| Validez | 2026-10-28 → 2054-03-15 |
| Updater | minisign/rsign; password vacía |

### Key anterior (legacy; CI sigue usándola hasta actualizar secrets)

| Dato | Valor |
|---|---|
| Cert SHA-256 | `FD:3A:A8:BF:F7:7D:23:BF:AD:24:FC:4A:0C:6E:B5:0C:DF:A3:F8:22:61:1E:4E:A6:A1:2B:78:DD:CE:E2:5B:2C` |
| Validez | 2026-10-23 → 2054-03-10 |
| Ubicación | `sinnotas/legacy-2026-10-27/` |

La key anterior no se usa para releases nuevas. Se conserva solo como
referencia; sus contraseñas store/key no estaban disponibles.

## Estado actual

La key nueva está en el backup con todas sus contraseñas, pero **todavía no está
en GitHub Secrets**. Hasta que se actualicen los cuatro secretos de Android, el
CI sigue firmando con la key anterior.

No liberar una versión nueva hasta:

1. Cargar el keystore nuevo y las contraseñas en GitHub Secrets.
2. Verificar que el APK salga con el certificado `A8:E5:...`.
3. Reemplazar el backup viejo de Sin Notas en Drive por el del 2026-10-28.

Las instalaciones de prueba viejas (firmadas con `FD:3A:...`) deben
desinstalarse antes de instalar la versión nueva.

## GitHub Secrets

| Secreto | Uso |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | keystore en base64 |
| `KEYSTORE_PASSWORD` | store password |
| `KEY_ALIAS` | alias (`sinnotas-key`) |
| `KEY_PASSWORD` | key password |
| `TAURI_SIGNING_PRIVATE_KEY` | clave privada del updater |

No hay secreto de password del updater: la clave se generó con contraseña vacía.

## Verificación local

Cuando restaures el backup nuevo:

```bash
cd /tmp/restore-sinnotas
export KEYSTORE_PASSWORD="$(awk -F': ' '/^store password:/{print $2}' credentials.txt)"
export KEY_PASSWORD="$(awk -F': ' '/^key password:/{print $2}' credentials.txt)"
export KEY_ALIAS=sinnotas-key

keytool -list -v -keystore sinnotas-release.jks -storepass:env KEYSTORE_PASSWORD
keytool -certreq -alias "$KEY_ALIAS" -keystore sinnotas-release.jks \
  -storepass:env KEYSTORE_PASSWORD -keypass:env KEY_PASSWORD >/dev/null
```

Debe imprimir `A8:E5:D4:52:...` y no fallar con el key password.

## Firma local

El keystore nuevo está en
`~/.config/sinnotas/secrets/sinnotas-release.jks` y las variables en
`~/.config/sinnotas/secrets/signing.env` (600). El keystore viejo quedó en
`~/.config/sinnotas/secrets/legacy-2026-10-27/`; no lo uses para una release
nueva.

```bash
scripts/sign-local.sh
# o indicando el APK:
scripts/sign-local.sh /ruta/app-universal-release.apk
```

El script firma con `apksigner` y verifica el certificado `A8:E5:...`. Para
verificar solo el keystore:

```bash
set -a; source ~/.config/sinnotas/secrets/signing.env; set +a
scripts/verify-signing.sh
```

En CI el workflow decodifica `ANDROID_KEYSTORE_BASE64` en un archivo temporal y
firma el APK con `apksigner`.

## Referencias

- `docs/RELEASE.md`
- `scripts/verify-signing.sh`
