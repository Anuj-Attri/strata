"""Launcher for the Strata backend (FastAPI) with uvicorn. Run from repo root: python -m backend.run_backend"""
import uvicorn
from backend.main import app

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
