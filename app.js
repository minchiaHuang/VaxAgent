const _isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const QUERY_PARAMS = new URLSearchParams(window.location.search);
const API_ORIGIN =
  QUERY_PARAMS.get("api") ||
  (_isLocal ? "http://127.0.0.1:8000" : "https://vaxagentvaxagent-backend.onrender.com");
const PIPELINE_CONNECT_TIMEOUT_MS = Number(QUERY_PARAMS.get("timeout_ms")) || 8000;
const JOB_POLL_INTERVAL_MS = Number(QUERY_PARAMS.get("job_poll_ms")) || 10000;
const WS_URL = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline`;
const PENDING_FULL_ANALYSIS_KEY = "vaxagent.pendingFullAnalysis";

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
  currentRunId: "",
  stepStatuses: Object.fromEntries(PIPELINE_STEPS.map((step) => [step.key, "pending"])),
  stepExplanations: {},
  ws: null,
  historyRuns: [],
  historyStatus: "Run history appears when the backend is connected.",
  historyLoading: false,
  activeJob: null,
  retryAction: ""
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
  jobProgressNote: document.getElementById("job-progress-note"),
  retryLastActionButton: document.getElementById("retry-last-action"),
  refreshHistoryButton: document.getElementById("refresh-history"),
  historyStatus: document.getElementById("history-status"),
  historyList: document.getElementById("history-list")
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
let _jobElapsedInterval = null;
let _jobPollErrorCount = 0;

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function sentenceCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(value) {
  if (!value) return "Unknown time";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function setRetryAction(action) {
  state.retryAction = action;
  elements.retryLastActionButton.hidden = !action;
}

function resetRunState() {
  state.loaded = false;
  state.variantStats = null;
  state.candidates = [];
  state.blueprint = null;
  state.selectedCandidateRank = null;
  state.reportUrl = "";
  state.currentRunId = "";
  state.activeJob = null;
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

function renderRunHistory() {
  elements.historyStatus.textContent = state.historyStatus;

  if (state.historyLoading) {
    elements.historyList.className = "history-list";
    elements.historyList.innerHTML = '<div class="history-card"><p>Loading recent runs...</p></div>';
    return;
  }

  if (!state.historyRuns.length) {
    elements.historyList.className = "history-list empty-state";
    elements.historyList.textContent = "No backend run history yet.";
    return;
  }

  elements.historyList.className = "history-list";
  elements.historyList.innerHTML = state.historyRuns
    .map((run) => {
      const summary = run.summary || {};
      const isActive = run.run_id === state.currentRunId;
      const reportUrl = `${API_ORIGIN}/api/runs/${run.run_id}/report`;

      return `
        <article class="history-card reveal ${isActive ? "is-active" : ""}" data-run-id="${escapeHtml(run.run_id)}">
          <div>
            <h3>${escapeHtml(summary.dataset_name || run.dataset_id || "Saved pipeline run")}</h3>
            <p>${escapeHtml(summary.top_candidate || "Top candidate unavailable")} · ${escapeHtml(run.status)}</p>
            <div class="history-meta">
              <span class="history-pill">Run ${escapeHtml(run.run_id)}</span>
              <span class="history-pill">${escapeHtml(formatTimestamp(run.created_at))}</span>
              <span class="history-pill">${escapeHtml(`${summary.candidate_count || 0} candidates`)}</span>
            </div>
          </div>
          <div class="history-actions">
            <button class="secondary-button" data-run-report="${escapeHtml(reportUrl)}">Open Report</button>
            <button class="primary-button" data-run-open="${escapeHtml(run.run_id)}">Reopen Run</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.historyList.querySelectorAll("[data-run-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const runId = button.getAttribute("data-run-open");
      if (runId) void reopenRun(runId);
    });
  });

  elements.historyList.querySelectorAll("[data-run-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const reportUrl = button.getAttribute("data-run-report");
      if (reportUrl) {
        window.open(reportUrl, "_blank", "noopener");
      }
    });
  });
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

