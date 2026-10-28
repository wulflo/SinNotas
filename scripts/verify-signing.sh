#!/usr/bin/env bash
# Verifica que el keystore de release coincide con la identidad esperada.
#
# Uso:
#   KEYSTORE_PATH=/ruta/sinnotas-release.jks \
#   KEYSTORE_PASSWORD='...' KEY_ALIAS='sinnotas-key' KEY_PASSWORD='...' \
#   scripts/verify-signing.sh
#
# No imprime contraseñas. Sale con código != 0 si algo no coincide.
set -euo pipefail

EXPECTED_ALIAS="${EXPECTED_ALIAS:-sinnotas-key}"
EXPECTED_SHA256="${EXPECTED_SHA256:-A8:E5:D4:52:23:63:AD:3C:F6:7F:0C:8D:70:FB:C9:76:F1:CC:BC:A4:86:0C:D7:53:50:5E:EE:45:7F:3C:83:1A}"

KEYSTORE_PATH="${KEYSTORE_PATH:-${ANDROID_KEYSTORE_PATH:-}}"
KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-${ANDROID_KEYSTORE_PASSWORD:-}}"
KEY_ALIAS="${KEY_ALIAS:-${ANDROID_KEY_ALIAS:-}}"
KEY_PASSWORD="${KEY_PASSWORD:-${ANDROID_KEY_PASSWORD:-}}"

missing=0
for v in KEYSTORE_PATH KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD; do
  if [[ -z "${!v:-}" ]]; then
    echo "Falta la variable $v" >&2
    missing=1
  fi
done
if (( missing )); then
  cat >&2 <<'USAGE'
Uso:
  KEYSTORE_PATH=/ruta/al/keystore \
  KEYSTORE_PASSWORD='...' \
  KEY_ALIAS='...' \
  KEY_PASSWORD='...' \
  scripts/verify-signing.sh
USAGE
  exit 2
fi

if [[ ! -f "$KEYSTORE_PATH" ]]; then
  echo "No existe el keystore: $KEYSTORE_PATH" >&2
  exit 1
fi

umask 077
out="$(KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD" keytool -list -v \
  -keystore "$KEYSTORE_PATH" -storepass:env KEYSTORE_PASSWORD 2>&1)" || {
    echo "No se pudo abrir el keystore (¿store password incorrecta?)" >&2
    exit 1
  }

if ! grep -Eiq "alias name:[[:space:]]*${EXPECTED_ALIAS}|nombre de alias:[[:space:]]*${EXPECTED_ALIAS}" <<<"$out"; then
  echo "El alias esperado ($EXPECTED_ALIAS) no está en el keystore." >&2
  exit 1
fi

if ! grep -qi "$EXPECTED_SHA256" <<<"$out"; then
  echo "El certificado no coincide con el SHA-256 esperado:" >&2
  echo "  esperado: $EXPECTED_SHA256" >&2
  echo "  obtenido: $(grep -i 'SHA256:' <<<"$out" | head -1 | sed 's/^[[:space:]]*//')" >&2
  exit 1
fi

if ! KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD" KEY_PASSWORD="$KEY_PASSWORD" \
  keytool -certreq -alias "$EXPECTED_ALIAS" -keystore "$KEYSTORE_PATH" \
    -storepass:env KEYSTORE_PASSWORD -keypass:env KEY_PASSWORD >/dev/null 2>&1; then
  echo "La key password no es válida para el alias $EXPECTED_ALIAS." >&2
  exit 1
fi

echo "OK: keystore, alias y contraseñas coinciden con la identidad esperada."
echo "    Alias: $EXPECTED_ALIAS"
echo "    SHA-256: $EXPECTED_SHA256"
