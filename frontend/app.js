/* ── Configuration ────────────────────────────────────────────────────── */

const _isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const QUERY_PARAMS = new URLSearchParams(window.location.search);
const API_ORIGIN =
  QUERY_PARAMS.get("api") ||
  (_isLocal ? "http://127.0.0.1:8000" : "https://vaxagentvaxagent-backend.onrender.com");
const PIPELINE_CONNECT_TIMEOUT_MS = Number(QUERY_PARAMS.get("timeout_ms")) || 8000;
const JOB_POLL_INTERVAL_MS = Number(QUERY_PARAMS.get("job_poll_ms")) || 10000;
const WS_URL = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline`;
const PENDING_FULL_ANALYSIS_KEY = "vaxagent.pendingFullAnalysis";

/* ── Pipeline steps (backend) ────────────────────────────────────────── */

const PIPELINE_STEPS = [
  { key: "load_dataset", title: "Loading tumor data", detail: "Reading mutation profile..." },
  { key: "pvacseq", title: "Finding targets", detail: "Scanning for vaccine target candidates..." },
  { key: "ranking", title: "Ranking targets", detail: "Scoring by immune recognition potential..." },
  { key: "esmfold", title: "Checking structure", detail: "Verifying targets are reachable by the immune system..." },
  { key: "mrna_design", title: "Designing vaccine", detail: "Assembling vaccine blueprint..." },
  { key: "report", title: "Creating report", detail: "Generating your downloadable report..." }
];

/* ── Wizard steps ────────────────────────────────────────────────────── */

const WIZARD_STEPS = [
  { id: 1, key: "diagnosis", title: "Diagnosis", label: "Tell us about the diagnosis" },
  { id: 2, key: "upload", title: "Upload", label: "Upload your tumor data" },
  { id: 3, key: "candidates", title: "Targets", label: "Your top vaccine targets" },
  { id: 4, key: "blueprint", title: "Blueprint", label: "Your vaccine blueprint" },
  { id: 5, key: "next_steps", title: "Next Steps", label: "What to do next" }
];

/* ── Sequencing guidance by cancer type ───────────────────────────────── */

const SEQUENCING_GUIDANCE = {
  lymphoma: {
    name: "Lymphoma",
    note: "Lymphoma often has enough mutations for vaccine target discovery. Whole Exome Sequencing (WES) is typically recommended.",
    sequencing: "Whole Exome Sequencing (WES)",
    mutations: "Moderate to high"
  },
  osteosarcoma: {
    name: "Osteosarcoma",
    note: "Osteosarcoma can have complex mutations. Whole Genome Sequencing (WGS) may find more targets, but WES is also effective.",
    sequencing: "WES or WGS",
    mutations: "Moderate"
  },
  mast_cell_tumor: {
    name: "Mast cell tumor",
    note: "Mast cell tumors often involve specific gene mutations (like c-KIT). Targeted panels or WES can both work well.",
    sequencing: "WES or targeted panel",
    mutations: "Low to moderate"
  },
  melanoma: {
    name: "Melanoma",
    note: "Melanoma typically has a high mutation burden, making it one of the best candidates for personalized vaccine approaches.",
    sequencing: "WES",
    mutations: "High"
  },
  hemangiosarcoma: {
    name: "Hemangiosarcoma",
    note: "Hemangiosarcoma has a moderate mutation burden. WES is the standard approach for identifying vaccine targets.",
    sequencing: "WES",
    mutations: "Moderate"
  },
  soft_tissue_sarcoma: {
    name: "Soft tissue sarcoma",
    note: "Soft tissue sarcomas vary widely in mutation burden. WES provides the broadest view of potential targets.",
    sequencing: "WES",
    mutations: "Variable"
  },
  mammary_carcinoma: {
    name: "Mammary carcinoma",
    note: "Mammary tumors in pets can have a moderate-to-high mutation burden, similar to some human breast cancers.",
    sequencing: "WES",
    mutations: "Moderate to high"
  },
  transitional_cell_carcinoma: {
    name: "Transitional cell carcinoma",
    note: "Bladder tumors can harbor enough mutations for vaccine target discovery. WES is recommended.",
    sequencing: "WES",
    mutations: "Moderate"
  },
  other: {
    name: "Other cancer type",
    note: "For less common cancers, Whole Exome Sequencing (WES) provides the broadest coverage for discovering potential vaccine targets. Ask your vet about the expected mutation burden.",
    sequencing: "WES",
    mutations: "Varies"
  }
};

/* ── Translation content map (audience-adaptive inline text) ─────────── */

const INLINE_TEXT = {
  species_context: {
    pet_owner: "Species determines which immune system we model. Dogs use DLA alleles, humans use HLA \u2014 these are the \u201Clocks\u201D that determine which protein fragments the immune system can detect.",
    veterinarian: "Species selection determines the MHC system used for binding prediction. Canine analysis uses DLA alleles (e.g. DLA-88*034:01) with NetMHCpan; human uses HLA with pVACseq or MHCflurry.",
    researcher: "MHC allele system is species-dependent: canine DLA-88 alleles are predicted via NetMHCpan 4.1 (validated for DLA); human HLA alleles use MHCflurry or pVACseq with MHCflurry+NetMHCpan backends."
  },
  allele_hint: {
    pet_owner: "Your pet\u2019s immune alleles (DLA for dogs) are like a fingerprint for their immune system. Each animal has a unique combination. If you don\u2019t have your pet\u2019s allele type, ask your vet about DLA typing \u2014 it\u2019s a simple blood test.",
    veterinarian: "Enter the patient\u2019s DLA or HLA alleles. DLA typing can be performed via PCR-based assays. Common well-characterized canine alleles include DLA-88*034:01 and DLA-88*50101.",
    researcher: "Provide MHC Class I alleles in standard nomenclature (e.g. DLA-88*034:01, HLA-A*02:01). Binding predictions use NetMHCpan 4.1 for DLA and MHCflurry/NetMHCpan for HLA alleles."
  },
  prediction_context: {
    pet_owner: "<strong>What\u2019s happening:</strong> Each mutated protein is chopped into small fragments (9 amino acids long). We test whether each fragment fits tightly into your pet\u2019s immune receptor \u2014 like testing which keys fit a lock. Fragments that bind tightly become vaccine target candidates.",
    veterinarian: "<strong>Binding prediction in progress:</strong> Mutant peptides (8\u201311-mers) are evaluated against the patient\u2019s MHC alleles using neural network predictors. Candidates with predicted IC50 < 500 nM are retained for ranking.",
    researcher: "<strong>MHC-I binding prediction:</strong> Sliding-window peptide generation (8\u201311-mer) from each missense mutation. IC50 predicted via pan-allele neural networks. Threshold: median IC50 < 500 nM. Fold-change (WT/MT) used for specificity filtering."
  },
  ranking_explainer: {
    pet_owner: "<strong>How we rank targets:</strong> We combine four factors \u2014 binding strength (can the immune system grab it?), tumor presence (is it common across the tumor?), gene activity (is the tumor making it?), and immune specificity (how different from normal proteins?). A good vaccine target scores well on all four.",
    veterinarian: "<strong>Ranking methodology:</strong> Candidates are scored on four axes: MHC binding affinity (IC50), variant allele frequency (clonality), gene expression (TPM), and fold-change (MT vs WT binding). The composite score weights binding (50%), expression (30%), clonality (15%), and specificity (5%).",
    researcher: "<strong>Priority scoring:</strong> binding_score = max(0, 50\u00D7(1 \u2212 IC50/500)); expression_score = min(30, TPM/2); clonality_score = VAF\u00D715; specificity_score = min(5, fold_change/10). Total = sum of four components (0\u2013100 scale)."
  },
  blueprint_context: {
    pet_owner: "This follows the same basic design as modern mRNA vaccines (like COVID-19 vaccines), adapted for cancer targets. Each part of the molecule has a specific job \u2014 from protecting the mRNA to directing the immune response.",
    veterinarian: "The mRNA construct uses a standard multi-epitope cassette design: 5\u2019 cap + alpha-globin UTR + Ii signal peptide + antigen cassettes (GPGPG-linked) + beta-globin 3\u2019 UTR + poly(A)120. Codon-optimized for mammalian expression.",
    researcher: "Multi-epitope mRNA design: m7GpppN cap, human alpha-globin 5\u2019UTR, MHC-II invariant chain Ii signal peptide (METPAQLLFLLLLWLPDTTG), GPGPG-linked antigen cassettes ordered by priority score, TGA stop, human beta-globin 3\u2019UTR, poly(A)\u00D7120. Codon optimization: most-frequent human codon table."
  },
  report_context: {
    pet_owner: "This report summarizes your complete analysis. Share it with your veterinarian to discuss next steps. It includes the mutation summary, ranked targets with explanations, the vaccine blueprint, and important limitations.",
    veterinarian: "This report provides a computational neoantigen analysis summary suitable for clinical discussion. Review the candidate ranking rationale and limitations section before making treatment decisions.",
    researcher: "This report contains the full computational pipeline output: variant statistics, ranked neoantigen candidates with binding predictions, structure accessibility data, and mRNA construct design. All predictions require experimental validation."
  }
};

function updateInlineTextForAudience() {
  const a = state.audience || "pet_owner";
  const updates = {
    "species-context": INLINE_TEXT.species_context[a],
    "allele-hint": INLINE_TEXT.allele_hint[a],
    "prediction-context": INLINE_TEXT.prediction_context[a],
    "ranking-explainer-text": INLINE_TEXT.ranking_explainer[a],
    "blueprint-context": INLINE_TEXT.blueprint_context[a],
    "report-context": INLINE_TEXT.report_context[a]
  };
  for (const [id, html] of Object.entries(updates)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
}

/* ── Fallback fixture ────────────────────────────────────────────────── */

const FALLBACK_RUN = {
  variantStats: {
    dataset_id: "hcc1395",
    dataset_name: "Demo Case — Breast Cancer Cell Line (HCC1395)",
    source: "Precomputed benchmark dataset for demonstration purposes.",
    tumor_type: "Triple-negative breast cancer (cell line)",
    hla_alleles: ["HLA-A*29:02", "HLA-B*45:01", "HLA-B*82:02", "HLA-C*06:02"],
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
      rank: 1, gene: "TP53", mutation: "R248W", structure_source: "alphafold", mt_epitope_seq: "SVVVPWEPPL",
      hla_allele: "HLA-A*29:02", ic50_mt: 45.2, fold_change: 217.7,
      gene_expression_tpm: 38.2, tumor_dna_vaf: 0.48, clonality: "clonal",
      priority_score: 76, plddt: 82.4, surface_accessible: true
    },
    {
      rank: 2, gene: "PIK3CA", mutation: "E545K", structure_source: "alphafold", mt_epitope_seq: "IKDFSKIVSL",
      hla_allele: "HLA-B*45:01", ic50_mt: 78.6, fold_change: 79.1,
      gene_expression_tpm: 31.5, tumor_dna_vaf: 0.42, clonality: "clonal",
      priority_score: 70, plddt: 78.9, surface_accessible: true
    },
    {
      rank: 3, gene: "BRCA1", mutation: "T1685I", structure_source: "alphafold", mt_epitope_seq: "QMFISVVNL",
      hla_allele: "HLA-A*29:02", ic50_mt: 124.3, fold_change: 36.7,
      gene_expression_tpm: 18.7, tumor_dna_vaf: 0.39, clonality: "clonal",
      priority_score: 60, plddt: 74.2, surface_accessible: true
    },
    {
      rank: 4, gene: "PTEN", mutation: "R130Q", structure_source: "alphafold", mt_epitope_seq: "KMLQQDKMF",
      hla_allele: "HLA-B*45:01", ic50_mt: 198.4, fold_change: 19.2,
      gene_expression_tpm: 22.4, tumor_dna_vaf: 0.35, clonality: "clonal",
      priority_score: 54, plddt: 68.1, surface_accessible: false
    },
    {
      rank: 5, gene: "RB1", mutation: "R698W", structure_source: "alphafold", mt_epitope_seq: "LFMDLWRWL",
      hla_allele: "HLA-A*29:02", ic50_mt: 267.1, fold_change: 11.0,
      gene_expression_tpm: 15.2, tumor_dna_vaf: 0.31, clonality: "subclonal",
      priority_score: 45, plddt: 71.5, surface_accessible: true
    }
  ],
  blueprint: {
    construct_id: "MRNA-HCC1395-DRAFT-01",
    strategy: "Multi-target vaccine using 5 candidates",
    format: "Research-only blueprint preview",
    payload_summary:
      "5' Cap | 5' UTR | Signal peptide | TP53 target | PIK3CA target | BRCA1 target | PTEN target | RB1 target | 3' UTR | Poly(A) tail",
    total_length_nt: 450,
    antigen_count: 5,
    notes: [
      "This is a simplified research preview, not a validated therapeutic design.",
      "Targets are ordered by priority score — strongest first.",
      "Wet-lab validation and delivery design are required before any synthesis."
    ],
    sequence_preview: [
      "5' Cap:           m7GpppN",
      "5' UTR:           GGGAATTCTAGGCTAACTGCTGGAGCTCTTCTCCACC...",
      "Signal:           ATGGAGACCCCCCAGCTGCTCTTC...",
      "Target 1 (TP53):  AGCGTGGTCGTGCCCTGGGAGCCCCCCTTG",
      "Linker:           GGCCCCGGCCCCGGG",
      "Target 2 (PIK3CA): ATCAAGGACTTCTCCAAGATCGTGAGCCTG",
      "Stop:             TGA",
      "3' UTR:           TGAATCAGAGCAGAAAGCTCATGAGCCAGAAGTCTG...",
      "Poly(A):          AAAAAAAAAAAAAAAAAAAA...x120"
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
      "We loaded a demonstration dataset from a well-studied cancer cell line with a high number of mutations — giving us plenty of potential vaccine targets to work with.",
    pvacseq:
      "We scanned all the protein changes caused by mutations and tested which ones the immune system's receptors could grab onto tightly enough to trigger a response. Out of 322 possibilities, 78 passed the first filter.",
    ranking:
      "We ranked the remaining targets by combining four factors: how tightly the immune system can grab them, how actively the tumor produces them, how common they are across tumor cells, and how different they are from normal proteins.",
    esmfold:
      "We checked whether each target protein fragment is physically accessible on the cell surface — if the immune system can't reach it, it won't work as a vaccine target.",
    mrna_design:
      "We assembled the top 5 targets into a single vaccine blueprint — a design that could teach the immune system to recognize all five targets at once.",
    report:
      "We packaged everything into a downloadable report you can share with your veterinarian."
  },
  limitations: [
    "This demo uses a pre-computed benchmark dataset, not your pet's actual data.",
    "Target rankings are computational predictions — they require lab validation.",
    "The vaccine blueprint is a research preview, not a ready-to-manufacture design.",
    "Always consult a qualified veterinary oncologist before pursuing treatment."
  ]
};

/* ── Application state ───────────────────────────────────────────────── */

const state = {
  // Wizard
  wizardStep: 1,
  maxUnlockedStep: 1,
  audience: "pet_owner",
  diagnosis: { species: "", cancerType: "", cancerTypeCustom: "", stage: "", treatmentHistory: "" },

  // Pipeline data
  loaded: false,
  loading: false,
  mode: "idle",
  statusMessage: "",
  variantStats: null,
  candidates: [],
  blueprint: null,
  selectedCandidateRank: null,
  reportUrl: "",
  currentRunId: "",
  stepStatuses: Object.fromEntries(PIPELINE_STEPS.map((s) => [s.key, "pending"])),
  stepExplanations: {},
  stepRawMessages: {},
  ws: null,
  activeJob: null,
  retryAction: "",
  // Visual Explorer state
  currentScene: null,
  explorerTargetRank: 1,
  explanationCache: {},
  selectedConstructSegment: null,
  fetchingExplanation: false
};

let _analysisMode = "quick";
let _jobPollInterval = null;
let _jobStartTime = null;
let _jobElapsedInterval = null;
let _jobPollErrorCount = 0;

/* ── DOM references ──────────────────────────────────────────────────── */

const elements = {
  // Wizard shell
  progressSteps: document.getElementById("wizard-progress-steps"),
  wizardBack: document.getElementById("wizard-back"),
  wizardNext: document.getElementById("wizard-next"),
  modeChip: document.getElementById("mode-chip"),

  // Step 1
  speciesSelector: document.getElementById("species-selector"),
  cancerTypeSelect: document.getElementById("cancer-type-select"),
  cancerTypeCustom: document.getElementById("cancer-type-custom"),
  stageInput: document.getElementById("stage-input"),
  sequencingGuidance: document.getElementById("sequencing-guidance"),
  sequencingGuidanceContent: document.getElementById("sequencing-guidance-content"),

  // Step 2
  dropZone: document.getElementById("drop-zone"),
  vcfFileInput: document.getElementById("vcf-file-input"),
  fileLabelText: document.getElementById("file-label-text"),
  hlaAllelesInput: document.getElementById("hla-alleles-input"),
  analyseButton: document.getElementById("analyse-button"),
  tryDemoButton: document.getElementById("try-demo"),
  benchmarkSelector: document.getElementById("benchmark-selector"),
  benchmarkList: document.getElementById("benchmark-list"),
  pipelineProgress: document.getElementById("pipeline-progress"),
  pipelineStatus: document.getElementById("pipeline-status"),
  progressBar: document.getElementById("progress-bar"),
  pipelineStepsMini: document.getElementById("pipeline-steps-mini"),
  jobProgressArea: document.getElementById("job-progress-area"),
  jobProgressLabel: document.getElementById("job-progress-label"),
  jobElapsed: document.getElementById("job-elapsed"),
  jobProgressBar: document.getElementById("job-progress-bar"),
  jobProgressNote: document.getElementById("job-progress-note"),
  uploadStatus: document.getElementById("upload-status"),

  // Step 3
  summaryBar: document.getElementById("summary-bar"),
  summaryGrid: document.getElementById("summary-grid"),
  candidateList: document.getElementById("candidate-list"),
  rawCandidatesArea: document.getElementById("raw-candidates-area"),
  toggleRawCandidates: document.getElementById("toggle-raw-candidates"),
  rawCandidatesBlock: document.getElementById("raw-candidates-block"),

  // Step 4
  blueprintCard: document.getElementById("blueprint-card"),
  blueprintActions: document.getElementById("blueprint-actions"),
  exportButton: document.getElementById("export-brief"),
  toggleTechnical: document.getElementById("toggle-technical"),
  technicalDetails: document.getElementById("technical-details"),
  sequenceBlock: document.getElementById("sequence-block"),
  rawBlueprintArea: document.getElementById("raw-blueprint-area"),
  toggleRawBlueprint: document.getElementById("toggle-raw-blueprint"),
  rawBlueprintBlock: document.getElementById("raw-blueprint-block"),

  // Step 5
  vetLetterText: document.getElementById("vet-letter-text"),
  copyLetterButton: document.getElementById("copy-letter"),

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
  constructExplanation: document.getElementById("construct-explanation")
};

/* ── Jargon translation ──────────────────────────────────────────────── */

function bindingLabel(ic50) {
  if (ic50 < 50) return { text: "Very strong binding", css: "is-very-strong" };
  if (ic50 < 150) return { text: "Strong binding", css: "is-strong" };
  if (ic50 < 500) return { text: "Moderate binding", css: "is-moderate" };
  return { text: "Weak binding", css: "is-weak" };
}

function vafLabel(vaf) {
  return `Found in ${Math.round((vaf || 0) * 100)}% of tumor cells`;
}

function clonalityLabel(c) {
  return c === "clonal" ? "Present in all tumor cells" : "Present in some tumor cells";
}

function confidenceLabel(plddt) {
  if (plddt > 80) return "High confidence structure";
  if (plddt > 60) return "Moderate confidence";
  return "Low confidence";
}

function surfaceLabel(accessible) {
  return accessible
    ? "Reachable by the immune system"
    : "May be harder for the immune system to reach";
}

function structureSourceBadge(source) {
  if (!source || source === "heuristic") return "";
  const labels = {
    alphafold: { text: "AlphaFold DB", css: "is-alphafold" },
    esmfold: { text: "ESMFold", css: "is-esmfold" },
  };
  const { text, css } = labels[source] || { text: source, css: "" };
  return `<span class="binding-badge structure-source-badge ${css}" title="Structure prediction source: ${text}">${text}</span>`;
}

/* ── Utility functions ───────────────────────────────────────────────── */

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sentenceCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/* ── Wizard navigation ───────────────────────────────────────────────── */

function goToStep(n) {
  if (n < 1 || n > WIZARD_STEPS.length) return;
  if (n > state.maxUnlockedStep) return;

  state.wizardStep = n;

  // Toggle step visibility. Clear any inline display style set by the Visual
  // Explorer (activateScene) so that the CSS class always wins.
  document.querySelectorAll(".wizard-step").forEach((el) => {
    el.style.display = "";
    const stepNum = Number(el.dataset.step);
    el.classList.toggle("is-active", stepNum === n);
  });

  updateWizardProgress();
  updateWizardNav();
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Re-render step-specific content in case the initial render was skipped
  // (e.g. due to a caught render error during pipeline_complete handling).
  if (n === 3 && state.loaded) {
    try { renderCandidates(); } catch (e) { console.error("[goToStep3] renderCandidates:", e); }
  }
  if (n === 4 && state.loaded) {
    try { renderBlueprint(); } catch (e) { console.error("[goToStep4] renderBlueprint:", e); }
  }
}

function updateWizardProgress() {
  const steps = elements.progressSteps.querySelectorAll(".wizard-progress-step");
  steps.forEach((el) => {
    const stepNum = Number(el.dataset.step);
    el.classList.remove("is-active", "is-completed", "is-locked");

    if (stepNum === state.wizardStep) {
      el.classList.add("is-active");
    } else if (stepNum < state.wizardStep && stepNum <= state.maxUnlockedStep) {
      el.classList.add("is-completed");
    } else if (stepNum <= state.maxUnlockedStep) {
      // Unlocked but not current or past — just remove locked
    } else {
      el.classList.add("is-locked");
    }
  });
}

function canAdvance() {
  if (state.wizardStep === 1) {
    return state.diagnosis.species !== "" && state.diagnosis.cancerType !== "";
  }
  if (state.wizardStep === 2) {
    return state.loaded;
  }
  // Steps 3, 4, 5: always advanceable once unlocked
  return state.wizardStep < WIZARD_STEPS.length;
}

function updateWizardNav() {
  // Back button
  elements.wizardBack.hidden = state.wizardStep <= 1;

  // Next button
  const isLastStep = state.wizardStep >= WIZARD_STEPS.length;
  elements.wizardNext.hidden = isLastStep;
  elements.wizardNext.disabled = !canAdvance();

  // Contextual button text
  const labels = {
    1: "Continue",
    2: state.loaded ? "See Vaccine Targets" : "Continue",
    3: "View Blueprint",
    4: "See Next Steps"
  };
  elements.wizardNext.textContent = labels[state.wizardStep] || "Continue";
}

/* ── State management ────────────────────────────────────────────────── */

function resetRunState() {
  state.loaded = false;
  state.variantStats = null;
  state.candidates = [];
  state.blueprint = null;
  state.selectedCandidateRank = null;
  state.reportUrl = "";
  state.currentRunId = "";
  state.activeJob = null;
  state.stepStatuses = Object.fromEntries(PIPELINE_STEPS.map((s) => [s.key, "pending"]));
  state.stepExplanations = {};
  state.stepRawMessages = {};
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

function updateModeChip(mode, label) {
  state.mode = mode;
  const cssMap = { idle: "", running: "is-running", backend: "is-backend", fallback: "is-fallback" };
  elements.modeChip.className = `mode-chip ${cssMap[mode] || ""}`.trim();
  elements.modeChip.textContent = label || mode;
}

/* ── Step 2: Upload UI helpers ───────────────────────────────────────── */

function setUploadStatus(message, isError = false) {
  elements.uploadStatus.textContent = message;
  elements.uploadStatus.className = `upload-status ${isError ? "upload-status-error" : message ? "upload-status-info" : ""}`;
}

function setProgressVisible(visible) {
  elements.jobProgressArea.hidden = !visible;
}

function updateJobProgressBar(pct, label) {
  elements.jobProgressBar.style.width = `${pct}%`;
  if (label) elements.jobProgressLabel.textContent = label;
}

function showPipelineProgress(visible) {
  elements.pipelineProgress.hidden = !visible;
}

function updatePipelineBar(pct) {
  elements.progressBar.style.width = `${pct}%`;
}

function renderMiniSteps() {
  elements.pipelineStepsMini.innerHTML = PIPELINE_STEPS.map((step) => {
    const status = state.stepStatuses[step.key] || "pending";
    const cls = status === "complete" ? "is-complete" : status === "running" ? "is-running" : "";
    const hasExplanation = status === "complete" && state.stepExplanations[step.key];
    const hasRaw = state.stepRawMessages[step.key] && status === "complete";

    const whyBtn = hasExplanation
      ? `<button class="why-toggle-mini" data-why-step="${step.key}" type="button" title="Why this step?">Why?</button>`
      : "";
    const explainBtn = status === "complete"
      ? `<button class="explain-btn step-explain-btn" data-explain-step="${step.key}" type="button">Why?</button>`
      : "";
    const rawBtn = hasRaw
      ? `<button class="raw-toggle-mini" data-raw-step-btn="${step.key}" type="button">raw</button>`
      : "";

    const explanationPanel = hasExplanation
      ? `<div class="step-explanation-panel" id="why-step-${step.key}" hidden>
           <p class="step-explanation-text">${escapeHtml(state.stepExplanations[step.key])}</p>
         </div>`
      : "";

    return `<div class="mini-step-wrapper">
      <span class="mini-step ${cls}" data-step-key="${step.key}">${step.title}${whyBtn}${explainBtn}${rawBtn}</span>
      ${explanationPanel}
      ${hasRaw ? `<pre class="raw-data-block" id="raw-step-${step.key}" hidden>${escapeHtml(JSON.stringify(state.stepRawMessages[step.key], null, 2))}</pre>` : ""}
    </div>`;
  }).join("");

  // Wire "Why?" toggles
  elements.pipelineStepsMini.querySelectorAll("[data-why-step]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = btn.dataset.whyStep;
      const panel = document.getElementById(`why-step-${key}`);
      if (panel) {
        panel.hidden = !panel.hidden;
        btn.textContent = panel.hidden ? "Why?" : "Hide";
      }
    });
  });

  // Wire raw toggles
  elements.pipelineStepsMini.querySelectorAll("[data-raw-step-btn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = btn.dataset.rawStepBtn;
      const block = document.getElementById(`raw-step-${key}`);
      if (block) block.hidden = !block.hidden;
    });
  });

  // Wire step-level AI explain buttons
  elements.pipelineStepsMini.querySelectorAll(".step-explain-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const step = btn.dataset.explainStep;
      btn.disabled = true;
      btn.textContent = "Thinking\u2026";
      try {
        const res = await fetch(`${API_ORIGIN}/explain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: state.variantStats || {},
            question: `explain_step_${step}`
          })
        });
        const data = await res.json();
        btn.textContent = "Why?";
        btn.disabled = false;
        let el = btn.nextElementSibling;
        if (!el || !el.classList.contains("explain-response")) {
          el = document.createElement("p");
          el.className = "explain-response";
          btn.after(el);
        }
        el.textContent = data.explanation || data.error || "No explanation available.";
      } catch (_err) {
        btn.textContent = "Why?";
        btn.disabled = false;
      }
    });
  });
}

