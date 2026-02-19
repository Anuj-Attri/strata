# Strata Major Overhaul — Completion Report

**Date:** February 19, 2025  
**Phases completed:** 1–4. Phase 5 is this report. No git commands were run; commit manually when ready.

---

## What works

### Phase 1 — Input robustness
- **Backend (`inference_runner.py`)**: For `input_hint == "image"` with ONNX, the runner now reads the expected input shape from `session.get_inputs()[0].shape`. Integer H/W are used; dynamic dimensions fall back to 640×640. The PIL image is resized to (W, H) with `Image.LANCZOS` before conversion; after `ToTensor()` values are scaled to [0, 1] (no ImageNet mean/std for ONNX). PyTorch image path still uses 224×224 and ImageNet normalization.
- **Result**: YOLOv11n and other ONNX image models no longer crash on non-640×640 images; input is adapted to the model’s expected size.

### Phase 2 — Graph visualization
- **Layout**: `buildLayout` in `GraphView.jsx` uses BFS from root nodes, in-degree/children, depth grouping, and positions `[x, -depth*5, 0]` with X spread per row. Camera at `[0, -20, 120]`, fov 60, far 2000; OrbitControls target `[0, -20, 0]`.
- **Nodes**: Type-based gray colors via `getNodeColor` (conv, sigmoid/relu/mul, concat/add, resize/upsample, transpose/reshape). RoundedBox `[2.5, 1.2, 0.15]`; selected = white fill; hover = point light.
- **Labels**: `Text` from drei with system font fallback (`font={undefined}`), name (last 16 chars) at 0.35, type below at 0.25, color #333333.
- **Edges**: `Line` from drei with `[fromPos, midPoint, toPos]`, `midPoint` slightly below midpoint for a mild curve; color #444444, `lineWidth={1}`.

### Phase 3 — DetailPanel & feature map visualization
- **Data population**: `console.log('Selected record:', record)` added in `DetailPanel.jsx`. Cache key is `record.layer_id` from the backend; it matches graph node `id` when the same `model_graph` is used. If `record` is still undefined after inference, verify that the backend sends `layer_id` equal to the frontend node ids (e.g. from `model_graph.nodes[].id`).
- **FeatureMapGrid**: New `FeatureMapGrid.jsx` with `ChannelTile` (canvas, per-channel min–max normalization, white = high). Rank-4 tensors: first batch, up to 32 channels in a 4-column grid; “Showing 32 of C channels” when C > 32; click tile for full-size overlay. Rank-2/1 handled as single heatmap row. Below grid: output shape and optional mean/std/min/max. `DetailPanel` uses `FeatureMapGrid` with `tensor`, `outputShape`, and `stats` instead of `TensorHeatmap`.

### Phase 4 — UI polish
- **InfoIcon**: New `InfoIcon.jsx` with hover tooltip (dark card, no external fonts). All previous “(i)” / title-based hints in `DetailPanel`, `GraphView`, `InputPanel`, and `OnboardingFlow` replaced with `<InfoIcon tooltip="..." />`.
- **Header**: Top bar height 64px; “STRATA” wordmark 22px, fontWeight 200, letterSpacing `0.2em`; “LOAD MODEL” button padding `10px 24px`, fontSize 13, letterSpacing `0.15em`.
- **DetailPanel export**: Export block with “EXPORT SIZE — ~{size}” and InfoIcon; full-width stacked “SAVE TO FILE” (white bg, black text) and “COPY JSON” (transparent, white border); letterSpacing `0.15em`.

---

## What still needs attention

1. **GraphView `Line` (drei)**: The app uses `lineWidth={1}`. If lines don’t appear or the runtime complains, drei’s `Line` may need a different prop (e.g. `linewidth` in some builds) or a fallback (e.g. thin `LineBasicMaterial` with `Line` from three).
2. **DetailPanel `record` undefined**: If the console shows `record` as undefined after a successful run, confirm that the WebSocket payload’s `layer_id` matches the graph node `id` (e.g. compare backend `graph_nodes[i].id` with frontend `modelGraph.nodes[].id`). If the backend uses a different naming scheme, align it or map `layer_id` to the frontend id when calling `addToCache`.
3. **FeatureMapGrid tensor shape**: Backend sends `output_tensor` as nested lists (e.g. rank-4 `[B][C][H][W]`). Rank detection uses `outputShape?.length`; if the backend omits or misreports `output_shape`, the grid may show a single tile or mislayout. Ensure the backend includes correct `output_shape` in the layer record.
4. **Large tensors**: Showing up to 32 channels and full overlay is fine for debugging; for very large H/W or many channels, consider optional downsampling or capping canvas size to keep the UI responsive.
5. **OnboardingFlow**: The tooltip for each step is now only on hover via InfoIcon; the previous visible tooltip text was removed. If you want the tip text always visible as well, add it back next to `<InfoIcon tooltip={s.tooltip} />`.

---

## Files touched (summary)

- **Backend**: `inference_runner.py` (prepare_input, ONNX shape, 0–1 scaling).
- **Frontend**: `App.jsx` (header sizing, LOAD MODEL label), `DetailPanel.jsx` (FeatureMapGrid, InfoIcon, export section, console.log), `GraphView.jsx` (already had layout/labels/edges; InfoIcon in overlay), `InputPanel.jsx` (InfoIcon for all hints), `OnboardingFlow.jsx` (InfoIcon).
- **New**: `InfoIcon.jsx`, `FeatureMapGrid.jsx`.
- **Unchanged for behavior**: `main.py`, `store.js`, `TensorHeatmap.jsx` (no longer used in DetailPanel but can remain for other uses).

You can commit these changes manually when satisfied with local testing.