function buildCandidateComparison(candidate, nextCandidate) {
  if (!candidate || !nextCandidate) return "";

  const bindingDelta = Math.round((nextCandidate.ic50_mt || 0) - (candidate.ic50_mt || 0));
  const expressionDelta = ((candidate.gene_expression_tpm || 0) - (nextCandidate.gene_expression_tpm || 0)).toFixed(1);
  const vafDelta = Math.round(((candidate.tumor_dna_vaf || 0) - (nextCandidate.tumor_dna_vaf || 0)) * 100);

  return `${candidate.gene} ${candidate.mutation} stays ahead of ${nextCandidate.gene} ${nextCandidate.mutation} because it combines ${
    bindingDelta > 0 ? `${bindingDelta} nM stronger predicted binding` : "comparable predicted binding"
  }, ${expressionDelta > 0 ? `${expressionDelta} TPM higher expression` : "similar expression"}, and ${
    vafDelta > 0 ? `${vafDelta}% higher DNA VAF` : "similar clonality"
  }.`;
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
  const nextCandidate = state.candidates.find((item) => item.rank === candidate.rank + 1);
  const comparison = buildCandidateComparison(candidate, nextCandidate);

  state.selectedCandidateRank = candidate.rank;
  elements.explanationCard.className = "explanation-card reveal";
  elements.explanationCard.innerHTML = `
    <h3>${candidate.gene} ${candidate.mutation} ranks #${candidate.rank}</h3>
    <p class="explanation-copy">${narrative.summary}</p>
    ${rankingNote ? `<p class="explanation-copy">${rankingNote}</p>` : ""}
    ${comparison ? `<p class="explanation-copy"><strong>Why it outranks the next candidate:</strong> ${comparison}</p>` : ""}
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
  renderRunHistory();
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
    state.currentRunId = message.run_id || message.data?.run_id || "";
    state.activeJob = null;
    elements.exportButton.disabled = !state.reportUrl;
    elements.loadButton.disabled = false;
    elements.loadButton.textContent = "Reload Benchmark Case";
    clearPendingFullAnalysis();
    setRetryAction("");
    updateStatus(
      "backend",
      "Local backend run completed successfully. The export button now downloads the generated PDF research brief."
    );
    void fetchRunHistory();
  }

  renderAll();
}

function applyFallbackRun() {
  resetRunState();
  state.loaded = true;
  state.loading = false;
  state.activeJob = null;
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

function applySavedRun(run) {
  const payload = run.payload || {};

  resetRunState();
  state.loaded = true;
  state.loading = false;
  state.variantStats = payload.variant_stats || null;
  state.candidates = payload.candidates || [];
  state.blueprint = payload.blueprint || null;
  state.selectedCandidateRank = state.candidates[0]?.rank || null;
  state.currentRunId = run.run_id;
  state.reportUrl = payload.report_path ? `${API_ORIGIN}/api/runs/${run.run_id}/report` : "";
  state.stepStatuses = Object.fromEntries(PIPELINE_STEPS.map((step) => [step.key, "complete"]));
  state.stepExplanations = {
    load_dataset: "Loaded from saved backend run history.",
    ranking: "Candidate ranking was restored from a completed backend run.",
    report: "The PDF report for this saved run is ready to open."
  };
  elements.exportButton.disabled = !state.reportUrl;
  elements.loadButton.disabled = false;
  elements.loadButton.textContent = "Reload Benchmark Case";
  updateStatus(
    "backend",
    `Loaded saved run ${run.run_id}. The dataset summary, ranked candidates, and PDF report were restored from backend history.`
  );
  renderAll();
}

function persistPendingFullAnalysis(jobId, fileName, startedAt = Date.now()) {
  try {
    localStorage.setItem(
      PENDING_FULL_ANALYSIS_KEY,
      JSON.stringify({ jobId, fileName, startedAt })
    );
  } catch {
    // ignore localStorage failures
  }
}

function readPendingFullAnalysis() {
  try {
    const raw = localStorage.getItem(PENDING_FULL_ANALYSIS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingFullAnalysis() {
  try {
    localStorage.removeItem(PENDING_FULL_ANALYSIS_KEY);
  } catch {
    // ignore localStorage failures
  }
}

async function fetchRunHistory() {
  state.historyLoading = true;
  state.historyStatus = "Loading recent runs from the backend...";
  renderRunHistory();

  try {
    const response = await fetch(`${API_ORIGIN}/api/runs`);
    if (!response.ok) {
      throw new Error(`History request failed (HTTP ${response.status})`);
    }

    const result = await response.json();
    state.historyRuns = result.runs || [];
    state.historyStatus = state.historyRuns.length
      ? "Recent backend runs can be reopened or exported directly from here."
      : "The backend is available, but no runs have been saved yet.";
  } catch {
    state.historyRuns = [];
    state.historyStatus = "Run history is unavailable until the backend responds.";
  } finally {
    state.historyLoading = false;
    renderRunHistory();
  }
}

async function reopenRun(runId) {
  state.historyStatus = `Loading saved run ${runId}...`;
  renderRunHistory();

  try {
    const response = await fetch(`${API_ORIGIN}/api/runs/${runId}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Run reload failed (HTTP ${response.status})`);
    }

    const run = await response.json();
    applySavedRun(run);
    state.historyStatus = `Saved run ${runId} is active in the workspace.`;
    renderRunHistory();
  } catch (err) {
    state.historyStatus = `Could not reopen run ${runId}: ${err.message}`;
    renderRunHistory();
  }
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

function runBackendPipelineWithUrl(wsUrl, timeoutMs = PIPELINE_CONNECT_TIMEOUT_MS) {
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
    }, timeoutMs);

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
      let message;
      try {
        message = JSON.parse(event.data);
        applyPipelineMessage(message);
      } catch (_parseErr) {
        return;
      }

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

function startElapsedTimer(startedAt = Date.now()) {
  if (_jobElapsedInterval) {
    window.clearInterval(_jobElapsedInterval);
  }

  _jobStartTime = startedAt;
  const tick = () => {
    if (!_jobStartTime) return;
    const elapsed = Math.floor((Date.now() - _jobStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    elements.jobElapsed.textContent = `${mins}m ${secs}s elapsed`;
  };
  tick();
  _jobElapsedInterval = window.setInterval(tick, 1000);
}

function stopPolling() {
  if (_jobPollInterval) {
    window.clearInterval(_jobPollInterval);
    _jobPollInterval = null;
  }
  if (_jobElapsedInterval) {
    window.clearInterval(_jobElapsedInterval);
    _jobElapsedInterval = null;
  }
  _jobPollErrorCount = 0;
  _jobStartTime = null;
  elements.jobElapsed.textContent = "";
}

function restorePrimaryActions() {
  state.loading = false;
  elements.analyseButton.disabled = !elements.vcfFileInput.files[0];
  elements.analyseButton.textContent = "Analyse My File";
  elements.loadButton.disabled = false;
}

function describeRetryAction(action) {
  if (action === "demo") return "Retry Benchmark Load";
  if (action === "quick-analysis") return "Retry Quick Analysis";
  if (action === "full-analysis") return "Retry Full Analysis";
  if (action === "resume-full-analysis") return "Retry Result Reopen";
  return "Retry Last Action";
}

function scheduleRetryAction(action) {
  setRetryAction(action);
  if (action) {
    elements.retryLastActionButton.textContent = describeRetryAction(action);
  }
}

async function startCompletedJobPipeline(jobId, fileName) {
  updateProgressBar(100, "pVACseq complete. Loading results...");
  setUploadStatus(`pVACseq complete for ${fileName}. Running analysis pipeline...`);

  const wsUrl = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline?job_id=${jobId}`;
  const ok = await runBackendPipelineWithUrl(wsUrl, 60000);
  setProgressVisible(false);

  if (!ok) {
    setUploadStatus(
      "The backend could not reopen this completed pVACseq job into the workspace. Retry to request the finished results again.",
      true
    );
    scheduleRetryAction("resume-full-analysis");
    updateStatus(
      "idle",
      "The long-running backend job finished, but the final UI hydration step failed. Retry to reopen the completed result."
    );
  } else {
    setRetryAction("");
    setUploadStatus(`Full pVACseq analysis complete for ${fileName}.`);
  }
}

