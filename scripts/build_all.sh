#!/bin/bash
set -e
bash "$(dirname "$0")/build_backend.sh"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
npm install
npm run make
echo "Strata build complete. Installers in frontend/release/"
