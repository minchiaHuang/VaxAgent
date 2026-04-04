const _isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_ORIGIN =
  new URLSearchParams(window.location.search).get("api") ||
  (_isLocal ? "http://127.0.0.1:8000" : "https://vaxagentvaxagent-backend.onrender.com");
const WS_URL = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline`;

const PIPELINE_STEPS = [
  {
    key: "load_dataset",
    title: "Load dataset",
    detail: "Open one benchmark mutation case and summarize the mutation landscape."
  },
  {
    key: "pvacseq",
    title: "Predict candidates",
    detail: "Load the precomputed neoantigen shortlist for the benchmark sample."
  },
  {
    key: "ranking",
    title: "Rank shortlist",
    detail: "Score binding, expression, clonality, and mutant specificity."
  },
  {
    key: "esmfold",
    title: "Add structure context",
    detail: "Add surface-accessibility context for the top-ranked candidates."
  },
  {
    key: "mrna_design",
    title: "Draft blueprint",
    detail: "Assemble a research-only mRNA construct preview from the shortlist."
  },
  {
    key: "report",
    title: "Export report",
    detail: "Generate one concise brief for review and sharing."
  }
];

const FALLBACK_RUN = {
  variantStats: {
    dataset_id: "hcc1395",
    dataset_name: "HCC1395 Breast Cancer Cell Line",
    source: "Precomputed benchmark fixture embedded in the frontend for offline demo fallback.",
    tumor_type: "Triple-negative breast cancer",
    hla_alleles: [
      "HLA-A*29:02",
      "HLA-B*45:01",
      "HLA-B*82:02",
      "HLA-C*06:02"
    ],
    stats: {
      total_variants: 4741,
      missense_mutations: 1842,
      initial_predictions: 322,
      shortlisted_candidates: 5
    },
    tumor_mutation_burden: "High (34.7 mutations/Mb)"
  },
  candidates: [
    {
      rank: 1,
      gene: "TP53",
      mutation: "R248W",
      mt_epitope_seq: "SVVVPWEPPL",
      hla_allele: "HLA-A*29:02",
      ic50_mt: 45.2,
      fold_change: 217.7,
      gene_expression_tpm: 38.2,
      tumor_dna_vaf: 0.48,
      clonality: "clonal",
      priority_score: 76,
      plddt: 82.4,
      surface_accessible: true
    },
    {
      rank: 2,
      gene: "PIK3CA",
      mutation: "E545K",
      mt_epitope_seq: "IKDFSKIVSL",
      hla_allele: "HLA-B*45:01",
      ic50_mt: 78.6,
      fold_change: 79.1,
      gene_expression_tpm: 31.5,
      tumor_dna_vaf: 0.42,
      clonality: "clonal",
      priority_score: 70,
      plddt: 78.9,
      surface_accessible: true
    },
    {
      rank: 3,
      gene: "BRCA1",
      mutation: "T1685I",
      mt_epitope_seq: "QMFISVVNL",
      hla_allele: "HLA-A*29:02",
      ic50_mt: 124.3,
      fold_change: 36.7,
      gene_expression_tpm: 18.7,
      tumor_dna_vaf: 0.39,
      clonality: "clonal",
      priority_score: 60,
      plddt: 74.2,
      surface_accessible: true
    },
    {
      rank: 4,
      gene: "PTEN",
      mutation: "R130Q",
      mt_epitope_seq: "KMLQQDKMF",
      hla_allele: "HLA-B*45:01",
      ic50_mt: 198.4,
      fold_change: 19.2,
      gene_expression_tpm: 22.4,
      tumor_dna_vaf: 0.35,
      clonality: "clonal",
      priority_score: 54,
      plddt: 68.1,
      surface_accessible: false
    },
    {
      rank: 5,
      gene: "RB1",
      mutation: "R698W",
      mt_epitope_seq: "LFMDLWRWL",
      hla_allele: "HLA-A*29:02",
      ic50_mt: 267.1,
      fold_change: 11.0,
      gene_expression_tpm: 15.2,
      tumor_dna_vaf: 0.31,
      clonality: "subclonal",
      priority_score: 45,
      plddt: 71.5,
      surface_accessible: true
    }
  ],
  blueprint: {
    construct_id: "MRNA-HCC1395-DRAFT-01",
    strategy: "Multi-epitope long-peptide cassette (5 antigens)",
    format: "Research-only blueprint preview",
    payload_summary:
      "m7GpppN | 5' UTR | Signal peptide | TP53 R248W cassette | PIK3CA E545K cassette | BRCA1 T1685I cassette | PTEN R130Q cassette | RB1 R698W cassette | 3' UTR | Poly(A)×120",
    total_length_nt: 450,
    notes: [
      "Sequence is a simplified research preview, not a validated therapeutic design.",
      "Antigen ordering follows the shortlist ranking to keep the story easy to explain.",
      "Wet-lab validation and delivery design remain out of scope."
    ],
    sequence_preview: [
      "5' Cap:        m7GpppN",
      "5' UTR:        GGGAATTCTAGGCTAACTGCTGGAGCTCTTCTCCACC...",
      "Signal:        ATGGAGACCCCCCAGCTGCTCTTC...",
      "Ag1 (TP53 R248W): AGCGTGGTCGTGCCCTGGGAGCCCCCCTTG",
      "Linker:        GGCCCCGGCCCCGGG",
      "Ag2 (PIK3CA E545K): ATCAAGGACTTCTCCAAGATCGTGAGCCTG",
      "Stop:          TGA",
      "3' UTR:        TGAATCAGAGCAGAAAGCTCATGAGCCAGAAGTCTG...",
      "Poly(A):       AAAAAAAAAAAAAAAAAAAA...×120"
    ].join("\n")
  },
  explanations: {
    load_dataset:
      "We loaded the HCC1395 benchmark dataset, a triple-negative breast cancer cell line with a high mutation burden. That gives the workflow enough altered protein sequences to build a believable neoantigen shortlist for demo purposes.",
    pvacseq:
      "The shortlist comes from precomputed binding predictions instead of a live pVACseq run. This keeps the demo deterministic while still showing the kind of candidate filtering a real workflow would perform.",
    ranking:
      "Candidates are ranked by combining predicted binding strength, tumor expression, variant allele frequency, and mutant-vs-wildtype specificity. The goal is not to claim biological truth, but to make the prioritization logic explicit and easy to discuss.",
    esmfold:
      "Surface-accessibility context is included as a lightweight structural signal. It adds one more explainable research feature without introducing a fragile live dependency.",
    mrna_design:
      "The draft construct preview assembles the top candidates into one research-only mRNA blueprint. It is a communication aid for the demo, not a manufacturable therapeutic design.",
    report:
      "The export step packages the same summary, shortlist, and blueprint preview into one concise brief for sharing."
  },
  limitations: [
    "Single synthetic benchmark dataset only.",
    "Deterministic fixture-based ranking, not a live neoantigen pipeline.",
    "Draft construct preview is for research discussion only.",
    "Human expert review is required before any downstream scientific use."
  ]
};

const state = {
  loaded: false,
  loading: false,
  mode: "idle",
  statusMessage:
    "The load action will try the local backend first and fall back to the embedded benchmark fixture if the API is unavailable.",
  variantStats: null,
  candidates: [],
  blueprint: null,
  selectedCandidateRank: null,
  reportUrl: "",
  stepStatuses: Object.fromEntries(PIPELINE_STEPS.map((step) => [step.key, "pending"])),
  stepExplanations: {},
  ws: null
};

const elements = {
  loadButton: document.getElementById("load-demo"),
  exportButton: document.getElementById("export-brief"),
  stepper: document.getElementById("stepper"),
  datasetTitle: document.getElementById("dataset-title"),
  datasetBanner: document.getElementById("dataset-banner"),
  summaryGrid: document.getElementById("summary-grid"),
  summaryNote: document.getElementById("summary-note"),
  candidateList: document.getElementById("candidate-list"),
  explanationCard: document.getElementById("explanation-card"),
  blueprintCard: document.getElementById("blueprint-card"),
  limitationsList: document.getElementById("limitations-list"),
  modeChip: document.getElementById("mode-chip"),
  pipelineStatus: document.getElementById("pipeline-status"),
  vcfFileInput: document.getElementById("vcf-file-input"),
  hlaAllelesInput: document.getElementById("hla-alleles-input"),
  analyseButton: document.getElementById("analyse-button"),
  uploadStatus: document.getElementById("upload-status"),
  fileLabelText: document.getElementById("file-label-text"),
  modeQuickBtn: document.getElementById("mode-quick"),
  modeFullBtn: document.getElementById("mode-full"),
  modeDescription: document.getElementById("mode-description"),
  jobProgressArea: document.getElementById("job-progress-area"),
  jobProgressLabel: document.getElementById("job-progress-label"),
  jobElapsed: document.getElementById("job-elapsed"),
  progressBar: document.getElementById("progress-bar"),
  jobProgressNote: document.getElementById("job-progress-note")
};

const MODE_DESCRIPTIONS = {
  quick:
    "Upload a <code>.vcf</code> or <code>.vcf.gz</code> tumor mutation file. The variant summary will reflect your file. Neoantigen candidate ranking uses the HCC1395 benchmark fixture — live pVACseq is outside this demo scope.",
  full:
    "Upload a <code>.vcf</code> or <code>.vcf.gz</code> file and provide HLA alleles. pVACseq will run inside Docker and produce real neoantigen predictions. This takes <strong>30–60 minutes</strong> — Docker must be installed and running."
};

let _analysisMode = "quick";
let _jobPollInterval = null;
let _jobStartTime = null;

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function sentenceCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resetRunState() {
  state.loaded = false;
  state.variantStats = null;
  state.candidates = [];
  state.blueprint = null;
  state.selectedCandidateRank = null;
  state.reportUrl = "";
  state.stepStatuses = Object.fromEntries(PIPELINE_STEPS.map((step) => [step.key, "pending"]));
  state.stepExplanations = {};
  elements.exportButton.disabled = true;
}

function updateStatus(mode, message) {
  state.mode = mode;
  state.statusMessage = message;

  const chipClasses = {
    idle: "",
    running: "is-running",
    backend: "is-backend",
    fallback: "is-fallback"
  };
  const chipLabels = {
    idle: "Awaiting run",
    running: "Pipeline running",
    backend: "Backend connected",
    fallback: "Fallback fixture"
  };

  elements.modeChip.className = `mode-chip ${chipClasses[mode] || ""}`.trim();
  elements.modeChip.textContent = chipLabels[mode] || "Awaiting run";
  elements.pipelineStatus.textContent = message;
}

function renderStepper() {
  elements.stepper.innerHTML = PIPELINE_STEPS.map((step, index) => {
    const status = state.stepStatuses[step.key] || "pending";
    const statusClass =
      status === "complete" ? "is-complete" : status === "running" ? "is-active" : "";
    const detail = state.stepExplanations[step.key] || step.detail;

    return `
      <li class="stepper-item ${statusClass} reveal">
        <span class="step-index">${index + 1}</span>
        <h3>${step.title}</h3>
        <p>${detail}</p>
      </li>
    `;
  }).join("");
}

function buildSummaryMetrics(variantStats) {
  const stats = variantStats.stats || {};
  return [
    { label: "Total variants", value: formatNumber(stats.total_variants || 0) },
    { label: "Missense mutations", value: formatNumber(stats.missense_mutations || 0) },
    { label: "Initial predictions", value: formatNumber(stats.initial_predictions || 0) },
    { label: "Shortlisted", value: formatNumber(stats.shortlisted_candidates || state.candidates.length || 0) }
  ];
}

function renderSummary() {
  if (!state.variantStats) {
    elements.datasetTitle.textContent = "Awaiting demo load";
    elements.datasetBanner.className = "dataset-banner muted-banner";
    elements.datasetBanner.textContent =
      "Load the benchmark case to render the deterministic oncology research demo.";
    elements.summaryGrid.innerHTML = "";
    elements.summaryNote.className = "summary-note empty-state";
    elements.summaryNote.textContent =
      "The mutation summary will appear here once the benchmark case is loaded.";
    return;
  }

  const variantStats = state.variantStats;
  const metrics = buildSummaryMetrics(variantStats);
  const summaryText =
    state.stepExplanations.load_dataset ||
    "Benchmark mutation data loaded successfully.";

  elements.datasetTitle.textContent = variantStats.dataset_name;
  elements.datasetBanner.className = "dataset-banner reveal";
  elements.datasetBanner.innerHTML = `
    <strong>${variantStats.tumor_type}</strong><br />
    ${variantStats.source}
  `;
  elements.summaryGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="summary-card reveal">
          <p class="summary-card-label">${metric.label}</p>
          <p class="summary-card-value">${metric.value}</p>
        </article>
      `
    )
    .join("");
  elements.summaryNote.className = "summary-note reveal";
  elements.summaryNote.textContent = summaryText;
}

