# Out Of Scope

## Explicit Non-Goals

- arbitrary tumor file upload
- multiple datasets
- user accounts or auth
- saved run history
- multi-user collaboration
- production infrastructure
- live VCF parsing in the demo path
- live pVACseq or Docker execution
- clinical recommendation logic
- claims about cure, treatment selection, or efficacy
- automated therapeutic design claims
- any feature that weakens the stable happy path

## Why

This MVP exists to prove one explainable research workflow, not to simulate a full oncology platform.

## Stub Instead Of Build

When a choice exists, prefer stubbing:

- candidate scoring pipeline internals
- construct optimization internals
- report generation complexity
- advanced visualizations
- integration-heavy workflow steps
