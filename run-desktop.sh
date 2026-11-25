#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] Node.js / npm was not found in PATH."
  exit 1
fi

electron_is_ready() {
  node -e "
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.dirname(require.resolve('electron/package.json'));
    const executable = fs.readFileSync(path.join(root, 'path.txt'), 'utf8');
    process.exit(fs.existsSync(path.join(root, 'dist', executable)) ? 0 : 1);
  " 2>/dev/null
}

if ! electron_is_ready; then
  echo "Desktop dependencies are missing or incomplete."
  echo "Installing development dependencies without deleting existing modules..."
  unset ELECTRON_SKIP_BINARY_DOWNLOAD || true
  npm install --include=dev --no-audit --no-fund
  npm rebuild electron esbuild electron-winstaller

  if ! electron_is_ready; then
    echo "Electron package is present, but its runtime was not downloaded."
    echo "Running Caveria's verified Electron runtime installer..."
    node desktop/install-electron-runtime.cjs
  fi

  if ! electron_is_ready; then
    echo "[ERROR] Electron installation is incomplete."
    exit 1
  fi
fi

npm run desktop
