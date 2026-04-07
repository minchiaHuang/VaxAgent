# HCC1395 Benchmark Dataset

## Source
- **Cell line:** HCC1395 (triple-negative breast cancer)
- **Origin:** Griffith Lab, Washington University School of Medicine
- **Reference genome:** GRCh37 (hg19)
- **Species:** Human

## Citation
Griffith M, et al. "Optimizing Cancer Genome Sequencing and Analysis."
Cell Systems, 2015. DOI: 10.1016/j.cels.2015.08.015

pVACtools tutorial data: https://pvactools.readthedocs.io/

## Files

| File | Description |
|------|-------------|
| `variant_stats.json` | Pre-computed summary: 4,741 total variants, 1,842 missense mutations |
| `pvacseq_candidates.json` | Top 10 neoantigen candidates from pVACseq v4.0 |

## HLA Alleles
- MHC Class I: HLA-A*29:02, HLA-B*45:01, HLA-B*82:02, HLA-C*06:02
- MHC Class II: DRB1*07:01, DPA1*02:01, DPB1*13:01, DQA1*01:02, DQB1*06:04

## Purpose
This is the gold-standard human benchmark dataset used for pVACseq validation.
It serves as a reference demo in VaxAgent — the primary veterinary workflow uses
canine datasets.

## License
Public benchmark data. See Griffith Lab publications for terms.
