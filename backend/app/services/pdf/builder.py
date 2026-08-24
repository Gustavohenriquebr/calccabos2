# backend/app/services/pdf/builder.py
"""PDF builder for the CalcCabos memorial.

FASE 6: Pure DTO pipeline — circuit ORM objects replaced by DotDict DTOs.

Responsibilities
----------------
1. Create the SimpleDocTemplate with A3-landscape settings.
2. Initialise the ReportLab stylesheet (all custom ParagraphStyles).
3. Call ``data_provider.get_memorial_data()`` ONCE to obtain the DTO.
4. Pass the DTO to all section modules – NO section performs calculations.
5. Assemble the Flowable story list.
6. Call ``doc.build()`` and return the raw PDF bytes.

This module purposely contains ZERO electrical calculation logic.
All calculations are centralised in data_provider.py.
All rendering is delegated to sections/*.py.
"""
from __future__ import annotations

import logging
from io import BytesIO
from typing import Any, List

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

from app.services.pdf.data_provider import get_memorial_data
from app.services.pdf.estilos import DARK_NAVY, SLATE, GRID
from app.services.pdf.sections.capa import render_capa, render_cabecalho
from app.services.pdf.sections.tabelas import (
    render_tabela_principal,
    render_tabela_protecao,
    render_tabela_validacao,
    render_tabela_automaticos,
    render_tabela_analise_protecao_eletrica,
)
from app.services.pdf.sections.tecnico import render_secoes_memorial
from app.services.pdf.sections.resumo import render_sumario

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------

class PDFBuilderError(RuntimeError):
    """Raised by the builder when PDF generation fails."""


# ---------------------------------------------------------------------------
# Style factory
# ---------------------------------------------------------------------------

def _build_styles() -> dict:
    """Create and return the full CalcCabos stylesheet."""
    styles = getSampleStyleSheet()
    defs = [
        ("cc_logo",          dict(fontSize=14, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)),
        ("cc_title",         dict(fontSize=13, fontName="Helvetica-Bold", textColor=DARK_NAVY, alignment=TA_CENTER)),
        ("cc_cover_brand",   dict(fontSize=18, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)),
        ("cc_cover_title",   dict(fontSize=18, fontName="Helvetica-Bold", textColor=DARK_NAVY, alignment=TA_CENTER)),
        ("cc_cover_project", dict(fontSize=15, fontName="Helvetica-Bold", textColor=SLATE, alignment=TA_CENTER)),
        ("cc_meta_center",   dict(fontSize=8,  fontName="Helvetica", alignment=TA_CENTER)),
        ("cc_section",       dict(fontSize=11, fontName="Helvetica-Bold", textColor=DARK_NAVY, spaceAfter=6)),
        ("cc_small_section", dict(fontSize=8,  fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)),
        ("cc_table_header",  dict(fontSize=4.7, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER, leading=5.2)),
        ("cc_table_cell",    dict(fontSize=4.8, fontName="Helvetica", leading=5.5)),
        ("cc_prot_header",   dict(fontSize=6.0, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER, leading=6.5)),
        ("cc_prot_cell",     dict(fontSize=6.0, fontName="Helvetica", leading=6.8)),
        ("cc_footer",        dict(fontSize=7,  textColor=colors.grey, alignment=TA_CENTER)),
    ]
    for name, kwargs in defs:
        styles.add(ParagraphStyle(name, **kwargs))
    return styles


# ---------------------------------------------------------------------------
# Public builder
# ---------------------------------------------------------------------------

