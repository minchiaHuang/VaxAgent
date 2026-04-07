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
async def test_enrich_candidates_does_not_override_existing_values(monkeypatch) -> None:
    from pipeline import esmfold_client

    async def fake_plddt(_sequence: str) -> tuple[float, bool]:
        return 88.6, True

    monkeypatch.setattr(esmfold_client, "get_structure_plddt", fake_plddt)

    candidates = [
        {"mt_epitope_seq": "SVVVPWEPPL", "plddt": 0.0, "surface_accessible": False},
        {"mt_epitope_seq": "IKDFSKIVSL", "plddt": 72.0, "surface_accessible": True},
    ]
    enriched = await esmfold_client.enrich_candidates_with_structure(candidates)

    assert enriched[0]["plddt"] == 88.6
    assert enriched[0]["surface_accessible"] is True
    assert enriched[1]["plddt"] == 72.0
    assert enriched[1]["surface_accessible"] is True
