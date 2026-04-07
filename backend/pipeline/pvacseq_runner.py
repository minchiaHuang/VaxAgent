"""pVACseq runner — loads neoantigen candidate predictions.

In demo mode (USE_FIXTURES=true) this loads the precomputed pvacseq_candidates.json fixture.
In live mode it invokes VEP annotation then pVACseq via Docker subprocess and parses the TSV output.
The fixture path is always the safe fallback.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

BENCHMARKS_DIR = Path(__file__).parent.parent.parent / "data" / "benchmarks"
USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() == "true"
VEP_CACHE_DIR = os.getenv("VEP_CACHE_DIR", "")
VEP_ASSEMBLY = os.getenv("VEP_ASSEMBLY", "GRCh37")
PVACSEQ_TIMEOUT = int(os.getenv("PVACSEQ_TIMEOUT", "14400"))  # 4 hours default
VEP_TIMEOUT = int(os.getenv("VEP_TIMEOUT", "7200"))  # 2 hours default


def load_candidates_fixture(dataset_id: str = "hcc1395") -> list[dict]:
    benchmark_dir = BENCHMARKS_DIR / dataset_id
    # Support both naming conventions
    for name in ("pvacseq_candidates.json", "candidates.json"):
        path = benchmark_dir / name
        if path.exists():
            with open(path) as f:
                data = json.load(f)
            return data.get("candidates", [])
    raise FileNotFoundError(f"No candidates fixture found in {benchmark_dir}")


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


def _get_vcf_sample_name(vcf_path: str) -> str:
    """Extract the first sample name from the VCF #CHROM header line."""
    with open(vcf_path) as f:
        for line in f:
            if line.startswith("#CHROM"):
                cols = line.strip().split("\t")
                if len(cols) >= 10:
                    return cols[9]
    raise ValueError(f"Could not extract sample name from VCF (no #CHROM line with sample column): {vcf_path}")


def _vcf_is_vep_annotated(vcf_path: str) -> bool:
    """Return True if the VCF already contains VEP CSQ annotations in INFO."""
    with open(vcf_path) as f:
        for line in f:
            if line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) > 7 and "CSQ=" in fields[7]:
                return True
            break  # only inspect first data line
    return False


def _run_docker_with_cleanup(cmd: list[str], container_name: str, timeout: int) -> subprocess.CompletedProcess:
    """Run a Docker command, ensuring the container is killed if Python times out."""
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        subprocess.run(["docker", "kill", container_name], capture_output=True)
        raise RuntimeError(f"Docker command timed out after {timeout}s (container {container_name} killed)")


def _run_vep_docker(
    input_vcf: str,
    output_dir: str,
    vep_cache_dir: str,
    assembly: str,
) -> str:
    """Annotate a VCF with VEP using the griffithlab/pvactools Docker image.

    Returns the path to the annotated VCF file written inside output_dir.
    Raises RuntimeError if VEP exits with a non-zero code.
    """
    if not vep_cache_dir:
        raise RuntimeError(
            "VEP_CACHE_DIR is not set. "
            "Download the VEP cache and set VEP_CACHE_DIR in backend/.env before running live pVACseq."
        )

    annotated_vcf = str(Path(output_dir) / "annotated.vcf")
    container_name = f"vaxagent-vep-{uuid.uuid4().hex[:8]}"
    cmd = [
        "docker", "run", "--rm", "--name", container_name,
        "--platform", "linux/amd64",
        "-v", f"{input_vcf}:/data/input.vcf",
        "-v", f"{output_dir}:/data/output",
        "-v", f"{vep_cache_dir}:/opt/vep/.vep",
        "griffithlab/pvactools:latest",
        "pvacseq", "vep-annotate",
        "/data/input.vcf",
        "/data/output/annotated.vcf",
        assembly,
    ]
    result = _run_docker_with_cleanup(cmd, container_name, VEP_TIMEOUT)
    if result.returncode != 0:
        raise RuntimeError(f"VEP annotation failed: {result.stderr[:500]}")

    if not Path(annotated_vcf).exists():
        raise FileNotFoundError(f"VEP annotated output not found: {annotated_vcf}")

    return annotated_vcf


