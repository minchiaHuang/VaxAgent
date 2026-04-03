# VaxAgent Research Copilot MVP

VaxAgent is a fixture-first hackathon MVP for an explainable oncology research workflow copilot.

The repo is considered successful only when both of these demo paths are verifiable:

1. `frontend fallback`: no backend, stable local demo
2. `backend live path`: FastAPI running, WebSocket pipeline completes, report export works

## What This Is

- research-use prototype
- explainable prioritization workflow
- human-in-the-loop tool for oncology and translational research teams

## What This Is Not

- clinical product
- treatment recommendation system
- medical device
- claim of biological efficacy

## Happy Path

1. load one benchmark tumor mutation dataset
2. show mutation summary
3. show ranked neoantigen candidates
4. explain ranking logic in plain English
5. preview a draft mRNA blueprint
6. export one concise report

The happy path should be understandable in 60 to 90 seconds.

## Repo Map

- [`CODEX_BRIEF.md`](./CODEX_BRIEF.md): original scope, constraints, messaging rules
- [`index.html`](./index.html), [`styles.css`](./styles.css), [`app.js`](./app.js): single-page frontend
- [`backend/main.py`](./backend/main.py): FastAPI app with REST and WebSocket pipeline
- [`backend/README.md`](./backend/README.md): backend-only setup and API guide
- [`docs/mini-prd.md`](./docs/mini-prd.md): product intent and non-goals
- [`docs/acceptance-criteria.md`](./docs/acceptance-criteria.md): formal success definition and pass/fail checklist
- [`docs/demo-script.md`](./docs/demo-script.md): spoken demo narrative

## Run Modes

### Frontend Fallback

Use this when you need the simplest possible demo with no backend dependency.

```bash
open index.html
# or
python3 -m http.server 8080
```

Flow:

- open the app
- click `Load Benchmark Case`
- the mode chip should show `Fallback fixture`
- `Export Brief` downloads a markdown brief

### Backend Live Path

Use this when you want the full fixture-first pipeline, report generation, and run history.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --port 8000
```

Then open the frontend and click `Load Benchmark Case`.

Expected live behavior:

- the mode chip shows `Backend connected`
- the WebSocket pipeline completes
- `Export Brief` opens the generated PDF

## Verification Checklist

### A. Frontend Fallback Pass

- app opens without backend
- clicking `Load Benchmark Case` shows `Fallback fixture`
- mutation summary is visible
- candidate ranking is visible
- explanation panel is visible
- blueprint preview is visible
- markdown export downloads successfully
- research-use / non-clinical framing is visible

### B. Backend Live Path Pass

- backend dependencies install cleanly
- `uvicorn main:app --port 8000` starts successfully
- `curl http://127.0.0.1:8000/health` returns `{"status":"ok",...}`
- frontend shows `Backend connected`
- WebSocket pipeline completes all steps:
  - `load_dataset`
  - `pvacseq`
  - `ranking`
  - `esmfold`
  - `mrna_design`
  - `report`
  - `pipeline_complete`
- PDF report route works
- `GET /api/runs` shows the new run

### C. Handoff Pass

- a new contributor can follow this README without extra explanation
- kept docs do not contradict each other
- no outdated or duplicate project docs remain

## Success Definition

This project is `Handoff Ready` when:

- both run modes pass their verification paths
- the happy path is stable and repeatable
- non-specialists can understand the output in under 2 minutes
- the repo has one clear set of docs instead of overlapping versions

## Real Vs Stubbed

| Component                  | Status                | Notes                                                 |
| -------------------------- | --------------------- | ----------------------------------------------------- |
| Frontend UI                | Real                  | one-page demo app                                     |
| Benchmark fixture data     | Real                  | HCC1395 benchmark fixture                             |
| Candidate ranking          | Real                  | composite IC50 + expression + VAF + fold-change score |
| Plain-English explanations | Real with fallback    | Claude if available, static fallback otherwise        |
| mRNA blueprint preview     | Real research preview | deterministic construct generation                    |
| PDF report                 | Real                  | backend report generation                             |
| SQLite run history         | Real                  | saved by backend                                      |
| pVACseq live execution     | Stubbed for MVP       | fixture-first                                         |
| VCF live parsing           | Stubbed for MVP       | fixture-first                                         |
| ESMFold live enrichment    | Optional / fallback   | heuristic-safe for demo stability                     |

## Rule

If a feature threatens demo stability, stub it, simplify it, or remove it.
