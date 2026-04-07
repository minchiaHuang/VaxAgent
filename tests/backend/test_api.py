from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient


def test_benchmarks_endpoint_discovers_datasets(client: TestClient) -> None:
    response = client.get("/api/benchmarks")

    assert response.status_code == 200
    benchmarks = response.json()["benchmarks"]
    ids = [b["id"] for b in benchmarks]
    assert "hcc1395" in ids
    assert "canine-mammary" in ids

    canine = next(b for b in benchmarks if b["id"] == "canine-mammary")
    assert canine["species"] == "canine"
    assert canine["cancer_type"] == "Mammary carcinoma"
    assert canine["total_variants"] > 0

    human = next(b for b in benchmarks if b["id"] == "hcc1395")
    assert human["total_variants"] > 0


def test_health_returns_service_metadata(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "service" in response.json()
    assert "docker" in response.json()


def test_runs_endpoints_cover_empty_found_and_missing(client: TestClient, app_env) -> None:
    response = client.get("/api/runs")
    assert response.status_code == 200
    assert response.json() == {"runs": []}

    created_at = datetime.now(timezone.utc).isoformat()
    import asyncio

    asyncio.run(
        app_env.db.save_run(
            run_id="run-1",
            dataset_id="hcc1395",
            status="complete",
            created_at=created_at,
            summary={"top_candidate": "TP53 R248W"},
            payload={"report_path": "/tmp/missing.pdf"},
        )
    )

    listed = client.get("/api/runs")
    single = client.get("/api/runs/run-1")
    missing = client.get("/api/runs/missing-run")
    missing_report = client.get("/api/runs/run-1/report")

    assert listed.json()["runs"][0]["run_id"] == "run-1"
    assert single.json()["summary"]["top_candidate"] == "TP53 R248W"
    assert missing.status_code == 404
    assert missing_report.status_code == 404


def test_upload_rejects_invalid_extension(client: TestClient) -> None:
    response = client.post(
        "/api/upload",
        files={"vcf_file": ("sample.txt", b"not a vcf", "text/plain")},
    )

    assert response.status_code == 400
    assert ".vcf" in response.json()["error"]


def test_upload_parses_vcf_and_includes_hla_alleles(
    client: TestClient, sample_vcf_path
) -> None:
    with sample_vcf_path.open("rb") as fh:
        response = client.post(
            "/api/upload",
            data={"hla_alleles": "HLA-A*02:01, HLA-B*07:02"},
            files={"vcf_file": ("sample.vcf", fh, "text/plain")},
        )

    payload = response.json()

    assert response.status_code == 200
    assert payload["variant_stats"]["dataset_name"] == "sample.vcf"
    assert payload["variant_stats"]["stats"]["total_variants"] == 3
    assert payload["variant_stats"]["hla_alleles"] == ["HLA-A*02:01", "HLA-B*07:02"]


def test_upload_returns_422_when_parser_raises(app_env, sample_vcf_path) -> None:
    def boom(_path: str) -> dict:
        raise ValueError("bad file")

    app_env.main.parse_vcf_live_force = boom

    with TestClient(app_env.main.app) as client:
        with sample_vcf_path.open("rb") as fh:
            response = client.post(
                "/api/upload",
                files={"vcf_file": ("sample.vcf", fh, "text/plain")},
            )

    assert response.status_code == 422
    assert "bad file" in response.json()["error"]


def test_jobs_endpoint_returns_503_when_docker_is_unavailable(app_env, sample_vcf_path) -> None:
    with TestClient(app_env.main.app) as client:
        app_env.main._docker_available = False
        response = client.post(
            "/api/jobs/pvacseq",
            data={"hla_alleles": "HLA-A*02:01"},
            files={"vcf_file": ("sample.vcf", sample_vcf_path.read_bytes(), "text/plain")},
        )

    assert response.status_code == 503


def test_jobs_endpoint_handles_missing_hla_and_success(app_env, sample_vcf_path) -> None:
    async def fake_run(*_args, **_kwargs) -> None:
        return None

    app_env.main._docker_available = True
    app_env.main.run_pvacseq_async = fake_run

    with TestClient(app_env.main.app) as client:
        invalid_file = client.post(
            "/api/jobs/pvacseq",
            data={"hla_alleles": "HLA-A*02:01"},
            files={"vcf_file": ("sample.txt", b"bad", "text/plain")},
        )
        no_hla = client.post(
            "/api/jobs/pvacseq",
            data={"hla_alleles": ""},
            files={"vcf_file": ("sample.vcf", sample_vcf_path.read_bytes(), "text/plain")},
        )
        success = client.post(
            "/api/jobs/pvacseq",
            data={"hla_alleles": "HLA-A*02:01"},
            files={"vcf_file": ("sample.vcf", sample_vcf_path.read_bytes(), "text/plain")},
        )

        jobs = client.get("/api/jobs")
        job_id = success.json()["job_id"]
        fetched = client.get(f"/api/jobs/{job_id}")
        missing = client.get("/api/jobs/missing")

    assert invalid_file.status_code == 400
    assert no_hla.status_code == 400
    assert success.status_code == 200
    assert success.json()["status"] == "queued"
    assert jobs.json()["jobs"][0]["job_id"] == job_id
    assert fetched.status_code == 200
    assert missing.status_code == 404
