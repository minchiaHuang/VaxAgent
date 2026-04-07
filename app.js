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
    ].join("\n"),
    segments: [
      { type: "cap", label: "5' Cap" },
      { type: "utr", label: "5' UTR" },
      { type: "signal", label: "Signal Peptide" },
      { type: "target", label: "TP53 R248W", rank: 1 },
      { type: "linker", label: "Linker" },
      { type: "target", label: "PIK3CA E545K", rank: 2 },
      { type: "linker", label: "Linker" },
      { type: "target", label: "BRCA1 T1685I", rank: 3 },
      { type: "linker", label: "Linker" },
      { type: "target", label: "PTEN R130Q", rank: 4 },
      { type: "linker", label: "Linker" },
      { type: "target", label: "RB1 R698W", rank: 5 },
      { type: "stop", label: "Stop" },
      { type: "utr", label: "3' UTR" },
      { type: "polya", label: "Poly(A)" }
    ]
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
  retryAction: "",
  // Visual Explorer state
  currentScene: null,
  explorerTargetRank: 1,
  explanationCache: {},
  selectedConstructSegment: null,
  fetchingExplanation: false
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
  historyList: document.getElementById("history-list"),
  // Visual Explorer elements
  stepCandidates: document.getElementById("step-candidates"),
  stepBlueprint: document.getElementById("step-blueprint"),
  sceneFunnel: document.getElementById("scene-funnel"),
  sceneExplorer: document.getElementById("scene-explorer"),
  sceneConstruct: document.getElementById("scene-construct"),
  funnelViz: document.getElementById("funnel-viz"),
  funnelSvgWrap: document.getElementById("funnel-svg-wrap"),
  funnelStatic: document.getElementById("funnel-static"),
  funnelStaticList: document.getElementById("funnel-static-list"),
  funnelExplanation: document.getElementById("funnel-explanation"),
  proteinSvg: document.getElementById("protein-svg"),
  mutationMarker: document.getElementById("mutation-marker"),
  mutationLabel: document.getElementById("mutation-label"),
  surfaceBadge: document.getElementById("surface-badge"),
  explorerTabs: document.getElementById("explorer-tabs"),
  explorerSchematic: document.getElementById("explorer-schematic"),
  explorerExplanation: document.getElementById("explorer-explanation"),
  explorerStatic: document.getElementById("explorer-static"),
  explorerStaticCards: document.getElementById("explorer-static-cards"),
  constructViz: document.getElementById("construct-viz"),
  constructSvgWrap: document.getElementById("construct-svg-wrap"),
  constructExplanation: document.getElementById("construct-explanation"),
  legacyCandidates: document.getElementById("legacy-candidates"),
  legacyExplanationLayout: document.getElementById("legacy-explanation-layout")
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
  // Reset visual explorer state
  state.currentScene = null;
  state.explorerTargetRank = 1;
  state.explanationCache = {};
  state.selectedConstructSegment = null;
  state.fetchingExplanation = false;
  // Reset animation controller
  if (typeof animController !== "undefined") {
    animController.timelines = {};
    animController.played = new Set();
  }
  // Hide visual explorer panels
  if (elements.stepCandidates) elements.stepCandidates.style.display = "none";
  if (elements.stepBlueprint) elements.stepBlueprint.style.display = "none";
  const sceneNav = document.getElementById("scene-nav");
  if (sceneNav) sceneNav.style.display = "none";
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

/* ══════════════════════════════════════════════════════════════════════════
   VISUAL EXPLORER — Animation Controller, Scene Rendering, Sub-scenes
   ══════════════════════════════════════════════════════════════════════════ */

const _prefersReducedMotion =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SEGMENT_DESCRIPTIONS = {
  cap: "A chemical cap that protects the mRNA and tells the cell to start reading it.",
  utr: "A helper sequence that ensures the cell reads the instructions efficiently.",
  signal: "Tells the cell to display the vaccine targets on its surface for the immune system to see.",
  linker: "A short spacer between targets that ensures each one folds correctly.",
  stop: "A stop signal that tells the cell it has finished reading the vaccine blueprint.",
  polya: "A tail of repeated bases that protects the mRNA from being broken down too quickly.",
  target: "One of the selected neoantigen targets encoded in the vaccine construct."
};

class AnimationController {
  constructor() {
    this.timelines = {};
    this.played = new Set();
  }

