# Canine Mammary Tumor Benchmark Dataset

## Source
- **Dataset:** Whole-exome sequencing of 197 canine mammary gland tumors
- **Pairs:** 185 matched tumor-normal pairs with Mutect2 somatic variant calls
- **Origin:** Figshare collection 4543784
- **Reference genome:** CanFam3.1
- **Species:** Dog (Canis lupus familiaris)

## Citation
Alsaihati BA, et al. "Whole-exome and whole-transcriptome sequencing of canine
mammary gland tumors." Scientific Data 6, 147 (2019).
DOI: 10.1038/s41597-019-0149-8

Figshare: https://figshare.com/collections/4543784

## Files

| File | Description |
|------|-------------|
| `variant_stats.json` | Pre-computed summary from a representative CMT sample |
| `candidates.json` | Top neoantigen candidates (initial fixture from published data) |

## DLA Alleles
Representative DLA (Dog Leukocyte Antigen) alleles used for binding prediction:
- DLA-88*034:01 (prevalent in Boxers and other breeds)
- DLA-88*50101 (characterized binding motif, mass spec validated)

DLA allele typing is not included in the original dataset. The alleles above
are well-characterized reference alleles from published immunopeptidomics
studies (PubMed: 30239163, PMC5125661).

## Downloading the Raw VCF
```bash
python scripts/download_data.py --benchmark
```
This fetches the full Mutect2 somatic VCF (~125 MB) to `data/downloads/vcf/canine-mammary/`.

## Purpose
This is the primary veterinary benchmark for VaxAgent. Mammary tumors are the
most common tumor in unspayed female dogs, making this dataset representative
of real veterinary oncology cases.

## License
Public dataset. See the Scientific Data paper for terms.
