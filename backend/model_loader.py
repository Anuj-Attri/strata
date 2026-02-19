"""
Strata backend — load PyTorch and ONNX models and return a unified graph description.
No truncation of any data. All errors are converted to clear, human-readable messages.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import numpy as np
import onnx
import onnxruntime
import torch
import torch.nn as nn


def _sanitize_id(name: str) -> str:
    """Turn a module name into a safe node id by replacing dots with underscores."""
    return name.replace(".", "_")


def load_pt_model(path: str) -> dict[str, Any]:
    """
    Load a PyTorch model from a .pt or .pth file and build a graph of its layers.

    Opens the file, checks that it is a full model (not just a state dict), then
    walks every submodule to create nodes and edges. Each node gets parameter counts
    and placeholder shape lists (shapes are filled later when you run inference).
    """
    path = Path(path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"No file found at {path}")

    try:
        obj = torch.load(str(path), map_location="cpu", weights_only=False)
    except Exception as e:
        raise RuntimeError(f"Could not load PyTorch file: {e!s}") from e

    if isinstance(obj, dict) and not isinstance(obj, nn.Module):
        raise ValueError(
            "This appears to be a state dict, not a full model. "
            "Please save your model with torch.save(model, path) not torch.save(model.state_dict(), path)."
        )

    if not isinstance(obj, nn.Module):
        raise ValueError(
            "The file does not contain a PyTorch model. "
            "Strata expects a model saved with torch.save(model, path)."
        )

    model = obj
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    seen_ids: set[str] = set()

    for name, module in model.named_modules():
        if name == "":
            continue

        nid = _sanitize_id(name)
        if nid in seen_ids:
            continue
        seen_ids.add(nid)

        param_count = sum(p.numel() for p in module.parameters())
        trainable_params = sum(p.numel() for p in module.parameters() if p.requires_grad)
        type_name = type(module).__name__

        nodes.append({
            "id": nid,
            "name": name,
            "type": type_name,
            "param_count": param_count,
            "trainable_params": trainable_params,
            "input_shapes": [],
            "output_shapes": [],
        })

        for child_name, _ in module.named_children():
            child_full_name = f"{name}.{child_name}" if name else child_name
            child_id = _sanitize_id(child_full_name)
            edges.append({"from": nid, "to": child_id})

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    return {
        "model_type": "pt",
        "nodes": nodes,
        "edges": edges,
        "total_params": total_params,
        "trainable_params": trainable_params,
    }


def _onnx_tensor_shape(tensor: Any) -> list[int] | None:
    """Get shape as a list of integers from an ONNX tensor (TensorProto or ValueInfoProto)."""
    if tensor is None:
        return None
    if hasattr(tensor, "type") and tensor.type and hasattr(tensor.type, "tensor_type"):
        tt = tensor.type.tensor_type
        if tt and hasattr(tt, "shape") and tt.shape and tt.shape.dim:
            return [d.dim_value if d.dim_value else -1 for d in tt.shape.dim]
    return None


def load_onnx_model(path: str) -> dict[str, Any]:
    """
    Load an ONNX model from a .onnx file and build a graph of its operations.

    Uses the ONNX library to parse the file and check it is valid, then reads
    every node (operation) and how they connect. Shape information is taken
    from the graph where the model provides it.
    """
    path = Path(path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"No file found at {path}")

    try:
        onnx_model = onnx.load(str(path))
    except Exception as e:
        raise RuntimeError(f"Could not load ONNX file: {e!s}") from e

    try:
        onnx.checker.check_model(onnx_model)
    except onnx.checker.ValidationError as e:
        raise ValueError(f"Invalid ONNX model: {e!s}") from e

    graph = onnx_model.graph
    name_to_shape: dict[str, list[int] | None] = {}

    for inp in list(graph.input or []):
        name_to_shape[inp.name] = _onnx_tensor_shape(inp)
    for vi in list(graph.value_info or []):
        name_to_shape[vi.name] = _onnx_tensor_shape(vi)
    for out in list(graph.output or []):
        if out.name not in name_to_shape:
            name_to_shape[out.name] = _onnx_tensor_shape(out)

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []
    output_to_node: dict[str, str] = {}

    for i, node in enumerate(graph.node):
        nid = node.name if node.name else f"node_{i}"
        nid = re.sub(r"[^a-zA-Z0-9_]", "_", nid)
        name = node.name or node.op_type
        input_names = list(node.input) if node.input else []
        output_names = list(node.output) if node.output else []

        node_entry: dict[str, Any] = {
            "id": nid,
            "name": name,
            "type": node.op_type,
            "param_count": 0,
            "input_shapes": input_names,
            "output_shapes": output_names,
        }

        input_dims = [name_to_shape.get(inp) for inp in input_names]
        output_dims = [name_to_shape.get(out) for out in output_names]
        if any(input_dims) or any(output_dims):
            node_entry["input_dims"] = input_dims
            node_entry["output_dims"] = output_dims

        nodes.append(node_entry)

        for out_name in output_names:
            output_to_node[out_name] = nid

    node_ids_by_index = [n["id"] for n in nodes]
    for i, node in enumerate(graph.node):
        to_id = node_ids_by_index[i]
        for inp_name in node.input or []:
            if inp_name in output_to_node:
                edges.append({"from": output_to_node[inp_name], "to": to_id})

    # Deduplicate edges and ensure node ids used in edges exist
    node_ids = {n["id"] for n in nodes}
    edges = [e for e in edges if e["from"] in node_ids and e["to"] in node_ids]
    seen_edges: set[tuple[str, str]] = set()
    unique_edges: list[dict[str, str]] = []
    for e in edges:
        key = (e["from"], e["to"])
        if key not in seen_edges:
            seen_edges.add(key)
            unique_edges.append(e)

    return {
        "model_type": "onnx",
        "nodes": nodes,
        "edges": unique_edges,
        "total_params": 0,
        "trainable_params": 0,
    }


def load_model(path: str) -> dict[str, Any]:
    """
    Load a model from disk based on its file extension.

    .pt and .pth files are loaded as PyTorch models. .onnx files are loaded as
    ONNX models. Any other extension returns a clear error. All loader errors
    are converted to short, human-readable messages.
    """
    path = Path(path).resolve()
    suffix = path.suffix.lower()

    try:
        if suffix in (".pt", ".pth"):
            return load_pt_model(str(path))
        if suffix == ".onnx":
            return load_onnx_model(str(path))
        raise ValueError(
            "Unsupported format. Strata supports .pt, .pth, and .onnx models."
        )
    except (ValueError, FileNotFoundError, RuntimeError):
        raise
    except Exception as e:
        raise RuntimeError(f"Failed to load model: {e!s}") from e
