from __future__ import annotations

from datetime import datetime, timezone

import pytest


@pytest.mark.asyncio
async def test_run_persistence_round_trip(app_env) -> None:
    await app_env.db.init_db()

    created_at = datetime.now(timezone.utc).isoformat()
    await app_env.db.save_run(
        run_id="run-1",
        dataset_id="hcc1395",
        status="complete",
        created_at=created_at,
        summary={"top_candidate": "TP53 R248W"},
        payload={"report_path": "/tmp/report.pdf"},
    )

    runs = await app_env.db.list_runs()
    run = await app_env.db.get_run("run-1")

    assert len(runs) == 1
    assert runs[0]["summary"]["top_candidate"] == "TP53 R248W"
    assert run["payload"]["report_path"] == "/tmp/report.pdf"


@pytest.mark.asyncio
async def test_job_helpers_round_trip(app_env) -> None:
    await app_env.db.init_db()

    created_at = datetime.now(timezone.utc).isoformat()
    await app_env.db.create_job("job-1", created_at, "sample.vcf", ["HLA-A*02:01"])
    await app_env.db.update_job(
        "job-1",
        datetime.now(timezone.utc).isoformat(),
        status="complete",
        progress_pct=100,
        result_path="/tmp/candidates.json",
    )

    job = await app_env.db.get_job("job-1")
    jobs = await app_env.db.list_jobs()

    assert job["status"] == "complete"
    assert job["hla_alleles"] == ["HLA-A*02:01"]
    assert jobs[0]["job_id"] == "job-1"
