"""Tests for the MHC binding predictor (pipeline.mhc_predictor)."""
from __future__ import annotations

import pytest


def _make_candidates(n: int = 3) -> list[dict]:
    return [
        {
            "rank": i + 1,
            "gene": "TP53",
            "mt_epitope_seq": "SVVVPWEPPL",
            "wt_epitope_seq": "SVVVPREPPL",
            "hla_allele": "HLA-A*29:02",
            "ic50_mt": 45.2,
            "ic50_wt": 9840.5,
            "fold_change": 217.7,
        }
        for i in range(n)
    ]


def test_predict_binding_fixture_mode_tags_all_candidates(monkeypatch) -> None:
    from pipeline import mhc_predictor

    monkeypatch.setattr(mhc_predictor, "USE_FIXTURES", True)

    candidates = _make_candidates(3)
    result = mhc_predictor.predict_binding_for_candidates(candidates)

    assert all(c["ic50_source"] == "fixture" for c in result)


def test_predict_binding_empty_list_returns_empty(monkeypatch) -> None:
    from pipeline import mhc_predictor

    monkeypatch.setattr(mhc_predictor, "USE_FIXTURES", False)

    result = mhc_predictor.predict_binding_for_candidates([])
    assert result == []


def test_predict_binding_falls_back_to_fixture_when_mhcflurry_unavailable(
    monkeypatch,
) -> None:
    from pipeline import mhc_predictor

    monkeypatch.setattr(mhc_predictor, "USE_FIXTURES", False)
    monkeypatch.setattr(mhc_predictor, "is_mhcflurry_available", lambda: False)

    candidates = _make_candidates(2)
    result = mhc_predictor.predict_binding_for_candidates(candidates)

    assert all(c["ic50_source"] == "fixture" for c in result)


def test_predict_binding_uses_mhcflurry_when_available(monkeypatch) -> None:
    from pipeline import mhc_predictor

    monkeypatch.setattr(mhc_predictor, "USE_FIXTURES", False)
    monkeypatch.setattr(mhc_predictor, "is_mhcflurry_available", lambda: True)

    def fake_enrich(candidates, hla_alleles):
        for c in candidates:
            c["ic50_mt"] = 30.0
            c["ic50_wt"] = 6000.0
            c["fold_change"] = 200.0
            c["ic50_source"] = "mhcflurry"
        return candidates

    monkeypatch.setattr(mhc_predictor, "_enrich_with_mhcflurry", fake_enrich)

    candidates = _make_candidates(2)
    result = mhc_predictor.predict_binding_for_candidates(
        candidates, hla_alleles=["HLA-A*02:01"]
    )

    assert all(c["ic50_source"] == "mhcflurry" for c in result)
    assert result[0]["ic50_mt"] == 30.0


def test_predict_binding_falls_back_if_mhcflurry_raises(monkeypatch) -> None:
    from pipeline import mhc_predictor

    monkeypatch.setattr(mhc_predictor, "USE_FIXTURES", False)
    monkeypatch.setattr(mhc_predictor, "is_mhcflurry_available", lambda: True)

    def boom(candidates, hla_alleles):
        raise RuntimeError("MHCflurry model not loaded")

    monkeypatch.setattr(mhc_predictor, "_enrich_with_mhcflurry", boom)

    candidates = _make_candidates(2)
    result = mhc_predictor.predict_binding_for_candidates(candidates)

    assert all(c["ic50_source"] == "fixture" for c in result)


def test_is_mhcflurry_available_returns_false_when_not_installed(monkeypatch) -> None:
    """Simulate mhcflurry not installed — importlib.util.find_spec returns None."""
    import importlib.util
    from pipeline import mhc_predictor

    original_find_spec = importlib.util.find_spec

    def fake_find_spec(name, *args, **kwargs):
        if name == "mhcflurry":
            return None
        return original_find_spec(name, *args, **kwargs)

    monkeypatch.setattr(importlib.util, "find_spec", fake_find_spec)

    assert mhc_predictor.is_mhcflurry_available() is False


@pytest.mark.asyncio
async def test_run_mhcflurry_job_async_completes_with_fixture(
    app_env, tmp_path
) -> None:
    """MHCflurry job async runner should complete and write a candidates file."""
    import json
    from datetime import datetime, timezone
    from pathlib import Path

    from pipeline import mhc_predictor

    # Ensure DB tables exist (lifespan not triggered outside TestClient context)
    await app_env.db.init_db()

    job_id = "test-mhc-01"
    created_at = datetime.now(timezone.utc).isoformat()
    await app_env.db.create_job(job_id, created_at, "test.vcf", ["HLA-A*02:01"])

    await mhc_predictor.run_mhcflurry_job_async(
        job_id=job_id,
        vcf_path=str(tmp_path / "input.vcf"),
        hla_alleles=["HLA-A*02:01"],
        output_dir=str(tmp_path),
        dataset_id="hcc1395",
    )

    job = await app_env.db.get_job(job_id)
    assert job["status"] == "complete"
    assert job["progress_pct"] == 100

    result = json.loads((tmp_path / "candidates.json").read_text())
    assert isinstance(result, list)
    assert len(result) > 0
    assert all("ic50_source" in c for c in result)
