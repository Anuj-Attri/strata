"""
Strata backend — register and remove forward hooks on PyTorch modules to capture
full input/output tensors and stream them to the cache and queue. No truncation.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import numpy as np
import torch
import torch.nn as nn

from . import cache_store

logger = logging.getLogger(__name__)


def _sanitize_id(name: str) -> str:
    """Turn a module name into a safe node id by replacing dots with underscores."""
    return name.replace(".", "_")


def _first_tensor_from_input(input_arg: Any) -> np.ndarray | None:
    """Take the first non-None tensor from a tuple/list of inputs; return as numpy."""
    if input_arg is None:
        return None
    if isinstance(input_arg, torch.Tensor):
        return input_arg.detach().cpu().numpy()
    if isinstance(input_arg, (tuple, list)):
        for x in input_arg:
            if x is not None and isinstance(x, torch.Tensor):
                return x.detach().cpu().numpy()
    return None


def _first_tensor_from_output(output_arg: Any) -> np.ndarray | None:
    """Take the first tensor from a tuple/list of outputs; return as numpy."""
    if output_arg is None:
        return None
    if isinstance(output_arg, torch.Tensor):
        return output_arg.detach().cpu().numpy()
    if isinstance(output_arg, (tuple, list)):
        for x in output_arg:
            if x is not None and isinstance(x, torch.Tensor):
                return x.detach().cpu().numpy()
    if hasattr(output_arg, "last_hidden_state"):
        return output_arg.last_hidden_state.detach().cpu().numpy()
    if hasattr(output_arg, "logits"):
        return output_arg.logits.detach().cpu().numpy()
    return None


def _make_hook(
    name: str,
    module: nn.Module,
    queue: asyncio.Queue[dict[str, Any] | None],
) -> Any:
    """
    Return a forward-hook closure that captures input/output tensors for one module.

    The closure runs on every forward pass: it grabs the first input and output
    tensor, computes stats on the output, builds a full LayerRecord, stores it in
    the cache, and puts a JSON-serializable copy (tensors as lists) into the queue.
    If anything fails (e.g. non-tensor output), it logs a warning and skips.
    """

    def hook(
        _module: nn.Module,
        input: tuple[Any, ...],
        output: Any,
    ) -> None:
        layer_id = _sanitize_id(name)
        try:
            input_arr = _first_tensor_from_input(input)
            output_arr = _first_tensor_from_output(output)
            if output_arr is None:
                logger.warning(
                    "Hook could not capture output tensor for layer %s; skipping.",
                    name,
                )
                return
            if input_arr is None:
                input_arr = np.array([])

            stats = cache_store.get_stats(output_arr)
            param_count = sum(p.numel() for p in module.parameters())
            trainable_params = sum(
                p.numel() for p in module.parameters() if p.requires_grad
            )
            type_name = type(module).__name__

            record: dict[str, Any] = {
                "layer_id": layer_id,
                "name": name,
                "type": type_name,
                "param_count": param_count,
                "trainable_params": trainable_params,
                "input_tensor": input_arr,
                "output_tensor": output_arr,
                "input_shape": list(input_arr.shape),
                "output_shape": list(output_arr.shape),
                "stats": stats,
            }
            cache_store.put(layer_id, record)

            record_json: dict[str, Any] = {
                **record,
                "input_tensor": input_arr.tolist(),
                "output_tensor": output_arr.tolist(),
            }
            try:
                queue.put_nowait(record_json)
            except asyncio.QueueFull:
                logger.warning("Stream queue full; dropping record for layer %s", name)
        except Exception as e:
            logger.warning(
                "Hook failed for layer %s: %s; skipping.",
                name,
                e,
                exc_info=False,
            )

    return hook


def register_hooks(
    model: nn.Module,
    queue: asyncio.Queue[dict[str, Any] | None],
) -> list[Any]:
    """
    Attach a forward hook to every named submodule of the model (except the root).

    Each hook captures full input and output tensors, computes stats, writes a
    LayerRecord to the cache, and pushes a JSON-friendly copy to the queue. Returns
    the list of hook handles so the caller can remove them later.
    """
    handles: list[Any] = []
    for name, module in model.named_modules():
        if name == "":
            continue
        hook_fn = _make_hook(name, module, queue)
        handle = module.register_forward_hook(hook_fn)
        handles.append(handle)
    return handles


def remove_hooks(handles: list[Any]) -> None:
    """
    Remove every hook in the list by calling its .remove() method.

    Any error from remove() is ignored so that cleanup never crashes the app.
    """
    for handle in handles:
        try:
            handle.remove()
        except Exception:
            pass
