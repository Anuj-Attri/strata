# STRATA

### Visualize the layers beneath.

[Screenshot placeholder — architecture graph]

[Screenshot placeholder — detail panel with feature maps]

Strata is an open-source AI model profiling and visualization tool. Load any PyTorch or ONNX model, run inference on real inputs, and explore every layer's full tensor data in an interactive 3D graph.

---

## Features

- **3D architecture graph** — Navigate your model as an interactive graph (Three.js / React Three Fiber).
- **Real-time inference visualization** — Run a single forward pass and see which layers fired.
- **Per-layer tensor export** — Export full tensor data to `.txt` with no truncation.
- **Feature map preview** — Select a node to view tensor heatmaps in the detail panel.
- **PyTorch and ONNX** — Load `.pt`, `.pth`, or `.onnx` models.
- **Vision and transformer support** — Works with CNNs (YOLO, ResNet), ViT, and NLP models (BERT, DistilBERT).

---

## Install

### End users

Download the installer from [Releases](https://github.com/Anuj-Attri/Strata/releases). Run it. No setup required.

- **Linux:** `.deb` or `.AppImage` — install with `sudo dpkg -i Strata*.deb` or run the AppImage (e.g. `chmod +x Strata*.AppImage && ./Strata*.AppImage`).
- **Windows:** Run the `.exe` installer.

### Developers

1. **Clone the repo**
   ```bash
   git clone https://github.com/Anuj-Attri/Strata.git
   cd Strata
   ```

2. **Backend (Python)**
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

3. **Frontend (Node)**
   ```bash
   cd frontend
   npm ci
   ```

4. **Run in dev mode**
   ```bash
   npm run dev
   ```
   This starts the FastAPI backend and the Electron app. Load a model from the UI.

---

## How to use

1. **Load a model** — Use the sidebar to choose a `.pt`, `.pth`, or `.onnx` file. The app builds a graph of the model structure.
2. **Provide input** — For vision models, pick an image. For transformer/NLP models, enter text (tokenization is automatic). For other models, use the tensor option.
3. **Run inference** — Click **Run inference**. The graph updates: nodes that produced data show a small white dot. Click a node to see its tensor in the detail panel and export if needed.

---

## Supported models

| Model type           | Format        | Example                    |
|----------------------|---------------|----------------------------|
| Vision CNN           | ONNX, PyTorch | YOLOv11, ResNet            |
| Transformer / NLP    | ONNX, PyTorch | BERT, DistilBERT           |
| Vision Transformer   | ONNX          | ViT                        |
| Custom models        | PyTorch       | Any `nn.Module`            |

---

## Tensor export

Exported tensors are written as plain text: one value per line, row-major order. There is **no truncation** — the full tensor is saved. Use the detail panel’s export action after selecting a layer.

---

## Performance note

Strata prioritizes correctness and clarity over speed. Large models or many layers may run slowly on modest hardware. Optimization (e.g. batching, lazy loading) is on the roadmap.

---

## Contributing

We welcome contributions. Please fork the repo, create a branch from `main`, and open a PR to `main`. Describe what you changed and why. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## License

MIT. See [LICENSE](LICENSE) for full text.
