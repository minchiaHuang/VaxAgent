"""AlphaFold DB client — fetches precomputed pLDDT scores from the EBI AlphaFold database.

Lookup strategy:
  1. Map gene name to UniProt accession via a static table (common cancer genes).
  2. If not in table, attempt live UniProt search to resolve the accession.
  3. Fetch mean pLDDT from AlphaFold API prediction metadata.
  4. Falls back gracefully when the gene is unknown or the API is unreachable.

In fixture mode (USE_FIXTURES=true) all lookups return pre-computed values
so CI and demos work without any network calls.
"""

from __future__ import annotations

import asyncio
import os
from typing import Optional

import httpx

USE_FIXTURES = os.getenv("USE_FIXTURES", "true").lower() == "true"
ALPHAFOLD_API_BASE = os.getenv(
    "ALPHAFOLD_API_BASE",
    "https://alphafold.ebi.ac.uk/api",
)
UNIPROT_SEARCH_URL = "https://rest.uniprot.org/uniprotkb/search"
REQUEST_TIMEOUT = 20.0

# Static gene → UniProt accession map for common human cancer driver genes.
# Sourced from UniProt canonical reviewed entries (Swiss-Prot).
GENE_TO_UNIPROT: dict[str, str] = {
    "TP53": "P04637",
    "KRAS": "P01116",
    "EGFR": "P00533",
    "BRAF": "P15056",
    "PIK3CA": "P42336",
    "PTEN": "P60484",
    "MYC": "P01106",
    "BRCA1": "P38398",
    "BRCA2": "P51587",
    "RB1": "P06400",
    "APC": "P25054",
    "CDKN2A": "P42771",
    "VHL": "P40337",
    "CTNNB1": "P35222",
    "NRAS": "P01111",
    "HRAS": "P01112",
    "IDH1": "O75874",
    "IDH2": "P48735",
    "FGFR1": "P11362",
    "FGFR2": "P21802",
    "FGFR3": "P22607",
    "ALK": "Q9UM73",
    "RET": "P07949",
    "MET": "P08581",
    "HER2": "P04626",
    "ESR1": "P03372",
    "AR": "P10275",
    "DNMT3A": "Q9Y6K1",
    "FLT3": "P36888",
    "NPM1": "P06748",
    "RUNX1": "Q01196",
    "JAK2": "O60674",
    "SF3B1": "O75533",
    "NOTCH1": "P46531",
    "FBXW7": "Q969H0",
    "KIT": "P10721",
    "PDGFRA": "P16234",
    "SMO": "Q99835",
    "PTCH1": "Q13635",
    "CDH1": "P12830",
    "NF1": "P21359",
    "NF2": "P35240",
    "TSC1": "Q92574",
    "TSC2": "P49815",
    # Common canine orthologs share these accessions for our purposes;
    # future work should add DogSNP-sourced canine-specific entries.
}

# Fixture pLDDT values for genes in the benchmark datasets.
# Mean pLDDT from AlphaFold DB (accessed Jan 2025).
FIXTURE_PLDDT: dict[str, float] = {
    "TP53": 79.2,
    "KRAS": 74.5,
    "EGFR": 82.1,
    "BRAF": 76.8,
    "PIK3CA": 80.3,
    "PTEN": 78.6,
    "MYC": 52.4,   # intrinsically disordered — low pLDDT expected
    "BRCA1": 58.9,
    "BRCA2": 61.2,
    "RB1": 75.4,
    "APC": 60.1,
    "CDKN2A": 68.7,
    "VHL": 83.5,
    "CTNNB1": 77.2,
    "NRAS": 73.8,
    "HER2": 84.1,
    "KIT": 81.6,
    "PDGFRA": 80.9,
    "JAK2": 79.7,
    "FLT3": 77.3,
}


async def get_alphafold_plddt(gene: str) -> Optional[float]:
    """Return mean pLDDT for a gene from the AlphaFold DB.

    Returns None if the gene is not in AlphaFold DB or the API is unreachable.
    In fixture mode returns pre-computed values without network access.
    """
    if USE_FIXTURES:
        return FIXTURE_PLDDT.get(gene.upper())

    try:
        uniprot_id = GENE_TO_UNIPROT.get(gene.upper())
        if uniprot_id is None:
            uniprot_id = await _resolve_uniprot_id(gene)
        if uniprot_id is None:
            return None
        return await _fetch_alphafold_plddt(uniprot_id)
    except Exception:
        return None


async def _resolve_uniprot_id(gene: str) -> Optional[str]:
    """Query UniProt REST API to resolve a gene name to an accession."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(
                UNIPROT_SEARCH_URL,
                params={
                    "query": f"gene_exact:{gene} AND organism_id:9606 AND reviewed:true",
                    "fields": "accession",
                    "format": "json",
                    "size": "1",
                },
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                return results[0]["primaryAccession"]
    except Exception:
        pass
    return None


async def _fetch_alphafold_plddt(uniprot_id: str) -> Optional[float]:
    """Fetch mean pLDDT for a UniProt accession from the AlphaFold DB."""
    try:
        url = f"{ALPHAFOLD_API_BASE}/prediction/{uniprot_id}"
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            entries = resp.json()
            if not entries:
                return None
            entry = entries[0]
            # AlphaFold API v4 includes meanPlddt in the metadata response.
            mean_plddt = entry.get("meanPlddt")
            if mean_plddt is not None:
                return round(float(mean_plddt), 1)
            # Fallback: download CIF and parse pLDDT from B-factor column.
            pdb_url = entry.get("pdbUrl")
            if pdb_url:
                return await _parse_plddt_from_pdb_url(client, pdb_url)
    except Exception:
        pass
    return None


async def _parse_plddt_from_pdb_url(
    client: httpx.AsyncClient, pdb_url: str
) -> Optional[float]:
    """Download PDB and extract mean pLDDT from B-factor column (first 500 ATOM lines)."""
    try:
        resp = await client.get(pdb_url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        b_factors: list[float] = []
        for i, line in enumerate(resp.text.splitlines()):
            if i > 2000:
                break
            if line.startswith("ATOM"):
                try:
                    b_factors.append(float(line[60:66].strip()))
                except ValueError:
                    continue
        if b_factors:
            return round(sum(b_factors) / len(b_factors), 1)
    except Exception:
        pass
    return None


def get_fixture_plddt(gene: str) -> Optional[float]:
    """Synchronous fixture lookup — used by tests that don't run async."""
    return FIXTURE_PLDDT.get(gene.upper())
