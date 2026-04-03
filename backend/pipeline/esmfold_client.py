"""ESMFold API client — predicts protein structure accessibility for candidates.

Uses the public Meta ESMFold API. Falls back to fixture pLDDT values
if the API is unavailable or USE_FIXTURES is set.
"""

from __future__ import annotations

import asyncio
import os

import httpx

ESMFOLD_API_URL = os.getenv(
    "ESMFOLD_API_URL",
    "https://api.esmatlas.com/foldSequence/v1/pdb/",
)
USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() == "true"

# Timeout per sequence — the public API can be slow
REQUEST_TIMEOUT = 30.0


async def get_structure_plddt(sequence: str) -> tuple[float, bool]:
    """Return (pLDDT, surface_accessible) for a peptide sequence.

    pLDDT > 70 = reliable prediction; surface_accessible = True means
    the epitope region is solvent-exposed based on secondary structure heuristics.
    """
    if USE_FIXTURES:
        return _estimate_plddt_heuristic(sequence), _estimate_surface(sequence)

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                ESMFOLD_API_URL,
                content=sequence,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            plddt = _parse_plddt_from_pdb(response.text)
            surface = plddt > 70
            return plddt, surface
    except Exception:
        return _estimate_plddt_heuristic(sequence), _estimate_surface(sequence)


async def enrich_candidates_with_structure(candidates: list[dict]) -> list[dict]:
    """Add pLDDT and surface_accessible fields to each candidate."""
    tasks = [get_structure_plddt(c["mt_epitope_seq"]) for c in candidates]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for candidate, result in zip(candidates, results):
        if isinstance(result, Exception) or result is None:
            continue
        plddt, surface = result
        if candidate.get("plddt", 0) == 0.0:
            candidate["plddt"] = round(plddt, 1)
        if not candidate.get("surface_accessible"):
            candidate["surface_accessible"] = surface

    return candidates


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
