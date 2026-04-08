  # VaxAgent 5-Step Visual Storyboard Draft

This document is a review artifact, not a production spec. Its job is to make the scientific story legible before any formal UI build starts.

## Review Goals

- Make the 5 scientific steps feel visually distinct
- Keep one hero data point per step
- Show what stays on the main canvas versus what gets pushed into disclosure
- Prevent the experience from collapsing back into a generic results browser

## Wizard Mapping

- Current `Step 1 Diagnosis`: unchanged
- Current `Step 2 Upload`: scientific `STEP 1 sequence / detection` and `STEP 2 fragment generation`
- Current `Step 3 Understand`: scientific `STEP 3 fit / mismatch`
- Current `Step 4 Blueprint`: scientific `STEP 4 ranking / funnel` and `STEP 5 blueprint / assembly`
- Current `Step 5 Discuss`: handoff only

## Storyboard

### Current Step 2A / Scientific Step 1

**Title**
Sequence / Detection

**Purpose**
Show exactly where the tumor sequence diverges from the normal sequence.

**Main visual**
Two aligned sequence rails, `normal` above and `tumor` below, with one mutation position highlighted by a single marker.

**What the user sees first**
A calm side-by-side comparison with one changed base or amino-acid position called out.

**What the user sees second**
A short note that this one change is the origin point for the downstream vaccine-target search.

**Hero data**
The mutation itself.

**Secondary evidence**
Gene name, mutation label, species or allele context.

**Disclosure only**
Raw VCF details, parser logs, benchmark caveats.

**Do not do**
Do not start with upload mechanics, long status text, or ranking language.

### Current Step 2B / Scientific Step 2

**Title**
Fragment Generation

**Purpose**
Show how one mutation turns into overlapping candidate peptide fragments.

**Main visual**
A sequence strip centered on the mutation, with multiple overlapping windows cut across it; one window is retained as the selected candidate peptide.

**What the user sees first**
The mutation-centered sequence context.

**What the user sees second**
Four or five overlapping fragments, ending with one selected peptide card.

**Hero data**
The chosen mutant peptide sequence.

**Secondary evidence**
Fragment length, number of windows, mutant versus wild-type context.

**Disclosure only**
Sliding-window implementation details, technical filtering rules.

**Do not do**
Do not introduce MHC fit or ranking here.

### Current Step 3 / Scientific Step 3

**Title**
Fit / Mismatch

**Purpose**
Explain whether the selected peptide can plausibly fit into the immune receptor groove.

**Main visual**
A simplified MHC groove as a stable slot, with the peptide rendered as a segmented ribbon. Anchor positions use three states: `fit`, `partial`, `mismatch`.

**What the user sees first**
The peptide entering the groove and the fit state coloring.

**What the user sees second**
One sentence connecting that visual pattern to the binding label or IC50 result.

**Hero data**
Fit state across anchor points.

**Secondary evidence**
HLA or DLA allele, IC50 bucket, fold-change.

**Disclosure only**
Model provenance, predictor engine, structure confidence notes.

**Do not do**
Do not make this look like a realistic protein render or a structural-biology tool.

### Current Step 4A / Scientific Step 4

**Title**
Ranking / Funnel

**Purpose**
Explain why some candidates survive prioritization and others fall away.

**Main visual**
A funnel or tiered reduction view showing many candidates narrowing into a top set via four criteria: binding, expression, clonality, specificity.

**What the user sees first**
The narrowing motion from many candidates to a small ranked set.

**What the user sees second**
A flat comparison strip showing the top few survivors.

**Hero data**
Why the winner remains after filtering.

**Secondary evidence**
Score pillars, top-3 comparison, shortlist count.

**Disclosure only**
Weighting formulas, raw ranking tables, lower-ranked candidates.

**Do not do**
Do not start with a long list of cards or open with the final score alone.

### Current Step 4B / Scientific Step 5

**Title**
Blueprint / Assembly

**Purpose**
Show how selected targets become one mRNA construct.

**Main visual**
A left-to-right assembly line where selected target blocks are ordered, linked, and wrapped by support segments into one construct.

**What the user sees first**
The selected targets as ordered building blocks.

**What the user sees second**
The support segments, linkers, and final assembled mRNA blueprint.

**Hero data**
The ordered target cassette.

**Secondary evidence**
Construct ID, target count, support-segment roles.

**Disclosure only**
Full sequence preview, segment metadata, production caveats.

**Do not do**
Do not open with a generic DNA helix that does not explain assembly.

### Current Step 5

**Title**
Discuss / Handoff

**Purpose**
Turn the computational story into a human discussion artifact.

**Main visual**
A concise summary panel with handoff prompts and limitations.

**What the user sees first**
What to bring to the vet or research discussion.

**What the user sees second**
Export and checklist support.

**Hero data**
The summary of what was selected and why.

**Secondary evidence**
Limits, next questions, share/export actions.

**Disclosure only**
Long technical appendix content.

**Do not do**
Do not put new core science visuals here.

## Draft Review Checklist

- Can a non-technical reviewer tell the difference between `fragment generation`, `fit / mismatch`, and `ranking / funnel`?
- Does each step have one obvious visual hero?
- Is the primary story visible without opening disclosure content?
- Does the flow feel like a narrative instead of a results browser?