def gerar_pdf(projeto: Any, circuitos: List[Any], usuario: Any) -> bytes:
    """Generate the full CalcCabos memorial PDF and return raw bytes.

    FASE 5: The builder is now a pure orchestrator.
    All data aggregation happens in ``get_memorial_data()``.
    All rendering happens inside ``sections/*.py``.

    Parameters
    ----------
    projeto : Any
        Project ORM instance.
    circuitos : List[Any]
        List of circuit ORM instances (may be empty or None).
    usuario : Any
        Authenticated user ORM instance.

    Returns
    -------
    bytes
        Raw PDF bytes starting with ``%PDF``.

    Raises
    ------
    PDFBuilderError
        On any generation failure, with the original exception as ``__cause__``.
    """
    # --- guards ---
    if projeto is None:
        raise PDFBuilderError("gerar_pdf: projeto não pode ser None.")
    if circuitos is None:
        circuitos = []
        logger.warning("gerar_pdf: circuitos=None → usando lista vazia.")

    logger.info(
        "gerar_pdf [builder Fase 6]: projeto=%s  circuitos=%d",
        getattr(projeto, "id", "?"),
        len(circuitos),
    )

    buf = BytesIO()
    try:
        # ── STEP 1: compute the DTO once ─────────────────────────────────
        dto = get_memorial_data(projeto, circuitos)
        logger.debug("DTO assembled: %d fields", len(dto))

        # ── STEP 2: document + styles ─────────────────────────────────────
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A3),
            topMargin=0.8 * cm,
            bottomMargin=0.8 * cm,
            leftMargin=0.8 * cm,
            rightMargin=0.8 * cm,
            title=f"CalcCabos_{getattr(projeto, 'id', 'sem-id')}",
        )
        styles = _build_styles()

        # Prefer pure DotDict DTOs (Fase 6); fall back to ORM objects if absent
        circuitos_render = dto.get("circuitos_dto") or dto.get("circuitos", [])

        # ── STEP 3: story assembly (pure rendering, zero calculations) ────
        story: List = []

        # Cover page  ← dto path (Fase 5+6)
        story.extend(render_capa(dto, usuario, styles))

        # Technical header  ← legacy project object still used here
        # (cabecalho reads raw ORM attrs; will be DTO-ified in Fase 6)
        story.extend([
            PageBreak(),
            render_cabecalho(projeto, usuario, styles),
            Spacer(1, 0.25 * cm),
        ])

        # Memorial sections 1-15  ← dto path (Fase 5+6)
        story.extend(render_secoes_memorial(dto, styles))

        # Dimensioning tables  ← pure CircuitoDTO DotDicts (Fase 6)
        story.extend([
            PageBreak(),
            Paragraph("Tabela principal de dimensionamento", styles["cc_section"]),
            render_tabela_principal(circuitos_render, styles),
            Spacer(1, 0.35 * cm),
            Paragraph("Verificação de Proteção por Disjuntor", styles["cc_section"]),
            render_tabela_protecao(circuitos_render, styles),
            Spacer(1, 0.35 * cm),
            Paragraph("Critério de seleção automática", styles["cc_section"]),
            render_tabela_automaticos(circuitos_render, styles),
            Spacer(1, 0.35 * cm),
            Paragraph("Validação Normativa dos Circuitos", styles["cc_section"]),
            render_tabela_validacao(circuitos_render, styles),
            Spacer(1, 0.35 * cm),
            Paragraph("ANÁLISE DE PROTEÇÃO ELÉTRICA", styles["cc_section"]),
            render_tabela_analise_protecao_eletrica(circuitos_render, styles),
            PageBreak(),
            Paragraph("Sumário de Critérios e Controle Final", styles["cc_section"]),
        ])

        # Summary + criteria + signature  ← dto path (Fase 5+6)
        resumo_blocos, criterios, assinatura = render_sumario(dto, usuario, styles)
        story.extend([
            *resumo_blocos,
            Spacer(1, 0.45 * cm),
            criterios,
            Spacer(1, 0.7 * cm),
            assinatura,
            Spacer(1, 0.4 * cm),
            HRFlowable(width="100%", thickness=0.5, color=GRID),
            Spacer(1, 0.15 * cm),
            Paragraph(
                "Documento gerado automaticamente pelo CalcCabos. "
                "Requer validação e assinatura do responsável técnico.",
                styles["cc_footer"],
            ),
        ])

        # ── STEP 4: build ─────────────────────────────────────────────────
        doc.build(story)
        pdf_bytes = buf.getvalue()

        if not pdf_bytes:
            raise PDFBuilderError("gerar_pdf: doc.build gerou um PDF vazio.")

        logger.info(
            "gerar_pdf [builder Fase 6] concluído: projeto=%s  tamanho=%d bytes",
            getattr(projeto, "id", "?"),
            len(pdf_bytes),
        )
        return pdf_bytes

    except PDFBuilderError:
        raise
    except Exception as exc:
        logger.exception(
            "gerar_pdf [builder] FALHOU: projeto=%s  erro=%s",
            getattr(projeto, "id", "?"),
            exc,
        )
        raise PDFBuilderError(f"Falha ao gerar PDF: {exc}") from exc
