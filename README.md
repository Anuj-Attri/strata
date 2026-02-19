# STRATA

### Visualize the layers beneath.

Load any PyTorch or ONNX model. Run inference.  
Explore every layer's full tensor data in 3D.

---

## INSTALL

Go to [Releases](https://github.com/your-org/strata/releases). Download the installer for your OS. Run it. No terminal. No setup. No dependencies.

---

## HOW TO USE

1. **Load your model** — Drag a `.pt` or `.onnx` file into Strata, or click *Load model* and choose a file from your computer. [screenshot]
2. **Provide input** — In the bottom bar, give your model something to process: drop an image, enter text, or type comma-separated numbers. Click *Run inference*. [screenshot]
3. **Explore the graph** — Click any node in the 3D architecture graph to inspect that layer’s tensor data, shapes, and statistics in the right panel. Double-click a node to focus the camera. [screenshot]

---

## WHAT IS A LAYER?

A neural network is made of layers — each one transforms data in a specific way. Think of it like an assembly line: raw input goes in one end, and a prediction comes out the other. Strata lets you pause at every station and inspect exactly what happened to your data.

---

## WHAT IS A TENSOR?

A tensor is a grid of numbers — like a spreadsheet, but it can have many dimensions. Your image becomes a tensor (pixels → numbers). Your sentence becomes a tensor (words → numbers). Strata shows you the exact numbers at every stage of your model, with nothing hidden.

---

## WHAT IS A MODEL?

A model is a trained AI — a file that has learned to perform a specific task, like recognizing objects in photos, translating text, or detecting anomalies. Strata works with PyTorch (`.pt`, `.pth`) and ONNX (`.onnx`) model formats.

---

## ACCURACY

Strata stores and exports complete tensor data with no truncation. Every value you see is exact. Save files may be large for complex models — Strata always shows you the estimated file size before you export.

---

## PERFORMANCE NOTE

Strata currently prioritizes accuracy over speed. Full tensors are captured and stored at every layer. Performance optimization is on the roadmap. For very large models, inference capture will be slower than standard model execution.

---

## CONTRIBUTING

Contributions are welcome. Open an issue or submit a pull request. For larger changes, please discuss in an issue first.

---

## LICENSE

MIT
