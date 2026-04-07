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


@pytest.mark.asyncio
async def test_explain_on_demand_returns_fallback_without_api_key(monkeypatch) -> None:
    from agent import orchestrator

    monkeypatch.setattr(orchestrator, "ANTHROPIC_API_KEY", "")

    text = await orchestrator.explain_on_demand(
        {"gene": "TP53", "mutation": "R248W"},
        "how_immune_binding_works"
    )

    assert "immune" in text.lower() or "receptor" in text.lower() or "hla" in text.lower()


@pytest.mark.asyncio
async def test_explain_on_demand_handles_unknown_question(monkeypatch) -> None:
    from agent import orchestrator

    monkeypatch.setattr(orchestrator, "ANTHROPIC_API_KEY", "")

    text = await orchestrator.explain_on_demand({}, "unknown_question_key")

    assert "not available" in text.lower()


@pytest.mark.asyncio
async def test_explain_on_demand_falls_back_on_api_failure(monkeypatch) -> None:
    from agent import orchestrator

    async def raise_error(_ctx: dict, _q: str) -> str:
        raise RuntimeError("boom")

    monkeypatch.setattr(orchestrator, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(orchestrator, "_call_claude_on_demand", raise_error)

    text = await orchestrator.explain_on_demand(
        {},
        "why_surface_accessibility_matters"
    )

    assert "surface" in text.lower()