function startElapsedTimer(startedAt = Date.now()) {
  if (_jobElapsedInterval) window.clearInterval(_jobElapsedInterval);
  _jobStartTime = startedAt;
  const tick = () => {
    if (!_jobStartTime) return;
    const elapsed = Math.floor((Date.now() - _jobStartTime) / 1000);
    elements.jobElapsed.textContent = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s elapsed`;
  };
  tick();
  _jobElapsedInterval = window.setInterval(tick, 1000);
}

function stopPolling() {
  if (_jobPollInterval) { window.clearInterval(_jobPollInterval); _jobPollInterval = null; }
  if (_jobElapsedInterval) { window.clearInterval(_jobElapsedInterval); _jobElapsedInterval = null; }
  _jobPollErrorCount = 0;
  _jobStartTime = null;
  elements.jobElapsed.textContent = "";
}

/* ── Rendering: Step 3 — Candidates ──────────────────────────────────── */

function buildCandidateNarrative(candidate) {
  const binding = bindingLabel(candidate.ic50_mt);
  const structNote = typeof candidate.surface_accessible === "boolean"
    ? surfaceLabel(candidate.surface_accessible)
    : "Structural accessibility is approximate in this analysis.";

  return {
    summary: `The ${candidate.gene} gene has a mutation (${candidate.mutation}) that creates an altered protein the immune system could learn to recognize. It ranks #${candidate.rank} because it combines ${binding.text.toLowerCase()} to immune receptors, active production by the tumor, and enough difference from normal proteins to be a useful target.`,
    bullets: [
      `${binding.text} — the immune system's receptors can grab this target ${candidate.ic50_mt < 150 ? "tightly" : "with moderate strength"}.`,
      `${vafLabel(candidate.tumor_dna_vaf)} — ${candidate.clonality === "clonal" ? "it's present across the whole tumor, not just part of it" : "it's in some tumor cells but not all"}.`,
      `${structNote}`
    ],
    caution: "This is a computational prediction, not a confirmed result. Lab validation and veterinary review are required."
  };
}

