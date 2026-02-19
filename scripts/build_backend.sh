#!/bin/bash
set -e
echo "Building Strata backend..."
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pip install -r backend/requirements.txt
pip install pyinstaller uvicorn
pyinstaller --onefile --name strata_backend --distpath backend/dist --specpath backend --workpath backend/build \
  --hidden-import=transformers --hidden-import=onnxruntime --hidden-import=torch \
  --hidden-import=backend.main --hidden-import=backend.cache_store --hidden-import=backend.model_loader \
  --hidden-import=backend.hook_manager --hidden-import=backend.inference_runner \
  run_backend.py
echo "Backend build complete. Binary at backend/dist/strata_backend"