  register(sceneId, timeline) {
    this.timelines[sceneId] = timeline;
  }

  play(sceneId) {
    if (this.played.has(sceneId)) return;
    if (_prefersReducedMotion) {
      this.skipToEnd(sceneId);
      return;
    }
    const tl = this.timelines[sceneId];
    if (tl) {
      tl.play();
    }
    this.played.add(sceneId);
  }

  skipToEnd(sceneId) {
    const tl = this.timelines[sceneId];
    if (tl) {
      tl.progress(1);
    }
    this.played.add(sceneId);
  }

  isPlaying(sceneId) {
    const tl = this.timelines[sceneId];
    return tl ? tl.isActive() : false;
  }

  hasPlayed(sceneId) {
    return this.played.has(sceneId);
  }
}

const animController = new AnimationController();

// ── Scene navigation ──────────────────────────────────────────────────────

function activateScene(sceneId) {
  state.currentScene = sceneId;

  // Toggle scene containers
  if (elements.sceneFunnel) {
    elements.sceneFunnel.classList.toggle("is-active", sceneId === "3a");
  }
  if (elements.sceneExplorer) {
    elements.sceneExplorer.classList.toggle("is-active", sceneId === "3b");
  }
  if (elements.sceneConstruct) {
    elements.sceneConstruct.classList.toggle("is-active", sceneId === "4a");
  }

  // Show/hide the step panels
  if (elements.stepCandidates) {
    elements.stepCandidates.style.display = (sceneId === "3a" || sceneId === "3b") ? "" : "none";
  }
  if (elements.stepBlueprint) {
    elements.stepBlueprint.style.display = (sceneId === "4a") ? "" : "none";
  }

  // Play animations if first visit
  if (sceneId === "3a") {
    buildFunnelTimeline();
    animController.play("funnel");
  }
  if (sceneId === "3b") {
    renderExplorerScene();
  }
  if (sceneId === "4a") {
    renderConstructScene();
    buildConstructTimeline();
    animController.play("construct");
  }

  // Update navigation buttons
  updateSceneNavButtons();
}

function updateSceneNavButtons() {
  // Find or create scene nav buttons
  let navContainer = document.getElementById("scene-nav");
  if (!navContainer) {
    navContainer = document.createElement("div");
    navContainer.id = "scene-nav";
    navContainer.style.cssText =
      "display:flex; justify-content:space-between; align-items:center; max-width:600px; margin:24px auto 0; gap:12px;";

    const backBtn = document.createElement("button");
    backBtn.id = "scene-back";
    backBtn.className = "secondary-button";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", sceneGoBack);

    const nextBtn = document.createElement("button");
    nextBtn.id = "scene-next";
    nextBtn.className = "primary-button";
    nextBtn.textContent = "Continue";
    nextBtn.addEventListener("click", sceneGoNext);

    navContainer.appendChild(backBtn);
    navContainer.appendChild(nextBtn);

    // Insert after step-candidates or step-blueprint depending on active scene
    const parent = (state.currentScene === "4a")
      ? elements.stepBlueprint
      : elements.stepCandidates;
    if (parent) parent.appendChild(navContainer);
  }

  // Re-parent to the correct panel
  const parent = (state.currentScene === "4a")
    ? elements.stepBlueprint
    : elements.stepCandidates;
  if (parent && navContainer.parentElement !== parent) {
    parent.appendChild(navContainer);
  }

  const backBtn = document.getElementById("scene-back");
  const nextBtn = document.getElementById("scene-next");

  if (state.currentScene === "3a") {
    backBtn.style.visibility = "hidden";
    nextBtn.textContent = "See your targets";
    nextBtn.style.display = "";
  } else if (state.currentScene === "3b") {
    backBtn.style.visibility = "";
    backBtn.textContent = "Back to overview";
    nextBtn.textContent = "View Blueprint";
    nextBtn.style.display = "";
  } else if (state.currentScene === "4a") {
    backBtn.style.visibility = "";
    backBtn.textContent = "Back to targets";
    nextBtn.style.display = "none";
  }

  navContainer.style.display = state.currentScene ? "flex" : "none";
}