function renderCandidates() {
  if (!state.candidates.length) {
    elements.candidateList.className = "candidate-list empty-state";
    elements.candidateList.textContent =
      "Candidate ranking appears after the benchmark case is loaded.";
    return;
  }

  elements.candidateList.className = "candidate-list";
  elements.candidateList.innerHTML = state.candidates
    .map((candidate) => {
      const selectedClass =
        candidate.rank === state.selectedCandidateRank ? "is-selected" : "";
      const clonalityLabel = sentenceCase(candidate.clonality);

      return `
        <button class="candidate-card reveal ${selectedClass}" data-rank="${candidate.rank}">
          <div class="candidate-rank">#${candidate.rank}</div>
          <div>
            <div class="candidate-header">
              <h3>${candidate.gene} ${candidate.mutation}</h3>
              <span class="candidate-tag">${candidate.hla_allele}</span>
            </div>
            <p class="candidate-meta">
              Peptide ${candidate.mt_epitope_seq} · Binding ${candidate.ic50_mt} nM · Expression ${candidate.gene_expression_tpm} TPM · Clonality ${clonalityLabel}
            </p>
          </div>
          <div class="candidate-score">
            <span>Priority</span>
            <strong>${candidate.priority_score}</strong>
          </div>
        </button>
      `;
    })
    .join("");

  elements.candidateList.querySelectorAll("[data-rank]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCandidateRank = Number(button.getAttribute("data-rank"));
      renderCandidates();
      renderExplanation();
    });
  });
}