function scoringBars(c) {
  const bindingPct = Math.max(0, Math.min(100, (1 - c.ic50_mt / 500) * 100));
  const presencePct = Math.min(100, (c.tumor_dna_vaf || 0) * 200);
  const activityPct = Math.min(100, (c.gene_expression_tpm || 0) / 50 * 100);
  const specificityPct = Math.min(100, Math.log10(Math.max(1, c.fold_change || 1)) / Math.log10(500) * 100);

  const label = (pct) => pct > 75 ? 'Excellent' : pct > 50 ? 'Strong' : pct > 25 ? 'Moderate' : 'Low';

  return `
    <div class="scoring-bars">
      <div class="score-factor">
        <span class="factor-label">Binding strength</span>
        <div class="factor-track"><div class="factor-fill" style="width:${bindingPct}%"></div></div>
        <span class="factor-rating">${label(bindingPct)}</span>
      </div>
      <div class="score-factor">
        <span class="factor-label">Tumor presence</span>
        <div class="factor-track"><div class="factor-fill" style="width:${presencePct}%"></div></div>
        <span class="factor-rating">${label(presencePct)}</span>
      </div>
      <div class="score-factor">
        <span class="factor-label">Gene activity</span>
        <div class="factor-track"><div class="factor-fill" style="width:${activityPct}%"></div></div>
        <span class="factor-rating">${label(activityPct)}</span>
      </div>
      <div class="score-factor">
        <span class="factor-label">Immune specificity</span>
        <div class="factor-track"><div class="factor-fill" style="width:${specificityPct}%"></div></div>
        <span class="factor-rating">${label(specificityPct)}</span>
      </div>
    </div>`;
}

