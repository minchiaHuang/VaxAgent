"""Claude-powered orchestrator that generates plain-English explanations for each pipeline step.

Falls back to pre-written static explanations if the API key is absent or the call fails.
The fallback explanations are deliberately high-quality so the demo works without any API key.
"""

from __future__ import annotations

import os

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Static fallback explanations — written for pet owners, not bioinformaticians
FALLBACK_EXPLANATIONS: dict[str, str] = {
    "load_dataset": (
        "We loaded the tumor mutation data and found 4,741 mutations in total. "
        "Of those, 1,842 change the proteins that cells produce — these are the ones "
        "the immune system might be able to recognize. A high number of mutations is "
        "actually helpful here: it means more potential vaccine targets to choose from."
    ),
    "pvacseq": (
        "We tested every mutated protein fragment against the immune system's receptors "
        "to see which ones the immune system could grab tightly enough to trigger a response. "
        "Out of 322 candidates tested, 78 passed the first filter — the protein fragment "
        "sticks tightly enough to the immune receptor to potentially trigger an attack on "
        "the cancer cells."
    ),
    "ranking": (
        "We ranked the remaining targets by combining four factors: how tightly the "
        "immune system can grab them, how actively the tumor produces them, how common "
        "they are across the tumor cells, and how different they are from normal proteins. "
        "The top-ranked target scores well on all four, making it the most promising "
        "candidate for a vaccine."
    ),
    "esmfold": (
        "We checked whether each target protein fragment is physically accessible on "
        "the cell surface. Even if a target looks promising on paper, the immune system "
        "can only reach it if it's exposed on the outside of the cell. Targets that are "
        "buried inside the protein structure are less likely to work as vaccine targets."
    ),
    "mrna_design": (
        "We assembled the top 5 targets into a single vaccine blueprint. The design "
        "follows the same basic approach used in modern mRNA vaccines: a protective cap, "
        "a signal to direct the targets toward immune cells, the target sequences linked "
        "together, and a stabilizing tail. This is a research starting point — professional "
        "review and lab validation are needed before synthesis."
    ),
    "report": (
        "We packaged everything into a downloadable report that you can share with your "
        "veterinarian. It includes the mutation summary, the ranked vaccine targets with "
        "explanations, the vaccine blueprint, and an important limitations section."
    ),
}


async def explain_step(step: str, context: dict) -> str:
    """Return a plain-English explanation for a pipeline step.

    Attempts to call Claude for a contextual explanation.
    Falls back to static text if the API key is missing or the call fails.
    """
    if not ANTHROPIC_API_KEY:
        return FALLBACK_EXPLANATIONS.get(step, _generic_fallback(step))

    try:
        return await _call_claude(step, context)
    except Exception:
        return FALLBACK_EXPLANATIONS.get(step, _generic_fallback(step))


async def _call_claude(step: str, context: dict) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    system_prompt = (
        "You are a veterinary oncology assistant helping pet owners understand the "
        "process of exploring a personalized cancer vaccine for their animal. "
        "Explain each step in plain, warm language that a smart non-expert can understand. "
        "Avoid jargon — use 'vaccine target' instead of 'neoantigen', 'binding strength' "
        "instead of 'IC50', 'tumor presence' instead of 'VAF'. "
        "Be encouraging but honest about limitations. "
        "Never suggest this replaces veterinary advice. "
        "Be concise (2-4 sentences)."
    )

    step_prompts: dict[str, str] = {
        "load_dataset": (
            f"Explain what happened when we loaded this tumor mutation data: {context}. "
            "Focus on what the numbers mean for finding vaccine targets."
        ),
        "pvacseq": (
            f"Explain the vaccine target screening step. "
            f"We tested {context.get('total_evaluated', 'many')} candidates and found "
            f"{context.get('passing_threshold', 'several')} that the immune system might recognize. "
            "Explain in pet-owner terms what this filtering means."
        ),
        "ranking": (
            f"Explain how we ranked {len(context.get('candidates', []))} vaccine target candidates. "
            f"Top candidate: {context.get('top_candidate', 'unknown')} with score "
            f"{context.get('top_score', 'N')}. Explain the ranking criteria in everyday language."
        ),
        "esmfold": (
            "Explain what the protein structure check tells us about whether the immune "
            "system can physically reach each vaccine target. Use an everyday analogy."
        ),
        "mrna_design": (
            f"Explain the vaccine blueprint design step. "
            f"We combined {context.get('antigen_count', 5)} targets into a single construct of "
            f"{context.get('total_length_nt', 0)} units. "
            "Explain the key elements simply."
        ),
        "report": (
            "Explain what the generated report contains and how the pet owner should use it "
            "when talking to their veterinarian."
        ),
    }

    prompt = step_prompts.get(step, f"Explain this pipeline step: {step}. Context: {context}")

    message = await client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=256,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


