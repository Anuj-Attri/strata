@echo off
setlocal
set REPO=%~dp0..
echo === Strata: Building backend ===
cd /d "%REPO%\backend"
pip install -r requirements.txt
pip install pyinstaller
pyinstaller --onefile --name strata_backend ^
  --hidden-import=uvicorn.logging ^
  --hidden-import=uvicorn.loops.auto ^
  --hidden-import=uvicorn.protocols.http.auto ^
  --hidden-import=uvicorn.protocols.websockets.auto ^
  --hidden-import=uvicorn.lifespan.on ^
  --hidden-import=fastapi ^
  --hidden-import=onnxruntime ^
  --hidden-import=onnx ^
  --hidden-import=transformers ^
  --hidden-import=PIL ^
  main.py
echo === Backend binary: %REPO%\backend\dist\strata_backend.exe ===