function renderCandidates() {
  if (!state.candidates.length) {
    elements.candidateList.className = "candidate-list empty-state";
    elements.candidateList.textContent = "Upload your data or try the demo to see vaccine targets.";
    elements.summaryBar.hidden = true;
    return;
  }

  // Summary bar
  if (state.variantStats) {
    elements.summaryBar.hidden = false;
    const stats = state.variantStats.stats || {};
    const metrics = [
      { label: "Total mutations", value: formatNumber(stats.total_variants || 0) },
      { label: "Protein-changing", value: formatNumber(stats.missense_mutations || 0) },
      { label: "Candidates screened", value: formatNumber(stats.initial_predictions || 0) },
      { label: "Top targets", value: formatNumber(stats.shortlisted_candidates || state.candidates.length || 0) }
    ];
    elements.summaryGrid.innerHTML = metrics.map((m) => `
      <article class="summary-card reveal">
        <p class="summary-card-label">${m.label}</p>
        <p class="summary-card-value">${m.value}</p>
      </article>
    `).join("");
  }

  // Show ranking explainer
  document.getElementById('ranking-explainer')?.removeAttribute('hidden');

  // Origin badge + Candidate cards
  const isDemo = state.mode === "fallback";
  elements.candidateList.className = "candidate-list";
  const originBadge = `<div class="origin-badge ${isDemo ? 'is-benchmark' : 'is-uploaded'}">${isDemo ? 'Benchmark data' : 'From your file'}</div>`;
  elements.candidateList.innerHTML = originBadge + state.candidates.map((c) => {
    const selected = c.rank === state.selectedCandidateRank ? "is-selected" : "";
    const binding = bindingLabel(c.ic50_mt);
    const narrative = buildCandidateNarrative(c);

    return `
      <div class="candidate-card reveal ${selected}" data-rank="${c.rank}">
        <div class="candidate-rank">#${c.rank}</div>
        <div>
          <div class="candidate-header">
            <h3>${escapeHtml(c.gene)} ${escapeHtml(c.mutation)}</h3>
          </div>
          <p class="candidate-meta">${clonalityLabel(c.clonality)} &middot; ${vafLabel(c.tumor_dna_vaf)}</p>
          <div class="candidate-badges">
            <span class="binding-badge ${binding.css}">${binding.text}</span>
            ${c.surface_accessible ? '<span class="binding-badge is-strong">Surface accessible</span>' : ""}
            ${structureSourceBadge(c.structure_source)}
          </div>
          ${selected ? `
            <div class="candidate-detail">
              <p>${narrative.summary}</p>
              <ul>${narrative.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
              ${scoringBars(c)}
              <div class="guardrail">${narrative.caution}</div>
              <div class="candidate-explain-row">
                <button class="explain-btn" data-explain-rank="${c.rank}" data-explain-q="explain_priority_score" type="button">Why this score?</button>
                ${c.structure_source && c.structure_source !== "heuristic" ? `<button class="explain-btn" data-explain-rank="${c.rank}" data-explain-q="explain_structure_source" type="button">About ${c.structure_source === "alphafold" ? "AlphaFold" : "ESMFold"} data</button>` : ""}
                ${c.ic50_source && c.ic50_source !== "fixture" ? `<button class="explain-btn" data-explain-rank="${c.rank}" data-explain-q="explain_ic50_source" type="button">About ${c.ic50_source}</button>` : ""}
              </div>
              <div class="candidate-ai-explanation" id="ai-explain-${c.rank}" hidden></div>
              <button class="tech-toggle" data-tech-rank="${c.rank}" type="button">Show technical values</button>
              <div class="tech-values" id="tech-${c.rank}">IC50: ${c.ic50_mt} nM | Expression: ${c.gene_expression_tpm} TPM | VAF: ${formatPercent(c.tumor_dna_vaf || 0)} | Fold change: ${c.fold_change}x | pLDDT: ${c.plddt} | Structure: ${c.structure_source || "heuristic"} | Prediction: ${c.ic50_source || "fixture"} | Peptide: ${c.mt_epitope_seq} | HLA: ${c.hla_allele}</div>
            </div>
          ` : ""}
        </div>
        <div class="candidate-score">
          <span>Score</span>
          <strong>${c.priority_score}</strong>
        </div>
      </div>
    `;
  }).join("");

  // Wire click handlers
  elements.candidateList.querySelectorAll("[data-rank]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".tech-toggle") || e.target.closest(".explain-btn")) return;
      state.selectedCandidateRank = Number(card.dataset.rank);
      renderCandidates();
    });
  });

  // Wire tech toggles
  elements.candidateList.querySelectorAll(".tech-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rank = btn.dataset.techRank;
      const el = document.getElementById(`tech-${rank}`);
      if (el) el.classList.toggle("is-visible");
    });
  });

  // Wire on-demand AI explanation buttons on candidate cards
  elements.candidateList.querySelectorAll(".explain-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const rank = Number(btn.dataset.explainRank);
      const question = btn.dataset.explainQ;
      const candidate = state.candidates.find((c) => c.rank === rank);
      const panel = document.getElementById(`ai-explain-${rank}`);
      if (!candidate || !panel) return;

      btn.disabled = true;
      btn.textContent = "Loading…";
      panel.hidden = false;
      panel.innerHTML = '<span class="explain-loading">Generating explanation…</span>';

      try {
        const context = {
          gene: candidate.gene,
          mutation: candidate.mutation,
          priority_score: candidate.priority_score,
          structure_source: candidate.structure_source || "heuristic",
          ic50_source: candidate.ic50_source || "fixture",
          plddt: candidate.plddt,
          ic50_mt: candidate.ic50_mt,
          hla_allele: candidate.hla_allele,
          surface_accessible: candidate.surface_accessible,
        };
        const res = await fetch(`${API_ORIGIN}/explain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context, question }),
        });
        const data = await res.json();
        if (data.explanation) {
          panel.innerHTML = `<p class="ai-explanation-text">${escapeHtml(data.explanation)}</p>`;
          btn.textContent = "Hide";
          btn.addEventListener("click", () => { panel.hidden = !panel.hidden; }, { once: true });
        } else {
          panel.innerHTML = `<span class="explain-error">Could not load explanation.</span>`;
          btn.textContent = "Try again";
          btn.disabled = false;
        }
      } catch (_err) {
        panel.innerHTML = `<span class="explain-error">Could not load explanation.</span>`;
        btn.textContent = "Try again";
        btn.disabled = false;
      }
    });
  });

  // Raw data for Step 3
  elements.rawCandidatesArea.hidden = false;
  elements.rawCandidatesBlock.textContent = JSON.stringify(state.candidates, null, 2);
}

/* ── Rendering: Step 4 — Blueprint ───────────────────────────────────── */

function renderBlueprintAnnotations(blueprint) {
  if (!blueprint || !blueprint.antigen_count) return '';
  const parts = [
    { label: "5' Cap", desc: "Protects the mRNA from degradation", color: "var(--primary)" },
    { label: "5' UTR", desc: "Tells the cell to start reading here", color: "#6366f1" },
    { label: "Signal peptide", desc: "Directs targets toward immune cells", color: "#0891b2" },
  ];
  for (let i = 0; i < (blueprint.antigen_count || 5); i++) {
    parts.push({ label: `Target ${i+1}`, desc: "Vaccine target from your tumor", color: "#059669" });
    if (i < (blueprint.antigen_count || 5) - 1) {
      parts.push({ label: "Linker", desc: "Flexible spacer between targets", color: "#9ca3af" });
    }
  }
  parts.push({ label: "Stop", desc: "Tells the cell to stop reading", color: "#dc2626" });
  parts.push({ label: "3' UTR", desc: "Stabilizes the mRNA", color: "#6366f1" });
  parts.push({ label: "Poly(A) tail", desc: "Protects the mRNA and helps it last longer", color: "#f59e0b" });

  return `<div class="construct-annotations">
    <p class="construct-annotations-title">What each part does:</p>
    <div class="construct-bar">${parts.map(p =>
      `<div class="construct-segment" style="background:${p.color}" title="${p.desc}">
        <span class="segment-label">${p.label}</span>
      </div>`
    ).join('')}</div>
    <div class="construct-legend">${parts.filter((p,i,a) => a.findIndex(x => x.label === p.label) === i).map(p =>
      `<span class="legend-item"><span class="legend-dot" style="background:${p.color}"></span>${p.label}: ${p.desc}</span>`
    ).join('')}</div>
  </div>`;
}

function renderBlueprint() {
  if (!state.blueprint) {
    elements.blueprintCard.className = "blueprint-card empty-state";
    elements.blueprintCard.textContent = "The vaccine blueprint will appear after analysis is complete.";
    elements.blueprintActions.hidden = true;
    elements.technicalDetails.hidden = true;
    return;
  }

  const bp = state.blueprint;
  elements.blueprintCard.className = "blueprint-card reveal";
  elements.blueprintCard.innerHTML = `
    <div class="blueprint-summary">
      <div class="blueprint-section">
        <h4>What to synthesize</h4>
        <p>A multi-target vaccine construct containing <strong>${bp.antigen_count || state.candidates.length} vaccine targets</strong> from the highest-ranked mutations found in the tumor.</p>
        <p>Each target is a short protein fragment that the immune system can learn to recognize and attack.</p>
      </div>
      <div class="blueprint-section">
        <h4>Why these targets</h4>
        <p>These targets were selected because they combine strong immune binding, active production by the tumor, and enough difference from normal proteins to minimize the risk of the immune system attacking healthy tissue.</p>
      </div>
      <div class="blueprint-section">
        <h4>What to expect</h4>
        <p>This blueprint is a starting point for discussion with your veterinarian and a synthesis lab. It is <strong>not</strong> a ready-to-manufacture design — it requires professional review, wet-lab validation, and formulation.</p>
      </div>
    </div>
    <dl class="blueprint-metadata">
      <div><dt>Construct ID</dt><dd>${escapeHtml(bp.construct_id)}</dd></div>
      <div><dt>Strategy</dt><dd>${escapeHtml(bp.strategy)}</dd></div>
      <div><dt>Targets included</dt><dd>${bp.antigen_count || state.candidates.length}</dd></div>
      <div><dt>Total length</dt><dd>${bp.total_length_nt} nucleotides</dd></div>
    </dl>
    <ul style="margin-top:14px;padding-left:18px;color:var(--muted);line-height:1.7;">
      ${bp.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
    </ul>
    ${renderBlueprintAnnotations(bp)}
  `;

  elements.blueprintActions.hidden = false;
  elements.exportButton.disabled = !(state.reportUrl || state.mode === "fallback");
  elements.sequenceBlock.textContent = bp.sequence_preview;

  // Show explain-blueprint button
  document.getElementById("explain-blueprint")?.removeAttribute("hidden");

  // Raw data for Step 4
  elements.rawBlueprintArea.hidden = false;
  elements.rawBlueprintBlock.textContent = JSON.stringify(bp, null, 2);
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

/* ── Pipeline message handling ───────────────────────────────────────── */

function applyPipelineMessage(message) {
  if (message.step && state.stepStatuses[message.step] !== undefined) {
    state.stepStatuses[message.step] = message.status;
  }
  // Show prediction context when pvacseq starts
  if (message.step === "pvacseq" && message.status === "running") {
    document.getElementById('prediction-context')?.removeAttribute('hidden');
  }
  if (message.explanation) {
    state.stepExplanations[message.step] = message.explanation;
  }
  if (message.step && message.step !== "pipeline_complete") {
    state.stepRawMessages[message.step] = message;
  }

  if (message.step === "load_dataset" && message.status === "complete") {
    state.variantStats = message.data;
    // Pre-fill alleles from benchmark if the input is empty
    const alleleInput = elements.hlaAllelesInput;
    if (alleleInput && !alleleInput.value) {
      const alleles = state.variantStats?.hla_alleles || state.variantStats?.dla_alleles || [];
      if (alleles.length > 0) {
        alleleInput.value = alleles.join(", ");
        alleleInput.placeholder = "Pre-filled from benchmark \u2014 replace with your pet\u2019s actual alleles";
      }
    }
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
    if (elements.exportButton) elements.exportButton.disabled = !state.reportUrl;
    clearPendingFullAnalysis();
    updateModeChip("backend", "Connected");
    showPipelineProgress(false);

    // Unlock all wizard steps and auto-advance to step 3.
    // Each render is wrapped individually so a failure in one cannot
    // prevent the others or the step advance from running.
    state.maxUnlockedStep = 5;
    try { renderCandidates(); } catch (e) { console.error("[pipeline] renderCandidates:", e); }
    try { renderBlueprint(); }  catch (e) { console.error("[pipeline] renderBlueprint:", e); }
    try { updateVetLetter(); }  catch (e) { console.error("[pipeline] updateVetLetter:", e); }
    goToStep(3);
  }

  // Update mini pipeline progress
  renderMiniSteps();
  const completedCount = Object.values(state.stepStatuses).filter((s) => s === "complete").length;
  updatePipelineBar(Math.round((completedCount / PIPELINE_STEPS.length) * 100));
  elements.pipelineStatus.textContent =
    state.stepExplanations[message.step] || PIPELINE_STEPS.find((s) => s.key === message.step)?.detail || "Processing...";

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
  state.stepStatuses = Object.fromEntries(PIPELINE_STEPS.map((s) => [s.key, "complete"]));
  elements.exportButton.disabled = false;
  updateModeChip("fallback", "Demo mode");
  // Pre-fill alleles from fallback benchmark if the input is empty
  const alleleInput = elements.hlaAllelesInput;
  if (alleleInput && !alleleInput.value) {
    const alleles = state.variantStats?.hla_alleles || state.variantStats?.dla_alleles || [];
    if (alleles.length > 0) {
      alleleInput.value = alleles.join(", ");
      alleleInput.placeholder = "Pre-filled from benchmark \u2014 replace with your pet\u2019s actual alleles";
    }
  }
  showPipelineProgress(false);

  state.maxUnlockedStep = 5;
  renderCandidates();
  renderBlueprint();
  updateVetLetter();
  goToStep(3);
  enterVisualExplorer();
}

/* ── Vet letter template ─────────────────────────────────────────────── */

function updateVetLetter() {
  const species = state.diagnosis.species || "[species]";
  const cancerType = state.diagnosis.cancerType
    ? (SEQUENCING_GUIDANCE[state.diagnosis.cancerType]?.name || state.diagnosis.cancerTypeCustom || state.diagnosis.cancerType)
    : "[cancer type]";
  const topCandidate = state.candidates[0];
  const candidateCount = state.candidates.length;

  elements.vetLetterText.textContent = `Dear Dr. [Vet Name],

I've been exploring personalized cancer vaccine options for [Pet Name],
my ${species} diagnosed with ${cancerType}.

Using tumor sequencing data, I've identified ${candidateCount} potential
vaccine targets through computational analysis. I've attached a summary
report from VaxAgent.

Key points:
- The top target is a ${topCandidate ? topCandidate.gene + " " + topCandidate.mutation : "[gene]"} mutation with ${topCandidate ? bindingLabel(topCandidate.ic50_mt).text.toLowerCase() : "predicted"} immune binding
- ${candidateCount} targets were identified with predicted immune recognition
- This analysis is computational only and requires clinical interpretation

I understand this is an emerging approach and would value your expert
guidance on next steps.

Thank you,
[Owner Name]`;
}

/* ── WebSocket pipeline ──────────────────────────────────────────────── */

function runBackendPipelineWithUrl(wsUrl, timeoutMs = PIPELINE_CONNECT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    let sawAnyMessage = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      if (state.ws) { state.ws.close(); state.ws = null; }
      resolve(false);
    }, timeoutMs);

    try {
      state.ws = new WebSocket(wsUrl);
    } catch {
      window.clearTimeout(timeout);
      resolve(false);
      return;
    }

    state.ws.onopen = () => {
      updateModeChip("running", "Analyzing...");
      showPipelineProgress(true);
      elements.pipelineStatus.textContent = "Connected. Running analysis pipeline...";
    };

    state.ws.onmessage = (event) => {
      sawAnyMessage = true;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }

      // Resolve the promise BEFORE calling applyPipelineMessage so that
      // DOM/rendering exceptions cannot silently block the success signal.
      if (message.step === "pipeline_complete" && message.status === "complete") {
        window.clearTimeout(timeout);
        if (!settled) { settled = true; resolve(true); }
        if (state.ws) { state.ws.close(); state.ws = null; }
      }
      if (message.status === "error") {
        window.clearTimeout(timeout);
        if (!settled) { settled = true; resolve(false); }
      }

      try { applyPipelineMessage(message); } catch (err) {
        console.error("[pipeline] applyPipelineMessage threw:", err);
      }
    };

    state.ws.onerror = () => {
      window.clearTimeout(timeout);
      if (state.ws) { state.ws.close(); state.ws = null; }
      if (!settled) { settled = true; resolve(false); }
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

/* ── Upload & analysis flows ─────────────────────────────────────────── */

function persistPendingFullAnalysis(jobId, fileName, startedAt = Date.now()) {
  try { localStorage.setItem(PENDING_FULL_ANALYSIS_KEY, JSON.stringify({ jobId, fileName, startedAt })); } catch {}
}
function readPendingFullAnalysis() {
  try { const raw = localStorage.getItem(PENDING_FULL_ANALYSIS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearPendingFullAnalysis() {
  try { localStorage.removeItem(PENDING_FULL_ANALYSIS_KEY); } catch {}
}

async function checkDockerAvailability() {
  try {
    const res = await fetch(`${API_ORIGIN}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.docker === true;
  } catch { return false; }
}

async function startCompletedJobPipeline(jobId, fileName) {
  updateJobProgressBar(100, "Analysis complete. Loading results...");
  setUploadStatus(`Analysis complete for ${fileName}. Loading results...`);
  const wsUrl = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline?job_id=${jobId}`;
  const ok = await runBackendPipelineWithUrl(wsUrl, 60000);
  setProgressVisible(false);
  if (!ok) {
    setUploadStatus("Could not load the completed results. Please try again.", true);
    updateModeChip("idle", "Awaiting");
  } else {
    setUploadStatus(`Analysis complete for ${fileName}.`);
    // Guarantee the wizard can advance even if applyPipelineMessage had a render error.
    if (state.loaded && state.wizardStep === 2) {
      state.maxUnlockedStep = Math.max(state.maxUnlockedStep, 5);
      goToStep(3);
    }
    updateWizardNav();
  }
}

async function pollFullAnalysisJob(jobId, fileName) {
  try {
    const res = await fetch(`${API_ORIGIN}/api/jobs/${jobId}`);
    if (!res.ok) return;
    _jobPollErrorCount = 0;
    const job = await res.json();
    state.activeJob = { jobId, fileName, status: job.status, error: job.error_msg || "" };
    updateJobProgressBar(job.progress_pct || 5, `Analyzing... ${job.status}`);
    setUploadStatus(
      job.status === "running"
        ? `Running analysis for ${fileName}. You can leave this page open.`
        : `Job ${jobId} is ${job.status}.`
    );
    if (job.status === "complete") {
      stopPolling();
      await startCompletedJobPipeline(jobId, fileName);
      state.loading = false;
      elements.analyseButton.disabled = !elements.vcfFileInput.files[0];
      elements.analyseButton.textContent = "Analyse My File";
      return;
    }
    if (job.status === "failed") {
      stopPolling();
      clearPendingFullAnalysis();
      setProgressVisible(false);
      setUploadStatus(`Analysis failed: ${job.error_msg || "unknown error"}`, true);
      state.activeJob = null;
      state.loading = false;
      elements.analyseButton.disabled = !elements.vcfFileInput.files[0];
      elements.analyseButton.textContent = "Analyse My File";
      updateModeChip("idle", "Awaiting");
    }
  } catch {
    _jobPollErrorCount += 1;
    if (_jobPollErrorCount >= 3) {
      setUploadStatus(`Connection interrupted. VaxAgent will keep retrying automatically.`, true);
    }
  }
}

function beginFullAnalysisPolling(jobId, fileName, options = {}) {
  stopPolling();
  const startedAt = options.startedAt || Date.now();
  persistPendingFullAnalysis(jobId, fileName, startedAt);
  state.activeJob = { jobId, fileName, status: "queued", error: "" };
  setProgressVisible(true);
  updateJobProgressBar(options.initialProgress || 5, options.initialLabel || "Queued...");
  elements.jobProgressNote.textContent = "This analysis will continue even if you refresh the page.";
  startElapsedTimer(startedAt);
  void pollFullAnalysisJob(jobId, fileName);
  _jobPollInterval = window.setInterval(() => void pollFullAnalysisJob(jobId, fileName), JOB_POLL_INTERVAL_MS);
}

async function submitFullPipeline() {
  const file = elements.vcfFileInput.files[0];
  if (!file) return;
  const hla = elements.hlaAllelesInput.value.trim();
  if (!hla) { setUploadStatus("Immune receptor alleles are required for full analysis.", true); return; }
  if (state.loading) return;

  resetRunState();
  state.loading = true;
  elements.analyseButton.disabled = true;
  elements.analyseButton.textContent = "Submitting...";
  setUploadStatus("Uploading and starting analysis...");
  setProgressVisible(true);
  updateJobProgressBar(2, "Uploading...");
  updateModeChip("running", "Analyzing...");

  const formData = new FormData();
  formData.append("vcf_file", file);
  formData.append("hla_alleles", hla);

  let jobId;
  try {
    const res = await fetch(`${API_ORIGIN}/api/jobs/pvacseq`, { method: "POST", body: formData });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Submission failed`); }
    const result = await res.json();
    jobId = result.job_id;
  } catch (err) {
    setUploadStatus(`Error: ${err.message}`, true);
    setProgressVisible(false);
    state.loading = false;
    elements.analyseButton.disabled = !file;
    elements.analyseButton.textContent = "Analyse My File";
    updateModeChip("idle", "Awaiting");
    return;
  }

  elements.analyseButton.textContent = "Analyzing...";
  setUploadStatus(`Analysis started. This may take 30–60 minutes.`);
  beginFullAnalysisPolling(jobId, file.name);
}

