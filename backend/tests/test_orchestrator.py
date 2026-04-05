from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_explain_step_uses_static_fallback_without_api_key(monkeypatch) -> None:
    from agent import orchestrator

    monkeypatch.setattr(orchestrator, "ANTHROPIC_API_KEY", "")

    text = await orchestrator.explain_step("ranking", {})

    assert "Candidates were scored" in text


@pytest.mark.asyncio
async def test_explain_step_falls_back_when_claude_call_fails(monkeypatch) -> None:
    from agent import orchestrator

    async def raise_error(_step: str, _context: dict) -> str:
        raise RuntimeError("boom")

    monkeypatch.setattr(orchestrator, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(orchestrator, "_call_claude", raise_error)

    text = await orchestrator.explain_step("report", {})

    assert "research brief" in text.lower()


@pytest.mark.asyncio
async def test_generic_fallback_handles_unknown_step(monkeypatch) -> None:
    from agent import orchestrator

    monkeypatch.setattr(orchestrator, "ANTHROPIC_API_KEY", "")

    text = await orchestrator.explain_step("unknown_step", {})

    assert "unknown_step" in text
