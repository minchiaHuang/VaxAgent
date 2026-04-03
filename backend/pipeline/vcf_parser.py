"""VCF parser — reads variant data and returns a structured summary.

In demo mode (USE_FIXTURES=true) this loads the precomputed variant_stats.json fixture
instead of parsing a real VCF file.
"""

from __future__ import annotations

import gzip
import json
import os
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() == "true"


def load_variant_stats_fixture(dataset_id: str = "hcc1395") -> dict:
    path = FIXTURES_DIR / "variant_stats.json"
    with open(path) as f:
        return json.load(f)


def parse_vcf(vcf_path: str) -> dict:
    """Parse a VCF file and return variant statistics.

    Falls back to fixture if USE_FIXTURES is set or parsing fails.
    """
    if USE_FIXTURES:
        return load_variant_stats_fixture()

    try:
        return _parse_vcf_live(vcf_path)
    except Exception:
        return load_variant_stats_fixture()


def parse_vcf_live_force(vcf_path: str) -> dict:
    """Parse a VCF file unconditionally, ignoring the USE_FIXTURES env var.

    Used by the upload endpoint so that real files are always parsed even
    when the rest of the pipeline is running in fixture mode.
    Raises on parse failure so the caller can return an HTTP error.
    """
    return _parse_vcf_live(vcf_path)


def _parse_vcf_live(vcf_path: str) -> dict:
    opener = gzip.open if vcf_path.endswith(".gz") else open

    total = 0
    snvs = 0
    missense = 0
    indels = 0

    with opener(vcf_path, "rt") as f:
        for line in f:
            if line.startswith("#"):
                continue
            parts = line.strip().split("\t")
            if len(parts) < 5:
                continue
            total += 1
            ref, alt = parts[3], parts[4]
            if len(ref) == 1 and len(alt) == 1:
                snvs += 1
            elif len(ref) != len(alt):
                indels += 1

            info = parts[7] if len(parts) > 7 else ""
            if "missense_variant" in info:
                missense += 1

    return {
        "dataset_id": "custom",
        "dataset_name": "Custom VCF Upload",
        "source": vcf_path,
        "tumor_type": "Unknown",
        "hla_alleles": [],
        "stats": {
            "total_variants": total,
            "somatic_snvs": snvs,
            "missense_mutations": missense,
            "frameshift_indels": indels,
            "initial_predictions": 0,
            "high_confidence_candidates": 0,
            "shortlisted_candidates": 0,
        },
        "top_mutated_genes": [],
        "tumor_mutation_burden": "Unknown",
        "pipeline_version": "live parse",
    }
