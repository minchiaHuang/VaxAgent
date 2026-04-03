"""Async SQLite persistence layer for pipeline run history and pVACseq jobs."""

from __future__ import annotations

import json
import os
from pathlib import Path

import aiosqlite

DB_PATH = os.getenv("DB_PATH", "vaxagent.db")


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                run_id      TEXT PRIMARY KEY,
                dataset_id  TEXT NOT NULL,
                status      TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                summary     TEXT,
                payload     TEXT
            )
            """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                job_id        TEXT PRIMARY KEY,
                status        TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL,
                vcf_filename  TEXT,
                hla_alleles   TEXT,
                progress_pct  INTEGER DEFAULT 0,
                result_path   TEXT,
                error_msg     TEXT
            )
            """
        )
        await db.commit()


async def save_run(
    run_id: str,
    dataset_id: str,
    status: str,
    created_at: str,
    summary: dict,
    payload: dict,
) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO runs
                (run_id, dataset_id, status, created_at, summary, payload)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                dataset_id,
                status,
                created_at,
                json.dumps(summary),
                json.dumps(payload),
            ),
        )
        await db.commit()


async def list_runs() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT run_id, dataset_id, status, created_at, summary FROM runs ORDER BY created_at DESC LIMIT 20"
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                {
                    "run_id": row["run_id"],
                    "dataset_id": row["dataset_id"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "summary": json.loads(row["summary"] or "{}"),
                }
                for row in rows
            ]


# ---------------------------------------------------------------------------
# pVACseq job helpers
# ---------------------------------------------------------------------------


async def create_job(
    job_id: str,
    created_at: str,
    vcf_filename: str,
    hla_alleles: list[str],
) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO jobs (job_id, status, created_at, updated_at, vcf_filename, hla_alleles, progress_pct)
            VALUES (?, 'queued', ?, ?, ?, ?, 0)
            """,
            (job_id, created_at, created_at, vcf_filename, json.dumps(hla_alleles)),
        )
        await db.commit()


async def update_job(
    job_id: str,
    updated_at: str,
    status: str | None = None,
    progress_pct: int | None = None,
    result_path: str | None = None,
    error_msg: str | None = None,
) -> None:
    fields: list[str] = ["updated_at = ?"]
    values: list = [updated_at]
    if status is not None:
        fields.append("status = ?")
        values.append(status)
    if progress_pct is not None:
        fields.append("progress_pct = ?")
        values.append(progress_pct)
    if result_path is not None:
        fields.append("result_path = ?")
        values.append(result_path)
    if error_msg is not None:
        fields.append("error_msg = ?")
        values.append(error_msg)
    values.append(job_id)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE jobs SET {', '.join(fields)} WHERE job_id = ?", values
        )
        await db.commit()


async def get_job(job_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)) as cur:
            row = await cur.fetchone()
            if row is None:
                return None
            return {
                "job_id": row["job_id"],
                "status": row["status"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "vcf_filename": row["vcf_filename"],
                "hla_alleles": json.loads(row["hla_alleles"] or "[]"),
                "progress_pct": row["progress_pct"],
                "result_path": row["result_path"],
                "error_msg": row["error_msg"],
            }


async def list_jobs() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT job_id, status, created_at, updated_at, vcf_filename, progress_pct "
            "FROM jobs ORDER BY created_at DESC LIMIT 20"
        ) as cur:
            rows = await cur.fetchall()
            return [
                {
                    "job_id": row["job_id"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "vcf_filename": row["vcf_filename"],
                    "progress_pct": row["progress_pct"],
                }
                for row in rows
            ]


async def get_run(run_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM runs WHERE run_id = ?", (run_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            return {
                "run_id": row["run_id"],
                "dataset_id": row["dataset_id"],
                "status": row["status"],
                "created_at": row["created_at"],
                "summary": json.loads(row["summary"] or "{}"),
                "payload": json.loads(row["payload"] or "{}"),
            }
