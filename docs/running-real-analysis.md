# Running a Real Analysis with VaxAgent

This guide walks you through running VaxAgent on real data — from setup to results.

## Prerequisites

| Requirement | Minimum | Check |
|-------------|---------|-------|
| Python | 3.10+ | `python --version` |
| RAM | 8 GB (16+ recommended) | |
| Disk | 5 GB free | For models + VCFs |
| Docker (optional) | For full pVACseq | `docker --version` |

## 1. Setup

### Install backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

### Install MHCflurry (recommended — no Docker needed)

```bash
pip install mhcflurry
mhcflurry-downloads fetch models_class1_pan
```

> ~2 GB download, one-time. If you get `No module named 'pipes'` on Python 3.13+,
> edit `.venv/Lib/site-packages/mhcflurry/downloads_command.py` and change
> `from pipes import quote` to `from shlex import quote`.

### Install Docker pVACseq image (optional — most rigorous)

```bash
# Start Docker Desktop first
docker pull griffithlab/pvactools:latest    # ~4 GB one-time
```

### Download benchmark VCFs

```bash
python scripts/download_data.py --benchmark
```

Downloads:
- HCC1395 annotated VCF (2 MB) — human breast cancer reference
- Canine mammary tumor VCF (125 MB) — 185 matched tumor-normal pairs

## 2. Get Your Data

### What you need

A **VCF file** (`.vcf` or `.vcf.gz`) containing somatic mutations from tumor sequencing.

### Where to get VCF files

**For your own pet:**
- Ask your veterinary oncologist about tumor sequencing
- Providers: FidoCure, Antech/IDEXX, university vet hospitals
- Cost: $800–$2,500, turnaround 2–4 weeks
- You'll receive a VCF file listing all mutations found

**Public datasets for testing:**

