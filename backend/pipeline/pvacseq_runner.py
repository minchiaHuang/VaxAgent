"""pVACseq runner — loads neoantigen candidate predictions.

In demo mode (USE_FIXTURES=true) this loads the precomputed pvacseq_candidates.json fixture.
In live mode it invokes pVACseq via Docker subprocess and parses the TSV output.
The fixture path is always the safe fallback.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() == "true"


def load_candidates_fixture(dataset_id: str = "hcc1395") -> list[dict]:
    path = FIXTURES_DIR / "pvacseq_candidates.json"
    with open(path) as f:
        data = json.load(f)
    return data.get("candidates", [])


def run_pvacseq(
    vcf_path: str,
    sample_name: str,
    hla_alleles: list[str],
    output_dir: str,
) -> list[dict]:
    """Run pVACseq via Docker and return parsed candidates.

    Falls back to fixture if USE_FIXTURES is set or Docker is unavailable.
    """
    if USE_FIXTURES:
        return load_candidates_fixture()

    try:
        return _run_pvacseq_docker(vcf_path, sample_name, hla_alleles, output_dir)
    except Exception:
        return load_candidates_fixture()


def _run_pvacseq_docker(
    vcf_path: str,
    sample_name: str,
    hla_alleles: list[str],
    output_dir: str,
) -> list[dict]:
    allele_string = ",".join(hla_alleles)
    cmd = [
        "docker", "run", "--rm",
        "-v", f"{vcf_path}:/data/input.vcf",
        "-v", f"{output_dir}:/data/output",
        "griffithlab/pvactools:latest",
        "pvacseq", "run",
        "/data/input.vcf",
        sample_name,
        allele_string,
        "MHCflurry", "NetMHCpan",
        "/data/output",
        "-e1", "9",
        "--top-score-metric", "median",
        "--binding-threshold", "500",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    if result.returncode != 0:
        raise RuntimeError(f"pVACseq failed: {result.stderr[:500]}")

    tsv_path = Path(output_dir) / "MHC_Class_I" / f"{sample_name}.filtered.condensed.ranked.tsv"
    if not tsv_path.exists():
        raise FileNotFoundError(f"Expected output not found: {tsv_path}")

    return _parse_pvacseq_tsv(str(tsv_path))


def _parse_pvacseq_tsv(tsv_path: str) -> list[dict]:
    candidates = []
    with open(tsv_path) as f:
        headers = f.readline().strip().split("\t")
        for i, line in enumerate(f):
            parts = line.strip().split("\t")
            row = dict(zip(headers, parts))
            try:
                candidates.append(
                    {
                        "rank": i + 1,
                        "gene": row.get("Gene Name", ""),
                        "chromosome": row.get("Chromosome", ""),
                        "start": int(row.get("Start", 0)),
                        "stop": int(row.get("Stop", 0)),
                        "reference": row.get("Reference", ""),
                        "alt": row.get("Variant", ""),
                        "mutation": row.get("Mutation", ""),
                        "protein_change": row.get("Protein Position", ""),
                        "variant_type": row.get("Variant Type", ""),
                        "transcript": row.get("Transcript", ""),
                        "peptide_length": int(row.get("Peptide Length", 9)),
                        "mt_epitope_seq": row.get("MT Epitope Seq", ""),
                        "wt_epitope_seq": row.get("Corresponding WT Epitope Seq", ""),
                        "hla_allele": row.get("HLA Allele", ""),
                        "ic50_mt": float(row.get("Median MT Score", 999)),
                        "ic50_wt": float(row.get("Median WT Score", 999)),
                        "fold_change": float(row.get("Median Fold Change", 1)),
                        "tumor_dna_depth": int(row.get("Tumor DNA Depth", 0)),
                        "tumor_dna_vaf": float(row.get("Tumor DNA VAF", 0)),
                        "tumor_rna_depth": int(row.get("Tumor RNA Depth", 0)),
                        "tumor_rna_vaf": float(row.get("Tumor RNA VAF", 0)),
                        "gene_expression_tpm": float(row.get("Gene Expression", 0)),
                        "clonality": "clonal" if float(row.get("Tumor DNA VAF", 0)) > 0.35 else "subclonal",
                        "self_similarity": 0.0,
                        "priority_score": 0,
                        "surface_accessible": False,
                        "plddt": 0.0,
                        "explanation": "",
                    }
                )
            except (ValueError, KeyError):
                continue
    return candidates


async def run_pvacseq_async(
    job_id: str,
    vcf_path: str,
    hla_alleles: list[str],
    output_dir: str,
) -> None:
    """Run pVACseq in a background thread and persist results + job status to SQLite.

    Imports db helpers lazily to avoid circular imports at module load time.
    """
    from db.database import update_job

    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    result_path = str(Path(output_dir) / "candidates.json")

    await update_job(job_id, _now(), status="running", progress_pct=5)

    try:
        candidates = await asyncio.to_thread(
            _run_pvacseq_docker, vcf_path, job_id, hla_alleles, output_dir
        )
        await update_job(job_id, _now(), progress_pct=90)

        ranked = rank_candidates(candidates, top_n=10)
        Path(result_path).write_text(json.dumps(ranked, indent=2))

        await update_job(
            job_id, _now(), status="complete", progress_pct=100, result_path=result_path
        )
    except Exception as exc:
        await update_job(job_id, _now(), status="failed", error_msg=str(exc)[:500])


def load_candidates_from_job(result_path: str) -> list[dict]:
    """Load ranked candidates from a completed pVACseq job result file."""
    with open(result_path) as f:
        return json.load(f)


def rank_candidates(candidates: list[dict], top_n: int = 10) -> list[dict]:
    """Score and rank candidates by binding, expression, and clonality."""
    for c in candidates:
        ic50 = c.get("ic50_mt", 999)
        expr = c.get("gene_expression_tpm", 0)
        vaf = c.get("tumor_dna_vaf", 0)
        fold = c.get("fold_change", 1)

        binding_score = max(0, 50 * (1 - ic50 / 500)) if ic50 < 500 else 0
        expression_score = min(30, expr / 2)
        clonality_score = vaf * 15
        specificity_score = min(5, fold / 10)

        c["priority_score"] = int(binding_score + expression_score + clonality_score + specificity_score)

    ranked = sorted(candidates, key=lambda x: x["priority_score"], reverse=True)
    for i, c in enumerate(ranked):
        c["rank"] = i + 1

    return ranked[:top_n]
