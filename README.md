# VaxAgent Research Copilot MVP

VaxAgent is a fixture-first hackathon MVP for an explainable oncology research workflow copilot, with optional uploaded VCF analysis paths for local validation.

The repo is considered successful only when the benchmark demo path is stable and the backend-connected upload paths are verifiable:

1. `frontend fallback`: no backend, stable local demo
2. `backend benchmark path`: FastAPI running, WebSocket pipeline completes, report export works
3. `uploaded VCF paths`: quick analysis and full analysis behave as documented

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

### Backend Benchmark Path

Use this when you want the full benchmark pipeline, report generation, and run history.

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
- `Run history and reports` shows recent saved backend runs
- completed runs can be reopened from the history panel
- full-analysis pVACseq jobs resume after refresh while the backend job is still running

### Uploaded VCF Paths

When the backend is running, the landing screen exposes two upload modes:

- `Quick demo`: parses your uploaded `.vcf` / `.vcf.gz` and updates the mutation summary, but candidate ranking still uses the HCC1395 benchmark fixture
- `Full analysis`: requires Docker and HLA alleles, starts a real pVACseq job, and hydrates the UI from the finished job result

Expected quick-upload behavior:

- `POST /api/upload` accepts `.vcf` or `.vcf.gz`
- the dataset title changes to the uploaded filename
- the summary cards reflect the uploaded file
- the `pvacseq` explanation explicitly says the shortlist still comes from the benchmark fixture

Expected full-analysis behavior:

- Docker must be available or the mode stays disabled
- HLA alleles are required before submission
- `POST /api/jobs/pvacseq` returns a `job_id`
- `GET /api/jobs/{job_id}` progresses through `queued` / `running` / `complete`
- refreshing the page resumes polling for the active job
- after completion, the WebSocket pipeline is reopened with `job_id=<...>` and uses live pVACseq candidates instead of the fixture

Notes:

- pre-annotated VCF files that already contain `CSQ=` records skip the VEP step
- non-annotated VCF files require `VEP_CACHE_DIR` and `VEP_ASSEMBLY` to be configured in `backend/.env`
- full analysis is a long-running validation path, not the primary 60 to 90 second hackathon demo

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

### B. Backend Benchmark Path Pass

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

### C. Uploaded VCF Pass

- `POST /api/upload` accepts `.vcf` / `.vcf.gz` and rejects other file extensions
- quick upload updates the mutation summary using the uploaded filename
- quick upload still explains that candidate ranking is benchmark-based
- `Full analysis` stays disabled when Docker is unavailable
- `POST /api/jobs/pvacseq` rejects missing HLA alleles
- a completed full-analysis job produces:
  - `backend/jobs/<job_id>/MHC_Class_I/<sample>.MHC_I.filtered.tsv`
  - `backend/jobs/<job_id>/candidates.json`
- `GET /api/jobs/{job_id}` returns `complete` with `progress_pct=100`
- reopening the completed `job_id` through `/ws/pipeline?job_id=<...>` loads the live shortlist into the UI

### D. Handoff Pass

- a new contributor can follow this README without extra explanation
- kept docs do not contradict each other
- no outdated or duplicate project docs remain

## Test Automation

Frontend and backend both have automated coverage now.

```bash
# backend tests
cd backend
.venv/bin/python -m pytest

# browser E2E tests
cd ..
npx playwright install chromium
npx playwright test

# combined entrypoint
npm test
```

Coverage includes:

- backend REST and WebSocket happy paths
- upload and pVACseq job error handling
- pipeline scoring, VCF parsing, mRNA design, PDF generation, and persistence
- frontend fallback flow, backend benchmark flow, quick upload flow, full-analysis UI guardrails, and report hydration

## Success Definition

This project is `Handoff Ready` when:

- the benchmark demo paths pass their verification paths
- uploaded VCF paths are documented and testable
- the happy path is stable and repeatable
- non-specialists can understand the output in under 2 minutes
- the repo has one clear set of docs instead of overlapping versions

## Real Vs Stubbed

| Component                  | Status                | Notes                                                 |
| -------------------------- | --------------------- | ----------------------------------------------------- |
| Frontend UI                | Real                  | one-page demo app                                     |
| Benchmark fixture data     | Real                  | HCC1395 benchmark fixture                             |
| Uploaded VCF summary       | Real                  | `POST /api/upload` parses real `.vcf` / `.vcf.gz`     |
| Quick-upload ranking       | Fixture-backed        | uploaded summary + benchmark candidate shortlist      |
| Candidate ranking          | Real                  | composite IC50 + expression + VAF + fold-change score |
| Plain-English explanations | Real with fallback    | Claude if available, static fallback otherwise        |
| mRNA blueprint preview     | Real research preview | deterministic construct generation                    |
| PDF report                 | Real                  | backend report generation                             |
| SQLite run history         | Real                  | saved by backend                                      |
| pVACseq live execution     | Real in `Full analysis` | Docker job under `backend/jobs/<job_id>/`           |
| VCF live parsing           | Real on upload        | forced live parse for `/api/upload`                   |
| ESMFold live enrichment    | Optional / fallback   | heuristic-safe for demo stability                     |

## Rule

If a feature threatens demo stability, stub it, simplify it, or remove it.
