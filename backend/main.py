"""
Strata backend — FastAPI app: load model, run inference, stream layer data over WebSocket,
save/copy tensors, estimate export size. Electron waits for "Strata backend ready" on stdout.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime
import torch
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from . import cache_store
from . import inference_runner
from . import model_loader


# --- Request/response bodies ---


class LoadModelBody(BaseModel):
    path: str


class RunInferenceBody(BaseModel):
    input_data: str
    input_hint: str


class SaveTensorBody(BaseModel):
    layer_id: str
    path: str


class CopyTensorBody(BaseModel):
    layer_id: str


# --- App ---

app = FastAPI(title="Strata Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__},
    )


@app.on_event("startup")
def startup() -> None:
    app.state.model = None
    app.state.model_graph = {}
    app.state.model_type = None
    app.state.model_path = None
    app.state.stream_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    print("Strata backend ready", flush=True)


def _drain_queue(q: asyncio.Queue[Any]) -> None:
    while True:
        try:
            q.get_nowait()
        except asyncio.QueueEmpty:
            break


# --- Routes ---


@app.post("/load-model")
async def load_model_route(body: LoadModelBody) -> dict[str, Any]:
    """Load a PyTorch or ONNX model from disk and store its graph and live model in app state."""
    try:
        path = Path(body.path).resolve()
        if not path.exists():
            raise HTTPException(status_code=404, detail="File not found.")
        graph = model_loader.load_model(str(path))
        app.state.model_graph = graph
        app.state.model_type = graph["model_type"]
        suffix = path.suffix.lower()
        if suffix in (".pt", ".pth"):
            obj = torch.load(str(path), map_location="cpu", weights_only=False)
            if not isinstance(obj, torch.nn.Module):
                raise ValueError("File is not a full PyTorch model.")
            app.state.model = obj
        elif suffix == ".onnx":
            app.state.model = onnxruntime.InferenceSession(str(path))
            app.state.model_path = str(path)
        else:
            raise ValueError("Unsupported format.")
        return graph
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {e!s}")


@app.post("/run-inference")
async def run_inference_route(body: RunInferenceBody) -> dict[str, Any]:
    """Drain the stream queue, run inference in a thread, return the list of layer ids."""
    try:
        q = app.state.stream_queue
        _drain_queue(q)
        loop = asyncio.get_event_loop()
        model_state = {
            "model": app.state.model,
            "model_graph": app.state.model_graph,
            "model_type": app.state.model_type,
            "model_path": getattr(app.state, "model_path", None),
        }
        layer_ids = await loop.run_in_executor(
            None,
            lambda: inference_runner.run_inference(
                model_state,
                body.input_data,
                body.input_hint,
                q,
            ),
        )
        return {"layer_ids": layer_ids}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e!s}")


@app.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket) -> None:
    """Send each item from the stream queue as JSON until a None sentinel is received."""
    await websocket.accept()
    q = app.state.stream_queue
    try:
        while True:
            item = await q.get()
            if item is None:
                break
            await websocket.send_text(json.dumps(item))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@app.post("/save-tensor")
async def save_tensor_route(body: SaveTensorBody) -> dict[str, Any]:
    """Write the full layer record (no truncation) to a .txt file at the given path."""
    try:
        record = cache_store.get_any(body.layer_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Layer not found in cache.")
        stats = record.get("stats") or {}
        lines = [
            "=====================================",
            "STRATA — LAYER EXPORT",
            "=====================================",
            f"Layer:        {record.get('name', '')}",
            f"Type:         {record.get('type', '')}",
            f"Param Count:  {record.get('param_count', 0)}",
            f"Input Shape:  {record.get('input_shape', [])}",
            f"Output Shape: {record.get('output_shape', [])}",
            "-------------------------------------",
            "STATISTICS",
            f"Mean:  {stats.get('mean', 0):.8f}",
            f"Std:   {stats.get('std', 0):.8f}",
            f"Min:   {stats.get('min', 0):.8f}",
            f"Max:   {stats.get('max', 0):.8f}",
            "-------------------------------------",
            "INPUT TENSOR — full data, no truncation",
        ]
        inp = record.get("input_tensor")
        if inp is not None and hasattr(inp, "tolist"):
            arr = np.asarray(inp)
            data = arr.tolist()
            if isinstance(data, list):
                for sub in data:
                    lines.append(str(sub))
            else:
                lines.append(str(data))
        else:
            lines.append("[]")
        lines.append("-------------------------------------")
        lines.append("OUTPUT TENSOR — full data, no truncation")
        out = record.get("output_tensor")
        if out is not None and hasattr(out, "tolist"):
            arr = np.asarray(out)
            data = arr.tolist()
            if isinstance(data, list):
                for sub in data:
                    lines.append(str(sub))
            else:
                lines.append(str(data))
        else:
            lines.append("[]")
        lines.append("=====================================")
        path = Path(body.path).resolve()
        path.write_text("\n".join(lines), encoding="utf-8")
        return {"success": True, "path": str(path)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save failed: {e!s}")


@app.post("/copy-tensor")
async def copy_tensor_route(body: CopyTensorBody) -> dict[str, Any]:
    """Return the full layer record as JSON with tensors serialized as lists for clipboard."""
    try:
        record = cache_store.get_any(body.layer_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Layer not found in cache.")
        out: dict[str, Any] = {k: v for k, v in record.items() if k not in ("input_tensor", "output_tensor")}
        inp = record.get("input_tensor")
        out_arr = record.get("output_tensor")
        out["input_tensor"] = np.asarray(inp).tolist() if inp is not None else []
        out["output_tensor"] = np.asarray(out_arr).tolist() if out_arr is not None else []
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Copy failed: {e!s}")


@app.get("/estimate-size")
async def estimate_size_route(layer_id: str = Query(..., alias="layer_id")) -> dict[str, Any]:
    """Return estimated byte size and human-readable string for exporting this layer's tensors."""
    try:
        record = cache_store.get_any(layer_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Layer not found in cache.")
        inp = record.get("input_tensor")
        out = record.get("output_tensor")
        in_n = int(np.asarray(inp).size) if inp is not None else 0
        out_n = int(np.asarray(out).size) if out is not None else 0
        bytes_estimate = (in_n + out_n) * 24
        if bytes_estimate >= 1024 * 1024 * 1024:
            human = f"{bytes_estimate / (1024**3):.1f} GB"
        elif bytes_estimate >= 1024 * 1024:
            human = f"{bytes_estimate / (1024**2):.1f} MB"
        elif bytes_estimate >= 1024:
            human = f"{bytes_estimate / 1024:.1f} KB"
        else:
            human = f"{bytes_estimate} B"
        return {"bytes": bytes_estimate, "human_readable": human}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Estimate failed: {e!s}")


@app.get("/health")
async def health_route() -> dict[str, Any]:
    """Return status and whether a model is loaded; used by Electron to confirm backend is alive."""
    return {
        "status": "ok",
        "model_loaded": app.state.model is not None,
    }
