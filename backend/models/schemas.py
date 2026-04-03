from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class VariantStats(BaseModel):
    dataset_id: str
    dataset_name: str
    source: str
    tumor_type: str
    hla_alleles: list[str]
    stats: dict[str, Any]
    top_mutated_genes: list[str]
    tumor_mutation_burden: str
    pipeline_version: str


class NeoantigenCandidate(BaseModel):
    rank: int
    gene: str
    chromosome: str
    start: int
    stop: int
    reference: str
    alt: str
    mutation: str
    protein_change: str
    variant_type: str
    transcript: str
    peptide_length: int
    mt_epitope_seq: str
    wt_epitope_seq: str
    hla_allele: str
    ic50_mt: float = Field(description="Predicted IC50 for mutant peptide (nM)")
    ic50_wt: float = Field(description="Predicted IC50 for wildtype peptide (nM)")
    fold_change: float = Field(description="WT IC50 / MT IC50 — higher means mutation drives binding")
    tumor_dna_depth: int
    tumor_dna_vaf: float = Field(ge=0.0, le=1.0)
    tumor_rna_depth: int
    tumor_rna_vaf: float = Field(ge=0.0, le=1.0)
    gene_expression_tpm: float
    clonality: str
    self_similarity: float = Field(ge=0.0, le=1.0, description="Similarity to self-proteome (lower is safer)")
    priority_score: int = Field(ge=0, le=100)
    surface_accessible: bool = False
    plddt: float = Field(default=0.0, description="ESMFold confidence score (0-100)")
    explanation: str = ""


class MrnaBlueprint(BaseModel):
    construct_id: str
    strategy: str
    format: str
    signal_peptide: str
    antigen_count: int
    linker: str
    payload_summary: str
    sequence_preview: str
    utr_5prime: str
    utr_3prime: str
    poly_a_length: int
    total_length_nt: int
    notes: list[str]


class PipelineRun(BaseModel):
    run_id: str
    dataset_id: str
    status: str
    created_at: str
    variant_stats: VariantStats | None = None
    candidates: list[NeoantigenCandidate] = []
    blueprint: MrnaBlueprint | None = None
    report_path: str | None = None


class PipelineMessage(BaseModel):
    step: str
    status: str
    explanation: str = ""
    data: dict[str, Any] = {}
    run_id: str = ""
