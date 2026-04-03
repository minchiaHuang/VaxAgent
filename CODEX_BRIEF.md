# CODEX_BRIEF.md

# VaxAgent MVP — Codex Brief

## 1) Project Summary

We are building a hackathon MVP for HSIL Hackathon 2026.

This is **not** a clinical product and **not** a medical decision engine.

This is an **explainable AI copilot for oncology research workflows**.

The MVP should help a user go from tumor mutation data to:
- a ranked list of neoantigen candidates
- a plain-English explanation of why those candidates were prioritized
- a draft mRNA vaccine research blueprint / construct preview
- a concise exportable summary

The goal is to demonstrate:
- clearer interpretation of complex tumor mutation data
- reduced specialist bottlenecks
- better communication across technical and non-technical stakeholders
- a believable AI-assisted research workflow

---

## 2) Product Positioning

### What this is
An explainable research workflow copilot for oncology / translational medicine teams.

### What this is not
- not a treatment recommendation system
- not a clinical decision support tool for direct patient care
- not a medical device
- not a guarantee of biological efficacy
- not a platform for arbitrary real patient uploads in the MVP

### Core thesis
We are **not** pitching:
> AI designs cancer vaccines

We are pitching:
> AI helps oncology research teams interpret mutation data, prioritize candidates, and produce explainable research outputs faster and more clearly.

---

## 3) MVP Goal

Build a **single stable happy-path MVP** that demonstrates the workflow end-to-end.

The MVP only needs to support:
- **one benchmark dataset**
- **one demo path**
- **one stable UI flow**

### Required happy path
1. Load one benchmark tumor mutation dataset
2. Show mutation summary
3. Show ranked neoantigen candidates
4. Explain ranking logic in plain English
5. Show mRNA construct / blueprint preview
6. Allow one export/report action

### Demo goal
The happy path should be understandable in about **60–90 seconds**.

---

## 4) Target Users

### Primary user
- translational oncology researcher
- bioinformatics-adjacent research team
- innovation / tumor board support stakeholder who needs explainable outputs

### Secondary user
- hackathon judges
- mentors / incubator reviewers

### Explicitly not the user
- patients
- general consumers
- clinicians using this as a treatment recommendation system

---

## 5) Scope

### In scope
- one benchmark dataset only
- deterministic or fixture-first flow
- mutation summary UI
- ranked candidates UI
- explanation panel
- mRNA blueprint preview
- one export/report action
- limitations / human-in-the-loop note
- clear health-systems framing

### Out of scope
- arbitrary file upload in MVP
- multi-user workflows
- auth / accounts
- multiple datasets
- production deployment
- clinical recommendation logic
- claims about cure / treatment efficacy
- anything that weakens demo stability

**Rule:** if there is a tradeoff between completeness and stability, choose **stability**.

---

## 6) Existing Project State

Assume the backend is already substantially started.

Likely already present or mostly present:
- FastAPI backend
- agent orchestration
- VCF parsing
- pVACseq Docker runner
- mRNA construct designer
- data models / persistence layer

Known gaps / likely weak points:
- missing or unstable fixture for candidate output
- frontend is incomplete or missing
- some integrations are not fully wired
- demo polish / fallback path may be missing

Treat this project as a **stabilization + vertical slice MVP**, not a greenfield build.

---

## 7) Product Requirements

### Must have
- app loads one demo dataset successfully
- candidate ranking screen renders without crashing
- explanation panel renders
- mRNA blueprint preview renders
- one export/report action works
- happy path can be repeated reliably

### Should have
- pipeline stepper/progress UI
- basic charts or summary panels
- “why this candidate?” explanation affordance
- fallback copy if dependency fails

### Nice to have
- ESMFold or structure enrichment if stable
- downloadable PDF
- saved run history

**Do not implement nice-to-haves before must-haves are done.**

---

## 8) UX Principles

Optimize for **clarity over completeness**.

Principles:
- explain first, impress second
- one page is fine
- reduce biotech jargon or translate it immediately
- every section should answer:
  - what happened?
  - why does it matter?
- make limitations visible
- make human oversight visible

---

## 9) Health Systems Framing

The MVP should be framed as solving these system-level problems:
- too much complex oncology data to interpret quickly
- shortage of specialist time
- poor explainability of bioinformatics outputs
- communication barriers between technical and non-technical collaborators

This is the reason the concept fits the HSIL theme better as a workflow/interpretation tool than as a pure “vaccine designer.”

---

## 10) Non-Negotiable Messaging Rules

