#!/usr/bin/env bash
# Descarga la librería PDFium usada por el lector nativo de SinNotas.
#
# Uso:
#   scripts/fetch-pdfium.sh [destino]
#   PDFIUM_TARGET=macos-x86_64 scripts/fetch-pdfium.sh [destino]
#
# Sin argumentos descarga la librería para la plataforma actual dentro de
# src-tauri/resources/pdfium/<os>-<arch>/. PDFIUM_TARGET permite elegir un
# destino concreto (útil para CI: macOS universal necesita x64 y arm64).
#
# La librería se empaqueta como recurso de Tauri. No se descarga en tiempo de
# ejecución y no se usa la feature `bundled` de pdfium-render.
set -euo pipefail

PDFIUM_BUILD="${PDFIUM_BUILD:-8125}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${PDFIUM_TARGET:-}" ]]; then
  target="$PDFIUM_TARGET"
else
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$os" in
    linux)
      case "$arch" in
        x86_64) target="linux-x86_64" ;;
        aarch64|arm64) target="linux-aarch64" ;;
        *) echo "Arquitectura Linux no soportada: $arch" >&2; exit 1 ;;
      esac
      ;;
    darwin)
      case "$arch" in
        x86_64) target="macos-x86_64" ;;
        arm64) target="macos-aarch64" ;;
        *) echo "Arquitectura macOS no soportada: $arch" >&2; exit 1 ;;
      esac
      ;;
    mingw*|msys*|cygwin*)
      target="windows-x86_64"
      ;;
    *)
      echo "Sistema no soportado: $os" >&2
      exit 1
      ;;
  esac
fi

case "$target" in
  linux-x86_64) asset="pdfium-linux-x64.tgz"; library="libpdfium.so" ;;
  linux-aarch64) asset="pdfium-linux-arm64.tgz"; library="libpdfium.so" ;;
  macos-x86_64) asset="pdfium-mac-x64.tgz"; library="libpdfium.dylib" ;;
  macos-aarch64) asset="pdfium-mac-arm64.tgz"; library="libpdfium.dylib" ;;
  windows-x86_64) asset="pdfium-win-x64.tgz"; library="pdfium.dll" ;;
  *)
    echo "Destino PDFium no soportado: $target" >&2
    echo "Usa linux-x86_64, linux-aarch64, macos-x86_64, macos-aarch64 o windows-x86_64." >&2
    exit 1
    ;;
esac

destination="${1:-$ROOT/src-tauri/resources/pdfium/$target}"
mkdir -p "$destination"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/sinnotas-pdfium.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

url="https://github.com/bblanchon/pdfium-binaries/releases/download/chromium%2F${PDFIUM_BUILD}/${asset}"
echo "Descargando PDFium ${PDFIUM_BUILD} para ${target}…"
curl -fL --retry 4 --retry-delay 2 "$url" -o "$tmp/$asset"
tar xzf "$tmp/$asset" -C "$tmp"

found=""
for candidate in "$tmp/lib/$library" "$tmp/bin/$library" "$tmp/$library"; do
  if [[ -f "$candidate" ]]; then
    found="$candidate"
    break
  fi
done
if [[ -z "$found" ]]; then
  echo "No se encontró $library dentro de $asset" >&2
  exit 1
fi

cp "$found" "$destination/$library"
if [[ -f "$tmp/LICENSE" ]]; then
  cp "$tmp/LICENSE" "$ROOT/src-tauri/resources/pdfium/LICENSE"
fi

echo "PDFium instalado en $destination/$library"
