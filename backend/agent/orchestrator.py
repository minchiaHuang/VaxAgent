"""Claude-powered orchestrator that generates plain-English explanations for each pipeline step.

Falls back to pre-written static explanations if the API key is absent or the call fails.
The fallback explanations are deliberately high-quality so the demo works without any API key.
"""

from __future__ import annotations

import os

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Static fallback explanations — used when Claude API is unavailable
FALLBACK_EXPLANATIONS: dict[str, str] = {
    "load_dataset": (
        "We loaded the HCC1395 benchmark dataset — a triple-negative breast cancer cell line "
        "with a well-characterised mutation profile. The dataset contains 4,741 variants, of which "
        "1,842 alter protein sequences in ways that could be visible to the immune system. "
        "This is a high mutation burden, which is typical for triple-negative breast cancer and "
        "increases the pool of potential neoantigen targets."
    ),
    "pvacseq": (
        "We ran binding predictions for every mutated protein fragment (8–11 amino acids long) "
        "against the patient's specific HLA immune receptors using MHCflurry and NetMHCpan. "
        "Of 322 initial predictions, 78 passed our IC50 threshold of 500 nM — meaning they bind "
        "the immune receptor tightly enough to be plausible targets. We then filtered for "
        "expression support and variant allele frequency, leaving 10 high-confidence candidates "
        "for the shortlist."
    ),
    "ranking": (
        "Candidates were scored using four criteria: predicted binding affinity (IC50 — lower is "
        "better), tumour gene expression (TPM — ensures the target is actually made by the tumour), "
        "variant allele frequency (VAF — higher means more tumour cells carry this mutation), and "
        "binding specificity (fold-change between mutant and wildtype — ensures we're targeting "
        "the mutation, not a normal protein). The top-ranked candidate combines the strongest "
        "binding prediction with confirmed expression and clonal presence across the tumour."
    ),
    "esmfold": (
        "We used ESMFold to predict the 3D structure of the top candidate proteins and assess "
        "whether the mutated peptide region is surface-accessible — a necessary condition for "
        "immune recognition. Peptides buried inside the protein fold are less likely to be "
        "displayed on MHC molecules. Candidates with pLDDT confidence scores above 70 are "
        "considered reliable predictions. Surface accessibility was used to further prioritise "
        "the shortlist."
    ),
    "mrna_design": (
        "We assembled a draft mRNA construct encoding the top 5 neoantigen sequences in a single "
        "molecule. The design follows the same basic architecture as the Pfizer and Moderna COVID "
        "vaccines: a 5' cap and UTR for stability, a signal peptide to direct antigens toward "
        "immune cell display, the antigen cassettes separated by GPGPG linkers, a 3' UTR, and a "
        "120-adenine poly-A tail. Codon optimisation was applied to favour codons that human cells "
        "read most efficiently. This sequence is a research preview — wet-lab validation and "
        "delivery vehicle selection are required before any further steps."
    ),
    "report": (
        "A research brief summarising all findings has been generated as a PDF. It includes the "
        "dataset summary, the ranked candidate table, plain-English rationale for the top three "
        "candidates, the mRNA construct blueprint, and an explicit limitations section. This "
        "output is intended for research discussion and collaboration — it is not a clinical "
        "recommendation, and human expert review remains required."
    ),
}


async def explain_step(step: str, context: dict) -> str:
    """Return a plain-English explanation for a pipeline step.

    Attempts to call Claude claude-3-haiku for a contextual explanation.
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
        "You are an oncology research workflow assistant. "
        "Explain computational biology pipeline steps in plain English for a mixed audience "
        "of technical researchers and non-specialist stakeholders. "
        "Be concise (2-4 sentences), accurate, and avoid overclaiming. "
        "Always note that findings require human expert review and experimental validation. "
        "Never suggest clinical use or treatment recommendations."
    )

    step_prompts: dict[str, str] = {
        "load_dataset": (
            f"Explain what happened when we loaded this tumour mutation dataset: {context}. "
            "Focus on what the numbers mean and why this step matters."
        ),
        "pvacseq": (
            f"Explain the neoantigen binding prediction step. "
            f"We evaluated {context.get('total_evaluated', 'N')} candidates and found "
            f"{context.get('passing_threshold', 'N')} passing an IC50 threshold of 500 nM. "
            "Explain what IC50 means and why this filter matters."
        ),
        "ranking": (
            f"Explain how we ranked {len(context.get('candidates', []))} neoantigen candidates. "
            f"Top candidate: {context.get('top_candidate', 'unknown')} with priority score "
            f"{context.get('top_score', 'N')}. Explain the ranking criteria."
        ),
        "esmfold": (
            "Explain what the ESMFold protein structure prediction step tells us about "
            "surface accessibility and why it matters for immune recognition."
        ),
        "mrna_design": (
            f"Explain the mRNA construct design step. "
            f"We encoded {context.get('antigen_count', 5)} antigens in a construct of "
            f"{context.get('total_length_nt', 0)} nucleotides. "
            "Explain the key design elements in plain English."
        ),
        "report": (
            "Explain what the generated research brief contains and how it should be used."
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
        f"Pipeline step '{step}' completed successfully. "
        "Results are available in the data panel. "
        "Human expert review is recommended before any downstream use."
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
