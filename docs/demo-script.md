# Demo Script

## Goal

Deliver a stable 60 to 90 second demo that makes the product easy to understand for judges and non-specialists.

## Stage Setup

Before presenting:

- keep the app open on the landing screen
- if possible, have the backend already running so the preferred path shows `Backend connected`
- if the backend is unavailable, continue with the fallback path instead of troubleshooting live

## Opening Line

"VaxAgent is an explainable oncology research workflow copilot. It is a research-use prototype, not a clinical product. The job of this MVP is to take one benchmark tumor mutation case, rank likely neoantigen candidates, explain the ranking in plain English, preview an mRNA research blueprint, and export a concise summary."

## Operator Script

### Step 1 — Start the run

Action:

- click `Load Benchmark Case`

Say:

"This demo is intentionally fixture-first, so we can show one stable workflow instead of depending on fragile live tooling."

### Step 2 — Call out the mode

Action:

- point at the mode chip in the top panel

Say:

"If this says `Backend connected`, the frontend is using the live local pipeline path. If it says `Fallback fixture`, the demo still works safely without the backend. Both paths preserve the same happy-path story."

### Step 3 — Mutation summary

Action:

- point to the dataset title and summary cards

Say:

"Here we translate the benchmark mutation case into a quick research summary. Instead of forcing the audience through raw mutation files, we immediately show the scale of the sample and the shortlist context."

### Step 4 — Ranked candidates

Action:

- scroll to the ranked neoantigen candidates
- point to the top-ranked row

Say:

"This section turns the mutation output into an ordered shortlist. The point is not to claim clinical truth, but to make prioritization transparent and fast to discuss."

### Step 5 — Explanation panel

Action:

- click the top candidate
- point to the plain-English explanation panel

Say:

"When I click a candidate, the system explains why it rose to the top using plain-English factors like predicted binding strength, expression, and clonality. That helps technical and non-technical stakeholders stay aligned on why this candidate matters."

### Step 6 — Blueprint preview

Action:

- move to the blueprint preview panel

Say:

"From the ranked shortlist, we generate a draft mRNA blueprint preview. This is a research communication artifact, not a production-ready therapeutic design."

### Step 7 — Export

Action:

- click `Export Brief`

Say:

"Finally, we export the same story into a concise brief so the output can be shared outside the live demo."

## Closing Line

"So the value of VaxAgent is not that it replaces scientists. The value is that it makes an oncology research workflow more explainable, faster to review, and easier to communicate across mixed stakeholders."

## Key Messages To Repeat

- one benchmark dataset only
- one stable UI flow
- explainability over complexity
- deterministic demo path over fragile live integrations
- human review remains required

## Required Disclosures

- the candidate ranking is benchmark- and fixture-based for demo stability
- the blueprint preview is a research draft, not a manufacturable therapeutic construct
- the app does not provide treatment recommendations
- no arbitrary real patient uploads are supported in this MVP