function buildCandidateNarrative(candidate) {
  const structureNote =
    typeof candidate.surface_accessible === "boolean"
      ? candidate.surface_accessible
        ? "The mutated region is predicted to stay surface-accessible, which strengthens the research case."
        : "The mutated region may be less surface-accessible, which is one reason it ranks below the strongest leads."
      : "Structural context is approximate in this demo and should be treated as a supporting signal only.";

  return {
    summary:
      `${candidate.gene} ${candidate.mutation} ranks #${candidate.rank} because it balances strong predicted binding, measurable tumor expression, and enough mutant-specific separation from the wildtype peptide to make the shortlist explainable.`,
    bullets: [
      `Predicted binding is ${candidate.ic50_mt} nM for ${candidate.hla_allele}, which keeps the peptide inside the benchmark shortlist threshold.`,
      `Tumor expression is ${candidate.gene_expression_tpm} TPM and DNA VAF is ${formatPercent(candidate.tumor_dna_vaf || 0)}, so the mutation is both present and measurable in the sample.`,
      `Mutant-vs-wildtype fold change is ${candidate.fold_change}x. ${structureNote}`
    ],
    caution:
      "This is a research prioritization signal, not evidence of therapeutic efficacy. Experimental validation and expert review are still required."
  };
}

function renderExplanation() {
  if (!state.candidates.length) {
    elements.explanationCard.className = "explanation-card empty-state";
    elements.explanationCard.textContent =
      "Select a ranked candidate to inspect the explanation panel.";
    return;
  }

  const candidate =
    state.candidates.find((item) => item.rank === state.selectedCandidateRank) ||
    state.candidates[0];
  const narrative = buildCandidateNarrative(candidate);
  const rankingNote = state.stepExplanations.ranking;

  state.selectedCandidateRank = candidate.rank;
  elements.explanationCard.className = "explanation-card reveal";
  elements.explanationCard.innerHTML = `
    <h3>${candidate.gene} ${candidate.mutation} ranks #${candidate.rank}</h3>
    <p class="explanation-copy">${narrative.summary}</p>
    ${rankingNote ? `<p class="explanation-copy">${rankingNote}</p>` : ""}
    <ul>
      ${narrative.bullets.map((reason) => `<li>${reason}</li>`).join("")}
    </ul>
    <p class="explanation-copy"><strong>Guardrail:</strong> ${narrative.caution}</p>
  `;
}

