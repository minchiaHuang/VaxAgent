# Mini PRD

## Product

VaxAgent Research Copilot MVP

## Problem

Oncology research workflows produce mutation outputs that are difficult to interpret quickly and explain clearly to mixed technical and non-technical stakeholders. Teams often need a fast way to move from mutation summary to candidate prioritization without forcing every viewer through raw bioinformatics artifacts.

## Goal

Demonstrate a stable, explainable workflow that converts one benchmark tumor mutation dataset into:

- a mutation summary
- a ranked list of neoantigen candidates
- a plain-English explanation of prioritization logic
- a draft mRNA blueprint preview
- one exportable report

## Target User

- translational oncology researcher
- bioinformatics-adjacent team member
- innovation or review stakeholder who needs understandable outputs
- hackathon judge evaluating workflow clarity

## Non-User

- patient
- general consumer
- clinician seeking direct treatment recommendations

## Core User Story

As a research stakeholder, I want to review one benchmark mutation case and quickly understand which neoantigen candidates rise to the top and why, so I can discuss the output with collaborators without reading raw pipeline files.

## MVP Scope

The MVP supports exactly one happy path:

1. load one benchmark dataset
2. show mutation summary
3. show ranked neoantigen candidates
4. explain ranking in plain English
5. preview one draft mRNA construct
6. export one concise summary

## Requirements

- deterministic fixture-first behavior
- one-page UI is acceptable
- all language must stay in research-use framing
- limitations and human oversight must be visible
- the full flow must be understandable in 60 to 90 seconds

## Success Criteria

- the app runs locally with minimal setup
- the happy path completes without crash
- a non-specialist viewer can understand why the top candidate ranked first
- the export action works reliably
- no screen implies clinical use or treatment recommendation

## Constraints

- no arbitrary uploads
- no auth or multi-user workflows
- no production deployment work
- no live dependency that can break the demo
- no extra features beyond the stable happy path

## Non-Goals

- multiple datasets
- live pVACseq execution in the demo path
- live VCF parsing in the demo path
- multi-user collaboration
- saved history as a primary product feature
- clinical recommendation logic
- cure, efficacy, or treatment-selection claims
- manufacturing-grade therapeutic design claims

## Build Strategy

Prefer, in order:

1. fixture
2. stub
3. minimal implementation
4. full implementation only if required for the demo path
