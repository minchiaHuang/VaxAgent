# VaxAgent Feasibility Report

**Date:** April 3, 2026
**Purpose:** Technical and scientific feasibility assessment for team review
**Audience:** Development team without biotech background

---

## 1. What Are We Actually Building?

A web app where:
1. User loads tumor mutation data (a VCF file) + immune system type (HLA alleles)
2. An AI agent runs a bioinformatics pipeline and explains each step in plain English
3. Output: a ranked list of cancer-specific targets + an mRNA vaccine blueprint

We are NOT building a medical device. We are building a **computational design tool** that produces a starting point for lab synthesis. Think of it as "Canva for vaccine blueprints" — it makes the design step accessible, but a professional still prints and delivers the final product.

---

## 2. Is the Science Real?

**Yes.** This is not speculative. Personalized mRNA cancer vaccines are in Phase III clinical trials right now.

| Evidence | Detail |
|----------|--------|
| Moderna + Merck (V940/INTerpath-009) | Phase III trial for melanoma, expected results 2026 |
| BioNTech (BNT122/autogene cevumeran) | Phase II for pancreatic cancer, 50% relapse reduction reported |
| Paul Conyngham / "Rosie Protocol" | A data engineer (non-biologist) used ChatGPT + open-source tools to design a personalized mRNA vaccine for his dog in 2026. Result: 75% tumor shrinkage in the largest tumor within 1 month |
| pVACtools | Used in 11+ clinical trials, published in Genome Medicine and Cancer Immunology Research |

**Key caveat the team should understand:** Computational prediction is the easy part. Less than 5% of computationally predicted neoantigen binders actually trigger an immune response in practice. The value of our tool is making the *design step* fast and explainable — not guaranteeing clinical outcomes.

---

## 3. Pipeline Steps Explained (For Non-Biologists)

Here is what the pipeline does in plain language:

### Step 1: Read the Tumor Mutations
- **Input:** A VCF file (basically a spreadsheet of DNA mutations found in the tumor)
- **What happens:** We count and categorize mutations. We care about "missense" mutations — ones that change a protein's building blocks
- **Analogy:** Imagine reading a book and highlighting all the typos that change a word's meaning

### Step 2: Predict Which Mutations the Immune System Can See
- **Tool:** pVACseq (open source, gold standard)
- **What happens:** For each mutated protein fragment (8-11 amino acids long), we predict whether it sticks to the patient's specific immune receptors (HLA molecules). Strong stickers (IC50 < 500 nanomolar) are "neoantigen candidates"
- **Analogy:** Imagine testing which puzzle pieces fit into a specific lock. We are looking for mutant pieces that fit the patient's immune lock but don't match any normal pieces

### Step 3: Rank and Filter Candidates
- **What happens:** We filter by multiple criteria:
  - Does the tumor actually express this gene? (RNA expression check)
  - Is the mutation present in most tumor cells? (variant allele frequency / clonality)
  - Does the peptide look like a normal human protein? (self-similarity check)
- **Output:** Typically 20-80 high-confidence candidates from thousands of starting mutations

### Step 4: Check Protein Structure (Optional)
- **Tool:** ESMFold API (free, by Meta)
- **What happens:** We predict the 3D shape of the protein and check if the mutation is on the surface (accessible to immune cells) vs. buried inside
- **Analogy:** A lock on the outside of a door can be picked; one inside a wall cannot

### Step 5: Design the mRNA Vaccine Construct
- **What happens:** We take the top 5-7 neoantigen sequences and encode them into a single mRNA molecule:
  - Codon optimization (choose DNA letters that human cells read efficiently)
  - Add linker sequences between neoantigens (GPGPG spacers)
  - Add regulatory elements (5'/3' UTRs from human globin genes, poly-A tail)
  - Add a signal peptide so the cell presents the antigens to the immune system
- **Output:** A complete mRNA nucleotide sequence, ready for synthesis
- **This is the same basic architecture as COVID mRNA vaccines** (Pfizer/Moderna)

### Step 6: Generate Report
- **Output:** A PDF with all candidates, scores, the mRNA blueprint, and methodology notes

---

## 4. What Tools and Data Do We Use?

### Software Tools (All Free / Open Source)

| Tool | What It Does | Cost | Reliability |
|------|-------------|------|-------------|
| **pVACseq** (pVACtools) | Predicts which mutations the immune system can target | Free, open source | Gold standard — 11+ clinical trials |
| **ESMFold API** (Meta) | Predicts 3D protein structure | Free API | Academic service, occasionally slow/down |
| **Claude API** (Anthropic) | AI agent that orchestrates and explains | ~$0.01 per pipeline run | Highly reliable |
| **FastAPI + React** | Web framework | Free | Standard web stack |
| **Docker** | Runs pVACseq in a container | Free | Standard |