function renderBlueprint() {
  if (!state.blueprint) {
    elements.blueprintCard.className = "blueprint-card empty-state";
    elements.blueprintCard.textContent =
      "The construct preview is shown after the benchmark case is loaded.";
    return;
  }

  elements.blueprintCard.className = "blueprint-card reveal";
  elements.blueprintCard.innerHTML = `
    <h3>${state.blueprint.construct_id}</h3>
    <p class="blueprint-copy">${state.blueprint.payload_summary}</p>
    <dl class="blueprint-metadata">
      <div>
        <dt>Strategy</dt>
        <dd>${state.blueprint.strategy}</dd>
      </div>
      <div>
        <dt>Format</dt>
        <dd>${state.blueprint.format}</dd>
      </div>
      <div>
        <dt>Length</dt>
        <dd>${state.blueprint.total_length_nt} nt</dd>
      </div>
      <div>
        <dt>Antigens</dt>
        <dd>${state.blueprint.antigen_count || state.candidates.length}</dd>
      </div>
    </dl>
    <ul>
      ${state.blueprint.notes.map((note) => `<li>${note}</li>`).join("")}
    </ul>
    <pre class="sequence-block">${state.blueprint.sequence_preview}</pre>
  `;
}

function renderLimitations() {
  const limitations =
    state.mode === "backend"
      ? [
          "Benchmark HCC1395 dataset only.",
          "Pipeline is fixture-first even when the backend is connected.",
          "No clinical recommendation or treatment guidance is implied.",
          "Human expert review remains required before downstream use."
        ]
      : FALLBACK_RUN.limitations;

  elements.limitationsList.innerHTML = limitations
    .map((item) => `<li>${item}</li>`)
    .join("");
}

