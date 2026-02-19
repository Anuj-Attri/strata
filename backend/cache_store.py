"""
Strata backend — inference cache store.
Module-level dict keyed by layer_id. Cleared and fully repopulated on every inference run.
No truncation anywhere — stores complete arrays.
"""

from __future__ import annotations

import re
import numpy as np
from typing import Any

# Key: layer_id (str). Value: full LayerRecord dict.
# Each entry: name, type, param_count, input_tensor, output_tensor,
# input_shape, output_shape, stats: {mean, std, min, max}
inference_cache: dict[str, dict[str, Any]] = {}


def clear() -> None:
    """Clear the entire cache. Call before each new inference run."""
    inference_cache.clear()


def put(layer_id: str, record: dict[str, Any]) -> None:
    """Store a complete LayerRecord for a layer. No truncation."""
    inference_cache[layer_id] = record


def get(layer_id: str) -> dict[str, Any] | None:
    """Retrieve the full LayerRecord for a layer, or None if not present."""
    return inference_cache.get(layer_id)


def get_any(layer_id: str) -> dict[str, Any] | None:
    """Try raw key, then sanitized, then partial name match."""
    if layer_id in inference_cache:
        return inference_cache[layer_id]
    sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", layer_id).strip("_")
    if sanitized in inference_cache:
        return inference_cache[sanitized]
    for key, val in inference_cache.items():
        if layer_id in key or (sanitized and sanitized in key):
            return val
    return None


def get_stats(arr: np.ndarray) -> dict[str, float]:
    """Compute mean, std, min, max from a full array. No truncation."""
    flat = arr.flatten()
    if flat.size == 0:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    return {
        "mean": float(np.mean(flat)),
        "std": float(np.std(flat)),
        "min": float(np.min(flat)),
        "max": float(np.max(flat)),
    }
