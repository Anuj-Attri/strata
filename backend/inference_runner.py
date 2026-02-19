"""
Strata backend — prepare inputs (image, text, or raw tensor), run PyTorch or ONNX
inference, and capture full layer data into the cache and stream queue.
"""

from __future__ import annotations

import asyncio
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


def prepare_input(input_data: str, input_hint: str) -> torch.Tensor | dict[str, torch.Tensor]:
    """
    Turn a string (and a hint) into data the model can consume.

    For "image", the string is base64-encoded image bytes; we decode, load as PIL,
    convert to RGB, normalize with ImageNet stats, and add a batch dimension. For
    "text", we tokenize with BERT and return a dict of input_ids and attention_mask.
    For "tensor", we parse comma-separated floats into a float32 tensor with a
    batch dimension. Unknown hints fall back to tensor parsing or raise a clear error.
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
) -> list[str]:
    """
    Run ONNX inference and build one synthetic LayerRecord per requested node output.

    Converts the prepared tensor to numpy, runs the session requesting the first
    output of each graph node that has outputs, then builds a LayerRecord for each
    result and puts it in the cache and queue. Returns the list of layer ids in order.
    A sentinel None is put on the queue when done.
    """
    input_name = session.get_inputs()[0].name
    inp = prepared_input.detach().cpu().numpy()
    input_dict = {input_name: inp}

    output_names: list[str] = []
    node_indices: list[int] = []
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
    layer_ids: list[str] = []

    for i, arr in enumerate(outputs):
        node = graph_nodes[node_indices[i]]
        layer_id = node.get("id") or f"node_{node_indices[i]}"
        name = node.get("name") or layer_id
        type_name = node.get("type") or "Node"
        input_shapes = node.get("input_shapes") or []
        output_shape = list(arr.shape)
        stats = cache_store.get_stats(arr)

        input_arr = np.array([])
        input_shape: list[int] = []

        record: dict[str, Any] = {
            "layer_id": layer_id,
            "name": name,
            "type": type_name,
            "param_count": node.get("param_count", 0),
            "trainable_params": node.get("trainable_params", 0),
            "input_tensor": input_arr,
            "output_tensor": arr,
            "input_shape": input_shape,
            "output_shape": output_shape,
            "stats": stats,
        }
        cache_store.put(layer_id, record)
        layer_ids.append(layer_id)

        record_json: dict[str, Any] = {
            **record,
            "input_tensor": input_arr.tolist(),
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

    prepared = prepare_input(input_data, input_hint)
    model_type = model_state.get("model_type") or "pt"
    model = model_state.get("model")
    model_graph = model_state.get("model_graph") or {}

    if model_type == "pt":
        if model is None:
            raise RuntimeError("No PyTorch model loaded. Load a model first.")
        return run_pt_inference(model, prepared, queue)

    if model_type == "onnx":
        if model is None:
            raise RuntimeError("No ONNX model loaded. Load a model first.")
        graph_nodes = model_graph.get("nodes") or []
        if isinstance(prepared, dict):
            prepared_tensor = prepared.get("input_ids")
            if prepared_tensor is None:
                raise ValueError("Text input produced no input_ids. Cannot run ONNX inference.")
        else:
            prepared_tensor = prepared
        return run_onnx_inference(model, prepared_tensor, graph_nodes, queue)

    raise ValueError(f"Unknown model_type: {model_type}. Expected 'pt' or 'onnx'.")