async function pollFullAnalysisJob(jobId, fileName) {
  try {
    const res = await fetch(`${API_ORIGIN}/api/jobs/${jobId}`);
    if (!res.ok) {
      return;
    }

    _jobPollErrorCount = 0;
    const job = await res.json();
    state.activeJob = {
      jobId,
      fileName,
      status: job.status,
      error: job.error_msg || ""
    };

    updateProgressBar(job.progress_pct || 5, `pVACseq ${job.status}...`);
    setUploadStatus(
      job.status === "running"
        ? `pVACseq is running for ${fileName}. Job ${jobId} remains resumable if you refresh this page.`
        : `Job ${jobId} is ${job.status}.`,
      false
    );

    if (job.status === "complete") {
      stopPolling();
      await startCompletedJobPipeline(jobId, fileName);
      restorePrimaryActions();
      return;
    }

    if (job.status === "failed") {
      stopPolling();
      clearPendingFullAnalysis();
      setProgressVisible(false);
      setUploadStatus(`pVACseq failed: ${job.error_msg || "unknown error"}`, true);
      scheduleRetryAction("full-analysis");
      state.activeJob = null;
      restorePrimaryActions();
      updateStatus(
        "idle",
        "The backend job failed before candidate ranking could be loaded. Review the error above and retry when ready."
      );
    }
  } catch {
    _jobPollErrorCount += 1;
    if (_jobPollErrorCount >= 3) {
      setUploadStatus(
        `Status polling lost contact with job ${jobId}. VaxAgent will keep retrying, and refreshing this page will resume the same job.`,
        true
      );
    }
  }
}