function renderAll() {
  renderStepper();
  renderSummary();
  renderCandidates();
  renderExplanation();
  renderBlueprint();
  renderLimitations();
}

function applyPipelineMessage(message) {
  if (message.step && state.stepStatuses[message.step] !== undefined) {
    state.stepStatuses[message.step] = message.status;
  }
  if (message.explanation) {
    state.stepExplanations[message.step] = message.explanation;
  }

  if (message.step === "load_dataset" && message.status === "complete") {
    state.variantStats = message.data;
  }
  if (message.step === "ranking" && message.status === "complete") {
    state.candidates = message.data.candidates || [];
    state.selectedCandidateRank = state.candidates[0]?.rank || null;
  }
  if (message.step === "mrna_design" && message.status === "complete") {
    state.blueprint = message.data;
  }
  if (message.step === "report" && message.status === "complete") {
    state.reportUrl = `${API_ORIGIN}${message.data.report_url}`;
  }
  if (message.step === "pipeline_complete" && message.status === "complete") {
    state.loaded = true;
    state.loading = false;
    elements.exportButton.disabled = !state.reportUrl;
    elements.loadButton.disabled = false;
    elements.loadButton.textContent = "Reload Benchmark Case";
    updateStatus(
      "backend",
      "Local backend run completed successfully. The export button now downloads the generated PDF research brief."
    );
  }

  renderAll();
}

function applyFallbackRun() {
  resetRunState();
  state.loaded = true;
  state.loading = false;
  state.variantStats = FALLBACK_RUN.variantStats;
  state.candidates = FALLBACK_RUN.candidates;
  state.blueprint = FALLBACK_RUN.blueprint;
  state.selectedCandidateRank = FALLBACK_RUN.candidates[0].rank;
  state.stepExplanations = { ...FALLBACK_RUN.explanations };
  state.stepStatuses = Object.fromEntries(PIPELINE_STEPS.map((step) => [step.key, "complete"]));
  elements.exportButton.disabled = false;
  elements.loadButton.disabled = false;
  elements.loadButton.textContent = "Reload Benchmark Case";
  updateStatus(
    "fallback",
    "Backend connection was unavailable, so the app loaded the embedded benchmark fixture instead. The demo path remains stable."
  );
  renderAll();
}