Never describe the MVP as:
- “AI cures cancer”
- “AI creates a patient’s treatment”
- “upload a patient file and get a vaccine”
- “clinical-grade recommendation”

Always describe it as:
- research copilot
- explainable prioritization workflow
- human-in-the-loop system
- prototype for oncology/translational research teams
- research-use / exploratory workflow

---

## 11) Acceptance Criteria

The MVP is done when all of the following are true:
- one benchmark dataset loads successfully
- end-to-end happy path works without crash
- candidate list is visible
- explanation panel is visible
- blueprint preview is visible
- export/report action works
- output is understandable by a non-specialist viewer
- the product clearly presents itself as a research workflow tool, not a clinical tool

If any feature threatens the demo path, remove it or stub it.

---

## 12) Build Strategy

Use a **small-scope vertical slice** approach.

### Preferred implementation pattern
- deterministic fixtures over unstable live dependencies
- mock/stub where needed
- keep one golden demo path
- optimize for demo reliability
- leave TODOs clearly where deeper science/infra work would go later

### When uncertain
- choose smaller scope
- choose more explicit UX
- choose fixture-first
- choose demo reliability over technical purity

---

## 13) What I want Codex to do

Please help me:
1. audit the repo against this MVP definition
2. identify what is missing for the happy path
3. propose the smallest implementation plan
4. implement only what is necessary for the MVP
5. avoid feature creep
6. note anything risky or fake/stubbed clearly
7. stop when the MVP is demo-ready

---

## 14) Expected Output from Codex

I want Codex to produce:

### A. Repo audit
A short summary of:
- what already exists
- what is broken
- what is missing
- what can be stubbed

### B. MVP task list
Prioritized as:
- Must
- Should
- Nice to have

### C. Code changes
Only changes needed to make the happy path demo-ready.

### D. Demo notes
A short `demo.md` explaining:
- how to run the MVP
- what the happy path is
- what is mocked/stubbed
- what limitations should be disclosed

---

## 15) Constraints for Codex

- do not redesign the whole product
- do not add auth
- do not add arbitrary uploads
- do not add multi-user features
- do not optimize for production
- do not add claims that imply clinical use
- do not expand scope unless absolutely necessary for the demo path

If you find missing pieces, prefer:
1. fixture
2. stub
3. minimal implementation
4. full implementation only if required

---

## 16) Priority Order

If you need to choose, prioritize in this order:
1. demo reliability
2. end-to-end happy path
3. explanation quality
4. clean UI
5. extra functionality

---

## 17) Repo Audit Checklist

Use this checklist when inspecting the repo.

### Project structure
- [ ] Identify backend entrypoints
- [ ] Identify frontend entrypoints
- [ ] Identify environment/config requirements
- [ ] Identify dataset / fixture locations
- [ ] Identify report/export implementation
- [ ] Identify demo run path

### Backend
- [ ] Confirm benchmark dataset loading works
- [ ] Confirm candidate generation or fixture loading works
- [ ] Confirm ranking output format is stable
- [ ] Confirm explanation endpoint or logic exists
- [ ] Confirm blueprint preview data exists
- [ ] Confirm export/report route exists or can be stubbed
- [ ] Identify any crash points
- [ ] Identify any live dependencies that should be stubbed

### Frontend
- [ ] Confirm whether there is an existing app shell
- [ ] Confirm whether a one-page vertical slice exists
- [ ] Confirm mutation summary view
- [ ] Confirm candidate table view
- [ ] Confirm explanation panel
- [ ] Confirm blueprint preview panel
- [ ] Confirm export/report action
- [ ] Confirm loading/error/empty states

### Demo readiness
- [ ] Can the app run locally with reasonable setup?
- [ ] Can the happy path complete without manual fixes?
- [ ] Are dependencies deterministic enough for demo?
- [ ] Is there a fallback path if a service fails?
- [ ] Is the messaging compliant with research-use framing?

---

## 18) Definition of Demo-Ready

The MVP is demo-ready if:
- a first-time viewer can understand the flow in under 2 minutes
- the app can be run locally without fragile setup
- the happy path completes without crash
- the UI clearly explains the workflow
- limitations are visible
- the system does not overclaim clinical value

---

## 19) First Task for Codex

Start by reading the repo and tell me:

1. what parts of the happy path already exist
2. what is currently blocking the MVP
3. the minimum set of changes needed to make the MVP demo-ready
4. what should be stubbed instead of fully built

Do not make large changes yet.
Start with the audit and a minimal implementation plan.