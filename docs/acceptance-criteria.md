# Acceptance Criteria

## Must Have

- one benchmark dataset loads without user setup
- mutation summary is visible
- ranked neoantigen candidates are visible
- a plain-English explanation panel is visible
- mRNA blueprint preview is visible
- one export action works reliably
- the app clearly states research-use and human-in-the-loop limitations
- the happy path completes without crash

## Demo Criteria

- a first-time viewer can follow the flow in under 90 seconds
- the UI answers "what happened?" and "why does it matter?" in each major section
- the top candidate rationale is understandable to a non-specialist viewer
- no part of the UI implies clinical-grade recommendations

## Engineering Criteria

- no network dependency is required for the happy path
- the dataset and outputs are deterministic
- no live bioinformatics tooling is required at demo time
- failure-prone integrations are stubbed or removed

## Release Rule

If any feature threatens demo stability, it should be stubbed, simplified, or removed.