function buildFallbackReport() {
  const top = state.candidates[0];
  const summaryMetrics = buildSummaryMetrics(state.variantStats);

  return `# VaxAgent Research Brief

## Dataset

- Case: ${state.variantStats.dataset_name}
- Tumor type: ${state.variantStats.tumor_type}
- Source: ${state.variantStats.source}

## Mutation Summary

${summaryMetrics.map((metric) => `- ${metric.label}: ${metric.value}`).join("\n")}

## Ranked Candidates

${state.candidates
  .map(
    (candidate) =>
      `### #${candidate.rank} ${candidate.gene} ${candidate.mutation}\n- Peptide: ${candidate.mt_epitope_seq}\n- HLA: ${candidate.hla_allele}\n- IC50: ${candidate.ic50_mt} nM\n- Expression: ${candidate.gene_expression_tpm} TPM\n- DNA VAF: ${formatPercent(candidate.tumor_dna_vaf || 0)}\n- Priority score: ${candidate.priority_score}`
  )
  .join("\n\n")}

## Highlighted Explanation

${buildCandidateNarrative(top).summary}

## Draft mRNA Blueprint

- Construct ID: ${state.blueprint.construct_id}
- Strategy: ${state.blueprint.strategy}
- Payload: ${state.blueprint.payload_summary}

## Limitations

${FALLBACK_RUN.limitations.map((item) => `- ${item}`).join("\n")}
`;
}

function exportBrief() {
  if (state.mode === "backend" && state.reportUrl) {
    window.open(state.reportUrl, "_blank", "noopener");
    return;
  }

  const blob = new Blob([buildFallbackReport()], {
    type: "text/markdown;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vaxagent-research-brief.md";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function runBackendPipelineWithUrl(wsUrl) {
  return new Promise((resolve) => {
    let settled = false;
    let sawAnyMessage = false;
    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      if (state.ws) {
        state.ws.close();
        state.ws = null;
      }
      resolve(false);
    }, 8000);

    try {
      state.ws = new WebSocket(wsUrl);
    } catch (_error) {
      window.clearTimeout(timeout);
      resolve(false);
      return;
    }

    state.ws.onopen = () => {
      updateStatus(
        "running",
        `Connected to the local backend at ${API_ORIGIN}. Streaming the benchmark pipeline now.`
      );
    };

    state.ws.onmessage = (event) => {
      sawAnyMessage = true;
      const message = JSON.parse(event.data);
      applyPipelineMessage(message);

      if (message.status === "error") {
        window.clearTimeout(timeout);
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }

      if (message.step === "pipeline_complete" && message.status === "complete") {
        window.clearTimeout(timeout);
        if (state.ws) {
          state.ws.close();
          state.ws = null;
        }
        if (!settled) {
          settled = true;
          resolve(true);
        }
      }
    };

    state.ws.onerror = () => {
      window.clearTimeout(timeout);
      if (state.ws) {
        state.ws.close();
        state.ws = null;
      }
      if (!settled) {
        settled = true;
        resolve(false);
      }
    };

    state.ws.onclose = () => {
      if (!settled && !state.loaded) {
        window.clearTimeout(timeout);
        settled = true;
        resolve(sawAnyMessage && state.loaded);
      }
    };
  });
}

async function checkDockerAvailability() {
  try {
    const res = await fetch(`${API_ORIGIN}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.docker === true;
  } catch {
    return false;
  }
}

function setAnalysisMode(mode) {
  _analysisMode = mode;
  elements.modeQuickBtn.classList.toggle("is-selected", mode === "quick");
  elements.modeFullBtn.classList.toggle("is-selected", mode === "full");
  elements.modeDescription.innerHTML = MODE_DESCRIPTIONS[mode];
  elements.hlaAllelesInput.required = mode === "full";
  const placeholder =
    mode === "full"
      ? "HLA alleles (required) — e.g. HLA-A*02:01, HLA-B*07:02"
      : "HLA alleles (optional) — e.g. HLA-A*02:01, HLA-B*07:02";
  elements.hlaAllelesInput.placeholder = placeholder;
  setUploadStatus("");
}

