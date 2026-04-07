# VaxAgent Research Copilot

VaxAgent is an explainable oncology research workflow copilot for veterinary and translational medicine teams. It helps users go from tumor mutation data to ranked neoantigen candidates, plain-English explanations, and a draft mRNA vaccine blueprint.

## What This Is

- research-use prototype for veterinary oncology
- explainable prioritization workflow with AI-powered explanations
- human-in-the-loop tool for pet owners, veterinarians, and research teams

## What This Is Not

- clinical product or medical device
- treatment recommendation system
- claim of biological efficacy

## Repo Structure

```
VaxAgent/
├── frontend/              # Single-page app (vanilla JS)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── backend/               # FastAPI + pipeline modules
│   ├── main.py            # REST + WebSocket API
│   ├── agent/             # LLM-powered explanations
│   ├── pipeline/          # VCF parsing, prediction, ranking, mRNA design, PDF
│   ├── db/                # SQLite persistence
│   └── models/            # Pydantic schemas
├── data/
│   └── benchmarks/        # Fixture datasets with provenance
│       ├── hcc1395/       # Human breast cancer reference
│       └── canine-mammary/ # Canine mammary tumor (primary)
├── scripts/               # Data download and fixture generation
├── tests/
│   ├── backend/           # pytest suite
│   ├── e2e/               # Playwright E2E tests
│   └── fixtures/          # Synthetic test VCFs
└── docs/
    ├── acceptance-criteria.md
    ├── demo-script.md
    └── archive/           # Historical docs (codex brief, feasibility report)
```

## Quick Start

### Frontend Only (no backend)

```bash
python3 -m http.server 8080 --directory frontend
# Open http://localhost:8080
# Click "Load Benchmark Case" for a demo
```

### With Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --port 8000
```

Then open the frontend — it auto-detects the backend at `http://127.0.0.1:8000`.

### Run Modes

| Mode | What It Does | Backend Required |
|------|-------------|-----------------|
| **Frontend Fallback** | Loads fixture data, exports markdown | No |
| **Backend Benchmark** | Full pipeline via WebSocket, PDF export, run history | Yes |
| **Quick Upload** | Parses your VCF, shows real stats + benchmark candidates | Yes |
| **Full Analysis** | Real pVACseq via Docker (30-60 min) | Yes + Docker |

## Test Automation

```bash
# Backend tests
cd backend
.venv/bin/python -m pytest ../tests/backend

# E2E tests
npx playwright install chromium
npx playwright test

# Both
npm test
```

## Benchmarks

| Dataset | Species | Cancer Type | Source |
|---------|---------|-------------|--------|
| HCC1395 | Human | Breast (TNBC) | Griffith Lab, WashU |
| Canine Mammary | Dog | Mammary carcinoma | Figshare (2019) |

Each benchmark in `data/benchmarks/` includes a `README.md` with provenance and citation.

## Real vs Stubbed

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend UI | Real | Wizard-based single-page app |
| Benchmark fixtures | Real | HCC1395 + canine mammary tumor data |
| VCF parsing | Real | Live parse on upload |
| Quick-upload ranking | Fixture-backed | Real stats + benchmark candidates |
| Candidate ranking | Real | Composite IC50 + expression + VAF + fold-change |
| Explanations | Real with fallback | Claude if API key present, static otherwise |
| mRNA blueprint | Real preview | Deterministic construct generation |
| PDF report | Real | ReportLab-generated |
| SQLite run history | Real | Saved by backend |
| pVACseq execution | Real (Full Analysis) | Docker job |
| Structure prediction | Optional/fallback | ESMFold API or heuristic |

## Docs

- [`docs/acceptance-criteria.md`](./docs/acceptance-criteria.md) — success definition and verification checklist
- [`docs/demo-script.md`](./docs/demo-script.md) — spoken demo narrative
- [`docs/archive/`](./docs/archive/) — historical project docs (codex brief, feasibility report)
