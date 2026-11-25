#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] Node.js / npm was not found in PATH."
  exit 1
fi

if [ ! -x "node_modules/.bin/vite" ]; then
  echo "Local Vite installation is missing or incomplete."
  echo "Installing development dependencies without deleting existing modules..."
  npm install --include=dev --no-audit --no-fund
  npm rebuild esbuild
  if [ ! -x "node_modules/.bin/vite" ]; then
    echo "[ERROR] Vite installation is incomplete."
    exit 1
  fi
fi

npm run dev -- --open
