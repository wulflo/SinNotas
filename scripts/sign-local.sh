#!/usr/bin/env bash
# Firma un APK local con el keystore de release de Sin Notas.
# No guarda secretos en el repo: los lee de /home/alonso/.config/sinnotas/secrets/signing.env
#
# Uso:
#   scripts/sign-local.sh [ruta/al/apk]
#
# Si no pasás la ruta, busca un APK release sin firmar en
# src-tauri/gen/android/app/build/outputs/apk.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${SIGNING_ENV_FILE:-/home/alonso/.config/sinnotas/secrets/signing.env}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,12p' "$0"
  exit 0
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "No existe $ENV_FILE" >&2
  echo "Definí KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS y KEY_PASSWORD en el entorno." >&2
fi

for v in KEYSTORE_PATH KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD; do
  if [[ -z "${!v:-}" ]]; then
    echo "Falta $v. Definila en $ENV_FILE o en el entorno." >&2
    exit 2
  fi
done
export KEYSTORE_PATH KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD

if [[ ! -f "$KEYSTORE_PATH" ]]; then
  echo "No existe el keystore: $KEYSTORE_PATH" >&2
  exit 1
fi

case "$KEYSTORE_PATH" in
  "$ROOT"/*)
    echo "ADVERTENCIA: el keystore está dentro del repo ($ROOT)." >&2
    echo "Mejor movelo a ~/.config/ y actualizá $ENV_FILE." >&2
    ;;
esac

APK="${1:-}"
if [[ -z "$APK" ]]; then
  mapfile -t APKS < <(find "$ROOT/src-tauri/gen/android/app/build/outputs/apk" \
    -path '*/release/*' -name '*.apk' -not -name '*-signed*' 2>/dev/null | sort)
  if [[ ${#APKS[@]} -eq 0 ]]; then
    echo "No encontré un APK release. Pasá la ruta como argumento." >&2
    exit 1
  fi
  APK="${APKS[0]}"
fi

if [[ ! -f "$APK" ]]; then
  echo "No existe el APK: $APK" >&2
  exit 1
fi

APKSIGNER="${APKSIGNER:-}"
if [[ -z "$APKSIGNER" ]]; then
  APKSIGNER="$(command -v apksigner || true)"
fi
if [[ -z "$APKSIGNER" ]]; then
  for d in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk"; do
    [[ -n "$d" && -d "$d/build-tools" ]] || continue
    APKSIGNER="$(find "$d/build-tools" -maxdepth 2 -type f -name apksigner 2>/dev/null | sort -V | tail -1)"
    [[ -n "$APKSIGNER" ]] && break
  done
fi
if [[ -z "$APKSIGNER" || ! -x "$APKSIGNER" ]]; then
  echo "No encontré apksigner. Instalá Android build-tools o definí APKSIGNER." >&2
  exit 1
fi

OUT="${APK%.apk}-signed.apk"
"$APKSIGNER" sign \
  --ks "$KEYSTORE_PATH" \
  --ks-key-alias "$KEY_ALIAS" \
  --ks-pass env:KEYSTORE_PASSWORD \
  --key-pass env:KEY_PASSWORD \
  --out "$OUT" \
  "$APK"

"$APKSIGNER" verify --verbose --print-certs "$OUT" | tee "$OUT.certs.txt"
if [[ -n "${EXPECTED_SHA256:-}" ]]; then
  EXPECTED_NORM="$(printf '%s' "$EXPECTED_SHA256" | tr -d ':' | tr '[:upper:]' '[:lower:]')"
  CERT_NORM="$(grep -i 'certificate SHA-256 digest:' "$OUT.certs.txt" | head -1 | sed 's/.*digest:[[:space:]]*//' | tr -d ':' | tr '[:upper:]' '[:lower:]')"
  if [[ "$CERT_NORM" != "$EXPECTED_NORM" ]]; then
    echo "ERROR: el APK no quedó firmado con el certificado esperado." >&2
    echo "Esperado: $EXPECTED_SHA256" >&2
    echo "Obtenido: $CERT_NORM" >&2
    exit 1
  fi
fi
echo "OK: APK firmado en $OUT"