def _run_pvacseq_docker(
    annotated_vcf: str,
    sample_name: str,
    hla_alleles: list[str],
    output_dir: str,
) -> list[dict]:
    """Run pVACseq on a VEP-annotated VCF and return parsed candidates.

    The sample_name argument is ignored — the actual sample name is always
    read from the VCF #CHROM header to avoid mismatches.
    """
    vcf_sample = _get_vcf_sample_name(annotated_vcf)
    allele_string = ",".join(hla_alleles)
    container_name = f"vaxagent-pvacseq-{uuid.uuid4().hex[:8]}"
    cmd = [
        "docker", "run", "--rm", "--name", container_name,
        "--platform", "linux/amd64",
        "-v", f"{annotated_vcf}:/data/input.vcf",
        "-v", f"{output_dir}:/data/output",
        "griffithlab/pvactools:latest",
        "pvacseq", "run",
        "/data/input.vcf",
        vcf_sample,
        allele_string,
        "MHCflurry", "NetMHCpan",
        "/data/output",
        "-e1", "9",
        "--top-score-metric", "median",
        "--binding-threshold", "500",
    ]
    result = _run_docker_with_cleanup(cmd, container_name, PVACSEQ_TIMEOUT)
    if result.returncode != 0:
        raise RuntimeError(f"pVACseq failed: {result.stderr[:500]}")

    # pvactools ≥ 4.x changed the output naming convention
    tsv_path = Path(output_dir) / "MHC_Class_I" / f"{vcf_sample}.MHC_I.filtered.tsv"
    if not tsv_path.exists():
        # Fall back to legacy naming (pvactools < 4)
        tsv_path = Path(output_dir) / "MHC_Class_I" / f"{vcf_sample}.filtered.condensed.ranked.tsv"
    if not tsv_path.exists():
        raise FileNotFoundError(
            f"pVACseq output not found. Checked:\n"
            f"  {Path(output_dir) / 'MHC_Class_I' / f'{vcf_sample}.MHC_I.filtered.tsv'}\n"
            f"  {Path(output_dir) / 'MHC_Class_I' / f'{vcf_sample}.filtered.condensed.ranked.tsv'}"
        )

    return _parse_pvacseq_tsv(str(tsv_path))


def _safe_float(value: str, default: float = 0.0) -> float:
    """Convert a string to float, returning default for NA / empty / None."""
    if value in ("NA", "", "None", None):
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _parse_pvacseq_tsv(tsv_path: str) -> list[dict]:
    candidates = []
    with open(tsv_path) as f:
        headers = f.readline().strip().split("\t")
        for i, line in enumerate(f):
            parts = line.strip().split("\t")
            row = dict(zip(headers, parts))
            try:
                # Support both pvactools ≥4 ("Median MT IC50 Score") and <4 ("Median MT Score")
                ic50_mt = _safe_float(row.get("Median MT IC50 Score") or row.get("Median MT Score", "999"), 999.0)
                ic50_wt = _safe_float(row.get("Median WT IC50 Score") or row.get("Median WT Score", "999"), 999.0)
                # "WT Epitope Seq" in ≥4, "Corresponding WT Epitope Seq" in <4
                wt_seq = row.get("WT Epitope Seq") or row.get("Corresponding WT Epitope Seq", "")
                vaf = _safe_float(row.get("Tumor DNA VAF", "0"))
                candidates.append(
                    {
                        "rank": i + 1,
                        "gene": row.get("Gene Name", ""),
                        "chromosome": row.get("Chromosome", ""),
                        "start": int(row.get("Start", 0) or 0),
                        "stop": int(row.get("Stop", 0) or 0),
                        "reference": row.get("Reference", ""),
                        "alt": row.get("Variant", ""),
                        "mutation": row.get("Mutation", ""),
                        "protein_change": row.get("Protein Position", ""),
                        "variant_type": row.get("Variant Type", ""),
                        "transcript": row.get("Transcript", ""),
                        "peptide_length": int(row.get("Peptide Length", 9) or 9),
                        "mt_epitope_seq": row.get("MT Epitope Seq", ""),
                        "wt_epitope_seq": wt_seq,
                        "hla_allele": row.get("HLA Allele", ""),
                        "ic50_mt": ic50_mt,
                        "ic50_wt": ic50_wt,
                        "fold_change": _safe_float(row.get("Median Fold Change") or row.get("Corresponding Fold Change", "1"), 1.0),
                        "tumor_dna_depth": int(_safe_float(row.get("Tumor DNA Depth", "0"))),
                        "tumor_dna_vaf": vaf,
                        "tumor_rna_depth": int(_safe_float(row.get("Tumor RNA Depth", "0"))),
                        "tumor_rna_vaf": _safe_float(row.get("Tumor RNA VAF", "0")),
                        "gene_expression_tpm": _safe_float(row.get("Gene Expression", "0")),
                        "clonality": "clonal" if vaf > 0.35 else "subclonal",
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
    """Run VEP annotation then pVACseq in a background thread, persisting results to SQLite.

    Step progression:
      5%  — job accepted, VEP starting
      40% — VEP complete, pVACseq starting
      90% — pVACseq complete, ranking
      100% — done

    Imports db helpers lazily to avoid circular imports at module load time.
    """
    from db.database import update_job

    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    result_path = str(Path(output_dir) / "candidates.json")

    await update_job(job_id, _now(), status="running", progress_pct=5)

    try:
        # Step 1: VEP annotation — skip if the VCF is already annotated with CSQ fields
        if _vcf_is_vep_annotated(vcf_path):
            annotated_vcf = vcf_path
            await update_job(job_id, _now(), progress_pct=40)
        else:
            annotated_vcf = await asyncio.to_thread(
                _run_vep_docker, vcf_path, output_dir, VEP_CACHE_DIR, VEP_ASSEMBLY
            )
            await update_job(job_id, _now(), progress_pct=40)

        # Step 2: pVACseq binding prediction
        candidates = await asyncio.to_thread(
            _run_pvacseq_docker, annotated_vcf, job_id, hla_alleles, output_dir
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
