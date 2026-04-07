#!/usr/bin/env python3
"""Regenerate benchmark fixture JSONs from downloaded VCF data.

Usage:
    python scripts/generate_fixtures.py --dataset canine-mammary --vcf data/downloads/vcf/canine-mammary/CMT.mutect2.somatic.vcf
    python scripts/generate_fixtures.py --dataset hcc1395 --vcf data/downloads/vcf/hcc1395/annotated.expression.vcf.gz

This runs:
  1. VCF parsing → variant_stats.json
  2. Binding prediction (if available) → candidates.json
  3. Writes to data/benchmarks/{dataset}/

Full implementation requires NetMHCpan/MHCflurry (Phase 4).
Currently generates variant_stats.json only.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate benchmark fixtures from VCF data")
    parser.add_argument("--dataset", required=True, help="Benchmark dataset ID (e.g., canine-mammary)")
    parser.add_argument("--vcf", required=True, help="Path to VCF file")
    args = parser.parse_args()

    vcf_path = Path(args.vcf)
    if not vcf_path.exists():
        print(f"Error: VCF file not found: {vcf_path}")
        print("Run 'python scripts/download_data.py --benchmark' to download benchmark VCFs first.")
        sys.exit(1)

    output_dir = REPO_ROOT / "data" / "benchmarks" / args.dataset
    output_dir.mkdir(parents=True, exist_ok=True)

    # Step 1: Parse VCF → variant_stats.json
    from pipeline.vcf_parser import parse_vcf_live_force
    import json

    print(f"Parsing {vcf_path}...")
    stats = parse_vcf_live_force(str(vcf_path))
    stats["dataset_id"] = args.dataset
    stats["dataset_name"] = f"Generated from {vcf_path.name}"

    stats_path = output_dir / "variant_stats.json"
    stats_path.write_text(json.dumps(stats, indent=2))
    print(f"Written: {stats_path}")

    # Step 2: Binding prediction → candidates.json (stub — requires Phase 4)
    print("Note: Candidate generation requires NetMHCpan/MHCflurry (Phase 4). Skipping.")
    print("Done.")


if __name__ == "__main__":
    main()