### Demo Dataset: HCC1395

| Property | Value |
|----------|-------|
| What | Triple-negative breast cancer cell line |
| Source | Griffith Lab / Washington University (public, free) |
| Download size | ~200MB (pre-processed VCF) |
| Raw sequencing data | ~300GB (we do NOT need this) |
| Expected output | ~322 initial predictions, ~78 high-confidence candidates |
| HLA alleles | HLA-A*29:02, HLA-B*45:01, HLA-B*82:02, HLA-C*06:02, DQA1*03:03, DQB1*03:02, DRB1*04:05 |
| Why this dataset | Used by pVACtools team for their official tutorials; well-characterized benchmark |

---

## 5. Hardware and Infrastructure Requirements

### Our Development Machine

| Spec | Value | Sufficient? |
|------|-------|-------------|
| CPU | Intel Core ~2.7GHz | Yes |
| GPU | RTX 5070 Laptop (12GB VRAM) | Not needed for this project |
| RAM | 32GB | Yes |
| OS | Windows 11 | Yes |

### What Requires What

| Task | Runs On | Notes |
|------|---------|-------|
| Frontend (React) | Local PC | No special requirements |
| Backend (FastAPI) | Local PC | No special requirements |
| VCF parsing | Local PC | Reads line-by-line, low memory |
| pVACseq (live) | Docker container, local or cloud | 30-60 min on full dataset |
| pVACseq (demo) | N/A — use pre-computed fixtures | Instant |
| ESMFold | Remote API call | No local compute needed |
| AlphaFold (full, local) | NOT feasible locally | Requires 2.5TB database + 16GB+ VRAM |
| AlphaFold (DB lookup) | Remote API call | Free, for known human proteins only |
| Claude agent | Remote API call | ~$0.01 per run |

### Do We Need Cloud?

**For the hackathon demo: No.** Everything runs locally using pre-computed fixtures.

**For a "real" end-to-end run:** Optionally run pVACseq on a cloud spot instance once ($1-3) and save the output. This gives us real results to use as fixtures.

---

## 6. Cost Breakdown

### Hackathon Demo (Fixture-Based)

| Item | Cost |
|------|------|
| HCC1395 dataset download | Free |
| pVACtools Docker image | Free |
| ESMFold API | Free |
| Claude API (6 calls/run, ~300 tokens each) | ~$0.01/run |
| Hosting (local dev servers) | Free |
| **Total** | **~$0.01 per demo run** |

### Optional: One Real pVACseq Run on Cloud

| Item | Cost |
|------|------|
| AWS EC2 spot instance (c6a.8xlarge, ~1 hour) | $1-3 |
| S3 storage for data (1 week) | ~$2 |
| **Total** | **~$3-5 one-time** |

### Full Production Pipeline (Hypothetical)

| Item | Cost per patient |
|------|-----------------|
| Tumor sequencing (WES/WGS) | $3,000-5,000 (done externally) |
| Cloud compute (alignment + variant calling + pVACseq) | $5-15 |
| Claude API | $0.01-0.05 |
| ESMFold / AlphaFold | Free |
| **Total compute cost (our part)** | **~$5-15 per patient** |

---

## 7. What Is Already Built

| Component | Status | Notes |
|-----------|--------|-------|
| FastAPI backend with WebSocket | Done | All API routes working |
| Claude agent orchestrator | Done | Calls Claude API, has fallback explanations |
| VCF parser | Done | Parses .vcf and .vcf.gz files |
| pVACseq Docker runner | Done | Subprocess wrapper + TSV parser |
| ESMFold API client | Done | But not wired into pipeline yet |
| mRNA construct designer | Done | Codon optimization, linkers, UTRs, poly-A |
| PDF report generator | Done | But not wired into pipeline yet |
| SQLite database | Done | Stores run history and results |
| Pydantic data models | Done | All schemas defined |
| Fixture: variant_stats.json | Done | Realistic variant data |
| Fixture: pvacseq_candidates.json | **Missing** | **Pipeline will crash without this** |
| Frontend | **Not started** | React + Tailwind + Recharts needed |

### Remaining Work Estimate

| Task | Effort |
|------|--------|
| Create pvacseq_candidates.json fixture | 1-2 hours |
| Wire ESMFold into pipeline (or add fixture) | 30 min |
| Wire PDF report generator into pipeline | 15 min |
| Improve candidate ranking logic | 30 min |
| Build frontend (Upload + Pipeline + Results) | 6-10 hours |
| End-to-end testing and polish | 2-3 hours |
| **Total to working demo** | **~10-16 hours** |

