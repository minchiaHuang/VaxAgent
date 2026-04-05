"""VaxAgent FastAPI backend.

Endpoints:
  GET  /health                  — liveness check
  GET  /api/runs                — list past pipeline runs
  GET  /api/runs/{run_id}       — get a specific run
  GET  /api/runs/{run_id}/report — download PDF report
  WS   /ws/pipeline             — run the full pipeline with streaming updates

WebSocket message schema:
  { "step": str, "status": "running"|"complete"|"error",
    "explanation": str, "data": dict, "run_id": str }
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
import uuid
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

load_dotenv()

from agent.orchestrator import explain_step
from db.database import create_job, get_job, get_run, init_db, list_jobs, list_runs, save_run, update_job
from pipeline.esmfold_client import enrich_candidates_with_structure
from pipeline.mrna_designer import design_construct
from pipeline.pvacseq_runner import (
    load_candidates_fixture,
    load_candidates_from_job,
    rank_candidates,
    run_pvacseq_async,
)
from pipeline.report_generator import generate_pdf
from pipeline.vcf_parser import load_variant_stats_fixture, parse_vcf_live_force

JOBS_DIR = Path(os.getenv("JOBS_DIR", Path(__file__).parent / "jobs"))
JOBS_DIR.mkdir(exist_ok=True)
PIPELINE_STEP_DELAY_SECONDS = os.getenv("PIPELINE_STEP_DELAY_SECONDS")

_docker_available: bool = False
_upload_cache_evict_task: asyncio.Task | None = None

# In-memory cache for uploaded VCF parse results keyed by file_id.
# Entries are evicted after 30 minutes via a background task.
_upload_cache: dict[str, dict] = {}

CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _docker_available, _upload_cache_evict_task

    _docker_available = shutil.which("docker") is not None
    await init_db()

    if os.getenv("DISABLE_UPLOAD_CACHE_EVICTION", "false").lower() != "true":
        _upload_cache_evict_task = asyncio.create_task(_evict_upload_cache())

    try:
        yield
    finally:
        if _upload_cache_evict_task is not None:
            _upload_cache_evict_task.cancel()
            with suppress(asyncio.CancelledError):
                await _upload_cache_evict_task
            _upload_cache_evict_task = None


app = FastAPI(
    title="VaxAgent Research Copilot API",
    description="Explainable oncology research workflow backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN] if CORS_ORIGIN != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def _evict_upload_cache() -> None:
    """Remove upload cache entries older than 30 minutes every 5 minutes."""
    while True:
        await asyncio.sleep(300)
        cutoff = datetime.now(timezone.utc).timestamp() - 1800
        stale = [k for k, v in _upload_cache.items() if v.get("_uploaded_at", 0) < cutoff]
        for k in stale:
            _upload_cache.pop(k, None)


async def _step_sleep(default_seconds: float) -> None:
    if PIPELINE_STEP_DELAY_SECONDS is None:
        await asyncio.sleep(default_seconds)
        return
    await asyncio.sleep(float(PIPELINE_STEP_DELAY_SECONDS))


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "vaxagent-backend",
        "docker": _docker_available,
    }


@app.get("/api/runs")
async def get_runs() -> JSONResponse:
    runs = await list_runs()
    return JSONResponse({"runs": runs})


@app.get("/api/runs/{run_id}")
async def get_single_run(run_id: str) -> JSONResponse:
    run = await get_run(run_id)
    if run is None:
        return JSONResponse({"error": "Run not found"}, status_code=404)
    return JSONResponse(run)


@app.get("/api/runs/{run_id}/report")
async def download_report(run_id: str) -> FileResponse:
    run = await get_run(run_id)
    if run is None:
        return JSONResponse({"error": "Run not found"}, status_code=404)

    report_path = run.get("payload", {}).get("report_path")
    if not report_path or not Path(report_path).exists():
        return JSONResponse({"error": "Report not yet generated"}, status_code=404)

    return FileResponse(
        report_path,
        media_type="application/pdf",
        filename=f"vaxagent-{run_id}.pdf",
    )


@app.post("/api/upload")
async def upload_vcf(
    vcf_file: UploadFile = File(...),
    hla_alleles: str = Form(""),
) -> JSONResponse:
    """Accept a VCF or VCF.gz upload, parse real variant statistics, and
    return a file_id that the WebSocket pipeline can use for Step 1."""

    filename = vcf_file.filename or ""
    if not (filename.endswith(".vcf") or filename.endswith(".vcf.gz")):
        return JSONResponse(
            {"error": "Only .vcf and .vcf.gz files are accepted."},
            status_code=400,
        )

    suffix = ".vcf.gz" if filename.endswith(".vcf.gz") else ".vcf"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await vcf_file.read())
        tmp_path = tmp.name

    try:
        variant_stats = parse_vcf_live_force(tmp_path)
    except Exception as exc:
        Path(tmp_path).unlink(missing_ok=True)
        return JSONResponse({"error": f"VCF parse failed: {exc}"}, status_code=422)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    alleles = [a.strip() for a in hla_alleles.split(",") if a.strip()]
    if alleles:
        variant_stats["hla_alleles"] = alleles

    variant_stats["dataset_name"] = filename
    variant_stats["source"] = "User-uploaded VCF file."

    file_id = uuid.uuid4().hex[:8]
    _upload_cache[file_id] = {
        **variant_stats,
        "_uploaded_at": datetime.now(timezone.utc).timestamp(),
    }

    return JSONResponse({"file_id": file_id, "variant_stats": variant_stats})


@app.post("/api/jobs/pvacseq")
async def submit_pvacseq_job(
    vcf_file: UploadFile = File(...),
    hla_alleles: str = Form(""),
) -> JSONResponse:
    """Accept a VCF upload and HLA alleles, start a real pVACseq Docker job."""
    if not _docker_available:
        return JSONResponse(
            {"error": "Docker is not available on this machine. pVACseq requires Docker."},
            status_code=503,
        )

    filename = vcf_file.filename or ""
    if not (filename.endswith(".vcf") or filename.endswith(".vcf.gz")):
        return JSONResponse(
            {"error": "Only .vcf and .vcf.gz files are accepted."},
            status_code=400,
        )

    alleles = [a.strip() for a in hla_alleles.split(",") if a.strip()]
    if not alleles:
        return JSONResponse(
            {"error": "At least one HLA allele is required for pVACseq."},
            status_code=400,
        )

    job_id = uuid.uuid4().hex[:8]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    suffix = ".vcf.gz" if filename.endswith(".vcf.gz") else ".vcf"
    vcf_path = str(job_dir / f"input{suffix}")
    with open(vcf_path, "wb") as f:
        f.write(await vcf_file.read())

    created_at = datetime.now(timezone.utc).isoformat()
    await create_job(job_id, created_at, filename, alleles)
    asyncio.create_task(
        run_pvacseq_async(job_id, vcf_path, alleles, str(job_dir))
    )

    return JSONResponse({"job_id": job_id, "status": "queued"})


@app.get("/api/jobs")
async def get_jobs_list() -> JSONResponse:
    jobs = await list_jobs()
    return JSONResponse({"jobs": jobs})


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str) -> JSONResponse:
    job = await get_job(job_id)
    if job is None:
        return JSONResponse({"error": "Job not found"}, status_code=404)
    return JSONResponse({
        "job_id": job["job_id"],
        "status": job["status"],
        "progress_pct": job["progress_pct"],
        "vcf_filename": job["vcf_filename"],
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
        "error_msg": job["error_msg"],
    })


# ---------------------------------------------------------------------------
# WebSocket pipeline
# ---------------------------------------------------------------------------


async def _send(ws: WebSocket, step: str, status: str, explanation: str = "", data: dict | None = None, run_id: str = "") -> None:
    await ws.send_json(
        {
            "step": step,
            "status": status,
            "explanation": explanation,
            "data": data or {},
            "run_id": run_id,
        }
    )


@app.websocket("/ws/pipeline")
async def pipeline_ws(
    websocket: WebSocket,
    dataset_id: str = "hcc1395",
    file_id: str = "",
    job_id: str = "",
) -> None:
    await websocket.accept()
    run_id = uuid.uuid4().hex[:8]

    # Resolve real pVACseq job candidates if job_id provided
    job_candidates: list[dict] | None = None
    if job_id:
        job = await get_job(job_id)
        if job is None:
            await _send(websocket, "error", "error",
                        explanation=f"Job {job_id} not found.", run_id=run_id)
            await websocket.close()
            return
        if job["status"] != "complete":
            await _send(websocket, "error", "error",
                        explanation=f"Job {job_id} is not complete yet (status: {job['status']}).",
                        run_id=run_id)
            await websocket.close()
            return
        job_candidates = load_candidates_from_job(job["result_path"])

    try:
        # ── Step 1: Load dataset ──────────────────────────────────────────
        await _send(websocket, "load_dataset", "running", run_id=run_id)
        await _step_sleep(0.3)

        if file_id and file_id in _upload_cache:
            variant_stats = {k: v for k, v in _upload_cache[file_id].items() if not k.startswith("_")}
        else:
            variant_stats = load_variant_stats_fixture(dataset_id)
        explanation = await explain_step("load_dataset", variant_stats)
        await _send(
            websocket,
            "load_dataset",
            "complete",
            explanation=explanation,
            data=variant_stats,
            run_id=run_id,
        )

        # ── Step 2: pVACseq candidate loading ────────────────────────────
        await _send(websocket, "pvacseq", "running", run_id=run_id)
        await _step_sleep(0.5)

        if job_candidates is not None:
            raw_candidates = job_candidates
            explanation = (
                f"Ran live pVACseq on your uploaded VCF file. "
                f"{len(raw_candidates)} candidates passed the IC50 binding threshold of 500 nM "
                f"and are ready for ranking."
            )
        else:
            raw_candidates = load_candidates_fixture(dataset_id)
            pvacseq_context = {
                "total_evaluated": variant_stats.get("stats", {}).get("initial_predictions", 322),
                "passing_threshold": variant_stats.get("stats", {}).get("high_confidence_candidates", 78),
            }
            if file_id and file_id in _upload_cache:
                explanation = (
                    "Neoantigen binding predictions use the HCC1395 benchmark shortlist — "
                    "running live pVACseq on an uploaded file takes 30–60 minutes and is outside "
                    "the scope of this demo. The variant summary above reflects your file."
                )
            else:
                explanation = await explain_step("pvacseq", pvacseq_context)
        await _send(
            websocket,
            "pvacseq",
            "complete",
            explanation=explanation,
            data={"candidate_count": len(raw_candidates)},
            run_id=run_id,
        )

        # ── Step 3: Rank and filter ───────────────────────────────────────
        await _send(websocket, "ranking", "running", run_id=run_id)
        await _step_sleep(0.4)

        ranked = rank_candidates(raw_candidates, top_n=10)
        top = ranked[0] if ranked else {}
        ranking_context = {
            "candidates": ranked,
            "top_candidate": f"{top.get('gene', '')} {top.get('mutation', '')}",
            "top_score": top.get("priority_score", 0),
        }
        explanation = await explain_step("ranking", ranking_context)
        await _send(
            websocket,
            "ranking",
            "complete",
            explanation=explanation,
            data={"candidates": ranked},
            run_id=run_id,
        )

        # ── Step 4: ESMFold structure enrichment ─────────────────────────
        await _send(websocket, "esmfold", "running", run_id=run_id)
        await _step_sleep(0.3)

        enriched = await enrich_candidates_with_structure(ranked[:5])
        explanation = await explain_step("esmfold", {})
        await _send(
            websocket,
            "esmfold",
            "complete",
            explanation=explanation,
            data={"enriched_count": len(enriched)},
            run_id=run_id,
        )

        # Merge enrichment back into ranked list
        enriched_map = {c["rank"]: c for c in enriched}
        for c in ranked:
            if c["rank"] in enriched_map:
                c.update({
                    k: v for k, v in enriched_map[c["rank"]].items()
                    if k in ("plddt", "surface_accessible")
                })

        # ── Step 5: mRNA construct design ────────────────────────────────
        await _send(websocket, "mrna_design", "running", run_id=run_id)
        await _step_sleep(0.4)

        blueprint = design_construct(ranked, top_n=5)
        explanation = await explain_step("mrna_design", blueprint)
        await _send(
            websocket,
            "mrna_design",
            "complete",
            explanation=explanation,
            data=blueprint,
            run_id=run_id,
        )

        # ── Step 6: PDF report ───────────────────────────────────────────
        await _send(websocket, "report", "running", run_id=run_id)
        await _step_sleep(0.3)

        # Attach explanations to top candidates before PDF generation
        for c in ranked[:3]:
            if not c.get("explanation"):
                c["explanation"] = (
                    f"{c['gene']} {c['mutation']} ranks #{c['rank']} with a priority score of "
                    f"{c['priority_score']}. Predicted binding IC50 is {c['ic50_mt']} nM "
                    f"(fold-change vs wildtype: {c['fold_change']}×). "
                    f"Gene expression is {c['gene_expression_tpm']} TPM with "
                    f"{c['clonality']} clonality (VAF {c['tumor_dna_vaf']:.0%})."
                )

        report_path = generate_pdf(run_id, variant_stats, ranked, blueprint)
        explanation = await explain_step("report", {})
        await _send(
            websocket,
            "report",
            "complete",
            explanation=explanation,
            data={"report_url": f"/api/runs/{run_id}/report"},
            run_id=run_id,
        )

        # ── Persist run ───────────────────────────────────────────────────
        summary = {
            "dataset_name": variant_stats.get("dataset_name", ""),
            "top_candidate": f"{top.get('gene', '')} {top.get('mutation', '')}",
            "candidate_count": len(ranked),
            "construct_id": blueprint.get("construct_id", ""),
        }
        payload = {
            "variant_stats": variant_stats,
            "candidates": ranked,
            "blueprint": blueprint,
            "report_path": report_path,
        }
        await save_run(
            run_id=run_id,
            dataset_id=dataset_id,
            status="complete",
            created_at=datetime.now(timezone.utc).isoformat(),
            summary=summary,
            payload=payload,
        )

        # ── Pipeline complete ─────────────────────────────────────────────
        await _send(
            websocket,
            "pipeline_complete",
            "complete",
            explanation="Pipeline completed successfully. All steps passed.",
            data={"run_id": run_id, "report_url": f"/api/runs/{run_id}/report"},
            run_id=run_id,
        )

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await _send(
            websocket,
            "error",
            "error",
            explanation=f"Pipeline error: {exc}",
            run_id=run_id,
        )
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
