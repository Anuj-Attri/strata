"""
Strata backend — prepare inputs (image, text, or raw tensor), run PyTorch or ONNX
inference, and capture full layer data into the cache and stream queue.
"""

from __future__ import annotations

import asyncio
import re
from base64 import b64decode
from io import BytesIO
from typing import Any

import numpy as np
import onnxruntime
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms

from . import cache_store
from . import hook_manager


def build_intermediate_session(model_path: str):
    """
    Modifies the ONNX model to expose all intermediate tensors as outputs,
    then creates an InferenceSession from the modified model in memory.
    This lets us capture the output of every single layer during inference.
    """
    import onnx
    model = onnx.load(model_path)
    existing = {o.name for o in model.graph.output}
    for node in model.graph.node:
        for out in node.output:
            if out and out not in existing:
                model.graph.output.append(
                    onnx.helper.make_tensor_value_info(out, onnx.TensorProto.FLOAT, None)
                )
                existing.add(out)
    try:
        model = onnx.shape_inference.infer_shapes(model)
    except Exception:
        pass
    session = onnxruntime.InferenceSession(
        model.SerializeToString(),
        providers=["CPUExecutionProvider"],
    )
    output_names = [o.name for o in session.get_outputs()]
    return session, output_names


def _parse_onnx_image_shape(session: onnxruntime.InferenceSession) -> tuple[int, int]:
    """Read H, W from ONNX input shape; default 640×640 if dynamic."""
    inp = session.get_inputs()[0]
    shape = getattr(inp, "shape", []) or []
    # Typical: [batch, channels, height, width] or [batch, channels, H, W]
    h, w = 640, 640
    if len(shape) >= 4:
        sh, sw = shape[2], shape[3]
        if isinstance(sh, int) and sh > 0:
            h = sh
        if isinstance(sw, int) and sw > 0:
            w = sw
    return h, w


def prepare_input(
    input_data: str,
    input_hint: str,
    onnx_session: onnxruntime.InferenceSession | None = None,
) -> torch.Tensor | dict[str, torch.Tensor]:
    """
    Turn a string (and a hint) into data the model can consume.

    For "image", the string is base64-encoded image bytes. If onnx_session is
    provided, image is resized to the session's expected input shape (H×W) and
    normalized to [0, 1]. For PyTorch (no session), uses 224×224 and ImageNet
    normalization. For "text", we tokenize with BERT. For "tensor", we parse
    comma-separated floats. Unknown hints fall back to tensor or raise.
    """
    hint = (input_hint or "").strip().lower() or "tensor"

    if hint == "image":
        try:
            raw = b64decode(input_data.strip(), validate=True)
        except Exception as e:
            raise ValueError(f"Invalid base64 image data: {e!s}") from e
        try:
            pil = Image.open(BytesIO(raw)).convert("RGB")
        except Exception as e:
            raise ValueError(f"Could not load image: {e!s}") from e

        if onnx_session is not None:
            h, w = _parse_onnx_image_shape(onnx_session)
            pil = pil.resize((w, h), Image.LANCZOS)
            t = transforms.ToTensor()(pil)
            t = t / 255.0
            t = t.unsqueeze(0)
            return t

        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])
        t = transform(pil).unsqueeze(0)
        return t

    if hint == "text":
        try:
            from transformers import AutoTokenizer
            tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
        except Exception as e:
            raise RuntimeError(f"Could not load tokenizer: {e!s}") from e
        try:
            encoded = tokenizer(
                input_data,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512,
            )
        except Exception as e:
            raise ValueError(f"Tokenization failed: {e!s}") from e
        return {k: v for k, v in encoded.items()}

    if hint == "tensor":
        try:
            parts = [p.strip() for p in input_data.split(",") if p.strip()]
            if not parts:
                raise ValueError("No numbers provided")
            values = [float(x) for x in parts]
            t = torch.tensor(values, dtype=torch.float32).unsqueeze(0)
            return t
        except ValueError as e:
            raise ValueError(f"Could not parse tensor from comma-separated numbers: {e!s}") from e

    try:
        parts = [p.strip() for p in input_data.split(",") if p.strip()]
        if not parts:
            raise ValueError("No numbers provided")
        values = [float(x) for x in parts]
        t = torch.tensor(values, dtype=torch.float32).unsqueeze(0)
        return t
    except ValueError:
        raise ValueError(
            "Unsupported input hint. Use 'image', 'text', or 'tensor', or provide "
            "comma-separated numbers for raw tensor input."
        ) from None


def run_pt_inference(
    model: nn.Module,
    prepared_input: torch.Tensor | dict[str, torch.Tensor],
    queue: asyncio.Queue[dict[str, Any] | None],
) -> list[str]:
    """
    Run one forward pass with hooks attached, then remove the hooks.

    Registers hooks so every layer's input and output are stored in the cache and
    pushed to the queue. Uses the prepared input (tensor or dict for text). Returns
    the ordered list of layer ids that were captured. A sentinel None is put on the
    queue when done so stream consumers know to stop.
    """
    handles = hook_manager.register_hooks(model, queue)
    try:
        if isinstance(prepared_input, dict):
            model(**prepared_input)
        else:
            model(prepared_input)
    finally:
        hook_manager.remove_hooks(handles)
    try:
        queue.put_nowait(None)
    except asyncio.QueueFull:
        pass
    return list(cache_store.inference_cache.keys())


