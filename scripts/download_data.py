#!/usr/bin/env python3
"""Download benchmark VCFs, VEP caches, and prediction models from public sources.

Usage:
    python scripts/download_data.py --all          # Everything
    python scripts/download_data.py --benchmark    # Benchmark VCFs only
    python scripts/download_data.py --vep-cache    # VEP caches
    python scripts/download_data.py --models       # MHCflurry models
    python scripts/download_data.py --list         # Show available downloads
    python scripts/download_data.py --verify       # Check existing downloads
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS_DIR = REPO_ROOT / "data" / "downloads"

# ── Download targets ────────────────────────────────────────────────────────

TARGETS: dict[str, dict] = {
    "hcc1395-vcf": {
        "url": "https://raw.githubusercontent.com/griffithlab/pVACtools/master/pvactools/tools/pvacseq/example_data/annotated.expression.vcf.gz",
        "dest": "vcf/hcc1395/annotated.expression.vcf.gz",
        "size_mb": 2.0,
        "description": "HCC1395 VEP-annotated somatic VCF (Griffith Lab pVACtools example)",
        "category": "benchmark",
    },
    "hcc1395-inputs": {
        "url": "https://raw.githubusercontent.com/griffithlab/pVACtools_Intro_Course/main/HCC1395_inputs.zip",
        "dest": "vcf/hcc1395/HCC1395_inputs.zip",
        "size_mb": 24.2,
        "description": "HCC1395 full input bundle (VCF + HLA typing + expression)",
        "category": "benchmark",
    },
    "canine-mammary-vcf": {
        "url": "https://ndownloader.figshare.com/files/15194201",
        "dest": "vcf/canine-mammary/CMT.mutect2.somatic.vcf",
        "size_mb": 124.6,
        "description": "Canine mammary tumor Mutect2 somatic VCF (185 matched pairs, Figshare)",
        "category": "benchmark",
    },
}

CATEGORIES = {
    "benchmark": "Benchmark VCFs",
    "vep-cache": "VEP annotation caches",
    "models": "Prediction models (MHCflurry)",
}


def download_file(url: str, dest: Path, description: str) -> bool:
    """Download a file with progress reporting. Returns True on success."""
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        print(f"  [skip] {dest.name} already exists")
        return True

    print(f"  Downloading {description}...")
    print(f"  URL: {url}")
    print(f"  Dest: {dest}")

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "VaxAgent/1.0"})
        with urllib.request.urlopen(req, timeout=300) as response:
            total = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 1024 * 256  # 256KB chunks

            with open(dest, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded / total * 100
                        mb = downloaded / 1024 / 1024
                        print(f"\r  {mb:.1f} MB ({pct:.0f}%)", end="", flush=True)
                    else:
                        mb = downloaded / 1024 / 1024
                        print(f"\r  {mb:.1f} MB", end="", flush=True)

        print(f"\n  [done] {dest.name} ({downloaded / 1024 / 1024:.1f} MB)")
        return True

    except Exception as exc:
        print(f"\n  [error] {exc}")
        dest.unlink(missing_ok=True)
        return False


def verify_file(dest: Path) -> bool:
    """Check if a downloaded file exists and has non-zero size."""
    if not dest.exists():
        return False
    return dest.stat().st_size > 0


def list_targets(category: str | None = None) -> None:
    """Print available download targets."""
    print("\nAvailable downloads:\n")
    for name, info in TARGETS.items():
        if category and info["category"] != category:
            continue
        dest = DOWNLOADS_DIR / info["dest"]
        status = "downloaded" if dest.exists() else "not downloaded"
        print(f"  {name}")
        print(f"    {info['description']}")
        print(f"    Size: ~{info['size_mb']} MB | Status: {status}")
        print()


def download_category(category: str) -> int:
    """Download all targets in a category. Returns count of failures."""
    targets = {k: v for k, v in TARGETS.items() if v["category"] == category}
    if not targets:
        print(f"No targets in category '{category}'")
        return 0

    print(f"\n{'='*60}")
    print(f"Downloading: {CATEGORIES.get(category, category)}")
    print(f"{'='*60}\n")

    failures = 0
    for name, info in targets.items():
        dest = DOWNLOADS_DIR / info["dest"]
        if not download_file(info["url"], dest, info["description"]):
            failures += 1
        print()

    return failures


def verify_all() -> None:
    """Verify all downloaded files."""
    print("\nVerifying downloads:\n")
    for name, info in TARGETS.items():
        dest = DOWNLOADS_DIR / info["dest"]
        if verify_file(dest):
            size_mb = dest.stat().st_size / 1024 / 1024
            print(f"  [ok]   {name} ({size_mb:.1f} MB)")
        elif dest.exists():
            print(f"  [bad]  {name} (exists but empty)")
        else:
            print(f"  [miss] {name} (not downloaded)")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download VaxAgent benchmark data and models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--all", action="store_true", help="Download everything")
    parser.add_argument("--benchmark", action="store_true", help="Download benchmark VCFs")
    parser.add_argument("--vep-cache", action="store_true", help="Download VEP caches")
    parser.add_argument("--models", action="store_true", help="Download prediction models")
    parser.add_argument("--list", action="store_true", help="List available downloads")
    parser.add_argument("--verify", action="store_true", help="Verify existing downloads")

    args = parser.parse_args()

    if not any([args.all, args.benchmark, args.vep_cache, args.models, args.list, args.verify]):
        parser.print_help()
        sys.exit(0)

    if args.list:
        list_targets()
        return

    if args.verify:
        verify_all()
        return

    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    failures = 0

    if args.all or args.benchmark:
        failures += download_category("benchmark")

    if args.all or args.vep_cache:
        failures += download_category("vep-cache")

    if args.all or args.models:
        failures += download_category("models")

    if failures:
        print(f"\n{failures} download(s) failed.")
        sys.exit(1)
    else:
        print("\nAll downloads complete.")


if __name__ == "__main__":
    main()
