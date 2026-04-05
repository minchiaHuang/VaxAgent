from __future__ import annotations

from pathlib import Path


def test_parse_vcf_counts_variants(monkeypatch, sample_vcf_path: Path) -> None:
    from pipeline import vcf_parser

    monkeypatch.setattr(vcf_parser, "USE_FIXTURES", False)

    result = vcf_parser.parse_vcf(str(sample_vcf_path))

    assert result["stats"]["total_variants"] == 3
    assert result["stats"]["somatic_snvs"] == 2
    assert result["stats"]["frameshift_indels"] == 1
    assert result["stats"]["missense_mutations"] == 1


def test_parse_vcfgz_counts_variants(monkeypatch, sample_vcfgz_path: Path) -> None:
    from pipeline import vcf_parser

    monkeypatch.setattr(vcf_parser, "USE_FIXTURES", False)

    result = vcf_parser.parse_vcf_live_force(str(sample_vcfgz_path))

    assert result["dataset_name"] == "Custom VCF Upload"
    assert result["stats"]["total_variants"] == 3


def test_parse_vcf_returns_fixture_when_enabled(monkeypatch, sample_vcf_path: Path) -> None:
    from pipeline import vcf_parser

    monkeypatch.setattr(vcf_parser, "USE_FIXTURES", True)

    result = vcf_parser.parse_vcf(str(sample_vcf_path))

    assert result["dataset_id"] == "hcc1395"
    assert result["dataset_name"] == "HCC1395 Breast Cancer Cell Line"