function sceneGoNext() {
  // Skip any playing animation first
  if (state.currentScene && animController.isPlaying(
    state.currentScene === "3a" ? "funnel" : state.currentScene === "4a" ? "construct" : ""
  )) {
    animController.skipToEnd(state.currentScene === "3a" ? "funnel" : "construct");
    return;
  }

  if (state.currentScene === "3a") {
    activateScene("3b");
  } else if (state.currentScene === "3b") {
    activateScene("4a");
  }
}

function sceneGoBack() {
  if (state.currentScene === "3b") {
    activateScene("3a");
  } else if (state.currentScene === "4a") {
    activateScene("3b");
  }
}

// ── Click-to-skip handler ─────────────────────────────────────────────────

function handleSceneClick(e) {
  // Don't skip if clicking interactive elements
  if (e.target.closest("button, .explorer-tab, .construct-segment, .ve-accordion-trigger, .ve-retry-link")) {
    return;
  }
  if (state.currentScene === "3a" && animController.isPlaying("funnel")) {
    animController.skipToEnd("funnel");
  }
  if (state.currentScene === "4a" && animController.isPlaying("construct")) {
    animController.skipToEnd("construct");
  }
}

if (elements.stepCandidates) {
  elements.stepCandidates.addEventListener("click", handleSceneClick);
}
if (elements.stepBlueprint) {
  elements.stepBlueprint.addEventListener("click", handleSceneClick);
}

// ── Funnel Visualization (Scene 3a) ───────────────────────────────────────

function buildFunnelTimeline() {
  if (animController.timelines.funnel || !state.variantStats) return;

  const stats = state.variantStats.stats || {};
  const tiers = [
    { tier: 1, value: stats.total_variants || 0, width: 520, x: 40 },
    { tier: 2, value: stats.missense_mutations || 0, width: 400, x: 100 },
    { tier: 3, value: stats.initial_predictions || 0, width: 280, x: 160 },
    { tier: 4, value: stats.shortlisted_candidates || state.candidates.length || 0, width: 160, x: 220 }
  ];

  // Set width proportional to values
  const maxVal = tiers[0].value || 1;
  tiers.forEach((t) => {
    t.barWidth = Math.max(40, (t.value / maxVal) * 520);
  });

  // Populate static fallback list (mobile)
  const staticLabels = ["Variants found", "Change proteins", "Potential targets screened", "Top targets selected"];
  if (elements.funnelStaticList) {
    elements.funnelStaticList.innerHTML = tiers.map((t, i) =>
      `<li class="funnel-static-item">
        <span class="stat-label">${staticLabels[i]}</span>
        <span class="stat-value">${formatNumber(t.value)}</span>
      </li>`
    ).join("");
  }

  // Set explanation text
  const explanationText = state.stepExplanations.load_dataset ||
    `We analyzed ${formatNumber(tiers[0].value)} variants and filtered them down to ${formatNumber(tiers[3].value)} top vaccine targets through successive screening stages.`;
  if (elements.funnelExplanation) {
    elements.funnelExplanation.textContent = explanationText;
  }

  if (typeof gsap === "undefined") {
    // No GSAP — show end state
    tiers.forEach((t) => {
      const bar = elements.funnelViz?.querySelector(`.funnel-bar[data-tier="${t.tier}"]`);
      const count = elements.funnelViz?.querySelector(`.funnel-count[data-tier="${t.tier}"]`);
      if (bar) bar.setAttribute("width", t.barWidth);
      if (count) count.textContent = formatNumber(t.value);
    });
    elements.funnelViz?.querySelectorAll(".funnel-connector").forEach((c) => c.setAttribute("opacity", "1"));
    if (elements.funnelExplanation) elements.funnelExplanation.style.opacity = "1";
    animController.played.add("funnel");
    return;
  }

  const tl = gsap.timeline({ paused: true });

  tiers.forEach((t, i) => {
    const bar = elements.funnelViz?.querySelector(`.funnel-bar[data-tier="${t.tier}"]`);
    const count = elements.funnelViz?.querySelector(`.funnel-count[data-tier="${t.tier}"]`);

    if (bar) {
      tl.to(bar, {
        attr: { width: t.barWidth },
        duration: 0.4,
        ease: "power2.out"
      }, i * 0.35);
    }

    if (count) {
      tl.to({ val: 0 }, {
        val: t.value,
        duration: 0.5,
        ease: "power1.out",
        snap: { val: 1 },
        onUpdate: function () {
          count.textContent = formatNumber(Math.round(this.targets()[0].val));
        }
      }, i * 0.35);
    }

    // Connector lines after each tier except last
    if (i < tiers.length - 1) {
      const c1 = document.getElementById(`fc-${i * 2 + 1}`);
      const c2 = document.getElementById(`fc-${i * 2 + 2}`);
      if (c1) tl.to(c1, { attr: { opacity: 1 }, duration: 0.2 }, i * 0.35 + 0.3);
      if (c2) tl.to(c2, { attr: { opacity: 1 }, duration: 0.2 }, i * 0.35 + 0.3);
    }
  });

  // Tier 4 bounce
  const tier4group = elements.funnelViz?.querySelector('.funnel-tier[data-tier="4"]');
  if (tier4group) {
    tl.to(tier4group, {
      scale: 1.03,
      transformOrigin: "center center",
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: "power2.inOut"
    }, tiers.length * 0.35);
  }

  // Fade in explanation
  if (elements.funnelExplanation) {
    tl.to(elements.funnelExplanation, { opacity: 1, duration: 0.3 }, tiers.length * 0.35 + 0.2);
  }

  animController.register("funnel", tl);
}

