#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] Node.js / npm was not found in PATH."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies for the first time..."
  npm install
fi

npx vite --host 0.0.0.0 --open
