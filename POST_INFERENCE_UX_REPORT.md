# Post-inference UX + Node Restoration — Report

**Phases completed:** 1–6. No git commands were run.

---

## Phase 6 — Verification checklist

| Question | Expected |
|----------|----------|
| **Every node shows a white face with type label before inference** | Yes. `makeTextTexture` uses white background (#FFFFFF), black text for type (bold 24px), gray (#444) for name. Fallback when no cache record. Box behind is #111111; sizes box [3, 1.4, 0.12], plane [2.9, 1.3]. |
| **After inference, nodes with matched cache records show feature maps** | Yes. Texture useMemo uses record (by id, sanitized id, or partial name match); when `record?.output_tensor` and `record?.output_shape` exist, `makeTensorTexture` is used. |
| **Clicking any node at any time populates DetailPanel with at minimum name, type, and shapes** | Yes. Source 1: `selectedNode` from `modelGraph.nodes.find(n => n.id === selectedLayerId)` — name, type, param_count, trainable_params, input_dims, output_dims. Source 2: `record` from cache (raw, sanitized, or partial name match) — stats, feature map grid, export; shown only when record exists. |
| **SAVE TO FILE produces a .txt with actual tensor numbers** | Yes. DetailPanel uses `layerIdToFetch = record?.layer_id ?? selectedLayerId` for estimate-size and save-tensor. Backend `get_any` tries raw, sanitized, then partial key match. Saved file includes INPUT TENSOR and OUTPUT TENSOR sections with full nested lists. |
| **CLEAR button resets to pre-inference state** | Yes. CLEAR calls `clearCache()` and `setLayerOrder([])`; nodes return to label-only display. |
| **Loading a new model clears previous inference data** | Yes. `handleLoadModel` calls `clearCache()` and `setLayerOrder([])` before fetching the new model. |
| **App stays responsive and interactive after inference completes** | Yes. WebSocket onmessage: when `data === null` (sentinel), `setRunning(false)`; on catch also `setRunning(false)`. RUN INFERENCE is disabled only while `isRunning`. |

---

## What was changed

### Phase 1 — Node rendering
- **makeTextTexture**: White background (#FFFFFF), black type text, #444 name; (line1 \|\| 'OP').slice(0, 14), (line2 \|\| '').slice(0, 22).
- **GraphNode**: Texture from record when available, else always `makeTextTexture(type, name)`. Box color fixed to #111111; box size [3, 1.4, 0.12], plane [2.9, 1.3] at z=0.06; box at z=-0.06. Both meshes have onPointerDown(selectNode).

### Phase 2 — Layer selection
- **DetailPanel**: `selectedNode = modelGraph?.nodes?.find(n => n.id === selectedLayerId)`. Record = inferenceCache[id] \|\| sanitized \|\| partial name match (clean(r.name).includes(clean(nodeName))). Display: name/type/param_count/trainable from selectedNode ?? record; input/output shape from record ?? selectedNode?.input_dims/output_dims. Inference block (stats, FeatureMapGrid, export) only when record exists.
- **GraphView Scene**: Record for each node now also resolved by partial name match so node faces show feature maps when cache key matches by name.

### Phase 3 — Full tensor export
- **DetailPanel**: `layerIdToFetch = record?.layer_id ?? selectedLayerId` used for estimate-size and save-tensor/copy-tensor requests.
- **cache_store.get_any**: Tries raw key, then sanitized (strip '_'), then first key containing `layer_id` or `sanitized`. Save format unchanged: INPUT TENSOR and OUTPUT TENSOR sections with full values.

### Phase 4 — Post-inference freedom
- **App.jsx**: On WebSocket message, if `data === null` call `setRunning(false)` and return; in catch also `setRunning(false)`. handleLoadModel: call `clearCache()` and `setLayerOrder([])` before load-model request.
- **InputPanel**: CLEAR button (transparent, border #333, marginRight 8) calls `clearCache()` and `setLayerOrder([])`.

### Phase 5 — General model compatibility
- **inference_runner.run_onnx_inference** (model_path branch): Builds `inter_input_dict` for all `inter_session.get_inputs()`: first input gets prepared tensor (numpy, cast to float32 if needed), remaining inputs get zeros with inferred shape (default 1). Runs `inter_session.run(None, inter_input_dict)`.
- **build_intermediate_session**: Unchanged; already has try/except for shape_inference.
- **hook_manager**: Already registers only on `model.named_modules()` (nn.Module subclasses).
- **InputPanel**: Tensor input type shows tooltip "This model expects raw numeric input. Enter values separated by commas." detectInputType already defaults to 'tensor' when no conv/attention/embed.

---

## Files touched

- **Frontend**: GraphView.jsx (makeTextTexture, GraphNode sizes/colors, record partial match in Scene), DetailPanel.jsx (two sources, layerIdToFetch, cleanForMatch), App.jsx (null sentinel setRunning(false), catch setRunning(false), clearCache+setLayerOrder before load), InputPanel.jsx (CLEAR button, tensor tooltip).
- **Backend**: cache_store.py (get_any: raw, sanitized, partial key match).

Commit manually after testing.