// ── Target Explorer (Scene 3b) ────────────────────────────────────────────

function renderExplorerScene() {
  if (!state.candidates.length) return;

  // Render tabs
  renderExplorerTabs();

  // Render the current target
  renderExplorerTarget(state.explorerTargetRank);

  // Render mobile static cards
  renderExplorerStaticCards();
}

function getStrengthDots(score) {
  if (score >= 70) return "\u25cf\u25cf\u25cf";
  if (score >= 55) return "\u25cf\u25cf";
  return "\u25cf";
}

function renderExplorerTabs() {
  if (!elements.explorerTabs) return;

  elements.explorerTabs.innerHTML = state.candidates.map((c) => {
    const selected = c.rank === state.explorerTargetRank ? "is-selected" : "";
    return `
      <button class="explorer-tab ${selected}" data-rank="${c.rank}">
        <span class="tab-rank">#${c.rank}</span>
        <span>${c.gene}</span>
        <span class="tab-dots">${getStrengthDots(c.priority_score)}</span>
      </button>
    `;
  }).join("");

  elements.explorerTabs.querySelectorAll(".explorer-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const rank = Number(tab.getAttribute("data-rank"));
      if (rank !== state.explorerTargetRank) {
        switchExplorerTarget(rank);
      }
    });
  });
}

function renderExplorerTarget(rank) {
  const candidate = state.candidates.find((c) => c.rank === rank);
  if (!candidate) return;

  state.explorerTargetRank = rank;

  // Update protein schematic
  updateProteinSchematic(candidate);

  // Update explanation panel
  renderExplorerExplanation(candidate);
}

function updateProteinSchematic(candidate) {
  const marker = elements.mutationMarker;
  const label = elements.mutationLabel;
  const badge = elements.surfaceBadge;

  if (!marker || !label) return;

  const isSurface = candidate.surface_accessible !== false;

  // Position mutation marker
  if (isSurface) {
    // Surface: on the outer edge of the protein body
    marker.setAttribute("x", "355");
    marker.setAttribute("y", "130");
    marker.className.baseVal = "mutation-marker surface";
  } else {
    // Buried: deep inside the protein body
    marker.setAttribute("x", "230");
    marker.setAttribute("y", "185");
    marker.className.baseVal = "mutation-marker buried";
  }

  // Label
  const labelX = isSurface ? 400 : 275;
  const labelY = isSurface ? 125 : 180;
  label.setAttribute("x", labelX);
  label.setAttribute("y", labelY - 20);
  label.textContent = `${candidate.gene} ${candidate.mutation}`;

  // Surface badge
  if (badge) {
    if (isSurface) {
      badge.className = "surface-badge is-surface";
      badge.innerHTML = "\u2713 Immune cells can reach this target";
    } else {
      badge.className = "surface-badge is-buried";
      badge.innerHTML = "\u26a0 Harder for immune cells to reach";
    }
  }
}