async function uploadAndRun() {
  if (_analysisMode === "full") return submitFullPipeline();
  const file = elements.vcfFileInput.files[0];
  if (!file || state.loading) return;

  resetRunState();
  state.loading = true;
  elements.analyseButton.disabled = true;
  elements.analyseButton.textContent = "Uploading...";
  setUploadStatus("Uploading and parsing your file...");
  updateModeChip("running", "Analyzing...");

  const formData = new FormData();
  formData.append("vcf_file", file);
  const hla = elements.hlaAllelesInput.value.trim();
  if (hla) formData.append("hla_alleles", hla);

  let fileId;
  try {
    const response = await fetch(`${API_ORIGIN}/api/upload`, { method: "POST", body: formData });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `Upload failed`); }
    const result = await response.json();
    fileId = result.file_id;
    setUploadStatus(`Parsed ${file.name}. Running analysis...`);
    elements.analyseButton.textContent = "Analyzing...";
  } catch (err) {
    setUploadStatus(`Upload error: ${err.message}`, true);
    state.loading = false;
    elements.analyseButton.disabled = false;
    elements.analyseButton.textContent = "Analyse My File";
    updateModeChip("idle", "Awaiting");
    return;
  }

  const wsUrl = `${API_ORIGIN.replace(/^http/, "ws")}/ws/pipeline?file_id=${fileId}`;
  const ok = await runBackendPipelineWithUrl(wsUrl);
  if (!ok) {
    setUploadStatus("Analysis server unavailable. Loading demo data as fallback.", true);
    applyFallbackRun();
  } else {
    setUploadStatus(`Analysis complete for ${file.name}.`);
  }
  state.loading = false;
  elements.analyseButton.disabled = !elements.vcfFileInput.files[0];
  elements.analyseButton.textContent = "Analyse My File";
}