---

## 8. Risk Assessment

### Low Risk (Manageable)

| Risk | Mitigation |
|------|------------|
| Claude API key runs out of credits | Agent has pre-written fallback explanations for every step |
| pVACseq takes too long to run live | Use pre-computed fixtures (already the plan) |
| ESMFold API is slow or down | Add fixture fallback for structure data |
| VCF file format edge cases | We use a well-characterized benchmark dataset |

### Medium Risk (Should Address)

| Risk | Mitigation |
|------|------------|
| Missing fixture file (pvacseq_candidates.json) | Must create before demo — currently a crash bug |
| WebSocket connection drops during demo | Add reconnection logic in frontend |
| Judges question scientific validity | Cite pVACtools' 11+ clinical trial track record; be upfront about <5% hit rate |
| Team unfamiliar with biotech terminology | This document + glossary below |

### Non-Risks (Things That Sound Scary But Aren't)

| Concern | Why It's Fine |
|---------|---------------|
| "Do we need to understand genomics?" | No. The pipeline tools (pVACseq, ESMFold) are black boxes with well-defined inputs/outputs. We wrap them, we don't build them |
| "Is this legal?" | We are building a computational tool, not a medical device. No regulatory burden for the software itself. The brief targets veterinary use first (lightest regulation) |
| "Do we need 300GB of DNA data?" | No. The processed VCF file is ~100MB. Raw sequencing is someone else's problem |
| "Can this actually work on a laptop?" | Yes. Everything is either a remote API call or uses pre-computed fixtures |

---

## 9. What Makes This a Strong Hackathon Project

1. **Real science, real tools** — pVACseq is used in actual clinical trials, not a toy
2. **Timely** — Paul Conyngham's dog Rosie story went viral in March 2026; personalized cancer vaccines are in the news
3. **Clear demo narrative** — "Click one button, watch AI walk you through designing a cancer vaccine in 2 minutes"
4. **AI is the differentiator** — the bioinformatics tools already exist; our value is the AI orchestration layer that makes them accessible
5. **Visually impressive** — pipeline stepper, mutation charts, mRNA construct visualization
6. **Technically honest** — we acknowledge limitations instead of overpromising

---

## 10. Glossary for the Team

| Term | Plain English |
|------|---------------|
| **VCF file** | A text file listing DNA mutations found in a tumor (like a spreadsheet of "typos" in DNA) |
| **HLA alleles** | Your immune system's fingerprint — determines which protein fragments your immune cells can detect |
| **Neoantigen** | A protein fragment that exists only in tumor cells (not normal cells), making it a potential vaccine target |
| **IC50** | How strongly a peptide sticks to an immune receptor. Lower = stronger. Below 500nM = good candidate |
| **pVACseq** | The bioinformatics tool that predicts which mutations make good vaccine targets |
| **Missense mutation** | A DNA change that swaps one amino acid for another in a protein |
| **mRNA vaccine** | A molecule that tells your cells to produce specific proteins, training your immune system to attack them (same tech as COVID vaccines) |
| **Codon optimization** | Choosing DNA letters that human cells read most efficiently (like translating a book into simpler language) |
| **ESMFold / AlphaFold** | AI tools that predict the 3D shape of a protein from its sequence |
| **pLDDT** | AlphaFold/ESMFold's confidence score (0-100). Above 70 = trustworthy prediction |
| **UTR** | Untranslated regions — regulatory sequences at the ends of mRNA that control how much protein gets made |
| **Poly-A tail** | A string of ~120 "A" letters at the end of mRNA that protects it from degradation |
| **Linker (GPGPG)** | A short flexible peptide spacer between vaccine targets, preventing them from interfering with each other |
| **VAF** | Variant Allele Frequency — what fraction of tumor cells carry this mutation. Higher = better target |
| **Docker** | A tool that packages software into portable containers so it runs the same everywhere |
| **WebSocket** | A persistent connection between browser and server that allows real-time streaming of updates |

---

## 11. Summary Decision Matrix

| Question | Answer |
|----------|--------|
| Is the science legitimate? | Yes — Phase III clinical trials ongoing |
| Can we build it with our hardware? | Yes — everything is API calls or pre-computed data |
| Do we need biotech expertise? | No — we wrap existing validated tools, not build new science |
| What's the total cost? | ~$0.01/demo run; $3-5 if we want one real pVACseq run |
| How much work remains? | ~10-16 hours to working demo |
| What's the biggest risk? | Missing fixture file (easy fix) and frontend not started yet (main effort) |
| Should we proceed? | **Yes** — the hard parts (backend pipeline, AI agent, data models) are done. The remaining work is straightforward web development |
