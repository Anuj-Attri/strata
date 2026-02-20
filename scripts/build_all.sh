#!/bin/bash
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
bash "$REPO/scripts/build_backend.sh"
echo "=== Strata: Building frontend ==="
cd "$REPO/frontend"
npm ci
npm run make
echo "=== Build complete. Check frontend/out/make/ ==="