/* ── Benchmark selector ─────────────────────────────────────────────── */

let _benchmarksCache = null;

async function fetchBenchmarks() {
  if (_benchmarksCache) return _benchmarksCache;
  try {
    const res = await fetch(`${API_ORIGIN}/api/benchmarks`);
    if (!res.ok) return null;
    const data = await res.json();
    _benchmarksCache = data.benchmarks || [];
    return _benchmarksCache;
  } catch {
    return null;
  }
}

function renderBenchmarkSelector(benchmarks) {
  if (!elements.benchmarkList || !benchmarks || benchmarks.length === 0) return;

  const speciesIcon = { canine: "\u{1F415}", human: "\u{1F9EC}", feline: "\u{1F408}" };

  elements.benchmarkList.innerHTML = benchmarks.map(b => `
    <button class="benchmark-card" data-benchmark-id="${b.id}">
      <span class="benchmark-icon">${speciesIcon[b.species] || "\u{1F9EC}"}</span>
      <div class="benchmark-info">
        <strong>${b.dataset_name}</strong>
        <span class="benchmark-meta">
          ${b.species === "canine" ? "Dog" : b.species === "feline" ? "Cat" : "Human"}
          &middot; ${b.cancer_type}
          &middot; ${(b.missense_mutations || 0).toLocaleString()} missense mutations
        </span>
      </div>
    </button>
  `).join("");

  elements.benchmarkList.querySelectorAll(".benchmark-card").forEach(card => {
    card.addEventListener("click", () => loadBenchmark(card.dataset.benchmarkId));
  });
}

