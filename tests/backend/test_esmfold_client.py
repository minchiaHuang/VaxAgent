from __future__ import annotations

import pytest


def test_parse_plddt_from_pdb() -> None:
    from pipeline.esmfold_client import _parse_plddt_from_pdb

    pdb_text = (
        "ATOM      1  N   ASN A   1      11.104  13.207   8.951  1.00 80.00           N\n"
        "ATOM      2  CA  ASN A   1      12.560  13.304   8.845  1.00 70.00           C\n"
    )

    assert _parse_plddt_from_pdb(pdb_text) == 75.0


def test_heuristics_return_reasonable_defaults() -> None:
    from pipeline.esmfold_client import _estimate_plddt_heuristic, _estimate_surface

    assert 40.0 <= _estimate_plddt_heuristic("SVVVPWEPPL") <= 92.0
    assert _estimate_surface("STNQKRD") is True
    assert _estimate_surface("") is False


@pytest.mark.asyncio
async def test_get_structure_plddt_uses_alphafold_tier_for_known_gene(monkeypatch) -> None:
    """AlphaFold tier should be used when gene is in the fixture table."""
    from pipeline import esmfold_client

    monkeypatch.setenv("USE_FIXTURES", "true")

    plddt, surface, source = await esmfold_client.get_structure_plddt("SVVVPWEPPL", gene="TP53")

    assert source == "alphafold"
    assert plddt == 79.2  # fixture value for TP53
    assert isinstance(surface, bool)


@pytest.mark.asyncio
async def test_get_structure_plddt_falls_back_to_heuristic_for_unknown_gene(monkeypatch) -> None:
    """Unknown gene in fixture mode should fall back to heuristic."""
    from pipeline import esmfold_client

    monkeypatch.setenv("USE_FIXTURES", "true")

    plddt, surface, source = await esmfold_client.get_structure_plddt(
        "SVVVPWEPPL", gene="UNKNOWN_GENE_XYZ"
    )

    assert source == "heuristic"
    assert 40.0 <= plddt <= 92.0


@pytest.mark.asyncio
async def test_get_structure_plddt_uses_heuristic_when_no_gene(monkeypatch) -> None:
    """No gene name provided — should fall back to heuristic in fixture mode."""
    from pipeline import esmfold_client

    monkeypatch.setenv("USE_FIXTURES", "true")

    plddt, surface, source = await esmfold_client.get_structure_plddt("SVVVPWEPPL")

    assert source == "heuristic"
    assert 40.0 <= plddt <= 92.0


@pytest.mark.asyncio
async def test_enrich_candidates_does_not_override_existing_plddt(monkeypatch) -> None:
    """Existing non-zero pLDDT values must not be overwritten by enrichment."""
    from pipeline import esmfold_client

    async def fake_plddt(sequence: str, gene=None) -> tuple[float, bool, str]:
        return 88.6, True, "alphafold"

    monkeypatch.setattr(esmfold_client, "get_structure_plddt", fake_plddt)

    candidates = [
        {"mt_epitope_seq": "SVVVPWEPPL", "gene": "TP53", "plddt": 0.0, "surface_accessible": False},
        {"mt_epitope_seq": "IKDFSKIVSL", "gene": "PIK3CA", "plddt": 72.0, "surface_accessible": True},
    ]
    enriched = await esmfold_client.enrich_candidates_with_structure(candidates)

    assert enriched[0]["plddt"] == 88.6
    assert enriched[0]["surface_accessible"] is True
    assert enriched[0]["structure_source"] == "alphafold"
    # pre-existing plddt preserved
    assert enriched[1]["plddt"] == 72.0
    assert enriched[1]["surface_accessible"] is True
    # structure_source still recorded
    assert enriched[1]["structure_source"] == "alphafold"


@pytest.mark.asyncio
async def test_enrich_candidates_sets_structure_source() -> None:
    """structure_source field is always populated after enrichment."""
    from pipeline import esmfold_client

    candidates = [
        {"mt_epitope_seq": "SVVVPWEPPL", "gene": "TP53"},
        {"mt_epitope_seq": "XXXXXXXXXXX", "gene": "NOT_IN_DB"},
    ]
    enriched = await esmfold_client.enrich_candidates_with_structure(candidates)

    for c in enriched:
        assert "structure_source" in c
        assert c["structure_source"] in ("alphafold", "esmfold", "heuristic")
