from __future__ import annotations

from pathlib import Path


def test_generate_pdf_writes_pdf_file(tmp_path: Path, monkeypatch) -> None:
    from pipeline import report_generator

    monkeypatch.setattr(report_generator, "REPORTS_DIR", tmp_path)

    output_path = report_generator.generate_pdf(
        run_id="run-123",
        variant_stats={
            "dataset_name": "Uploaded Sample",
            "tumor_type": "Unknown",
            "source": "fixture",
            "hla_alleles": ["HLA-A*02:01"],
            "stats": {
                "total_variants": 3,
                "somatic_snvs": 2,
                "missense_mutations": 1,
                "initial_predictions": 0,
                "high_confidence_candidates": 0,
                "shortlisted_candidates": 1,
            },
        },
        candidates=[
            {
                "rank": 1,
                "gene": "TP53",
                "mutation": "R248W",
                "mt_epitope_seq": "SVVVPWEPPL",
                "hla_allele": "HLA-A*02:01",
                "ic50_mt": 45.2,
                "gene_expression_tpm": 38.2,
                "tumor_dna_vaf": 0.48,
                "priority_score": 94,
                "explanation": "Top ranked candidate.",
            }
        ],
        blueprint={
            "construct_id": "MRNA-1",
            "strategy": "preview",
            "total_length_nt": 123,
            "payload_summary": "payload",
            "notes": ["Research only."],
        },
    )

    content = Path(output_path).read_bytes()

    assert content.startswith(b"%PDF")
    assert b"Vaccine Exploration Report" in content
    assert b"TP53" in content
