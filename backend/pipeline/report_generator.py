"""PDF report generator for a completed VaxAgent pipeline run.

Produces a vaccine exploration report suitable for pet owners to share
with their veterinary oncologist.
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


def _binding_label(ic50: float) -> str:
    if ic50 < 50:
        return "Very strong"
    if ic50 < 150:
        return "Strong"
    if ic50 < 500:
        return "Moderate"
    return "Weak"


def generate_pdf(
    run_id: str,
    variant_stats: dict,
    candidates: list[dict],
    blueprint: dict,
) -> str:
    """Generate a PDF vaccine exploration report and return its file path."""
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
    story.append(Paragraph("VaxAgent — Vaccine Exploration Report", title_style))
    story.append(
        Paragraph(
            f"Report ID: {run_id} &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            small_style,
        )
    )
    story.append(
        Paragraph(
            "<i>For educational exploration only. Not a clinical product or treatment recommendation.</i>",
            small_style,
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=12))

    # 1. Tumor profile
    story.append(Paragraph("1. Tumor Profile", h2_style))
    ds = variant_stats
    story.append(Paragraph(f"<b>Case:</b> {ds.get('dataset_name', '')}", body_style))
    story.append(Paragraph(f"<b>Tumor type:</b> {ds.get('tumor_type', '')}", body_style))
    story.append(Paragraph(f"<b>Source:</b> {ds.get('source', '')}", body_style))
    story.append(Paragraph(f"<b>Immune receptors (HLA):</b> {', '.join(ds.get('hla_alleles', []))}", body_style))

    stats = ds.get("stats", {})
    stat_rows = [
        ["Metric", "Value"],
        ["Total mutations found", str(stats.get("total_variants", ""))],
        ["Protein-changing mutations", str(stats.get("missense_mutations", ""))],
        ["Candidates screened", str(stats.get("initial_predictions", ""))],
        ["Top targets selected", str(stats.get("shortlisted_candidates", ""))],
    ]
    story.append(_make_table(stat_rows))

    # 2. Vaccine targets
    story.append(Paragraph("2. Top Vaccine Targets", h2_style))
    story.append(
        Paragraph(
            "Targets were ranked by combining how tightly the immune system can grab them, "
            "how actively the tumor produces them, how common they are across tumor cells, "
            "and how different they are from normal proteins.",
            body_style,
        )
    )

    cand_rows = [["#", "Gene", "Mutation", "Binding", "Tumor Presence", "Score"]]
    for c in candidates:
        vaf = c.get("tumor_dna_vaf", 0)
        cand_rows.append([
            str(c.get("rank", "")),
            c.get("gene", ""),
            c.get("mutation", ""),
            _binding_label(c.get("ic50_mt", 999)),
            f"In {vaf:.0%} of cells",
            str(c.get("priority_score", "")),
        ])
    story.append(_make_table(cand_rows, header_color=TEAL))

    # 3. Why these targets
    story.append(Paragraph("3. Why These Targets Were Selected", h2_style))
    for c in candidates[:3]:
        binding = _binding_label(c.get("ic50_mt", 999))
        vaf_pct = f"{c.get('tumor_dna_vaf', 0):.0%}"
        clonality = "all tumor cells" if c.get("clonality") == "clonal" else "some tumor cells"
        explanation = c.get("explanation", "")
        if not explanation:
            explanation = (
                f"This mutation in the {c['gene']} gene creates a protein fragment with "
                f"{binding.lower()} immune binding, found in {vaf_pct} of tumor cells "
                f"({clonality}). The immune system can learn to recognize this altered "
                f"protein and target cells carrying it."
            )
        story.append(
            Paragraph(
                f"<b>#{c['rank']} {c['gene']} {c['mutation']}</b> — {explanation}",
                body_style,
            )
        )
        story.append(Spacer(1, 4))

    # 4. Vaccine blueprint
    story.append(Paragraph("4. Vaccine Blueprint Summary", h2_style))
    bp = blueprint
    story.append(Paragraph(f"<b>Design ID:</b> {bp.get('construct_id', '')}", body_style))
    story.append(Paragraph(f"<b>Strategy:</b> {bp.get('strategy', '')}", body_style))
    story.append(Paragraph(f"<b>Total length:</b> {bp.get('total_length_nt', 0)} nucleotides", body_style))
    story.append(
        Paragraph(
            "This blueprint assembles the top vaccine targets into a single construct "
            "that could teach the immune system to recognize multiple tumor mutations at once. "
            "It is a research starting point — not a ready-to-manufacture design.",
            body_style,
        )
    )
    story.append(Spacer(1, 6))
    for note in bp.get("notes", []):
        story.append(Paragraph(f"• {note}", small_style))

    # 5. Discussing with your veterinarian
    story.append(Paragraph("5. Discussing This With Your Veterinarian", h2_style))
    vet_points = [
        "Bring this report to your next veterinary oncology appointment.",
        "Ask whether a personalized vaccine approach could be appropriate for your pet's case.",
        "Discuss which synthesis providers your vet would recommend working with.",
        "Confirm whether your pet's overall health supports immunotherapy.",
        "Ask about any ongoing clinical trials for cancer immunotherapy in animals.",
        "Remember that all targets in this report are computational predictions that require lab validation.",
    ]
    for point in vet_points:
        story.append(Paragraph(f"• {point}", body_style))

    # 6. Limitations
    story.append(Paragraph("6. Important Limitations", h2_style))
    limitations = [
        "This tool provides computational predictions only — it is not a diagnosis or treatment plan.",
        "All vaccine targets are predictions based on algorithms. They require wet-lab validation.",
        "Fewer than 5% of computationally predicted targets may prove effective in practice.",
        "The vaccine blueprint is a research preview, not a validated therapeutic design.",
        "A qualified veterinary oncologist must review any treatment decisions.",
        "This tool is for educational exploration, not clinical use.",
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
