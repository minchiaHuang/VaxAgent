from __future__ import annotations

from pathlib import Path


def test_safe_float_handles_invalid_values() -> None:
    from pipeline.pvacseq_runner import _safe_float

    assert _safe_float("12.5") == 12.5
    assert _safe_float("NA", 9.0) == 9.0
    assert _safe_float(None, 7.0) == 7.0
    assert _safe_float("oops", 5.0) == 5.0


def test_get_vcf_sample_name(sample_vcf_path: Path) -> None:
    from pipeline.pvacseq_runner import _get_vcf_sample_name

    assert _get_vcf_sample_name(str(sample_vcf_path)) == "TUMOR"


def test_detects_vep_annotation(tmp_path: Path) -> None:
    from pipeline.pvacseq_runner import _vcf_is_vep_annotated

    annotated = tmp_path / "annotated.vcf"
    annotated.write_text(
        "##fileformat=VCFv4.2\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "1\t100\t.\tA\tT\t.\tPASS\tCSQ=T|missense_variant\n"
    )

    assert _vcf_is_vep_annotated(str(annotated)) is True


def test_parse_pvacseq_tsv_supports_current_columns(tmp_path: Path) -> None:
    from pipeline.pvacseq_runner import _parse_pvacseq_tsv

    tsv_path = tmp_path / "current.tsv"
    tsv_path.write_text(
        "\t".join(
            [
                "Gene Name",
                "Chromosome",
                "Start",
                "Stop",
                "Reference",
                "Variant",
                "Mutation",
                "Protein Position",
                "Variant Type",
                "Transcript",
                "Peptide Length",
                "MT Epitope Seq",
                "WT Epitope Seq",
                "HLA Allele",
                "Median MT IC50 Score",
                "Median WT IC50 Score",
                "Median Fold Change",
                "Tumor DNA Depth",
                "Tumor DNA VAF",
                "Tumor RNA Depth",
                "Tumor RNA VAF",
                "Gene Expression",
            ]
        )
        + "\n"
        + "\t".join(
            [
                "TP53",
                "17",
                "7674220",
                "7674220",
                "C",
                "T",
                "R248W",
                "248",
                "missense_variant",
                "ENST00000269305",
                "10",
                "SVVVPWEPPL",
                "SVVVPREPPL",
                "HLA-A*29:02",
                "45.2",
                "9840.5",
                "217.7",
                "142",
                "0.48",
                "88",
                "0.51",
                "38.2",
            ]
        )
    )

    candidates = _parse_pvacseq_tsv(str(tsv_path))

    assert candidates[0]["gene"] == "TP53"
    assert candidates[0]["ic50_mt"] == 45.2
    assert candidates[0]["clonality"] == "clonal"


def test_parse_pvacseq_tsv_supports_legacy_columns(tmp_path: Path) -> None:
    from pipeline.pvacseq_runner import _parse_pvacseq_tsv

    tsv_path = tmp_path / "legacy.tsv"
    tsv_path.write_text(
        "\t".join(
            [
                "Gene Name",
                "Chromosome",
                "Start",
                "Stop",
                "Reference",
                "Variant",
                "Mutation",
                "Protein Position",
                "Variant Type",
                "Transcript",
                "Peptide Length",
                "MT Epitope Seq",
                "Corresponding WT Epitope Seq",
                "HLA Allele",
                "Median MT Score",
                "Median WT Score",
                "Corresponding Fold Change",
                "Tumor DNA Depth",
                "Tumor DNA VAF",
                "Tumor RNA Depth",
                "Tumor RNA VAF",
                "Gene Expression",
            ]
        )
        + "\n"
        + "\t".join(
            [
                "PIK3CA",
                "3",
                "179218303",
                "179218303",
                "G",
                "A",
                "E545K",
                "545",
                "missense_variant",
                "ENST00000263967",
                "10",
                "IKDFSKIVSL",
                "IKDFSEIVSL",
                "HLA-B*45:01",
                "78.6",
                "6220.1",
                "79.1",
                "128",
                "0.42",
                "74",
                "0.44",
                "31.5",
            ]
        )
    )

    candidates = _parse_pvacseq_tsv(str(tsv_path))

    assert candidates[0]["wt_epitope_seq"] == "IKDFSEIVSL"
    assert candidates[0]["fold_change"] == 79.1


def test_rank_candidates_sorts_and_limits_results() -> None:
    from pipeline.pvacseq_runner import rank_candidates

    ranked = rank_candidates(
        [
            {"gene": "A", "mutation": "m1", "ic50_mt": 40, "gene_expression_tpm": 20, "tumor_dna_vaf": 0.5, "fold_change": 20},
            {"gene": "B", "mutation": "m2", "ic50_mt": 300, "gene_expression_tpm": 5, "tumor_dna_vaf": 0.2, "fold_change": 2},
            {"gene": "C", "mutation": "m3", "ic50_mt": 80, "gene_expression_tpm": 15, "tumor_dna_vaf": 0.4, "fold_change": 10},
        ],
        top_n=2,
    )

    assert [candidate["rank"] for candidate in ranked] == [1, 2]
    assert ranked[0]["gene"] == "A"
    assert len(ranked) == 2