function beginFullAnalysisPolling(jobId, fileName, options = {}) {
  stopPolling();

  const startedAt = options.startedAt || Date.now();
  persistPendingFullAnalysis(jobId, fileName, startedAt);
  state.activeJob = {
    jobId,
    fileName,
    status: "queued",
    error: ""
  };

  setProgressVisible(true);
  updateProgressBar(options.initialProgress || 5, options.initialLabel || "pVACseq queued...");
  elements.jobProgressNote.textContent =
    "This full-analysis job is resumable. If the page refreshes, VaxAgent will reconnect to the same backend job automatically.";
  startElapsedTimer(startedAt);

  void pollFullAnalysisJob(jobId, fileName);
  _jobPollInterval = window.setInterval(() => {
    void pollFullAnalysisJob(jobId, fileName);
  }, JOB_POLL_INTERVAL_MS);
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
  setRetryAction("");
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
    scheduleRetryAction("full-analysis");
    restorePrimaryActions();
    updateStatus("idle", state.statusMessage);
    return;
  }

  elements.analyseButton.textContent = "pVACseq running...";
  setUploadStatus(`Job submitted (ID: ${jobId}). Polling for completion...`);
  beginFullAnalysisPolling(jobId, file.name);
}

function setUploadStatus(message, isError = false) {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.className = `upload-status ${isError ? "upload-status-error" : message ? "upload-status-info" : ""}`;
}

async function retryLastAction() {
  if (state.loading || !state.retryAction) return;

  if (state.retryAction === "demo") {
    return loadDemo();
  }

  if (state.retryAction === "resume-full-analysis") {
    const pending = readPendingFullAnalysis();
    if (pending) {
      resetRunState();
      state.loading = true;
      elements.analyseButton.disabled = true;
      elements.loadButton.disabled = true;
      elements.analyseButton.textContent = "Resuming...";
      updateStatus("running", `Reopening completed backend job ${pending.jobId} into the workspace.`);
      renderAll();
      beginFullAnalysisPolling(pending.jobId, pending.fileName, {
        startedAt: pending.startedAt,
        initialLabel: "Reconnecting to backend job..."
      });
      return;
    }
  }

  if (state.retryAction === "quick-analysis") {
    return uploadAndRun();
  }

  if (state.retryAction === "full-analysis") {
    return submitFullPipeline();
  }
}

async function restorePendingFullAnalysis() {
  const pending = readPendingFullAnalysis();
  if (!pending || state.loading) return;

  resetRunState();
  state.loading = true;
  elements.analyseButton.disabled = true;
  elements.loadButton.disabled = true;
  elements.analyseButton.textContent = "Resuming...";
  setRetryAction("");
  setUploadStatus(
    `Recovered active pVACseq job ${pending.jobId} for ${pending.fileName}. Reconnecting to backend progress...`
  );
  updateStatus(
    "running",
    `Recovered backend job ${pending.jobId} after refresh. VaxAgent is reconnecting to the long-running analysis.`
  );
  renderAll();

  beginFullAnalysisPolling(pending.jobId, pending.fileName, {
    startedAt: pending.startedAt,
    initialLabel: "Reconnecting to backend job..."
  });
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
  setRetryAction("");
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
    scheduleRetryAction("quick-analysis");
    restorePrimaryActions();
    updateStatus("idle", state.statusMessage);
    return;
  }

  const wsUrl = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline?file_id=${fileId}`;
  const backendSucceeded = await runBackendPipelineWithUrl(wsUrl);

  if (!backendSucceeded) {
    setUploadStatus("Pipeline failed after upload. The benchmark fixture was loaded as a fallback.", true);
    scheduleRetryAction("quick-analysis");
    applyFallbackRun();
  } else {
    setUploadStatus(`Analysis complete for ${file.name}.`);
    setRetryAction("");
  }

  restorePrimaryActions();
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
  setRetryAction("");
  updateStatus(
    "running",
    "Trying the local backend first so the demo can use the full pipeline path."
  );
  renderAll();

  const backendSucceeded = await runBackendPipeline();

  if (!backendSucceeded) {
    scheduleRetryAction("demo");
    applyFallbackRun();
  } else {
    setRetryAction("");
  }
}

elements.loadButton.addEventListener("click", loadDemo);
elements.exportButton.addEventListener("click", exportBrief);
elements.retryLastActionButton.addEventListener("click", () => {
  void retryLastAction();
});
elements.refreshHistoryButton.addEventListener("click", () => {
  void fetchRunHistory();
});

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
void fetchRunHistory();
void restorePendingFullAnalysis();