function setProgressVisible(visible) {
  elements.jobProgressArea.hidden = !visible;
}

function updateProgressBar(pct, label) {
  elements.progressBar.style.width = `${pct}%`;
  if (label) elements.jobProgressLabel.textContent = label;
}

function startElapsedTimer() {
  _jobStartTime = Date.now();
  const tick = () => {
    if (!_jobStartTime) return;
    const elapsed = Math.floor((Date.now() - _jobStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    elements.jobElapsed.textContent = `${mins}m ${secs}s elapsed`;
  };
  tick();
  return window.setInterval(tick, 1000);
}

function stopPolling() {
  if (_jobPollInterval) {
    window.clearInterval(_jobPollInterval);
    _jobPollInterval = null;
  }
  _jobStartTime = null;
}

async function submitFullPipeline() {
  const file = elements.vcfFileInput.files[0];
  if (!file) return;

  const hla = elements.hlaAllelesInput.value.trim();
  if (!hla) {
    setUploadStatus("HLA alleles are required for full pVACseq analysis.", true);
    return;
  }

  if (state.loading) return;

  resetRunState();
  state.loading = true;
  elements.analyseButton.disabled = true;
  elements.loadButton.disabled = true;
  elements.analyseButton.textContent = "Submitting...";
  setUploadStatus("Uploading VCF and submitting pVACseq job...");
  setProgressVisible(true);
  updateProgressBar(2, "Uploading file...");
  updateStatus("running", "Submitting pVACseq job. This will take 30–60 minutes.");
  renderAll();

  const formData = new FormData();
  formData.append("vcf_file", file);
  formData.append("hla_alleles", hla);

  let jobId = null;
  try {
    const res = await fetch(`${API_ORIGIN}/api/jobs/pvacseq`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Submission failed (HTTP ${res.status})`);
    }
    const result = await res.json();
    jobId = result.job_id;
  } catch (err) {
    setUploadStatus(`Submission error: ${err.message}`, true);
    setProgressVisible(false);
    state.loading = false;
    elements.analyseButton.disabled = false;
    elements.analyseButton.textContent = "Analyse My File";
    elements.loadButton.disabled = false;
    updateStatus("idle", state.statusMessage);
    return;
  }

  elements.analyseButton.textContent = "pVACseq running...";
  setUploadStatus(`Job submitted (ID: ${jobId}). Polling for completion...`);
  updateProgressBar(5, "pVACseq queued...");

  const elapsedTimer = startElapsedTimer();

  _jobPollInterval = window.setInterval(async () => {
    try {
      const res = await fetch(`${API_ORIGIN}/api/jobs/${jobId}`);
      if (!res.ok) return;
      const job = await res.json();

      updateProgressBar(job.progress_pct || 5, `pVACseq ${job.status}...`);

      if (job.status === "complete") {
        stopPolling();
        window.clearInterval(elapsedTimer);
        updateProgressBar(100, "pVACseq complete. Loading results...");
        setUploadStatus(`pVACseq complete for ${file.name}. Running analysis pipeline...`);

        const wsUrl = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline?job_id=${jobId}`;
        const ok = await runBackendPipelineWithUrl(wsUrl);
        setProgressVisible(false);
        if (!ok) {
          setUploadStatus("Pipeline failed after pVACseq. See console for details.", true);
          applyFallbackRun();
        } else {
          setUploadStatus(`Full pVACseq analysis complete for ${file.name}.`);
        }
        state.loading = false;
        elements.analyseButton.disabled = false;
        elements.analyseButton.textContent = "Analyse My File";
        elements.loadButton.disabled = false;

      } else if (job.status === "failed") {
        stopPolling();
        window.clearInterval(elapsedTimer);
        setProgressVisible(false);
        setUploadStatus(`pVACseq failed: ${job.error_msg || "unknown error"}`, true);
        state.loading = false;
        elements.analyseButton.disabled = false;
        elements.analyseButton.textContent = "Analyse My File";
        elements.loadButton.disabled = false;
        updateStatus("idle", state.statusMessage);
      }
    } catch {
      // transient fetch error — keep polling
    }
  }, 30000);
}

