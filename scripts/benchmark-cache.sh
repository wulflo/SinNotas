#!/usr/bin/env bash
# Benchmark the persistent metadata cache with a generated 5,000-note vault.
# Usage: scripts/benchmark-cache.sh [note-count]
set -euo pipefail

cd "$(dirname "$0")/.."

cargo run --release --manifest-path src-tauri/Cargo.toml \
  --example cache_benchmark -- "${1:-5000}"