function switchExplorerTarget(toRank) {
  const fromRank = state.explorerTargetRank;
  const toCandidate = state.candidates.find((c) => c.rank === toRank);
  if (!toCandidate) return;

  if (typeof gsap !== "undefined" && !_prefersReducedMotion) {
    // Animated switch
    const marker = elements.mutationMarker;
    const label = elements.mutationLabel;

    gsap.to(marker, {
      opacity: 0,
      duration: 0.15,
      onComplete: () => {
        updateProteinSchematic(toCandidate);
        gsap.fromTo(marker, { opacity: 0 }, { opacity: 1, duration: 0.15 });
      }
    });

    gsap.to(label, {
      opacity: 0,
      duration: 0.15,
      onComplete: () => {
        gsap.to(label, { opacity: 1, duration: 0.15 });
      }
    });

    // Crossfade explanation
    if (elements.explorerExplanation) {
      gsap.to(elements.explorerExplanation, {
        opacity: 0,
        duration: 0.1,
        onComplete: () => {
          renderExplorerExplanation(toCandidate);
          gsap.to(elements.explorerExplanation, { opacity: 1, duration: 0.2 });
        }
      });
    }
  } else {
    // Instant switch
    renderExplorerTarget(toRank);
  }

  state.explorerTargetRank = toRank;

  // Update tab selection
  elements.explorerTabs?.querySelectorAll(".explorer-tab").forEach((tab) => {
    tab.classList.toggle("is-selected", Number(tab.getAttribute("data-rank")) === toRank);
  });
}

function buildFriendlyNarrative(candidate) {
  const bindingStrength = candidate.ic50_mt < 100
    ? "very strong" : candidate.ic50_mt < 250 ? "moderate" : "weaker";

  const surfaceNote = candidate.surface_accessible !== false
    ? "The mutation is located on the protein surface where immune cells can access it, which strengthens the case for targeting it."
    : "The mutation appears to be buried inside the protein, making it harder for immune cells to reach. This lowers its priority.";

  return `${candidate.gene} ${candidate.mutation} is ranked #${candidate.rank} with a priority score of ${candidate.priority_score}. ` +
    `It shows ${bindingStrength} predicted binding (${candidate.ic50_mt} nM) to ${candidate.hla_allele}. ` +
    `The tumor expresses this gene at ${candidate.gene_expression_tpm} TPM with ` +
    `${candidate.clonality} clonality (${formatPercent(candidate.tumor_dna_vaf || 0)} of tumor cells carry it). ` +
    surfaceNote;
}

function renderExplorerExplanation(candidate) {
  if (!elements.explorerExplanation) return;

  const narrative = buildFriendlyNarrative(candidate);

  elements.explorerExplanation.innerHTML = `
    <div class="panel-header">
      <h3 class="panel-title">${escapeHtml(candidate.gene)} \u00b7 ${escapeHtml(candidate.mutation)}</h3>
      <span class="panel-subtitle">Score ${candidate.priority_score}</span>
      <span class="surface-badge ${candidate.surface_accessible !== false ? "is-surface" : "is-buried"}"
        style="font-size:0.75rem; padding:3px 8px;">
        ${candidate.surface_accessible !== false ? "\u2713 Surface" : "\u26a0 Buried"}
      </span>
    </div>
    <p class="panel-summary">${escapeHtml(narrative)}</p>

    <div class="ve-accordion-item" data-question="how_immune_binding_works" data-rank="${candidate.rank}">
      <button class="ve-accordion-trigger">
        <span class="ve-accordion-chevron">\u25b8</span>
        How does immune binding work?
      </button>
      <div class="ve-accordion-body"></div>
    </div>

    <div class="ve-accordion-item" data-question="why_surface_accessibility_matters" data-rank="${candidate.rank}">
      <button class="ve-accordion-trigger">
        <span class="ve-accordion-chevron">\u25b8</span>
        Why is surface accessibility important?
      </button>
      <div class="ve-accordion-body"></div>
    </div>

    <div class="ve-accordion-item" data-question="tech_values" data-rank="${candidate.rank}">
      <button class="ve-accordion-trigger">
        <span class="ve-accordion-chevron">\u25b8</span>
        Technical values
      </button>
      <div class="ve-accordion-body">
        <table style="width:100%; font-size:0.84rem; border-collapse:collapse;">
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">Peptide</td><td style="padding:4px 8px; font-weight:600;">${escapeHtml(candidate.mt_epitope_seq)}</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">HLA allele</td><td style="padding:4px 8px; font-weight:600;">${escapeHtml(candidate.hla_allele)}</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">IC50 (binding)</td><td style="padding:4px 8px; font-weight:600;">${candidate.ic50_mt} nM</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">Fold change</td><td style="padding:4px 8px; font-weight:600;">${candidate.fold_change}x</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">Expression</td><td style="padding:4px 8px; font-weight:600;">${candidate.gene_expression_tpm} TPM</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">DNA VAF</td><td style="padding:4px 8px; font-weight:600;">${formatPercent(candidate.tumor_dna_vaf || 0)}</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">Clonality</td><td style="padding:4px 8px; font-weight:600;">${sentenceCase(candidate.clonality)}</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">pLDDT</td><td style="padding:4px 8px; font-weight:600;">${candidate.plddt || "N/A"}</td></tr>
          <tr><td style="padding:4px 8px; color:var(--ve-muted);">Surface accessible</td><td style="padding:4px 8px; font-weight:600;">${candidate.surface_accessible !== false ? "Yes" : "No"}</td></tr>
        </table>
      </div>
    </div>
  `;

  // Wire accordion triggers
  elements.explorerExplanation.querySelectorAll(".ve-accordion-trigger").forEach((trigger) => {
    trigger.addEventListener("click", handleAccordionClick);
  });
}