async function loadBenchmark(datasetId) {
  if (state.loading) return;
  resetRunState();
  state.loading = true;
  setUploadStatus("Connecting to analysis server...");
  updateModeChip("running", "Connecting...");
  showPipelineProgress(true);
  elements.pipelineStatus.textContent = "Trying to connect to the analysis backend...";

  const wsUrl = `${WS_URL}?dataset_id=${encodeURIComponent(datasetId)}&species=${encodeURIComponent(state.species || "")}&cancer_type=${encodeURIComponent(state.cancerType || "")}`;
  const ok = await runBackendPipelineWithUrl(wsUrl);
  if (!ok) {
    applyFallbackRun();
    setUploadStatus("Loaded demo case (offline mode).");
  } else {
    setUploadStatus("Benchmark analysis complete.");
  }
  state.loading = false;
}

async function loadDemo() {
  if (state.loading) return;

  // If benchmark selector is already showing and has cards, don't re-fetch
  if (elements.benchmarkSelector && !elements.benchmarkSelector.hidden) {
    return;
  }

  // Try to show benchmark selector if backend has multiple benchmarks
  const benchmarks = await fetchBenchmarks();
  if (benchmarks && benchmarks.length > 1 && elements.benchmarkSelector) {
    renderBenchmarkSelector(benchmarks);
    elements.benchmarkSelector.hidden = false;
    return;
  }

  // Single benchmark or no backend — load directly
  const datasetId = (benchmarks && benchmarks.length > 0) ? benchmarks[0].id : "hcc1395";
  await loadBenchmark(datasetId);
}

/* ── Export ───────────────────────────────────────────────────────────── */

function buildFallbackReport() {
  const top = state.candidates[0];
  const stats = state.variantStats?.stats || {};
  return `# VaxAgent — Vaccine Exploration Report

## Tumor Profile

- Case: ${state.variantStats?.dataset_name || "Unknown"}
- Type: ${state.variantStats?.tumor_type || "Unknown"}

## Mutation Summary

- Total mutations: ${formatNumber(stats.total_variants || 0)}
- Protein-changing: ${formatNumber(stats.missense_mutations || 0)}
- Candidates screened: ${formatNumber(stats.initial_predictions || 0)}
- Top targets: ${state.candidates.length}

## Top Vaccine Targets

${state.candidates.map((c) => {
  const b = bindingLabel(c.ic50_mt);
  return `### #${c.rank} ${c.gene} ${c.mutation}
- Binding: ${b.text} (IC50: ${c.ic50_mt} nM)
- Tumor presence: ${vafLabel(c.tumor_dna_vaf)}
- ${clonalityLabel(c.clonality)}
- Score: ${c.priority_score}/100`;
}).join("\n\n")}

## Vaccine Blueprint

- Construct: ${state.blueprint?.construct_id || "N/A"}
- Strategy: ${state.blueprint?.strategy || "N/A"}
- Targets: ${state.blueprint?.antigen_count || state.candidates.length}

## Limitations

${FALLBACK_RUN.limitations.map((l) => `- ${l}`).join("\n")}

## Discussing With Your Veterinarian

- Bring this report to your next oncology appointment
- Ask about the feasibility of a personalized vaccine approach
- Discuss which synthesis providers they would recommend
- Confirm whether your pet's overall health supports immunotherapy
`;
}

