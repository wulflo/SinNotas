#!/usr/bin/env bash
#
# Genera el keystore de release de Sin Notas (PKCS12) y su copia Base64 para GitHub
# Actions.
#
# Uso:
#   scripts/generate-keystore.sh
#   FORCE=1 scripts/generate-keystore.sh   # regenerar (rompe actualizaciones)
#
# Variables opcionales:
#   KEYSTORE_FILE       (por defecto: sinnotas-release.p12)
#   KEY_ALIAS           (por defecto: sinnotas-key)
#   KEYSTORE_PASSWORD   (por defecto: aleatoria, se pasa via -storepass:env)
#   KEY_PASSWORD        (por defecto: aleatoria, se pasa via -keypass:env)
#   KEYSTORE_DNAME      (por defecto: CN=Sin Notas, ...)
#   BASE64_FILE         (por defecto: keystore.base64.txt)
#   SECRETS_FILE        (por defecto: keystore-secrets.txt, permisos 600)
#
# El keystore y los secretos quedan ignorados por Git. No los compartas ni los
# subas al repositorio: son el secreto que permite firmar actualizaciones de la
# APK con la misma identidad criptográfica.
#
# IMPORTANTE: Las contraseñas NO se imprimen en stdout. Se escriben a un archivo
# con permisos 600 y se muestra solo la ruta de dicho archivo.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

KEYSTORE_FILE="${KEYSTORE_FILE:-sinnotas-release.p12}"
BASE64_FILE="${BASE64_FILE:-keystore.base64.txt}"
KEY_ALIAS="${KEY_ALIAS:-sinnotas-key}"
KEY_SIZE="${KEY_SIZE:-2048}"
VALIDITY_DAYS="${VALIDITY_DAYS:-10000}"
KEYSTORE_DNAME="${KEYSTORE_DNAME:-CN=Sin Notas, OU=Android, O=SinNotas, L=Bogota, ST=Bogota, C=CO}"
SECRETS_FILE="${SECRETS_FILE:-keystore-secrets.txt}"

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '\n'
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n'
  fi
}

KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-$(random_password)}"
KEY_PASSWORD="${KEY_PASSWORD:-$(random_password)}"

if ! command -v keytool >/dev/null 2>&1; then
  echo "Error: keytool no está instalado. Instala un JDK 17 o superior." >&2
  exit 1
fi
if ! command -v base64 >/dev/null 2>&1; then
  echo "Error: base64 no está disponible en el sistema." >&2
  exit 1
fi

if [[ -e "${KEYSTORE_FILE}" && "${FORCE:-0}" != "1" ]]; then
  cat >&2 <<EOF
Error: ya existe ${KEYSTORE_FILE}.

Regenerarlo cambia la identidad de firma y las APK instaladas no podrán
actualizarse. Si estás seguro, ejecuta:

  FORCE=1 $0

EOF
  exit 1
fi

if [[ "${FORCE:-0}" == "1" ]]; then
  rm -f "${KEYSTORE_FILE}" "${BASE64_FILE}" "${SECRETS_FILE}"
fi

umask 077

# Generar keystore PKCS12 (formato moderno, recomendado sobre JKS)
# Las contraseñas se pasan via variables de entorno para no aparecer en ps/historial
export KEYSTORE_PASSWORD
export KEY_PASSWORD

keytool -genkeypair \
  -storetype PKCS12 \
  -keystore "${KEYSTORE_FILE}" \
  -alias "${KEY_ALIAS}" \
  -keyalg RSA \
  -keysize "${KEY_SIZE}" \
  -validity "${VALIDITY_DAYS}" \
  -dname "${KEYSTORE_DNAME}" \
  -storepass:env KEYSTORE_PASSWORD \
  -keypass:env KEY_PASSWORD \
  -noprompt >/dev/null

# GitHub Actions acepta el secreto en una sola línea (Base64 sin newlines)
base64 < "${KEYSTORE_FILE}" | tr -d '\n' > "${BASE64_FILE}"

# Escribir secretos a archivo con permisos 600 (NO a stdout)
cat > "${SECRETS_FILE}" <<EOF
ANDROID_KEYSTORE_BASE64=$(cat "${BASE64_FILE}")
KEYSTORE_PASSWORD=${KEYSTORE_PASSWORD}
KEY_ALIAS=${KEY_ALIAS}
KEY_PASSWORD=${KEY_PASSWORD}
EOF

chmod 600 "${KEYSTORE_FILE}" "${BASE64_FILE}" "${SECRETS_FILE}"

echo
echo "Keystore generado correctamente:"
echo "  Archivo: ${KEYSTORE_FILE} (PKCS12, permisos 600)"
echo "  Base64:  ${BASE64_FILE} (permisos 600)"
echo "  Secretos: ${SECRETS_FILE} (permisos 600, NO commitear)"
echo
echo "Para GitHub Actions, copia el contenido de ${SECRETS_FILE} en:"
echo "  Settings → Secrets and variables → Actions → New repository secret"
echo
echo "Secretos requeridos:"
echo "  ANDROID_KEYSTORE_BASE64"
echo "  KEYSTORE_PASSWORD"
echo "  KEY_ALIAS"
echo "  KEY_PASSWORD"
echo
echo "AVISO: ${SECRETS_FILE} contiene secretos. No lo pegues en issues, chats públicos"
echo "ni lo confirmes en Git. Si se filtran, rota la clave y vuelve a firmar."
echo "El archivo tiene permisos 600 para proteger su contenido."
