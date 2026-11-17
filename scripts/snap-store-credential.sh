#!/usr/bin/env bash
# Genera una credencial acotada para que GitHub Actions publique el snap.
#
# No escribe el secreto en el repositorio: lo copia al portapapeles si hay
# wl-copy/xclip, o lo imprime para que lo pegues en GitHub Secrets.
#
# Uso:
#   scripts/snap-store-credential.sh
#
# Requisitos:
#   - snapcraft instalado y con sesión iniciada (`snapcraft login`)
#   - el nombre del snap registrado en la Snap Store
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v snapcraft >/dev/null 2>&1; then
  echo "Falta snapcraft. Instálalo con: sudo snap install snapcraft --classic" >&2
  exit 1
fi

if ! snapcraft whoami >/dev/null 2>&1; then
  echo "No hay sesión iniciada. Ejecuta primero: snapcraft login" >&2
  exit 1
fi

SNAP="$(sed -n 's/^name:[[:space:]]*//p' snapcraft.yaml | head -n1)"
if [[ -z "$SNAP" ]]; then
  echo "No se pudo leer el nombre del snap desde snapcraft.yaml." >&2
  exit 1
fi

# La credencial queda solo en memoria. Si el comando falla, no se genera nada.
credential="$(snapcraft export-login \
  --snaps "$SNAP" \
  --channels stable,beta,edge \
  --acls package_access,package_push,package_update,package_release \
  -)"

if command -v wl-copy >/dev/null 2>&1; then
  printf '%s' "$credential" | wl-copy
  echo "Credencial de '$SNAP' copiada al portapapeles."
  echo "Pégala en GitHub → Settings → Secrets → Actions → SNAPCRAFT_STORE_CREDENTIALS."
elif command -v xclip >/dev/null 2>&1; then
  printf '%s' "$credential" | xclip -selection clipboard
  echo "Credencial de '$SNAP' copiada al portapapeles."
  echo "Pégala en GitHub → Settings → Secrets → Actions → SNAPCRAFT_STORE_CREDENTIALS."
else
  echo "Copia el siguiente valor en GitHub → Settings → Secrets → Actions →"
  echo "SNAPCRAFT_STORE_CREDENTIALS (no lo guardes en el repositorio):"
  echo
  printf '%s\n' "$credential"
fi