async function handleAccordionClick(e) {
  const item = e.currentTarget.closest(".ve-accordion-item");
  if (!item) return;

  const question = item.getAttribute("data-question");
  const rank = Number(item.getAttribute("data-rank"));
  const body = item.querySelector(".ve-accordion-body");
  const panel = item.closest(".ve-explanation-panel") || item.closest(".construct-explanation");

  // Accordion behavior: close other open items in the same panel
  if (panel) {
    panel.querySelectorAll(".ve-accordion-item.is-open").forEach((other) => {
      if (other !== item) {
        other.classList.remove("is-open");
      }
    });
  }

  // Toggle
  if (item.classList.contains("is-open")) {
    item.classList.remove("is-open");
    return;
  }

  item.classList.add("is-open");

  // Tech values are pre-rendered, no fetch needed
  if (question === "tech_values" || question === "segment_static") return;

  // Check cache
  const cacheKey = `${rank}:${question}`;
  if (state.explanationCache[cacheKey]) {
    body.textContent = state.explanationCache[cacheKey];
    return;
  }

  // Show loading shimmer
  body.innerHTML = `
    <div class="ve-shimmer">
      <div class="ve-shimmer-line" style="width:100%"></div>
      <div class="ve-shimmer-line"></div>
      <div class="ve-shimmer-line"></div>
    </div>
  `;

  // Fetch explanation
  await fetchAndDisplayExplanation(rank, question, body, cacheKey);
}

async function fetchAndDisplayExplanation(rank, question, bodyEl, cacheKey) {
  if (state.fetchingExplanation) return;

  const candidate = state.candidates.find((c) => c.rank === rank);
  if (!candidate && question !== "construct_segment_purpose") {
    bodyEl.innerHTML = '<span class="ve-error-msg">Unable to load explanation.</span>';
    return;
  }

  state.fetchingExplanation = true;

  const context = candidate ? {
    gene: candidate.gene,
    mutation: candidate.mutation,
    ic50_mt: candidate.ic50_mt,
    hla_allele: candidate.hla_allele,
    surface_accessible: candidate.surface_accessible,
    plddt: candidate.plddt
  } : {};

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_ORIGIN}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, question }),
      signal: controller.signal
    });

    window.clearTimeout(timeoutId);

    if (!response.ok) throw new Error("Request failed");

    const result = await response.json();
    const explanation = result.explanation || "No explanation available.";

    state.explanationCache[cacheKey] = explanation;
    bodyEl.textContent = explanation;
  } catch {
    bodyEl.innerHTML = `
      <span class="ve-error-msg">Unable to load explanation.</span>
      <button class="ve-retry-link" onclick="this.closest('.ve-accordion-item').classList.remove('is-open'); this.closest('.ve-accordion-item').querySelector('.ve-accordion-trigger').click();">
        Try again
      </button>
    `;
  } finally {
    state.fetchingExplanation = false;
  }
}

