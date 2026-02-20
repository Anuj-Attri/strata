# Contributing to Strata

Thanks for your interest in contributing. This document explains how the repo is structured and how to work on it.

## Repo structure

- **`backend/`** — Python FastAPI server: model loading, hooks, inference, cache. Run with `uvicorn backend.main:app`.
- **`frontend/`** — Electron app (React, React Three Fiber, Zustand). Build and run with `npm run make` and `npm start` (or `npm run dev` for development).
- **`scripts/`** — Build and icon scripts (e.g. `build_backend.sh`, `build_all.sh`, `generate_icons.js`).

## Run in dev mode

From the repo root:

1. Create and activate a virtualenv, then install backend deps:
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

2. From `frontend/`, install Node deps and start the dev pipeline:
   ```bash
   cd frontend && npm ci && npm run dev
   ```
   This starts the backend (uvicorn) and the Electron app. The app talks to the backend over HTTP/WebSocket.

## Backend architecture

- **FastAPI** — REST and WebSocket endpoints in `main.py`.
- **Hooks** — PyTorch forward hooks in `hook_manager.py` capture per-layer inputs/outputs.
- **Inference** — `inference_runner.py` runs PyTorch or ONNX inference and returns layer records.
- **Cache** — `cache_store.py` holds tensor stats; layer records are streamed to the frontend via WebSocket.

## Frontend architecture

- **Electron** — Desktop shell; Forge is used for packaging (see `forge.config.js`).
- **React Three Fiber (R3F)** — 3D graph in `GraphView.jsx`; nodes are meshes with label textures.
- **Zustand** — Global state in `store.js` (model graph, inference cache, selected layer).
- **Detail panel** — Shows feature maps and export for the selected layer (`FeatureMapGrid.jsx`).

## Adding support for a new model type

1. **Backend** — If the model uses a new input format (e.g. a new tokenizer), extend `inference_runner.prepare_input` or add a new `prepare_*` helper and wire it in `run_onnx_inference` / `run_inference`. For PyTorch, ensure `hook_manager` and `model_loader` can load and trace the model.
2. **Frontend** — If the UI needs a new input type (e.g. audio), extend `detectInputType` in `InputPanel.jsx` and add the corresponding input control and submission path in `App.jsx`.

## PR guidelines

- **One concern per PR** — Prefer focused changes (e.g. one feature or one bugfix).
- **Describe the problem and solution** — In the PR description, state what’s wrong or what’s missing and how your change addresses it.
- **Test** — Run `npm run dev` and test with a real model. For backend changes, run the FastAPI app and hit the relevant endpoints.
- **Checklist** — Use the repo’s pull request template (e.g. tested locally, no new high audit issues, CHANGELOG updated if notable).
