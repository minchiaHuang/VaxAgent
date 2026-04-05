"""PDF report generator for a completed VaxAgent pipeline run.

Produces a concise research brief suitable for sharing with mixed
technical and non-technical oncology research stakeholders.
Uses reportlab for PDF generation; outputs to a temp file.
"""

from __future__ import annotations

import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPORTS_DIR = Path(os.getenv("REPORTS_DIR", Path(__file__).parent.parent / "reports"))
REPORTS_DIR.mkdir(exist_ok=True)

ACCENT = colors.HexColor("#8f2d1d")
TEAL = colors.HexColor("#204b57")
LIGHT_BG = colors.HexColor("#f7f3ea")


def generate_pdf(
    run_id: str,
    variant_stats: dict,
    candidates: list[dict],
    blueprint: dict,
) -> str:
    """Generate a PDF research brief and return its file path."""
    output_path = str(REPORTS_DIR / f"vaxagent-{run_id}.pdf")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=LETTER,
        rightMargin=0.8 * inch,
        leftMargin=0.8 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.8 * inch,
        pageCompression=0,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=22,
        textColor=ACCENT,
        spaceAfter=4,
    )
    h2_style = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=TEAL,
        spaceBefore=16,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        leading=14,
        spaceAfter=4,
    )
    small_style = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#665f52"),
        leading=12,
    )

    story = []

    # Title block
    story.append(Paragraph("VaxAgent Research Brief", title_style))
    story.append(
        Paragraph(
            f"Run ID: {run_id} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            small_style,
        )
    )
    story.append(
        Paragraph(
            "<i>Research-use prototype. Not a clinical product or treatment recommendation.</i>",
            small_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=12))

    # Dataset summary
    story.append(Paragraph("1. Dataset Summary", h2_style))
    ds = variant_stats
    story.append(Paragraph(f"<b>Dataset:</b> {ds.get('dataset_name', '')}", body_style))
    story.append(Paragraph(f"<b>Tumor type:</b> {ds.get('tumor_type', '')}", body_style))
    story.append(Paragraph(f"<b>Source:</b> {ds.get('source', '')}", body_style))
    story.append(Paragraph(f"<b>HLA alleles:</b> {', '.join(ds.get('hla_alleles', []))}", body_style))

    stats = ds.get("stats", {})
    stat_rows = [
        ["Metric", "Value"],
        ["Total variants", str(stats.get("total_variants", ""))],
        ["Somatic SNVs", str(stats.get("somatic_snvs", ""))],
        ["Missense mutations", str(stats.get("missense_mutations", ""))],
        ["Initial predictions", str(stats.get("initial_predictions", ""))],
        ["High-confidence candidates", str(stats.get("high_confidence_candidates", ""))],
        ["Shortlisted", str(stats.get("shortlisted_candidates", ""))],
    ]
    story.append(_make_table(stat_rows))

    # Candidate ranking
    story.append(Paragraph("2. Ranked Neoantigen Candidates", h2_style))
    story.append(
        Paragraph(
            "Candidates were ranked by a composite score weighting predicted binding affinity (IC50), "
            "tumor expression (TPM), variant allele frequency, and fold-change specificity.",
            body_style,
        )
    )

    cand_rows = [["#", "Gene", "Mutation", "Peptide", "HLA", "IC50 (nM)", "Expr (TPM)", "VAF", "Score"]]
    for c in candidates:
        cand_rows.append([
            str(c.get("rank", "")),
            c.get("gene", ""),
            c.get("mutation", ""),
            c.get("mt_epitope_seq", ""),
            c.get("hla_allele", "").replace("HLA-", ""),
            str(c.get("ic50_mt", "")),
            str(c.get("gene_expression_tpm", "")),
            f"{c.get('tumor_dna_vaf', 0):.0%}",
            str(c.get("priority_score", "")),
        ])
    story.append(_make_table(cand_rows, header_color=TEAL))

    # Explanations for top 3
    story.append(Paragraph("3. Candidate Rationale", h2_style))
    for c in candidates[:3]:
        story.append(
            Paragraph(
                f"<b>#{c['rank']} {c['gene']} {c['mutation']}</b> — {c.get('explanation', 'No explanation generated.')}",
                body_style,
            )
        )
        story.append(Spacer(1, 4))

    # Blueprint
    story.append(Paragraph("4. Draft mRNA Construct Blueprint", h2_style))
    bp = blueprint
    story.append(Paragraph(f"<b>Construct ID:</b> {bp.get('construct_id', '')}", body_style))
    story.append(Paragraph(f"<b>Strategy:</b> {bp.get('strategy', '')}", body_style))
    story.append(Paragraph(f"<b>Total length:</b> {bp.get('total_length_nt', 0)} nt", body_style))
    story.append(Paragraph(f"<b>Payload:</b> {bp.get('payload_summary', '')}", body_style))
    story.append(Spacer(1, 6))
    for note in bp.get("notes", []):
        story.append(Paragraph(f"• {note}", small_style))

    # Limitations
    story.append(Paragraph("5. Limitations and Guardrails", h2_style))
    limitations = [
        "This output is a research prototype for demonstration purposes only.",
        "Candidate ranking is based on computational predictions; experimental validation is required.",
        "The mRNA construct preview is not optimized for therapeutic manufacturability.",
        "Less than 5% of computationally predicted neoantigens trigger a clinical immune response.",
        "No clinical recommendation or treatment guidance is implied.",
        "Human expert review is required before any downstream scientific use.",
    ]
    for lim in limitations:
        story.append(Paragraph(f"• {lim}", small_style))

    doc.build(story)
    return output_path


def _make_table(rows: list[list[str]], header_color=ACCENT) -> Table:
    col_widths = None
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), header_color),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 1), (-1, -1), 7.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]
    )
    t.setStyle(style)
    return t
