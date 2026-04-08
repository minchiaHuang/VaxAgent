# VaxAgent V2 Step 3/4 Redesign

## Brief

### Problem statement
Users can reach Step 3 and Step 4 today, but the experience still feels like a results browser instead of a decision-understanding flow. The main breakdown is not missing science data. It is information order:

- the UI opens with mechanics before conclusion
- ranking, structure, and blueprint details are spread across multiple interaction layers
- Step 3/4 use both wizard navigation and scene navigation, which makes the mental model fragile

### Primary persona
- Primary: pet owner
- Secondary: veterinarian
- Tertiary: researcher

### Success criteria
- Explainability: a pet owner can understand why the lead target is the current best option
- Comparability: the user can compare the top 3 candidates without opening multiple unrelated panels
- Actionability: the user leaves Step 4/5 with clear discussion prompts for a veterinarian

### IA
- Overview
- Why this matters
- Evidence and uncertainty
- Next action

## Screen List

### Core screens
- `S3-00 Targets_Overview`
- `S3-01 TopTarget_Explain`
- `S3-02 CompareTargets_Top3`
- `S3-03 Targets_EmptyOrError`
- `S4-00 Blueprint_Overview`
- `S4-01 WhyThisDesign`
- `S4-02 Safety_Limits_VetPrep`

### Supporting modules
- `Filtering_Funnel_Explained`
- `ConstructMap_Interactive`
- `ExportAndVetPrep`

## Implementation Notes

### Step 3
- Default to the top target as the primary story
- Move ranking methodology into supporting context, not the first interaction
- Keep evidence and uncertainty together in the same module
- Keep backup candidates available as progressive disclosure

### Step 4
- Start with what the blueprint is trying to do
- Explain ordering and support segments before exposing technical detail
- Keep the construct map interactive, but demote it from the entry point
- Surface notes and limits as part of the main story, not a hidden appendix

## Backlog

### Phase 1
- Use one late-step progression model only; no primary dependence on scene navigation
- Reorder Step 3/4 content around conclusion first, evidence second
- Extract shared presentation patterns for confidence, evidence, comparison, and risk
- Keep the frontend mapped to current backend fields

### Phase 2
- Normalize visibility of ranking, structure, and blueprint facts so each fact appears once in the right place
- Reduce duplicate explanation surfaces across Step 3 and Step 4
- Improve mobile hierarchy with progressive disclosure instead of static fallback only

### Phase 3
- Strengthen Step 5 handoff with vet-prep checklist and export framing
- Extend mobile-specific density and interaction strategy
- Add future-data placeholders only after the current-field experience is stable