function renderExplorerStaticCards() {
  if (!elements.explorerStaticCards) return;

  elements.explorerStaticCards.innerHTML = state.candidates.map((c) => {
    const narrative = buildFriendlyNarrative(c);
    const bindingLabel = c.ic50_mt < 100 ? "Strong" : c.ic50_mt < 250 ? "Moderate" : "Weak";

    return `
      <div class="explorer-static-card" data-rank="${c.rank}">
        <div class="card-header">
          <span class="card-gene">${escapeHtml(c.gene)} ${escapeHtml(c.mutation)}</span>
          <span class="card-rank">#${c.rank}</span>
        </div>
        <p class="card-summary">${escapeHtml(c.hla_allele)} \u00b7 ${bindingLabel} binding \u00b7 Score ${c.priority_score}</p>
        <div class="card-detail">${escapeHtml(narrative)}</div>
      </div>
    `;
  }).join("");

  elements.explorerStaticCards.querySelectorAll(".explorer-static-card").forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("is-expanded");
    });
  });
}

// ── Construct Assembly (Scene 4a) ─────────────────────────────────────────

function renderConstructScene() {
  if (!state.blueprint) return;

  const segments = state.blueprint.segments || buildDefaultSegments();
  const svg = elements.constructViz;
  if (!svg) return;

  // Calculate layout
  const padding = 20;
  const segHeight = 44;
  const gap = 4;
  const linkerWidth = 24;
  const y = 48;

  // Size segments proportionally
  let totalContentWidth = 0;
  const segSizes = segments.map((seg) => {
    const w = seg.type === "linker" ? linkerWidth :
              seg.type === "target" ? 90 :
              seg.type === "cap" || seg.type === "stop" ? 50 :
              seg.type === "polya" ? 70 : 65;
    totalContentWidth += w + gap;
    return w;
  });
  totalContentWidth -= gap; // no trailing gap

  const svgWidth = Math.max(700, totalContentWidth + padding * 2);
  svg.setAttribute("viewBox", `0 0 ${svgWidth} 140`);
  svg.innerHTML = "";

  let x = padding;
  segments.forEach((seg, i) => {
    const w = segSizes[i];
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "construct-segment");
    g.setAttribute("data-index", i);
    g.style.opacity = "0"; // start hidden for animation

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", `segment-rect type-${seg.type}`);
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", w);
    rect.setAttribute("height", segHeight);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", `segment-label ${seg.type === "linker" ? "type-linker" : ""}`);
    label.setAttribute("x", x + w / 2);
    label.setAttribute("y", y + segHeight / 2);
    label.textContent = seg.type === "linker" ? "\u00b7\u00b7\u00b7" : (seg.label.length > 12 ? seg.label.slice(0, 11) + "\u2026" : seg.label);

    // Top label for segment type
    const topLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    topLabel.setAttribute("class", "segment-label");
    topLabel.setAttribute("x", x + w / 2);
    topLabel.setAttribute("y", y - 8);
    topLabel.style.fontSize = "9px";
    topLabel.style.fill = "var(--ve-muted)";
    topLabel.textContent = seg.type === "target" ? `#${seg.rank || ""}` : "";

    g.appendChild(rect);
    g.appendChild(label);
    if (topLabel.textContent) g.appendChild(topLabel);
    svg.appendChild(g);

    x += w + gap;
  });

  // Wire click handlers
  svg.querySelectorAll(".construct-segment").forEach((segEl) => {
    segEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(segEl.getAttribute("data-index"));
      selectConstructSegment(idx, segments);
    });
  });
}

function buildDefaultSegments() {
  // Fallback if blueprint doesn't have segments
  const segs = [
    { type: "cap", label: "5' Cap" },
    { type: "utr", label: "5' UTR" },
    { type: "signal", label: "Signal Peptide" }
  ];
  state.candidates.forEach((c, i) => {
    if (i > 0) segs.push({ type: "linker", label: "Linker" });
    segs.push({ type: "target", label: `${c.gene} ${c.mutation}`, rank: c.rank });
  });
  segs.push({ type: "stop", label: "Stop" });
  segs.push({ type: "utr", label: "3' UTR" });
  segs.push({ type: "polya", label: "Poly(A)" });
  return segs;
}

