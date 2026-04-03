# VaxAgent Research Copilot MVP

VaxAgent is a fixture-first hackathon MVP for an explainable oncology research workflow copilot.

It is designed to demonstrate one stable happy path:

1. load one benchmark tumor mutation dataset
2. review a mutation summary
3. inspect ranked neoantigen candidates
4. read plain-English prioritization explanations
5. preview an mRNA construct blueprint
6. export one concise report

This repository intentionally optimizes for demo reliability over scientific completeness.

## Product Framing

This MVP is:

- a research-use prototype
- an explainable prioritization workflow
- a human-in-the-loop tool for oncology and translational research teams

This MVP is not:

- a clinical product
- a treatment recommendation system
- a medical device
- a claim of biological efficacy

## Repo Layout

### Frontend (no backend required)

- [`index.html`](./index.html): one-page demo UI
- [`styles.css`](./styles.css): visual styling
- [`app.js`](./app.js): deterministic benchmark dataset and UI logic
- [`demo.md`](./demo.md): run instructions and demo path
- [`docs/mini-prd.md`](./docs/mini-prd.md): condensed product definition
- [`docs/demo-script.md`](./docs/demo-script.md): 60–90 second demo narrative
- [`docs/acceptance-criteria.md`](./docs/acceptance-criteria.md): MVP release gate
- [`docs/out-of-scope.md`](./docs/out-of-scope.md): explicit non-goals

### Backend (FastAPI pipeline)

- [`backend/main.py`](./backend/main.py): FastAPI app with WebSocket pipeline endpoint
- [`backend/agent/orchestrator.py`](./backend/agent/orchestrator.py): Claude-powered plain-English explanations (with fallback)
- [`backend/pipeline/`](./backend/pipeline/): VCF parser, pVACseq runner, ESMFold client, mRNA designer, PDF report generator
- [`backend/fixtures/`](./backend/fixtures/): precomputed HCC1395 benchmark data
- [`backend/db/database.py`](./backend/db/database.py): SQLite run history
- [`backend/requirements.txt`](./backend/requirements.txt): Python dependencies
- [`backend/README.md`](./backend/README.md): backend setup and API reference

## Running The MVP

### Option A — Frontend with backend auto-detect (recommended)

Open [`index.html`](./index.html) in a browser. On load, the app will try the local backend at `http://127.0.0.1:8000` first and will fall back to the embedded benchmark fixture if the API is unavailable.

```bash
open index.html
# or
python3 -m http.server 8080
```

### Option B — Full backend pipeline

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # add ANTHROPIC_API_KEY if available
uvicorn main:app --reload --port 8000
```

WebSocket endpoint: `ws://localhost:8000/ws/pipeline`
REST docs: `http://localhost:8000/docs`

When the backend is running, the frontend `Load Benchmark Case` action streams the live fixture-first pipeline and uses the generated PDF for export.

## What Is Real Vs Stubbed

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend UI | Real | Complete one-page app |
| Benchmark fixture data | Real | HCC1395 cell line, 10 candidates |
| Candidate ranking algorithm | Real | Composite IC50 + expression + VAF score |
| mRNA codon optimisation | Real | Human codon usage table |
| Claude explanations | Real (with fallback) | Static text used if no API key |
| PDF report | Real | reportlab, saved to `backend/reports/` |
| SQLite run history | Real | Created automatically on first run |
| ESMFold structure | Heuristic fallback | Sequence-based estimate; live API opt-in |
| pVACseq execution | Fixture | Precomputed; Docker runner stub present |
| VCF live parsing | Fixture | Precomputed stats; parser stub present |

## Principle

If a feature threatens demo stability, it should be removed, simplified, or stubbed.
# VaxAgent
