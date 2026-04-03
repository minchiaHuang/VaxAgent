# Demo Notes

## How To Run

Option 1:

- open [`index.html`](./index.html) directly in a browser

Option 2:

- serve the repo root with a static file server
- open the local URL in a browser

No backend, database, or external model is required.

## Happy Path

1. Open the app.
2. Click `Load Benchmark Case`.
3. Point out whether the mode chip says `Backend connected` or `Fallback fixture`.
4. Read the mutation summary cards.
5. Review the ranked candidate list.
6. Select the top candidate to show the explanation panel.
7. Scroll to the mRNA blueprint preview.
8. Click `Export Brief` to open the backend PDF or download the fallback markdown brief.

## What Is Mocked Or Stubbed

- mutation parsing is precomputed
- neoantigen ranking is fixture-based
- explanation content is prewritten
- mRNA construct details are simplified for preview
- report export is generated client-side from the same fixture
- when the backend is available, the export action uses the generated PDF route

## Limitations To Disclose

- benchmark dataset only
- research-use prototype only
- no clinical recommendation or treatment guidance
- no claim of biological efficacy
- human expert review is still required
