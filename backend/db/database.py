"""Async SQLite persistence layer for pipeline run history."""

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
