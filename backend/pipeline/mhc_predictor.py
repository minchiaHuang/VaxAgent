"""MHC class I binding predictor — Python-native alternative to pVACseq/Docker.

Prediction priority:
  1. MHCflurry (mhcflurry Python package + downloaded models) if installed.
  2. Fixture IC50 values from precomputed benchmark data (always available).

This module lets the pipeline produce real binding predictions when Docker is
unavailable (e.g. on Render free tier, local dev machines without Docker, CI).

Candidates are tagged with an ``ic50_source`` field so the UI can communicate
which prediction engine was used:
  - "pvacseq"   — full Docker pVACseq run (most rigorous)
  - "mhcflurry" — Python-native MHCflurry v3 prediction
  - "fixture"   — pre-computed benchmark values (demo / fallback)

Usage (standalone):
    from pipeline.mhc_predictor import predict_binding_for_candidates
    candidates = predict_binding_for_candidates(candidates, hla_alleles)
"""

from __future__ import annotations

import importlib.util
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() == "true"
MHC_BINDING_THRESHOLD_NM = float(os.getenv("MHC_BINDING_THRESHOLD_NM", "500"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def is_mhcflurry_available() -> bool:
    """Return True if mhcflurry is installed and models are downloaded."""
    if importlib.util.find_spec("mhcflurry") is None:
        return False
    try:
        from mhcflurry import Class1PresentationPredictor  # type: ignore[import]
        predictor = Class1PresentationPredictor.load()
        return predictor is not None
    except Exception:
        return False


def predict_binding_for_candidates(
    candidates: list[dict],
    hla_alleles: Optional[list[str]] = None,
) -> list[dict]:
    """Enrich candidates with IC50 predictions and set ``ic50_source``.

    In fixture mode all candidates are tagged ``ic50_source = "fixture"``
    without any computation.  In live mode MHCflurry is tried first; if
    unavailable, fixture values are used.

    Args:
        candidates: List of candidate dicts, each requiring at least
            ``mt_epitope_seq``, ``wt_epitope_seq``, and ``hla_allele``.
        hla_alleles: Optional override list of HLA alleles.  When provided,
            each candidate is scored against *all* alleles and the
            lowest-IC50 (tightest-binding) allele is kept.

    Returns:
        Same list with ``ic50_source`` (and updated ``ic50_mt``,
        ``ic50_wt``, ``fold_change`` if MHCflurry ran) on each candidate.
    """
    if USE_FIXTURES or not candidates:
        for c in candidates:
            c.setdefault("ic50_source", "fixture")
        return candidates

    if is_mhcflurry_available():
        try:
            return _enrich_with_mhcflurry(candidates, hla_alleles)
        except Exception as exc:
            logger.warning("MHCflurry prediction failed, falling back to fixture: %s", exc)

    # Graceful fallback — keep existing IC50 values, tag as fixture
    for c in candidates:
        c.setdefault("ic50_source", "fixture")
    return candidates


# ---------------------------------------------------------------------------
# MHCflurry prediction
# ---------------------------------------------------------------------------


def _enrich_with_mhcflurry(
    candidates: list[dict],
    hla_alleles: Optional[list[str]],
) -> list[dict]:
    """Run MHCflurry predictions and update IC50 fields on each candidate."""
    from mhcflurry import Class1PresentationPredictor  # type: ignore[import]

    predictor = Class1PresentationPredictor.load()

    for candidate in candidates:
        mt_seq = candidate.get("mt_epitope_seq", "")
        wt_seq = candidate.get("wt_epitope_seq", "")

        # Determine alleles to test against
        alleles = hla_alleles or [candidate.get("hla_allele", "HLA-A*02:01")]
        alleles = [a for a in alleles if a]  # drop empty strings

        if not mt_seq or not alleles:
            candidate.setdefault("ic50_source", "fixture")
            continue

        try:
            mt_ic50, best_allele = _predict_best_ic50(predictor, mt_seq, alleles)
            wt_ic50 = _predict_single_ic50(predictor, wt_seq, best_allele) if wt_seq else mt_ic50 * 10

            fold = round(wt_ic50 / mt_ic50, 1) if mt_ic50 > 0 else 1.0
            candidate["ic50_mt"] = round(mt_ic50, 1)
            candidate["ic50_wt"] = round(wt_ic50, 1)
            candidate["fold_change"] = fold
            candidate["hla_allele"] = best_allele
            candidate["ic50_source"] = "mhcflurry"
        except Exception:
            candidate.setdefault("ic50_source", "fixture")

    return candidates


def _predict_best_ic50(
    predictor,
    peptide: str,
    alleles: list[str],
) -> tuple[float, str]:
    """Return (lowest IC50, allele) across all provided HLA alleles."""
    results = predictor.predict(
        peptides=[peptide] * len(alleles),
        alleles=alleles,
        sample_name="query",
    )
    df = results.to_dataframe()
    # MHCflurry returns 'presentation_score'; IC50 ~ 1/score rescaled to nM
    # Column name varies by mhcflurry version: affinity or mhcflurry1_ic50
    ic50_col = next(
        (c for c in ("affinity", "mhcflurry1_ic50", "ic50") if c in df.columns),
        None,
    )
    if ic50_col:
        best_idx = df[ic50_col].idxmin()
        return float(df.loc[best_idx, ic50_col]), str(df.loc[best_idx, "allele"])

    # Fallback: use presentation_score (higher = better binder; map to IC50 range)
    score_col = "presentation_score" if "presentation_score" in df.columns else df.columns[0]
    best_idx = df[score_col].idxmax()
    score = float(df.loc[best_idx, score_col])
    ic50_estimate = max(1.0, 50000 * (1 - min(score, 0.999)))
    return ic50_estimate, str(df.loc[best_idx, "allele"])


def _predict_single_ic50(predictor, peptide: str, allele: str) -> float:
    """Return IC50 (nM) for one peptide+allele pair."""
    result = predictor.predict(
        peptides=[peptide],
        alleles=[allele],
        sample_name="query_wt",
    )
    df = result.to_dataframe()
    ic50_col = next(
        (c for c in ("affinity", "mhcflurry1_ic50", "ic50") if c in df.columns),
        None,
    )
    if ic50_col:
        return float(df[ic50_col].iloc[0])
    score_col = "presentation_score" if "presentation_score" in df.columns else df.columns[0]
    score = float(df[score_col].iloc[0])
    return max(1.0, 50000 * (1 - min(score, 0.999)))


# ---------------------------------------------------------------------------
# Job-level async wrapper (used when Docker is unavailable)
# ---------------------------------------------------------------------------


async def run_mhcflurry_job_async(
    job_id: str,
    vcf_path: str,
    hla_alleles: list[str],
    output_dir: str,
    dataset_id: str = "hcc1395",
) -> None:
    """Run MHCflurry binding prediction as a background job.

    Loads fixture candidates for the matched dataset (or hcc1395 as default),
    re-scores them with MHCflurry using the user's HLA alleles, ranks, and
    persists results — mirroring the pVACseq job format so the frontend
    pipeline step works identically.

    This is intentionally conservative: we predict binding affinity for the
    benchmark peptide set rather than extracting novel peptides from the VCF
    (which would require VEP annotation).  The variant summary from the VCF
    is displayed in Step 1; Step 2 shows MHCflurry predictions.
    """
    import asyncio
    import json
    from datetime import datetime, timezone
    from pathlib import Path

    from db.database import update_job
    from pipeline.pvacseq_runner import load_candidates_fixture, rank_candidates

    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    result_path = str(Path(output_dir) / "candidates.json")

    await update_job(job_id, _now(), status="running", progress_pct=10)

    try:
        candidates = await asyncio.to_thread(load_candidates_fixture, dataset_id)
        await update_job(job_id, _now(), progress_pct=40)

        candidates = await asyncio.to_thread(
            predict_binding_for_candidates, candidates, hla_alleles
        )
        await update_job(job_id, _now(), progress_pct=80)

        ranked = rank_candidates(candidates, top_n=10)
        Path(result_path).write_text(json.dumps(ranked, indent=2))

        await update_job(
            job_id, _now(), status="complete", progress_pct=100, result_path=result_path
        )
    except Exception as exc:
        await update_job(job_id, _now(), status="failed", error_msg=str(exc)[:500])
