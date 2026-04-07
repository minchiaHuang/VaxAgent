"""Tiered structure prediction client for vaccine target candidates.

Prediction tiers (attempted in order):
  1. AlphaFold DB — precomputed, highest quality (gene-name lookup).
  2. ESMFold API  — live folding of novel peptide sequences (sequence lookup).
  3. Heuristic    — amino-acid composition estimate (always available).

Each enriched candidate gains three new fields:
  - plddt           (float)  mean predicted local distance difference test score
  - surface_accessible (bool)  whether the epitope is likely solvent-exposed
  - structure_source   (str)  "alphafold" | "esmfold" | "heuristic"

In fixture mode (USE_FIXTURES=true) all predictions use the heuristic or
AlphaFold fixture table without any network calls.
"""

from __future__ import annotations

import asyncio
import os
from typing import Optional

import httpx

from pipeline.alphafold_client import get_alphafold_plddt

ESMFOLD_API_URL = os.getenv(
    "ESMFOLD_API_URL",
    "https://api.esmatlas.com/foldSequence/v1/pdb/",
)
USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() == "true"

REQUEST_TIMEOUT = 30.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def get_structure_plddt(
    sequence: str,
    gene: Optional[str] = None,
) -> tuple[float, bool, str]:
    """Return (pLDDT, surface_accessible, structure_source) for a peptide.

    Tries AlphaFold DB → ESMFold API → heuristic, returning the first success.
    """
    # Tier 1: AlphaFold DB (gene-level; highest quality)
    if gene:
        af_plddt = await get_alphafold_plddt(gene)
        if af_plddt is not None:
            return af_plddt, af_plddt > 70, "alphafold"

    # Tier 2: ESMFold API (sequence-level; requires network, skipped in fixtures)
    if not USE_FIXTURES:
        esm_plddt = await _fetch_esmfold_plddt(sequence)
        if esm_plddt is not None:
            return esm_plddt, esm_plddt > 70, "esmfold"

    # Tier 3: Heuristic estimate (always available)
    plddt = _estimate_plddt_heuristic(sequence)
    return plddt, _estimate_surface(sequence), "heuristic"


async def enrich_candidates_with_structure(candidates: list[dict]) -> list[dict]:
    """Add pLDDT, surface_accessible, and structure_source fields to each candidate.

    Candidates that already carry a non-zero pLDDT are still updated with a
    structure_source label but their existing pLDDT is preserved.
    """
    tasks = [
        get_structure_plddt(c["mt_epitope_seq"], gene=c.get("gene"))
        for c in candidates
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for candidate, result in zip(candidates, results):
        if isinstance(result, Exception) or result is None:
            candidate.setdefault("structure_source", "heuristic")
            continue

        plddt, surface, source = result

        if candidate.get("plddt", 0) == 0.0:
            candidate["plddt"] = round(plddt, 1)
        if not candidate.get("surface_accessible"):
            candidate["surface_accessible"] = surface
        # Always record source so the frontend can display it.
        candidate["structure_source"] = source

    return candidates


# ---------------------------------------------------------------------------
# ESMFold tier
# ---------------------------------------------------------------------------


async def _fetch_esmfold_plddt(sequence: str) -> Optional[float]:
    """Call the public ESMFold API and return mean pLDDT, or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                ESMFOLD_API_URL,
                content=sequence,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            return _parse_plddt_from_pdb(response.text)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Utility / heuristic functions (kept for tests and fallback)
# ---------------------------------------------------------------------------


def _parse_plddt_from_pdb(pdb_text: str) -> float:
    """Extract mean pLDDT from PDB ATOM records (stored in B-factor column)."""
    b_factors = []
    for line in pdb_text.splitlines():
        if line.startswith("ATOM"):
            try:
                b_factors.append(float(line[60:66].strip()))
            except ValueError:
                continue
    return round(sum(b_factors) / len(b_factors), 1) if b_factors else 0.0


def _estimate_plddt_heuristic(sequence: str) -> float:
    """Rough pLDDT estimate based on sequence composition (fixture fallback)."""
    hydrophobic = set("VILMFYW")
    charged = set("DEKRH")
    h_count = sum(1 for aa in sequence if aa in hydrophobic)
    c_count = sum(1 for aa in sequence if aa in charged)
    n = len(sequence)
    if n == 0:
        return 50.0
    ratio = h_count / n
    base = 55 + ratio * 30 - (c_count / n) * 10
    return round(max(40.0, min(92.0, base)), 1)


def _estimate_surface(sequence: str) -> bool:
    """Estimate surface accessibility from sequence composition."""
    polar = set("STNQKRHDEP")
    polar_count = sum(1 for aa in sequence if aa in polar)
    return (polar_count / len(sequence)) > 0.4 if sequence else False
