# Node Labels, Feature Maps, Camera & ONNX Intermediates — Report

**Phases completed:** 1–5. No git commands were run.

---

## Phase 5 — Verification checklist

| Question | Expected |
|----------|----------|
| **Do nodes show type labels before inference?** | Yes. Each node shows a canvas texture with type (bold, line 1) and name (gray, line 2) via `makeTextTexture(typeLabel, nameLabel)`. No external font; always works. |
| **After inference, do node faces show grayscale feature maps?** | Yes. When `record?.output_tensor` and `record?.output_shape` exist, `makeTensorTexture(record.output_tensor, record.output_shape)` is used. Rank-4 uses first channel; rank-2/1 handled; per-channel min–max to 0–255. |
| **Does LMB pan and Ctrl+LMB rotate?** | Yes. Default: LEFT=PAN, MIDDLE=DOLLY, RIGHT=ROTATE. On Ctrl keydown, LEFT becomes ROTATE; on keyup, restored to PAN. Touch: ONE=PAN, TWO=DOLLY_ROTATE. |
| **Does inference complete without error on yolo11n.onnx?** | Expected yes. When `model_path` is set (ONNX load), `run_onnx_inference` uses `build_intermediate_session(model_path)` and runs `session.run(None, input_dict)` to capture all intermediate outputs. If some intermediates are non-float, runtime may warn or skip; float tensors are cached and streamed. |
| **Does clicking a node show TYPE, shapes, and stats in DetailPanel?** | Yes. DetailPanel already shows record name, type, param count, input/output shape, and stats (mean, std, min, max). Record is resolved via `inferenceCache[selectedLayerId]` or sanitized id or first record. |

---

## What was changed

### Phase 1 — Node content (labels + color)
- **Canvas text texture**: `makeTextTexture(line1, line2)` draws type (bold 22px) and name (16px gray) on a 256×128 canvas; returns `THREE.CanvasTexture`. No Google Fonts; no woff2.
- **Node color**: `getNodeColor(type, isSelected, hasFired)`: selected → `#FFFFFF`; before fire → dark grays by type (conv, sigmoid/mul, concat/add, resize/upsample); after fire → brighter (conv white, sigmoid/mul #CCCCCC, concat #AAAAAA, else #BBBBBB).
- **Rendering**: Switched from a single `InstancedMesh` to per-node `<GraphNode>`: each node is a group with a **front plane** (2.3×1.1, texture) at z=0.06 and a **box** (2.2×1.05×0.08, solid color) at z=-0.04. Before inference the plane uses the text texture; after inference it can use the feature-map texture (Phase 2).

### Phase 2 — Feature map on node face
- **Tensor texture**: `makeTensorTexture(outputTensor, outputShape)` builds a 64×64 grayscale canvas: rank-4 → first channel `outputTensor[0][0]`; rank-2 → `[outputTensor[0]]`; else flatten and slice. Per-channel min–max normalize to 0–255, draw to temp canvas, scale to 64×64. On error, gray 48×48 rect.
- **Per-node texture**: In `GraphNode`, `useMemo` picks texture: if `record?.output_tensor` and `record?.output_shape` exist → `makeTensorTexture(...)`; else → `makeTextTexture(typeLabel, nameLabel)`. So after inference, nodes with cache show the feature map on the front face.

### Phase 3 — Camera controls
- **OrbitControls**: `mouseButtons`: LEFT=PAN, MIDDLE=DOLLY, RIGHT=ROTATE. `touches`: ONE=PAN, TWO=DOLLY_ROTATE.
- **Ctrl+LMB rotate**: `useEffect` adds keydown/keyup listeners. On Ctrl keydown, set `controlsRef.current.mouseButtons` so LEFT=ROTATE; on keyup, restore LEFT=PAN.
- **Click to select**: `onPointerDown` on both the front plane and the box calls `e.stopPropagation()` and `onSelect(node.id)` so clicks select the node instead of rotating.

### Phase 4 — ONNX intermediate outputs
- **`build_intermediate_session(model_path)`** in `inference_runner.py`: loads ONNX with `onnx.load`, adds every `node.output` not already in `graph.output` as float value_info, runs shape inference, builds `InferenceSession` from the serialized modified model, returns `(session, output_names)`.
- **`run_onnx_inference(..., model_path=None)`**: If `model_path` is set, calls `build_intermediate_session(model_path)`, runs `session.run(None, input_dict)`, and for each `(name, arr)` builds a record with `layer_id` sanitized, `name` original, `type` `"onnx_output"`, and puts it in cache under both sanitized and raw name; sends record (with `output_tensor` as list) on the queue. If `model_path` is not set, keeps previous behavior (graph-node output list).
- **App state**: `main.py` sets `app.state.model_path = str(path)` when loading an `.onnx` file and includes `model_path` in `model_state` for `run_inference`, which passes it into `run_onnx_inference`.

---

## Files touched

- **Frontend**: `GraphView.jsx` — `getNodeColor`, `makeTextTexture`, `makeTensorTexture`, `GraphNode` (plane + box, texture from record or text), `Scene` (map over `visibleNodes`, OrbitControls + Ctrl handler, inferenceCache/layerOrder for record and hasFired).
- **Backend**: `inference_runner.py` — `build_intermediate_session`, `run_onnx_inference` extended with `model_path` and intermediate-run branch; `main.py` — `app.state.model_path`, `model_state["model_path"]`, ONNX load sets `model_path`.

Optional: add `frontend/public/assets/Inter.ttf` and use `font="/assets/Inter.ttf"` in drei `<Text>` if you later switch from canvas textures to Text components. Current implementation does not require it.

Commit manually after testing.