def run_onnx_inference(
    session: onnxruntime.InferenceSession,
    prepared_input: torch.Tensor,
    graph_nodes: list[dict[str, Any]],
    queue: asyncio.Queue[dict[str, Any] | None],
    model_path: str | None = None,
) -> list[str]:
    """
    Run ONNX inference. If model_path is set, use build_intermediate_session to
    capture all intermediate tensors; otherwise use the given session and graph_nodes.
    """
    input_name = session.get_inputs()[0].name
    inp = prepared_input.detach().cpu().numpy()
    input_dict = {input_name: inp}

    if model_path:
        inter_session, output_names = build_intermediate_session(model_path)
        # Build input_dict for all session inputs (user provides first; rest get zeros)
        all_inputs = inter_session.get_inputs()
        inter_input_dict: dict[str, np.ndarray] = {}
        for idx, inp_meta in enumerate(all_inputs):
            if idx == 0:
                arr = prepared_input.detach().cpu().numpy()
                if arr.dtype != np.float32 and arr.dtype != np.float64:
                    arr = arr.astype(np.float32)
                inter_input_dict[inp_meta.name] = arr
            else:
                shape = getattr(inp_meta, "shape", []) or []
                shape = [s if isinstance(s, int) and s > 0 else 1 for s in shape]
                if not shape:
                    shape = [1]
                inter_input_dict[inp_meta.name] = np.zeros(shape, dtype=np.float32)
        results = inter_session.run(None, inter_input_dict)
        layer_ids: list[str] = []
        for i, (name, arr) in enumerate(zip(output_names, results)):
            if arr is None:
                continue
            arr = np.asarray(arr)
            sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", name).strip("_")
            if not sanitized:
                sanitized = f"output_{i}"
            record: dict[str, Any] = {
                "layer_id": sanitized,
                "name": name,
                "type": "onnx_output",
                "param_count": 0,
                "trainable_params": 0,
                "input_tensor": [],
                "output_tensor": arr,
                "input_shape": [],
                "output_shape": list(arr.shape),
                "stats": cache_store.get_stats(arr),
            }
            cache_store.put(sanitized, record)
            cache_store.put(name, record)
            layer_ids.append(sanitized)
            record_json: dict[str, Any] = {
                **record,
                "input_tensor": [],
                "output_tensor": arr.tolist(),
            }
            try:
                queue.put_nowait(record_json)
            except asyncio.QueueFull:
                pass
        try:
            queue.put_nowait(None)
        except asyncio.QueueFull:
            pass
        return layer_ids

    # Original behavior: graph-node output list
    output_names = []
    node_indices = []
    for i, node in enumerate(graph_nodes):
        shapes = node.get("output_shapes") or []
        if shapes:
            output_names.append(shapes[0])
            node_indices.append(i)

    if not output_names:
        try:
            queue.put_nowait(None)
        except asyncio.QueueFull:
            pass
        return []

    outputs = session.run(output_names, input_dict)
    layer_ids = []
    for i, arr in enumerate(outputs):
        raw_key = output_names[i] if i < len(output_names) else f"output_{i}"
        sanitized_key = re.sub(r"[^a-zA-Z0-9_]", "_", raw_key)
        node = graph_nodes[node_indices[i]] if i < len(node_indices) else {}
        output_shape = list(arr.shape)
        stats = cache_store.get_stats(arr)
        record = {
            "layer_id": raw_key,
            "name": node.get("name") or raw_key,
            "type": node.get("type") or "Node",
            "param_count": node.get("param_count", 0),
            "trainable_params": node.get("trainable_params", 0),
            "input_tensor": np.array([]),
            "output_tensor": arr,
            "input_shape": [],
            "output_shape": output_shape,
            "stats": stats,
        }
        cache_store.put(raw_key, record)
        cache_store.put(sanitized_key, record)
        layer_ids.append(raw_key)
        record_json = {
            **record,
            "input_tensor": [],
            "output_tensor": arr.tolist(),
        }
        try:
            queue.put_nowait(record_json)
        except asyncio.QueueFull:
            pass
    try:
        queue.put_nowait(None)
    except asyncio.QueueFull:
        pass
    return layer_ids


def run_inference(
    model_state: dict[str, Any],
    input_data: str,
    input_hint: str,
    queue: asyncio.Queue[dict[str, Any] | None],
) -> list[str]:
    """
    Top-level entry: clear the cache, prepare input, then run PT or ONNX inference.

    Dispatches based on model_state["model_type"]. For ONNX, if the prepared input
    is a dict (text), we use the "input_ids" tensor. Returns the ordered list of
    layer ids. Raises clear, human-readable errors on failure.
    """
    cache_store.clear()

    model_type = model_state.get("model_type") or "pt"
    model = model_state.get("model")
    model_graph = model_state.get("model_graph") or {}
    onnx_session = model if model_type == "onnx" else None
    prepared = prepare_input(input_data, input_hint, onnx_session=onnx_session)

    if model_type == "pt":
        if model is None:
            raise RuntimeError("No PyTorch model loaded. Load a model first.")
        return run_pt_inference(model, prepared, queue)

    if model_type == "onnx":
        if model is None:
            raise RuntimeError("No ONNX model loaded. Load a model first.")
        graph_nodes = model_graph.get("nodes") or []
        model_path = model_state.get("model_path")
        if isinstance(prepared, dict):
            prepared_tensor = prepared.get("input_ids")
            if prepared_tensor is None:
                raise ValueError("Text input produced no input_ids. Cannot run ONNX inference.")
        else:
            prepared_tensor = prepared
        return run_onnx_inference(model, prepared_tensor, graph_nodes, queue, model_path=model_path)

    raise ValueError(f"Unknown model_type: {model_type}. Expected 'pt' or 'onnx'.")
