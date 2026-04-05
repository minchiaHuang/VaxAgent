from __future__ import annotations


def test_codon_optimize_skips_unknown_residues() -> None:
    from pipeline.mrna_designer import codon_optimize

    assert codon_optimize("MAZ*") == "ATGGCCTGA"


def test_design_construct_builds_preview() -> None:
    from pipeline.mrna_designer import design_construct

    blueprint = design_construct(
        [
            {"gene": "TP53", "mutation": "R248W", "mt_epitope_seq": "SVVVPWEPPL"},
            {"gene": "PIK3CA", "mutation": "E545K", "mt_epitope_seq": "IKDFSKIVSL"},
        ],
        top_n=5,
    )

    assert blueprint["antigen_count"] == 2
    assert "TP53 R248W cassette" in blueprint["payload_summary"]
    assert "Ag1 (TP53 R248W)" in blueprint["sequence_preview"]
    assert blueprint["total_length_nt"] > 0


def test_design_construct_handles_empty_candidates() -> None:
    from pipeline.mrna_designer import design_construct

    blueprint = design_construct([], top_n=5)

    assert blueprint["antigen_count"] == 0
    assert blueprint["strategy"] == "Multi-epitope long-peptide cassette (5 antigens)"
    assert blueprint["total_length_nt"] > 0
