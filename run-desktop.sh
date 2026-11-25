#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] Node.js / npm was not found in PATH."
  exit 1
fi

electron_ready=false
if [ -x "node_modules/.bin/electron" ] && node -e \
  "const fs = require('node:fs'); process.exit(fs.existsSync(require('electron')) ? 0 : 1)"; then
  electron_ready=true
fi

if [ "$electron_ready" = false ]; then
  echo "Desktop dependencies are missing or incomplete."
  echo "Installing development dependencies without deleting existing modules..."
  npm install --include=dev --no-audit --no-fund
  if ! node -e \
    "const fs = require('node:fs'); process.exit(fs.existsSync(require('electron')) ? 0 : 1)"; then
    echo "[ERROR] Electron installation is incomplete."
    exit 1
  fi
fi

npm run desktop
