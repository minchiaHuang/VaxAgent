from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient


def _dummy_pdf(path: Path) -> None:
    path.write_bytes(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n")


def _collect_messages(ws) -> list[dict]:
    messages = []
    while True:
        message = ws.receive_json()
        messages.append(message)
        if message["step"] in {"pipeline_complete", "error"}:
            break
    return messages


def test_pipeline_websocket_happy_path_persists_run(app_env) -> None:
    async def fake_explain(step: str, _context: dict) -> str:
        return f"{step} explained"

    async def fake_enrich(candidates: list[dict]) -> list[dict]:
        for candidate in candidates:
            candidate.setdefault("plddt", 75.0)
            candidate.setdefault("surface_accessible", True)
        return candidates

    def fake_generate_pdf(run_id: str, _variant_stats: dict, _candidates: list[dict], _blueprint: dict) -> str:
        report_path = app_env.reports_dir / f"{run_id}.pdf"
        _dummy_pdf(report_path)
        return str(report_path)

    app_env.main.explain_step = fake_explain
    app_env.main.enrich_candidates_with_structure = fake_enrich
    app_env.main.generate_pdf = fake_generate_pdf

    with TestClient(app_env.main.app) as client:
        with client.websocket_connect("/ws/pipeline") as ws:
            messages = _collect_messages(ws)

        steps = [message["step"] for message in messages]
        run_id = messages[-1]["run_id"]
        report = client.get(f"/api/runs/{run_id}/report")
        runs = client.get("/api/runs").json()["runs"]

    assert steps == [
        "load_dataset",
        "load_dataset",
        "pvacseq",
        "pvacseq",
        "ranking",
        "ranking",
        "esmfold",
        "esmfold",
        "mrna_design",
        "mrna_design",
        "report",
        "report",
        "pipeline_complete",
    ]
    assert report.status_code == 200
    assert runs[0]["run_id"] == run_id


def test_pipeline_uses_uploaded_file_cache(app_env) -> None:
    async def fake_explain(step: str, _context: dict) -> str:
        return f"{step} explained"

    def fake_generate_pdf(run_id: str, _variant_stats: dict, _candidates: list[dict], _blueprint: dict) -> str:
        report_path = app_env.reports_dir / f"{run_id}.pdf"
        _dummy_pdf(report_path)
        return str(report_path)

    app_env.main.explain_step = fake_explain
    app_env.main.generate_pdf = fake_generate_pdf
    app_env.main._upload_cache["file-1"] = {
        "dataset_id": "custom",
        "dataset_name": "uploaded.vcf",
        "source": "User-uploaded VCF file.",
        "tumor_type": "Unknown",
        "hla_alleles": ["HLA-A*02:01"],
        "stats": {
            "total_variants": 3,
            "somatic_snvs": 2,
            "missense_mutations": 1,
            "frameshift_indels": 1,
            "initial_predictions": 0,
            "high_confidence_candidates": 0,
            "shortlisted_candidates": 0,
        },
        "_uploaded_at": datetime.now(timezone.utc).timestamp(),
    }

    with TestClient(app_env.main.app) as client:
        with client.websocket_connect("/ws/pipeline?file_id=file-1") as ws:
            messages = _collect_messages(ws)

    load_complete = next(
        message
        for message in messages
        if message["step"] == "load_dataset" and message["status"] == "complete"
    )
    assert load_complete["data"]["dataset_name"] == "uploaded.vcf"
    assert load_complete["data"]["stats"]["total_variants"] == 3


def test_pipeline_returns_error_for_missing_or_incomplete_job(app_env) -> None:
    with TestClient(app_env.main.app) as client:
        with client.websocket_connect("/ws/pipeline?job_id=missing") as ws:
            missing = ws.receive_json()

        created_at = datetime.now(timezone.utc).isoformat()
        asyncio.run(app_env.db.create_job("job-1", created_at, "sample.vcf", ["HLA-A*02:01"]))
        with client.websocket_connect("/ws/pipeline?job_id=job-1") as ws:
            incomplete = ws.receive_json()

    assert missing["status"] == "error"
    assert "not found" in missing["explanation"]
    assert incomplete["status"] == "error"
    assert "not complete yet" in incomplete["explanation"]


def test_pipeline_uses_completed_job_candidates(app_env) -> None:
    async def fake_explain(step: str, _context: dict) -> str:
        return f"{step} explained"

    def fake_generate_pdf(run_id: str, _variant_stats: dict, _candidates: list[dict], _blueprint: dict) -> str:
        report_path = app_env.reports_dir / f"{run_id}.pdf"
        _dummy_pdf(report_path)
        return str(report_path)

    app_env.main.explain_step = fake_explain
    app_env.main.generate_pdf = fake_generate_pdf

    created_at = datetime.now(timezone.utc).isoformat()
    result_path = app_env.jobs_dir / "candidates.json"
    result_path.write_text(
        json.dumps(
            [
                {
                    "rank": 1,
                    "gene": "TP53",
                    "mutation": "R248W",
                    "mt_epitope_seq": "SVVVPWEPPL",
                    "hla_allele": "HLA-A*29:02",
                    "ic50_mt": 45.2,
                    "fold_change": 217.7,
                    "gene_expression_tpm": 38.2,
                    "tumor_dna_vaf": 0.48,
                    "clonality": "clonal",
                    "priority_score": 94,
                    "surface_accessible": True,
                    "plddt": 82.4,
                }
            ]
        )
    )

    with TestClient(app_env.main.app) as client:
        asyncio.run(app_env.db.create_job("job-2", created_at, "sample.vcf", ["HLA-A*02:01"]))
        asyncio.run(
            app_env.db.update_job(
                "job-2",
                created_at,
                status="complete",
                progress_pct=100,
                result_path=str(result_path),
            )
        )

        with client.websocket_connect("/ws/pipeline?job_id=job-2") as ws:
            messages = _collect_messages(ws)

    pvacseq_complete = next(
        message
        for message in messages
        if message["step"] == "pvacseq" and message["status"] == "complete"
    )
    ranking_complete = next(
        message
        for message in messages
        if message["step"] == "ranking" and message["status"] == "complete"
    )

    assert pvacseq_complete["data"]["candidate_count"] == 1
    assert ranking_complete["data"]["candidates"][0]["gene"] == "TP53"
