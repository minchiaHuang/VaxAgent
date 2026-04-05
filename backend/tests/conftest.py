from __future__ import annotations

import gzip
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture
def sample_vcf_text() -> str:
    return "\n".join(
        [
            "##fileformat=VCFv4.2",
            "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tTUMOR",
            "1\t100\t.\tA\tT\t.\tPASS\tCSQ=T|missense_variant;SOMATIC\tGT\t0/1",
            "1\t200\t.\tG\tGA\t.\tPASS\tCSQ=GA|frameshift_variant\tGT\t0/1",
            "1\t300\t.\tC\tG\t.\tPASS\tSOMATIC\tGT\t0/1",
        ]
    )


@pytest.fixture
def sample_vcf_path(tmp_path: Path, sample_vcf_text: str) -> Path:
    path = tmp_path / "sample.vcf"
    path.write_text(sample_vcf_text)
    return path


@pytest.fixture
def sample_vcfgz_path(tmp_path: Path, sample_vcf_text: str) -> Path:
    path = tmp_path / "sample.vcf.gz"
    with gzip.open(path, "wt") as fh:
        fh.write(sample_vcf_text)
    return path


@pytest.fixture
def app_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    db_path = tmp_path / "test.db"
    reports_dir = tmp_path / "reports"
    jobs_dir = tmp_path / "jobs"
    reports_dir.mkdir()
    jobs_dir.mkdir()

    monkeypatch.setenv("DB_PATH", str(db_path))
    monkeypatch.setenv("REPORTS_DIR", str(reports_dir))
    monkeypatch.setenv("JOBS_DIR", str(jobs_dir))
    monkeypatch.setenv("USE_FIXTURES", "true")
    monkeypatch.setenv("DISABLE_UPLOAD_CACHE_EVICTION", "true")
    monkeypatch.setenv("PIPELINE_STEP_DELAY_SECONDS", "0")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")

    module_names = [
        "db.database",
        "pipeline.report_generator",
        "pipeline.vcf_parser",
        "pipeline.pvacseq_runner",
        "pipeline.esmfold_client",
        "agent.orchestrator",
        "main",
    ]
    modules = {
        name: importlib.reload(importlib.import_module(name))
        for name in module_names
    }

    modules["main"]._upload_cache = {}

    return SimpleNamespace(
        db=modules["db.database"],
        report_generator=modules["pipeline.report_generator"],
        vcf_parser=modules["pipeline.vcf_parser"],
        pvacseq_runner=modules["pipeline.pvacseq_runner"],
        esmfold_client=modules["pipeline.esmfold_client"],
        orchestrator=modules["agent.orchestrator"],
        main=modules["main"],
        db_path=db_path,
        reports_dir=reports_dir,
        jobs_dir=jobs_dir,
    )


@pytest.fixture
def client(app_env: SimpleNamespace) -> TestClient:
    with TestClient(app_env.main.app) as test_client:
        yield test_client