function setUploadStatus(message, isError = false) {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.className = `upload-status ${isError ? "upload-status-error" : message ? "upload-status-info" : ""}`;
}

async function uploadAndRun() {
  if (_analysisMode === "full") {
    return submitFullPipeline();
  }

  const file = elements.vcfFileInput.files[0];
  if (!file) {
    return;
  }

  if (state.loading) {
    return;
  }

  resetRunState();
  state.loading = true;
  elements.analyseButton.disabled = true;
  elements.loadButton.disabled = true;
  elements.analyseButton.textContent = "Uploading...";
  setUploadStatus("Uploading and parsing your VCF file...");
  updateStatus(
    "running",
    "Uploading your VCF file and parsing variant statistics."
  );
  renderAll();

  const formData = new FormData();
  formData.append("vcf_file", file);
  const hla = elements.hlaAllelesInput.value.trim();
  if (hla) {
    formData.append("hla_alleles", hla);
  }

  let fileId = null;
  try {
    const response = await fetch(`${API_ORIGIN}/api/upload`, {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed (HTTP ${response.status})`);
    }
    const result = await response.json();
    fileId = result.file_id;
    setUploadStatus(`Parsed ${file.name}. Running analysis pipeline...`);
    elements.analyseButton.textContent = "Pipeline running...";
  } catch (err) {
    setUploadStatus(`Upload error: ${err.message}`, true);
    state.loading = false;
    elements.analyseButton.disabled = false;
    elements.analyseButton.textContent = "Analyse My File";
    elements.loadButton.disabled = false;
    updateStatus("idle", state.statusMessage);
    return;
  }

  const wsUrl = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline?file_id=${fileId}`;
  const backendSucceeded = await runBackendPipelineWithUrl(wsUrl);

  if (!backendSucceeded) {
    setUploadStatus("Pipeline failed after upload. The benchmark fixture was loaded as a fallback.", true);
    applyFallbackRun();
  } else {
    setUploadStatus(`Analysis complete for ${file.name}.`);
  }

  elements.analyseButton.disabled = false;
  elements.analyseButton.textContent = "Analyse My File";
}

function runBackendPipeline() {
  return runBackendPipelineWithUrl(WS_URL);
}

async function loadDemo() {
  if (state.loading) {
    return;
  }

  resetRunState();
  state.loading = true;
  elements.loadButton.disabled = true;
  elements.loadButton.textContent = "Loading...";
  updateStatus(
    "running",
    "Trying the local backend first so the demo can use the full pipeline path."
  );
  renderAll();

  const backendSucceeded = await runBackendPipeline();

  if (!backendSucceeded) {
    applyFallbackRun();
  }
}

elements.loadButton.addEventListener("click", loadDemo);
elements.exportButton.addEventListener("click", exportBrief);

elements.vcfFileInput.addEventListener("change", () => {
  const file = elements.vcfFileInput.files[0];
  if (file) {
    elements.fileLabelText.textContent = file.name;
    elements.analyseButton.disabled = false;
    setUploadStatus("");
  } else {
    elements.fileLabelText.textContent = "Choose .vcf or .vcf.gz file";
    elements.analyseButton.disabled = true;
  }
});

elements.analyseButton.addEventListener("click", uploadAndRun);

elements.modeQuickBtn.addEventListener("click", () => setAnalysisMode("quick"));
elements.modeFullBtn.addEventListener("click", () => {
  if (!elements.modeFullBtn.disabled) setAnalysisMode("full");
});

// Check Docker availability and enable Full analysis mode if available
checkDockerAvailability().then((dockerOk) => {
  if (dockerOk) {
    elements.modeFullBtn.disabled = false;
    elements.modeFullBtn.title = "";
  } else {
    elements.modeFullBtn.disabled = true;
    elements.modeFullBtn.title = "Docker is not available on this machine — Full analysis requires Docker";
  }
});

updateStatus("idle", state.statusMessage);
renderAll();
