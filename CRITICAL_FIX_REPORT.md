# Strata — Critical Fix + Performance + Visual Overhaul Report

**Phases completed:** 1–7. No git commands were run; commit manually after testing.

---

## Phase 7 — Verification checklist

Use this when testing the app:

| Question | Expected |
|----------|----------|
| **Are nodes visible in the canvas?** | Yes. Flat grid layout (20 per row), white boxes; camera at Z=60, fov 75. First 100 nodes shown when total > 200 until "LOAD ALL NODES" is clicked. InstancedMesh = one draw call for all visible nodes. |
| **Does the background particle field render?** | Yes. `BackgroundGrid.jsx`: ~2000 gray points (#333333, 60% opacity), slow Y drift via `useFrame`. Renders inside Canvas behind the graph. |
| **Does the CSS grid show before model load?** | Yes. When `modelGraph` is null, an overlay div with 40×40px grid texture and centered "STRATA / Drop a .pt or .onnx model to begin." is shown. It is removed once a model is loaded. |
| **Does input panel show image drop zone for YOLOv11n?** | Yes. `detectInputType` now checks both `type` and `name` for conv/attention/embed. Any node with "conv" in type or name triggers image input. |
| **Does clicking a node after inference show any record (even a fallback)?** | Yes. Backend stores under raw + sanitized keys; frontend `DetailPanel` resolves `record` via `inferenceCache[selectedLayerId]` then sanitized id then first available record. Backend `get_any(layer_id)` used for estimate-size, save-tensor, copy-tensor. |
| **Is the app responsive (no hang)?** | Yes. No per-frame iteration over 320 nodes; InstancedMesh for nodes; optional cap at 100 nodes with "LOAD ALL NODES"; no RoundedBox/Text from drei; edges as `lineSegments` with precomputed points. |

---

## What was changed

### Phase 1 — Performance
- **GraphView**: No `useFrame` over node list; only camera/controls. Node list rendered via a single `InstancedMesh` (one draw call). Display limited to first 100 nodes when `nodes.length > 200`, with "LOAD ALL NODES" to show all. No per-frame pulse over all nodes.

### Phase 2 — Graph rendering
- **Layout**: `buildLayout(nodes)` — flat grid only: 20 per row, `[col*3-30, row*-2.5+10, 0]`. No topology/edges used for layout.
- **Debug**: `console.log('Positions sample:', ...)` after positions `useMemo`.
- **Nodes**: Native `instancedMesh` + `boxGeometry` + `meshBasicMaterial` (no RoundedBox/Text from drei). Fallback position `[i*3, 0, 0]` if position missing.
- **Edges**: `lineSegments` + `bufferGeometry` + `lineBasicMaterial` (no drei Line). Only edges between visible nodes.
- **Camera**: `position [0,0,60]`, `fov 75`, `near 0.1`, `far 5000`; `ambientLight intensity={2}`.

### Phase 3 — Background and empty state
- **BackgroundGrid.jsx**: Points geometry, 2000 vertices, slow Y drift in `useFrame`. Rendered inside Canvas.
- **Empty state**: Overlay when `!modelGraph`: 40×40 CSS grid texture + centered "STRATA" and "Drop a .pt or .onnx model to begin."

### Phase 4 — Input detection
- **InputPanel**: `detectInputType` uses `nodes.some()` on both `n.type` and `n.name` for conv / attention|embed so YOLOv11n (Conv in name/type) gets image drop zone.

### Phase 5 — Cache key mismatch
- **Backend**: In `run_onnx_inference`, each record stored under `raw_key` (output name) and `sanitized_key` via `cache_store.put` for both. `cache_store.get_any(layer_id)` tries `layer_id` then sanitized key (used in estimate-size, save-tensor, copy-tensor).
- **Store**: `addToCache(key, record)`; App calls it with raw and sanitized keys when receiving WebSocket payload.
- **DetailPanel**: `record` = `inferenceCache[selectedLayerId]` or sanitized id or first value in cache.

### Phase 6 — Visual texture
- **Top bar**: `borderBottom: 1px solid #1a1a1a`, `background: linear-gradient(180deg, #0a0a0a 0%, #000000 100%)`.
- **DetailPanel**: `background: #050505`; section dividers `borderBottom: 1px solid #111111`; first section (layer name) has `borderLeft: 2px solid #FFFFFF` when a layer is selected.
- **InputPanel**: `background: linear-gradient(0deg, #0a0a0a 0%, #000000 100%)`.

---

## Files touched

- **Frontend**: `GraphView.jsx` (rewrite: layout, InstancedMesh, edges, camera, empty state, LOAD ALL NODES), `BackgroundGrid.jsx` (new), `InputPanel.jsx` (detectInputType, gradient), `DetailPanel.jsx` (record lookup, #050505, dividers, accent), `App.jsx` (addToCache with raw+sanitized, header gradient), `store.js` (addToCache(key, record)).
- **Backend**: `inference_runner.py` (raw + sanitized cache keys, `re`), `cache_store.py` (`get_any`, `re`), `main.py` (use `get_any` for estimate-size, save-tensor, copy-tensor).

Commit manually after confirming the checklist above.
