# VaxAgent Backend

FastAPI backend for the VaxAgent research copilot.

## Quick start

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # edit ANTHROPIC_API_KEY if you have one
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/health` to verify the server is running.

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
