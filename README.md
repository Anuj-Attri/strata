# STRATA

### Visualize the layers beneath.


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

### Requirements
- Python 3.x — [download from python.org](https://python.org/downloads) if not already installed
- No other setup needed — Strata installs its own Python dependencies on first launch

### Download

Go to the [Releases page](https://github.com/Anuj-Attri/strata/releases/latest):

| Platform | File | Notes |
|---|---|---|
| Windows | `.zip` | Extract and run `Strata.exe`. Python required. |
| Ubuntu/Debian | `.deb` | `sudo dpkg -i Strata*.deb`. Python required. |
| Linux universal | `.AppImage` | `chmod +x` and run. Python required. |

On first launch, Strata will automatically install its Python backend dependencies.
This requires an internet connection the first time only.

### Run from source
```bash
git clone https://github.com/Anuj-Attri/strata.git
cd strata
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cd frontend && npm install && npm run dev
```

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