function exportBrief() {
  if (state.mode === "backend" && state.reportUrl) {
    window.open(state.reportUrl, "_blank", "noopener");
    return;
  }
  const blob = new Blob([buildFallbackReport()], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vaxagent-vaccine-report.md";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── Restore pending job ─────────────────────────────────────────────── */

function restorePendingFullAnalysis() {
  const pending = readPendingFullAnalysis();
  if (!pending || state.loading) return;
  resetRunState();
  state.loading = true;
  elements.analyseButton.disabled = true;
  elements.analyseButton.textContent = "Resuming...";
  setUploadStatus(`Reconnecting to analysis job ${pending.jobId}...`);
  updateModeChip("running", "Resuming...");
  if (state.maxUnlockedStep < 2) { state.maxUnlockedStep = 2; }
  goToStep(2);
  beginFullAnalysisPolling(pending.jobId, pending.fileName, {
    startedAt: pending.startedAt,
    initialLabel: "Reconnecting..."
  });
}

/* ── Event wiring ────────────────────────────────────────────────────── */

// Audience toggle
document.querySelectorAll('.audience-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.audience-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    state.audience = btn.dataset.audience;
    updateInlineTextForAudience();
    // Sync report audience selector
    const reportRadio = document.querySelector(`input[name="report-audience"][value="${state.audience}"]`);
    if (reportRadio) {
      reportRadio.checked = true;
      document.querySelectorAll('.report-audience-option').forEach(o => o.classList.remove('is-selected'));
      reportRadio.closest('.report-audience-option')?.classList.add('is-selected');
    }
  });
});

// Wizard navigation
elements.wizardBack.addEventListener("click", () => goToStep(state.wizardStep - 1));
elements.wizardNext.addEventListener("click", () => {
  if (state.wizardStep === 1 && canAdvance()) {
    state.maxUnlockedStep = Math.max(state.maxUnlockedStep, 2);
  }
  goToStep(state.wizardStep + 1);
});

// Progress bar step clicks
elements.progressSteps.querySelectorAll(".wizard-progress-step").forEach((el) => {
  el.addEventListener("click", () => {
    const n = Number(el.dataset.step);
    if (n <= state.maxUnlockedStep) goToStep(n);
  });
});

// Step 1: Species
elements.speciesSelector.querySelectorAll(".species-card").forEach((card) => {
  card.addEventListener("click", () => {
    elements.speciesSelector.querySelectorAll(".species-card").forEach((c) => c.classList.remove("is-selected"));
    card.classList.add("is-selected");
    state.diagnosis.species = card.dataset.species;
    updateWizardNav();
  });
});

// Step 1: Cancer type
elements.cancerTypeSelect.addEventListener("change", () => {
  const val = elements.cancerTypeSelect.value;
  state.diagnosis.cancerType = val;
  elements.cancerTypeCustom.hidden = val !== "other";
  if (val !== "other") {
    state.diagnosis.cancerTypeCustom = "";
  }

  // Show sequencing guidance
  const guidance = SEQUENCING_GUIDANCE[val];
  if (guidance) {
    elements.sequencingGuidance.hidden = false;
    elements.sequencingGuidanceContent.innerHTML = `
      <p>${guidance.note}</p>
      <p><strong>Recommended sequencing:</strong> ${guidance.sequencing}</p>
      <p><strong>Expected mutation burden:</strong> ${guidance.mutations}</p>
    `;
  }

  updateWizardNav();
});

elements.cancerTypeCustom.addEventListener("input", () => {
  state.diagnosis.cancerTypeCustom = elements.cancerTypeCustom.value;
});

elements.stageInput.addEventListener("input", () => {
  state.diagnosis.stage = elements.stageInput.value;
});

// Step 2: File upload
elements.dropZone.addEventListener("click", () => elements.vcfFileInput.click());
elements.dropZone.addEventListener("dragover", (e) => { e.preventDefault(); elements.dropZone.classList.add("is-dragover"); });
elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("is-dragover"));
elements.dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  elements.dropZone.classList.remove("is-dragover");
  const file = e.dataTransfer?.files[0];
  if (file && (file.name.endsWith(".vcf") || file.name.endsWith(".vcf.gz"))) {
    elements.vcfFileInput.files = e.dataTransfer.files;
    elements.vcfFileInput.dispatchEvent(new Event("change"));
  }
});

elements.vcfFileInput.addEventListener("change", () => {
  const file = elements.vcfFileInput.files[0];
  const modeSelector = document.getElementById("analysis-mode-selector");
  if (file) {
    elements.fileLabelText.textContent = file.name;
    elements.fileLabelText.hidden = false;
    elements.dropZone.classList.add("has-file");
    elements.analyseButton.disabled = false;
    setUploadStatus("");
    if (modeSelector) modeSelector.hidden = false;
  } else {
    elements.fileLabelText.hidden = true;
    elements.dropZone.classList.remove("has-file");
    elements.analyseButton.disabled = true;
    if (modeSelector) modeSelector.hidden = true;
  }
});

// Analysis mode radio buttons
document.querySelectorAll('input[name="analysis-mode"]').forEach(radio => {
  radio.addEventListener("change", () => {
    document.querySelectorAll('.analysis-mode-card').forEach(c => c.classList.remove('is-selected'));
    radio.closest('.analysis-mode-card')?.classList.add('is-selected');
    if (radio.value === "benchmark") {
      _analysisMode = "quick";
      elements.tryDemoButton.click();
    } else {
      _analysisMode = radio.value;
    }
  });
});

elements.analyseButton.addEventListener("click", uploadAndRun);
elements.tryDemoButton.addEventListener("click", loadDemo);

// Report audience selector
document.querySelectorAll('input[name="report-audience"]').forEach(radio => {
  radio.addEventListener("change", () => {
    document.querySelectorAll('.report-audience-option').forEach(o => o.classList.remove('is-selected'));
    radio.closest('.report-audience-option')?.classList.add('is-selected');
    state.audience = radio.value;
    updateInlineTextForAudience();
    // Sync header audience toggle
    document.querySelectorAll('.audience-btn').forEach(b => b.classList.remove('is-active'));
    const headerBtn = document.querySelector(`.audience-btn[data-audience="${state.audience}"]`);
    if (headerBtn) headerBtn.classList.add('is-active');
  });
});

// Step 4: Export & technical toggle
elements.exportButton.addEventListener("click", exportBrief);
elements.toggleTechnical.addEventListener("click", () => {
  const showing = !elements.technicalDetails.hidden;
  elements.technicalDetails.hidden = showing;
  elements.toggleTechnical.textContent = showing ? "Show technical details" : "Hide technical details";
});

// Step 4: Explain blueprint
document.getElementById("explain-blueprint")?.addEventListener("click", async function () {
  this.disabled = true;
  this.textContent = "Thinking\u2026";
  try {
    const res = await fetch(`${API_ORIGIN}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: state.blueprint || {},
        question: "explain_blueprint"
      })
    });
    const data = await res.json();
    this.textContent = "Explain this blueprint";
    this.disabled = false;
    const responseEl = document.getElementById("blueprint-explain-response");
    if (responseEl) {
      responseEl.textContent = data.explanation || data.error || "No explanation available.";
      responseEl.hidden = false;
    }
  } catch (_err) {
    this.textContent = "Explain this blueprint";
    this.disabled = false;
  }
});

// Step 3: Raw data toggle
elements.toggleRawCandidates.addEventListener("click", () => {
  const showing = !elements.rawCandidatesBlock.hidden;
  elements.rawCandidatesBlock.hidden = showing;
  elements.toggleRawCandidates.textContent = showing ? "Show raw data" : "Hide raw data";
});

// Step 4: Raw data toggle
elements.toggleRawBlueprint.addEventListener("click", () => {
  const showing = !elements.rawBlueprintBlock.hidden;
  elements.rawBlueprintBlock.hidden = showing;
  elements.toggleRawBlueprint.textContent = showing ? "Show raw data" : "Hide raw data";
});

// Step 5: Copy letter
elements.copyLetterButton.addEventListener("click", () => {
  navigator.clipboard.writeText(elements.vetLetterText.textContent).then(() => {
    elements.copyLetterButton.textContent = "Copied!";
    setTimeout(() => { elements.copyLetterButton.textContent = "Copy"; }, 2000);
  });
});

// Docker check — inform the analysis mode selector but don't auto-switch mode.
// The user explicitly picks quick/full/benchmark via the radio buttons.
checkDockerAvailability().then((dockerOk) => {
  if (!dockerOk) {
    // Disable the "full" radio option when Docker is unavailable
    const fullRadio = document.querySelector('input[name="analysis-mode"][value="full"]');
    if (fullRadio) {
      fullRadio.disabled = true;
      const card = fullRadio.closest('.analysis-mode-card');
      if (card) {
        card.style.opacity = "0.5";
        card.style.cursor = "not-allowed";
        card.querySelector("p").textContent += " (Docker not available on this machine)";
      }
    }
  }
});

/* ── Initialize ──────────────────────────────────────────────────────── */

if (typeof lucide !== "undefined") {
  lucide.createIcons();
}

updateModeChip("idle", "Awaiting");
updateWizardProgress();
updateWizardNav();
renderCandidates();
renderBlueprint();
updateInlineTextForAudience();
void restorePendingFullAnalysis();
