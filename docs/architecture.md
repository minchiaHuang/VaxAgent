# VaxAgent Architecture

## Pipeline Overview

```
User → Frontend (vanilla JS) → WebSocket → Backend (FastAPI) → Pipeline
                                                                  │
                                                    ┌─────────────┼─────────────┐
                                                    ▼             ▼             ▼
                                              VCF Parser    Binding Pred   Structure
                                                    │             │             │
                                                    ▼             ▼             ▼
                                              Variant Stats  Candidates    pLDDT/Surface
                                                    │             │             │
                                                    └──────┬──────┘             │
                                                           ▼                    │
                                                       Ranking ←────────────────┘
                                                           │
                                                           ▼
                                                    mRNA Designer
                                                           │
                                                           ▼
                                                    PDF Report → SQLite
```

## Pipeline Steps (WebSocket)

| Step | Module | What It Does |
|------|--------|-------------|
| `load_dataset` | `vcf_parser.py` | Load fixture or parse uploaded VCF |
| `pvacseq` | `pvacseq_runner.py` / `mhc_predictor.py` | MHC binding prediction |
| `ranking` | `pvacseq_runner.rank_candidates()` | Composite scoring (IC50 + expression + VAF + fold-change) |
| `esmfold` | `esmfold_client.py` + `alphafold_client.py` | Tiered structure prediction |
| `mrna_design` | `mrna_designer.py` | Multi-epitope mRNA construct |
| `report` | `report_generator.py` | PDF generation via ReportLab |

## Binding Prediction Strategy

```
Job submitted with alleles
        │
        ├── All HLA-* alleles + Docker available → pVACseq (Docker)
        ├── Non-HLA alleles (DLA-*) or no Docker → MHCflurry (Python)
        └── Neither available → 503 error
```

- pVACseq: Full pipeline via griffithlab/pvactools Docker image. 30-60 min.
- MHCflurry: Python-native, `pip install mhcflurry`. Seconds. Falls back to fixture if not installed.
- Fixture fallback: Pre-computed candidates from `data/benchmarks/`.

## Structure Prediction Tiers

```
Tier 1: AlphaFold DB → instant lookup by UniProt ID
Tier 2: ESMFold API  → fold mutant sequence (5-30s, unreliable)
Tier 3: Heuristic    → sequence composition estimate (always works)
```

Each candidate gets a `structure_source` field ("alphafold" / "esmfold" / "heuristic") shown in the UI.

## Data Model

### Benchmark fixtures (`data/benchmarks/{id}/`)
- `variant_stats.json` — dataset summary (variants, mutations, alleles, TMB)
- `candidates.json` or `pvacseq_candidates.json` — top 10 ranked candidates

### Candidate schema
```json
{
  "rank": 1,
  "gene": "TP53",
  "mutation": "R248W",
  "mt_epitope_seq": "SVVVPWEPPL",
  "hla_allele": "DLA-88*034:01",
  "ic50_mt": 45.2,
  "ic50_wt": 9840.5,
  "fold_change": 217.7,
  "tumor_dna_vaf": 0.48,
  "gene_expression_tpm": 38.2,
  "priority_score": 94,
  "plddt": 82.4,
  "surface_accessible": true,
  "structure_source": "alphafold",
  "ic50_source": "pvacseq"
}
```

### Priority score formula
```
binding_score     = max(0, 50 * (1 - IC50 / 500))      # 0-50 points
expression_score  = min(30, TPM / 2)                     # 0-30 points
clonality_score   = VAF * 15                             # 0-15 points
specificity_score = min(5, fold_change / 10)             # 0-5 points
```

## API Surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| GET | `/api/benchmarks` | Discover available benchmark datasets |
| GET | `/api/runs` | List past pipeline runs |
| GET | `/api/runs/{id}` | Get specific run |
| GET | `/api/runs/{id}/report` | Download PDF report |
| POST | `/api/upload` | Upload VCF for quick analysis |
| POST | `/api/jobs/pvacseq` | Start binding prediction job |
| GET | `/api/jobs` | List jobs |
| GET | `/api/jobs/{id}` | Job status |
| POST | `/explain` | On-demand AI explanation |
| WS | `/ws/pipeline` | Full pipeline with streaming updates |

## Frontend Architecture

Single-page app with 5-step wizard:
1. **Diagnosis** — species, cancer type, sequencing guidance
2. **Upload** — VCF upload or benchmark selection
3. **Targets** — funnel visualization + candidate cards with scoring bars
4. **Blueprint** — mRNA construct visualization + technical details
5. **Next Steps** — vet letter template, synthesis options, timeline

Key UI features:
- Audience toggle (pet owner / vet / researcher)
- Origin labels (benchmark vs uploaded data)
- "Why?" explain buttons calling Claude on-demand
- Structure source badges per candidate
- Scoring breakdown bars (binding, presence, activity, specificity)

## Tech Stack

- **Frontend**: Vanilla JS, no framework
- **Backend**: FastAPI + uvicorn
- **Database**: SQLite via aiosqlite
- **PDF**: ReportLab
- **AI**: Claude Haiku (optional, graceful fallback)
- **Structure**: AlphaFold DB API + ESMFold API
- **Binding**: pVACseq (Docker) or MHCflurry (Python)
- **Deployment**: Render.com (render.yaml)