function selectConstructSegment(index, segments) {
  const seg = segments[index];
  if (!seg) return;

  state.selectedConstructSegment = index;

  // Highlight selected segment
  const svg = elements.constructViz;
  if (svg) {
    svg.querySelectorAll(".construct-segment").forEach((el, i) => {
      el.classList.toggle("is-selected", i === index);
    });
  }

  // Show explanation
  const panel = elements.constructExplanation;
  if (!panel) return;

  const description = SEGMENT_DESCRIPTIONS[seg.type] || "Part of the mRNA construct.";
  const candidate = seg.rank ? state.candidates.find((c) => c.rank === seg.rank) : null;

  let html = `
    <div class="ve-explanation-panel">
      <div class="panel-header">
        <h3 class="panel-title">${escapeHtml(seg.label)}</h3>
        <span class="panel-subtitle">${seg.type}</span>
      </div>
      <p class="panel-summary">${escapeHtml(description)}</p>
  `;

  if (candidate) {
    const bindingLabel = candidate.ic50_mt < 100 ? "Strong" : candidate.ic50_mt < 250 ? "Moderate" : "Weak";
    html += `
      <p class="panel-summary" style="margin-top:0;">
        <strong>${escapeHtml(candidate.gene)} ${escapeHtml(candidate.mutation)}</strong> \u00b7
        ${bindingLabel} binding (${candidate.ic50_mt} nM) \u00b7
        Score ${candidate.priority_score} \u00b7
        ${candidate.surface_accessible !== false ? "Surface accessible" : "Buried"}
      </p>
      <button class="ve-retry-link" style="margin-top:4px;"
        onclick="activateScene('3b'); switchExplorerTarget(${candidate.rank});">
        See details in explorer \u2192
      </button>
    `;
  }

  html += `
      <div class="ve-accordion-item" data-question="construct_segment_purpose" data-rank="${seg.rank || 0}">
        <button class="ve-accordion-trigger">
          <span class="ve-accordion-chevron">\u25b8</span>
          Learn more about this component
        </button>
        <div class="ve-accordion-body"></div>
      </div>
    </div>
  `;

  panel.innerHTML = html;

  // Wire accordion
  panel.querySelectorAll(".ve-accordion-trigger").forEach((trigger) => {
    trigger.addEventListener("click", handleAccordionClick);
  });
}

function buildConstructTimeline() {
  if (animController.timelines.construct || !state.blueprint) return;

  const svg = elements.constructViz;
  if (!svg || typeof gsap === "undefined") {
    // No GSAP — show end state
    svg?.querySelectorAll(".construct-segment").forEach((el) => {
      el.style.opacity = "1";
    });
    animController.played.add("construct");
    return;
  }

  const segEls = svg.querySelectorAll(".construct-segment");
  if (!segEls.length) return;

  const tl = gsap.timeline({ paused: true });

  segEls.forEach((el, i) => {
    const isTarget = el.querySelector(".type-target");
    const duration = isTarget ? 0.25 : 0.18;
    const bounce = isTarget ? -6 : -3;

    tl.fromTo(el, {
      opacity: 0,
      x: -30
    }, {
      opacity: 1,
      x: 0,
      duration,
      ease: "back.out(1.4)"
    }, i * 0.15);

    if (isTarget) {
      tl.to(el, {
        y: bounce,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut"
      }, i * 0.15 + duration);
    }
  });

  // Final glow pulse on the whole construct
  tl.to(segEls, {
    filter: "brightness(1.08)",
    duration: 0.2,
    yoyo: true,
    repeat: 1,
    stagger: 0
  }, "+=0.1");

  animController.register("construct", tl);
}

// ── Visual Explorer entry point ───────────────────────────────────────────

function enterVisualExplorer() {
  if (!state.loaded || !state.variantStats) return;

  // Hide legacy panels
  if (elements.legacyCandidates) elements.legacyCandidates.style.display = "none";
  if (elements.legacyExplanationLayout) elements.legacyExplanationLayout.style.display = "none";

  // Show step panels
  if (elements.stepCandidates) elements.stepCandidates.style.display = "";
  if (elements.stepBlueprint) elements.stepBlueprint.style.display = "none";

  // Reset explorer target to rank 1
  state.explorerTargetRank = state.candidates[0]?.rank || 1;

  // Activate the funnel scene
  activateScene("3a");
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

  // Enter visual explorer when data is ready
  if (message.step === "pipeline_complete" && message.status === "complete") {
    enterVisualExplorer();
  }
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
  enterVisualExplorer();
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
  enterVisualExplorer();
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
