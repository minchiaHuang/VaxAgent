# Acceptance Criteria

## Done Definition

The MVP is done only when it is `Handoff Ready`, not just when one local demo happens to work once.

## Product Success

- one benchmark dataset loads successfully
- mutation summary is visible
- ranked neoantigen candidates are visible
- a plain-English explanation panel is visible
- mRNA blueprint preview is visible
- one export action works reliably
- the app clearly states research-use and human-in-the-loop limitations
- no screen implies clinical or treatment recommendation use

## Demo Success

- the happy path can be explained in 60 to 90 seconds
- a non-specialist viewer can understand what happened and why it matters
- the top candidate rationale is understandable without reading raw pipeline files
- the flow is stable and repeatable

## Verification Paths

### Frontend fallback must pass

- app opens without backend setup
- clicking `Load Benchmark Case` shows `Fallback fixture`
- summary, candidates, explanation, blueprint, and export all work
- export downloads a markdown brief

### Backend live path must pass

- backend dependencies install successfully
- `uvicorn main:app --port 8000` starts successfully
- `GET /health` returns `ok`
- frontend shows `Backend connected`
- the pipeline completes:
  - `load_dataset`
  - `pvacseq`
  - `ranking`
  - `esmfold`
  - `mrna_design`
  - `report`
  - `pipeline_complete`
- PDF report export works
- `GET /api/runs` contains the new run

## Handoff Success

- README is sufficient as the primary runbook
- kept docs do not contradict one another
- duplicate or outdated docs have been removed
- runtime artifacts are not treated as handoff assets

## Release Rule

If any feature threatens demo stability, it should be stubbed, simplified, or removed.
