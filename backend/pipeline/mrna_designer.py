"""mRNA vaccine construct designer.

Takes ranked neoantigen candidates and assembles a research-preview mRNA construct:
  5' Cap → 5' UTR → Signal peptide → [Ag1 | Linker | Ag2 | Linker | …] → Stop → 3' UTR → Poly-A

All output is for research discussion only.
Codon optimization uses the most-frequent human codon per amino acid.
"""

from __future__ import annotations

# Most-frequent human codons per amino acid (Homo sapiens codon usage table)
HUMAN_OPTIMAL_CODONS: dict[str, str] = {
    "A": "GCC", "C": "TGC", "D": "GAC", "E": "GAG", "F": "TTC",
    "G": "GGC", "H": "CAC", "I": "ATC", "K": "AAG", "L": "CTG",
    "M": "ATG", "N": "AAC", "P": "CCC", "Q": "CAG", "R": "AGG",
    "S": "AGC", "T": "ACC", "V": "GTG", "W": "TGG", "Y": "TAC",
    "*": "TGA",
}

# MHC class II invariant chain Ii signal peptide (METPAQLLFLLLLWLPDTTG)
SIGNAL_PEPTIDE_AA = "METPAQLLFLLLLWLPDTTG"

# Linker separating antigens — GPGPG flexible spacer
LINKER_AA = "GPGPG"

# 5' UTR — human alpha-globin-derived (used in therapeutic mRNA)
UTR_5 = "GGGAAUUCUAGGCUAACUGCUGGAGCUCUUCUCCACC"

# 3' UTR — human beta-globin-derived
UTR_3 = "UGAAUCAGAGCAGAAAGCUCAUGAGCCAGAAGUCUGAGCAGAGAAAUACACUCUAUAAAUAAUAAAUAAUAAAAAAA"

# 5' Cap analog (N1-methylpseudouridine cap)
CAP = "m7GpppN"

POLY_A_LENGTH = 120


def codon_optimize(aa_sequence: str) -> str:
    """Translate an amino acid sequence to optimized DNA codons."""
    codons = []
    for aa in aa_sequence.upper():
        codon = HUMAN_OPTIMAL_CODONS.get(aa)
        if codon is None:
            continue
        codons.append(codon)
    return "".join(codons)


def design_construct(candidates: list[dict], top_n: int = 5) -> dict:
    """Design an mRNA construct from the top-N ranked candidates."""
    top = candidates[:top_n]
    antigen_names = [f"{c['gene']} {c['mutation']}" for c in top]
    peptide_seqs = [c["mt_epitope_seq"] for c in top]

    signal_dna = codon_optimize(SIGNAL_PEPTIDE_AA)
    linker_dna = codon_optimize(LINKER_AA)
    stop_codon = HUMAN_OPTIMAL_CODONS["*"]
    poly_a = "A" * POLY_A_LENGTH

    antigen_dna_blocks = [codon_optimize(seq) for seq in peptide_seqs]
    antigen_cassette = linker_dna.join(antigen_dna_blocks)

    coding_sequence = signal_dna + antigen_cassette + stop_codon
    full_sequence_parts = [
        UTR_5.replace("U", "T"),
        coding_sequence,
        UTR_3.replace("U", "T"),
        poly_a,
    ]
    full_sequence = "".join(full_sequence_parts)

    payload_summary = " | ".join(
        [f"{CAP}", "5' UTR", "Signal peptide"]
        + [f"{name} cassette" for name in antigen_names]
        + ["3' UTR", f"Poly(A)×{POLY_A_LENGTH}"]
    )

    sequence_preview_lines = [
        f"5' Cap:        {CAP}",
        f"5' UTR:        {UTR_5[:40]}...",
        f"Signal:        {signal_dna[:30]}...",
    ]
    for i, (name, dna) in enumerate(zip(antigen_names, antigen_dna_blocks)):
        sequence_preview_lines.append(f"Ag{i+1} ({name}): {dna}")
        if i < len(antigen_names) - 1:
            sequence_preview_lines.append(f"Linker:        {linker_dna}")
    sequence_preview_lines += [
        f"Stop:          {stop_codon}",
        f"3' UTR:        {UTR_3[:40]}...",
        f"Poly(A):       {'A' * 20}...×{POLY_A_LENGTH}",
    ]

    return {
        "construct_id": f"MRNA-HCC1395-DRAFT-01",
        "strategy": f"Multi-epitope long-peptide cassette ({top_n} antigens)",
        "format": "Research-only blueprint preview",
        "signal_peptide": SIGNAL_PEPTIDE_AA,
        "antigen_count": len(top),
        "linker": LINKER_AA,
        "payload_summary": payload_summary,
        "sequence_preview": "\n".join(sequence_preview_lines),
        "utr_5prime": UTR_5,
        "utr_3prime": UTR_3,
        "poly_a_length": POLY_A_LENGTH,
        "total_length_nt": len(full_sequence),
        "notes": [
            "Sequence is a simplified research preview, not a validated therapeutic design.",
            "Codon optimization uses the most-frequent human codon per amino acid.",
            "Antigen ordering follows the priority ranking to ease narrative review.",
            "Signal peptide directs antigen to MHC class I/II presentation pathway.",
            "Wet-lab validation, delivery vehicle design, and dose selection are out of scope.",
        ],
    }
