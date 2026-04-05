# VaxAgent Backend

FastAPI backend for the VaxAgent research copilot.

This document covers backend setup only. The repo-level runbook and success criteria live in the top-level [`README.md`](../README.md).

## Quick Start

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --port 8000
```

Open `http://localhost:8000/health` to verify the server is running.

## Required Verification

After startup, the backend path should satisfy all of these:

1. `curl http://127.0.0.1:8000/health` returns `{"status":"ok",...}`
2. the frontend shows `Backend connected` after `Load Benchmark Case`
3. `/ws/pipeline` completes through `pipeline_complete`
4. `/api/runs` shows the new run
5. `/api/runs/{run_id}/report` returns a PDF

## Tests

```bash
cd backend
.venv/bin/python -m pytest
```

The backend test suite covers:

- REST endpoints for health, uploads, jobs, runs, and report download
- WebSocket pipeline happy path and job/file error branches
- VCF parsing, pVACseq TSV parsing and ranking, mRNA blueprint generation, report export, orchestrator fallback, and SQLite persistence

## WebSocket demo

```js
const ws = new WebSocket("ws://localhost:8000/ws/pipeline");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

Each message has the shape:
```json
{ "step": "pvacseq", "status": "complete", "explanation": "...", "data": {}, "run_id": "abc12345" }
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/api/runs` | List past pipeline runs |
| GET | `/api/runs/{run_id}` | Get a specific run |
| GET | `/api/runs/{run_id}/report` | Download PDF report |
| WS | `/ws/pipeline` | Run full pipeline (streaming) |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | _(empty)_ | Optional — fallback explanations used if absent |
| `USE_FIXTURES` | `true` | Force fixture mode regardless of live API |
| `ESMFOLD_API_URL` | Public ESMFold API | ESMFold endpoint |
| `DB_PATH` | `vaxagent.db` | SQLite file path |
| `CORS_ORIGIN` | `*` | Frontend origin for CORS |

## What is stubbed vs real

| Component | Mode | Notes |
|-----------|------|-------|
| VCF parsing | Fixture | `fixtures/variant_stats.json` |
| pVACseq candidates | Fixture | `fixtures/pvacseq_candidates.json` |
| Candidate ranking | Real | Composite scoring in `pvacseq_runner.py` |
| ESMFold | Fixture heuristic | Falls back to sequence-based estimate |
| mRNA design | Real | Codon optimisation + UTR assembly |
| Claude explanations | Real (with fallback) | Static text used if no API key |
| PDF report | Real | reportlab — saved to `reports/` |
| SQLite persistence | Real | `vaxagent.db` created on startup |