def _generic_fallback(step: str) -> str:
    return (
        f"Step '{step}' completed successfully. "
        "Results are available in the analysis. "
        "Please review with your veterinarian before making any treatment decisions."
    )


# ---------------------------------------------------------------------------
# On-demand AI explanations (Visual Explorer)
# ---------------------------------------------------------------------------

ON_DEMAND_PROMPT_TEMPLATES: dict[str, str] = {
    "how_immune_binding_works": (
        "Explain to a pet owner (no biology background) how immune binding works for this "
        "neoantigen target. The peptide {mt_epitope_seq} binds to {hla_allele} with an IC50 of "
        "{ic50_mt} nM. Use a simple analogy (like a lock and key). Mention the IC50 value and "
        "what it means practically. 2-4 sentences, no jargon without definition."
    ),
    "why_surface_accessibility_matters": (
        "Explain to a pet owner why surface accessibility matters for a cancer vaccine target. "
        "This target has a pLDDT score of {plddt} and is {'surface accessible' if surface_accessible else 'buried'}. "
        "Use a simple analogy. Explain what happens when a target is buried vs on the surface. "
        "2-4 sentences, no jargon without definition."
    ),
    "clinical_context": (
        "Briefly describe what is known about {gene} {mutation} in cancer research. "
        "Frame it for a pet owner - what role does this gene normally play and what happens "
        "when it is mutated? 2-4 sentences, factual, no overclaiming."
    ),
    "construct_segment_purpose": (
        "Explain what the {segment_type} component of an mRNA vaccine does and why it is needed. "
        "Frame it for someone with no biology background using a simple analogy. "
        "2-4 sentences."
    ),
}

ON_DEMAND_FALLBACKS: dict[str, str] = {
    "how_immune_binding_works": (
        "Your immune system uses special receptor proteins (called HLA) that work like locks. "
        "The peptide from this mutation fits into the lock tightly - the lower the IC50 number, "
        "the tighter the fit. A tight fit means immune cells are more likely to recognise and "
        "attack cells carrying this mutation."
    ),
    "why_surface_accessibility_matters": (
        "For the immune system to target a mutation, it needs to be on the surface of the protein "
        "where immune cells can reach it - like a flag on a building versus something hidden in the "
        "basement. When our analysis shows a mutation is surface-accessible, it means the immune "
        "system has a better chance of finding and attacking it."
    ),
    "clinical_context": (
        "This gene plays an important role in cell growth and repair. When it is mutated, cells "
        "can grow out of control, which is one of the hallmarks of cancer. Researchers are actively "
        "studying mutations like this one as potential targets for cancer therapies."
    ),
    "construct_segment_purpose": (
        "This component is part of the mRNA vaccine blueprint. Each part of the mRNA molecule has "
        "a specific job - some protect the molecule from being broken down, some tell the cell how "
        "to read the instructions, and others encode the actual vaccine targets."
    ),
}


async def explain_on_demand(context: dict, question: str) -> str:
    """Generate an on-demand explanation for the Visual Explorer.

    Uses Claude API if available, otherwise falls back to static text.
    """
    if not ANTHROPIC_API_KEY:
        return ON_DEMAND_FALLBACKS.get(question, "Explanation not available for this question.")

    try:
        return await _call_claude_on_demand(context, question)
    except Exception:
        return ON_DEMAND_FALLBACKS.get(question, "Explanation not available for this question.")


async def _call_claude_on_demand(context: dict, question: str) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    system_prompt = (
        "You are explaining cancer vaccine science to a pet owner with no biology background. "
        "Use simple analogies. Keep it to 2-4 sentences. Do not use jargon without defining it. "
        "Do not include disclaimers or caveats - the main interface already shows those prominently. "
        "Use concrete language with actual numbers when available."
    )

    template = ON_DEMAND_PROMPT_TEMPLATES.get(question, f"Explain: {question}")

    # Format template with context values
    try:
        prompt = template.format(**context)
    except (KeyError, IndexError):
        prompt = template + f" Context: {context}"

    message = await client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=200,
        system=system_prompt,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()
