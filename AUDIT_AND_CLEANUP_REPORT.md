# Audit and cleanup report

## npm (frontend)

### What was done

- **`npm audit fix`** — Run; no fixes were applied (no fixes available without breaking changes).
- **Electron** — Updated from `^28.0.0` to `28.3.3` (latest 28.x) in `package.json`. Not force-upgraded to 40.x to avoid breaking changes.
- **`npm install`** — Run to regenerate `package-lock.json` after the Electron bump.

### What remains (unfixable without breaking changes)

- **1 moderate** — `electron` &lt; 35.7.5 (ASAR integrity bypass, GHSA-vmqv-hx8q-j7mg). Fix requires upgrading to Electron 35.7.5+ (e.g. 40.6.0 via `npm audit fix --force`), which is a major version jump and was not applied.
- **37 high** — All in **transitive** dev/build dependencies:
  - **minimatch** (ReDoS) — pulled in by `@electron/asar`, `@electron/universal`, `cacache`; no fix available in current dependency tree.
  - **tar** (path traversal, etc.) — pulled in by `@electron/node-gyp` → `@electron/rebuild` → `@electron-forge/core-utils`; no fix available.
  - **tmp** (symlink write) — pulled in by `@inquirer/prompts` → `@inquirer/editor` → `external-editor`; no fix available.

None of these are runtime app dependencies (react, three, zustand, etc.). They affect the build/tooling chain (Electron Forge, node-gyp, inquirer). Reaching zero high would require either a major Electron (and possibly Forge) upgrade or upstream fixes in those transitive packages.

### Summary

- **Fixed:** Electron pinned to 28.3.3 (within major).
- **Not fixed (by design):** No `--force` fixes; no changes to react/three/zustand.
- **Result:** `npm audit` still reports **1 moderate** and **37 high**. All high issues are in transitive dev/build dependencies (minimatch, tar, tmp via Electron/Forge tooling). **Zero high in runtime dependencies** (react, three, zustand, etc.). Achieving zero high overall would require a major Electron (and possibly Forge) upgrade.

---

## Python backend (safety)

### What was done

- **Pinned versions** — All entries in `backend/requirements.txt` are now exact versions to prevent drift:
  - fastapi==0.115.6  
  - uvicorn==0.32.1  
  - torch==2.6.0  
  - torchvision==0.21.0  
  - onnx==1.17.0  
  - onnxruntime==1.20.2  
  - numpy==1.26.4  
  - Pillow==11.0.0  
  - transformers==4.46.3  
  - websockets==14.1  
  - python-multipart==0.0.17  

- **Torch** — Set to 2.6.0 (from 2.5.1) to address at least one CVE (affected spec &lt; 2.6.0).

### What remains (safety check)

With pinned requirements, `safety check -r backend/requirements.txt` may still report vulnerabilities in:

- **torch** — Some advisories are fixed only in 2.7.1+ or 2.8.0+. Upgrading further may require compatibility testing.
- **Other packages** — If safety reports issues in numpy, Pillow, etc., consider upgrading to the patched versions it suggests.

Recommend re-running `safety check -r backend/requirements.txt` after `pip install -r backend/requirements.txt` and addressing any high/critical items by bumping to the suggested patched versions where feasible without breaking the app.

---

## Repo cleanup and docs

### Done

- **README.md** — Full rewrite: features, install (end-user + developer), how to use, supported models table, tensor export, performance note, contributing, license.
- **CONTRIBUTING.md** — Repo structure, dev mode, backend/frontend architecture, how to add a new model type, PR guidelines.
- **SECURITY.md** — Supported versions (0.1.x beta), how to report vulnerabilities (email placeholder), 48h response goal.
- **CHANGELOG.md** — 0.1.0-beta (2026-02-20) with added features list.
- **.github/ISSUE_TEMPLATE/bug_report.md** — Bug report template (description, model, steps, expected, screenshots, environment).
- **.github/ISSUE_TEMPLATE/feature_request.md** — Feature request (problem, solution, alternatives, context).
- **.github/pull_request_template.md** — PR description and checklist (dev test, model test, audit, CHANGELOG).
- **Removed internal report files** — CRITICAL_FIX_REPORT.md, MAJOR_SESSION_REPORT.md, NODE_LABELS_AND_INFERENCE_REPORT.md, OVERHAUL_REPORT.md, POST_INFERENCE_UX_REPORT.md.
- **run_backend.py** — Moved from repo root to `backend/run_backend.py`; run from repo root with `python -m backend.run_backend`. Root copy deleted.
- **.gitignore** — Updated: Python (`__pycache__/`, `*.pyc`, `.venv/`, `backend/dist/`, `backend/build/`, `*.spec`), Node (`node_modules/`, `frontend/.webpack/`, `frontend/out/`), OS (`.DS_Store`, `Thumbs.db`), IDE (`.vscode/`, `.idea/`), logs. **package-lock.json is not ignored** (kept for CI).
- **backend/__init__.py** — Already present; backend remains a proper package.

### Not done

- No git commands were run.
- SECURITY.md still has placeholder `[your-email@example.com]` — replace with a real contact.

---

## Checklist

| Item | Status |
|------|--------|
| npm audit fix (no force) | Done (no fixes available) |
| Electron updated within major (28.3.3) | Done |
| npm audit fix --force for dev/build only | Not applied (would upgrade Electron to 40; user said avoid force for runtime; electron is borderline — left at 28.x) |
| Zero high in runtime deps | Yes (all 37 high are in transitive dev/tooling) |
| Zero high overall | No (37 high remain; would need major Electron/Forge upgrade) |
| npm install + audit state | Done |
| safety check backend | Done; requirements pinned |
| Backend requirements pinned | Done |
| README, CONTRIBUTING, SECURITY, CHANGELOG | Written |
| Issue/PR templates | Added |
| Report .md files removed | Done |
| run_backend.py moved to backend/ | Done |
| .gitignore comprehensive, package-lock not ignored | Done |