| Dataset | Species | Type | Format | Link |
|---------|---------|------|--------|------|
| HCC1395 | Human | Breast (TNBC) | VCF (annotated) | Included — `data/downloads/vcf/hcc1395/` |
| Canine Mammary | Dog | Mammary | VCF (Mutect2) | Included — `data/downloads/vcf/canine-mammary/` |
| Feline Oncogenome | Cat | 13 tumor types | Supplementary tables | [Figshare](https://doi.org/10.6084/m9.figshare.28882502) |
| TCGA | Human | 33 cancer types | MAF/VCF | [portal.gdc.cancer.gov](https://portal.gdc.cancer.gov) |
| NCI ICDC | Dog | Multi-tumor | Cloud portal | [caninecommons.cancer.gov](https://caninecommons.cancer.gov) |
| SRA canine osteo | Dog | Osteosarcoma | Raw FASTQ* | SRA: PRJNA525883 |
| SRA canine lymphoma | Dog | Lymphoma | Raw FASTQ* | SRA: PRJNA247493 |

> *Raw FASTQ datasets require a variant calling pipeline (BWA + Mutect2) to produce
> a VCF. That's a separate bioinformatics step outside VaxAgent's scope.

### What alleles do you need?

The immune alleles tell VaxAgent which "locks" your pet's immune system uses.

| Species | Allele System | Example | How to Get |
|---------|--------------|---------|------------|
| Dog | DLA | `DLA-88*034:01` | Ask your vet about DLA typing (blood test) |
| Cat | FLA | `FLA-A*001:01` | Less commonly typed; research labs only |
| Human | HLA | `HLA-A*02:01` | OptiType from sequencing, or clinical HLA typing |

If you don't have alleles, VaxAgent will use reference alleles from the benchmark dataset. Results will be approximate.

## 3. Start the Servers

**Terminal 1 — backend:**

```bash
cd backend
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
uvicorn main:app --port 8000
```

**Terminal 2 — frontend:**

```bash
python -m http.server 8080 --directory frontend
```

Open **http://localhost:8080** in your browser.

## 4. Run the Analysis

### Step 1: Diagnosis

- Select your pet's species (Dog / Cat / Other)
- Select the cancer type
- Optionally add stage and treatment history
- Click **Next**

### Step 2: Upload and Analyse

**Option A: Upload your own VCF**

1. Drag and drop your `.vcf` or `.vcf.gz` file
2. Enter your pet's alleles (e.g., `DLA-88*034:01, DLA-88*50101`)
3. Choose analysis mode:

| Mode | Speed | What It Does |
|------|-------|-------------|
| **Quick** | ~30 seconds | MHCflurry binding prediction (Python-native) |
| **Full** | 30–60 minutes | VEP annotation + pVACseq (Docker, most rigorous) |
| **Benchmark** | Instant | Uses pre-computed results (not from your file) |

4. Click **Analyse My File**

**Option B: Try a benchmark case**

1. Click **"Try a benchmark case"**
2. Pick canine mammary tumor or HCC1395
3. Pipeline runs automatically with pre-computed data

### Step 3: Review Targets

You'll see:
- **Funnel visualization** — how thousands of mutations were filtered down
- **Ranked candidate cards** — each with scoring breakdown bars:
  - Binding strength (can the immune system grab it?)
  - Tumor presence (is it common across the tumor?)
  - Gene activity (is the tumor making it?)
  - Immune specificity (how different from normal?)
- **Structure source badges** — AlphaFold / ESMFold / heuristic
- **"Why this score?"** buttons for AI-powered explanations (needs `ANTHROPIC_API_KEY` in `.env`)

### Step 4: Vaccine Blueprint

- Color-coded mRNA construct diagram showing what each part does
- Technical construct details (sequence, UTRs, linkers)
- **Download Full Report (PDF)** — generates a shareable report

### Step 5: Next Steps

- Template letter for your veterinarian
- Synthesis lab options
- Timeline and cost estimates

## 5. Analysis Modes Explained

### Quick Analysis (MHCflurry)

```
Your VCF → Parse mutations → MHCflurry binding prediction → Rank → Results
                                    (~30 seconds)
```

- No Docker needed
- Works for human HLA alleles
- Limited DLA (canine) support — falls back to benchmark candidates
- Good for initial screening

### Full Analysis (pVACseq)

```
Your VCF → VEP annotation → pVACseq (MHCflurry + NetMHCpan) → Rank → Results
                                    (30–60 minutes)
```

- Requires Docker
- Most rigorous — clinical-grade binding prediction
- Supports human HLA alleles
- For canine DLA alleles, routes to MHCflurry automatically

### How VaxAgent picks the engine

```
You click "Analyse My File"
    │
    ├── Quick mode selected → MHCflurry (Python)
    │
    └── Full mode selected
        ├── HLA alleles + Docker running → pVACseq (Docker)
        ├── HLA alleles + no Docker → MHCflurry (Python)
        └── DLA alleles (any) → MHCflurry (Python)
```

## 6. Understanding Results

### Priority Score (0–100)

The composite score combines four factors:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Binding (IC50) | 50 pts max | How tightly the immune receptor grabs the target |
| Expression (TPM) | 30 pts max | How actively the tumor produces this gene |
| Clonality (VAF) | 15 pts max | How common the mutation is across tumor cells |
| Specificity (fold-change) | 5 pts max | How different from the normal protein |

**Score 80+** = excellent candidate
**Score 50–80** = good candidate
**Score <50** = weaker candidate (may still be worth including)

### Structure Source

| Badge | Meaning | Confidence |
|-------|---------|-----------|
| AlphaFold | Pre-computed structure from database | High |
| ESMFold | AI-predicted structure | Moderate |
| Heuristic | Estimated from sequence composition | Low |

### IC50 Binding Strength

| IC50 (nM) | Label | Meaning |
|-----------|-------|---------|
| < 50 | Very strong | Excellent binding — top vaccine target |
| 50–150 | Strong | Good binding |
| 150–500 | Moderate | Acceptable binding |
| > 500 | Weak | Unlikely to trigger immune response |

## 7. AI Explanations (Optional)

Add your Anthropic API key to `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

This enables:
- **"Why this score?"** on candidate cards — explains ranking factors in context
- **"Why?"** on pipeline steps — explains what happened and why it matters
- **"Explain this blueprint"** — explains the mRNA construct design
- **Audience-adaptive** — switch between Pet Owner / Vet / Researcher for different detail levels

Without an API key, these buttons show static fallback text.

## 8. Troubleshooting

| Problem | Solution |
|---------|----------|
| `No module named 'pipes'` | Python 3.13+ issue. Edit `mhcflurry/downloads_command.py`: change `from pipes import quote` to `from shlex import quote` |
| `Docker is not available` | Start Docker Desktop, then restart the backend |
| Upload rejected | Only `.vcf` and `.vcf.gz` files are accepted |
| "Alleles required" error | Enter at least one HLA or DLA allele for full analysis, or use Quick mode |
| MHCflurry slow first run | First prediction loads models into memory (~10s). Subsequent runs are faster. |
| Pipeline stuck | Refresh the page. The backend saves state — completed jobs can be resumed. |
| pVACseq timeout | Default 4-hour timeout. For large VCFs, increase `PVACSEQ_TIMEOUT` in `.env`. |

## 9. Important Limitations

- This is a **research prototype**, not a clinical product
- Computational predictions **require experimental validation**
- Always **discuss results with a veterinary oncologist** before acting
- Canine DLA binding prediction has less validation data than human HLA
- Structure predictions are estimates — crystallography data is the gold standard
- The mRNA blueprint is a research sketch, not a validated therapeutic design
