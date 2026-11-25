#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] Node.js / npm was not found in PATH."
  exit 1
fi

if [ ! -x "node_modules/.bin/vite" ]; then
  echo "Local Vite installation is missing or incomplete."
  echo "Installing locked development dependencies..."
  if [ -f "package-lock.json" ]; then
    npm ci --include=dev
  else
    npm install --include=dev
  fi
fi

npm run dev -- --open
