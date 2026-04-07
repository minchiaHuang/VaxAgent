"""Tests for the AlphaFold DB client (pipeline.alphafold_client)."""
from __future__ import annotations

import pytest


def test_fixture_returns_known_gene_plddt() -> None:
    from pipeline.alphafold_client import get_fixture_plddt

    assert get_fixture_plddt("TP53") == 79.2
    assert get_fixture_plddt("KRAS") == 74.5
    assert get_fixture_plddt("HER2") == 84.1


def test_fixture_returns_none_for_unknown_gene() -> None:
    from pipeline.alphafold_client import get_fixture_plddt

    assert get_fixture_plddt("UNKNOWN_GENE_XYZ") is None


def test_gene_to_uniprot_contains_common_cancer_genes() -> None:
    from pipeline.alphafold_client import GENE_TO_UNIPROT

    required = ["TP53", "KRAS", "EGFR", "BRAF", "PIK3CA", "PTEN", "BRCA1", "BRCA2"]
    for gene in required:
        assert gene in GENE_TO_UNIPROT, f"{gene} missing from GENE_TO_UNIPROT"


@pytest.mark.asyncio
async def test_get_alphafold_plddt_fixture_mode_known_gene(monkeypatch) -> None:
    """In fixture mode, known genes return pre-computed pLDDT without API calls."""
    from pipeline import alphafold_client

    monkeypatch.setattr(alphafold_client, "USE_FIXTURES", True)

    result = await alphafold_client.get_alphafold_plddt("TP53")
    assert result == 79.2


@pytest.mark.asyncio
async def test_get_alphafold_plddt_fixture_mode_unknown_gene(monkeypatch) -> None:
    """Unknown genes return None in fixture mode (no network call)."""
    from pipeline import alphafold_client

    monkeypatch.setattr(alphafold_client, "USE_FIXTURES", True)

    result = await alphafold_client.get_alphafold_plddt("NOVEL_GENE_ABC")
    assert result is None


@pytest.mark.asyncio
async def test_get_alphafold_plddt_live_mode_returns_none_on_error(monkeypatch) -> None:
    """Live mode that fails network call should return None gracefully."""
    from pipeline import alphafold_client

    monkeypatch.setattr(alphafold_client, "USE_FIXTURES", False)

    async def boom(*_args, **_kwargs):
        raise RuntimeError("network error")

    monkeypatch.setattr(alphafold_client, "_fetch_alphafold_plddt", boom)
    monkeypatch.setattr(alphafold_client, "_resolve_uniprot_id", boom)

    result = await alphafold_client.get_alphafold_plddt("TP53")
    assert result is None


@pytest.mark.asyncio
async def test_get_alphafold_plddt_live_known_gene_skips_uniprot_lookup(monkeypatch) -> None:
    """Known genes in GENE_TO_UNIPROT skip the UniProt API lookup in live mode."""
    from pipeline import alphafold_client

    monkeypatch.setattr(alphafold_client, "USE_FIXTURES", False)

    uniprot_calls: list[str] = []

    async def fake_resolve(gene: str):
        uniprot_calls.append(gene)
        return None  # should not be called for known genes

    async def fake_fetch(uniprot_id: str):
        return 79.2

    monkeypatch.setattr(alphafold_client, "_resolve_uniprot_id", fake_resolve)
    monkeypatch.setattr(alphafold_client, "_fetch_alphafold_plddt", fake_fetch)

    result = await alphafold_client.get_alphafold_plddt("TP53")

    assert result == 79.2
    assert uniprot_calls == [], "UniProt search should be skipped for known genes"


def test_fixture_plddt_values_in_valid_range() -> None:
    from pipeline.alphafold_client import FIXTURE_PLDDT

    for gene, plddt in FIXTURE_PLDDT.items():
        assert 0 <= plddt <= 100, f"{gene} pLDDT {plddt} out of [0, 100]"
