# backend/app/services/pdf/sections/capa.py
"""Cover page and technical header renderers for the CalcCabos memorial PDF."""
from __future__ import annotations
from datetime import datetime
from typing import Any, List

from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from app.services.pdf.estilos import (
    PETROBRAS_BLUE, LIGHT_BLUE, LIGHT_GRAY, GRID,
    OK_FILL, ALERT_FILL, CRITICAL_FILL,
    DARK_NAVY, SLATE, SURFACE,
)
from app.services.pdf.formatters import _fmt, _txt
from app.services.pdf.helpers import (
    _ctx, _norma_ref, _resumo_global, _status_hex,
)
from app.services.pdf.sections.tabelas import render_tabela_dados
from app.services.status_utils import status_visual


def render_capa(dto_or_projeto, usuario: Any, circuitos_or_styles, styles: dict = None) -> List:
    """Return the flowables for the cover page.

    FASE 5: Accepts either (dto, usuario, styles) or the legacy
    (projeto, usuario, circuitos, styles) signature for backward compat.
    """
    # Resolve arguments
    if isinstance(dto_or_projeto, dict):
        # Fase 5 path: (dto, usuario, styles)
        dto = dto_or_projeto
        if styles is None:
            styles = circuitos_or_styles
        resumo = dto["resumo_global"]
        projeto_dto = dto["projeto"]
        nome = projeto_dto.get("nome", "")
        cliente = projeto_dto.get("cliente") or "não informado"
        contexto = _ctx(projeto_dto.get("contexto", "industrial"))
        revisao = projeto_dto.get("revisao", "0")
        tensao_ref = projeto_dto.get("tensao_ref")
        projeto_id = projeto_dto.get("id", "")
    else:
        # Legacy path: (projeto, usuario, circuitos, styles)
        projeto = dto_or_projeto
        circuitos = circuitos_or_styles
        resumo = _resumo_global(projeto, circuitos)
        nome = projeto.nome
        cliente = projeto.cliente or "não informado"
        contexto = _ctx(projeto.contexto)
        revisao = getattr(projeto, "revisao", None) or "0"
        tensao_ref = projeto.tensao_ref
        projeto_id = projeto.id

    data = datetime.now().strftime("%d/%m/%Y %H:%M")
    status = resumo["status"]

    titulo = Table(
        [
            [Paragraph("CALCCABOS", styles["cc_cover_brand"]), Paragraph("MEMORIAL TÉCNICO DE DIMENSIONAMENTO ELÉTRICO", styles["cc_cover_title"])],
            ["", Paragraph(_txt(nome), styles["cc_cover_project"])],
        ],
        colWidths=[7.0 * cm, 27.0 * cm],
    )
    titulo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 1), DARK_NAVY),
        ("BACKGROUND", (1, 0), (1, 1), LIGHT_BLUE),
        ("TEXTCOLOR", (0, 0), (0, 1), colors.white),
        ("SPAN", (0, 0), (0, 1)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.6, GRID),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))

    kpis = Table(
        [
            ["Circuitos", "OK", "Alertas", "Críticos", "Módulos OK", "Módulos alerta", "Módulos críticos", "Status geral"],
            [
                resumo.get("total", 0),
                resumo.get("ok", 0),
                resumo.get("alertas", 0),
                resumo.get("criticos", 0),
                resumo.get("modulos_contagem", {}).get("ok", 0),
                resumo.get("modulos_contagem", {}).get("alerta", 0),
                resumo.get("modulos_contagem", {}).get("critico", 0),
                status_visual(status),
            ],
        ],
        colWidths=[w * cm for w in [4.0, 3.4, 3.8, 3.8, 4.1, 4.3, 4.4, 6.2]],
    )
    kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("BACKGROUND", (1, 1), (1, 1), OK_FILL),
        ("BACKGROUND", (2, 1), (2, 1), ALERT_FILL),
        ("BACKGROUND", (3, 1), (3, 1), CRITICAL_FILL),
        ("BACKGROUND", (4, 1), (4, 1), OK_FILL),
        ("BACKGROUND", (5, 1), (5, 1), ALERT_FILL),
        ("BACKGROUND", (6, 1), (6, 1), CRITICAL_FILL),
        ("BACKGROUND", (7, 1), (7, 1), _status_hex(status)),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    dados = render_tabela_dados(
        "Identificação técnica",
        [
            ["Projeto", nome],
            ["Cliente", cliente],
            ["Engenheiro responsável", usuario.nome],
            ["CREA", usuario.crea or "não informado"],
            ["Empresa", usuario.empresa or "não informado"],
            ["Contexto normativo", contexto],
            ["Versão/Revisão", revisao],
            ["Data de emissão", data],
            ["Status geral", status_visual(status)],
        ],
        styles,
    )
    motivo = render_tabela_dados(
        "Sumário executivo",
        [
            ["Síntese", resumo.get("motivo_status") or "Todos os módulos avaliados estão OK."],
            ["Critério de emissão", "Documento gerado automaticamente pelo CalcCabos e sujeito à validação do responsável técnico."],
        ],
        styles,
    )
    return [titulo, Spacer(1, 0.6 * cm), kpis, Spacer(1, 0.45 * cm), dados, Spacer(1, 0.35 * cm), motivo]


def render_cabecalho(projeto: Any, usuario: Any, styles: dict) -> Table:
    """Return the technical header table shown at the top of every page."""
    normas = f"NBR 5410 / IEC 60909 / {_norma_ref(projeto)}"
    data = datetime.now().strftime("%d/%m/%Y %H:%M")
    header = [
        [
            Paragraph("<b>CALCCABOS</b>", styles["cc_logo"]),
            Paragraph("<b>MEMORY CALCULATION FOR LV/MV CABLES</b>", styles["cc_title"]),
            "", "", "",
            Paragraph(f"<b>REV.</b><br/>{getattr(projeto, 'revisao', None) or '0'}", styles["cc_meta_center"]),
        ],
        ["Projeto", _txt(projeto.nome), "Cliente", _txt(projeto.cliente, "-"), "Data", data],
        ["Engenheiro responsável", _txt(usuario.nome), "CREA", _txt(usuario.crea, "-"), "Empresa", _txt(usuario.empresa, "-")],
        ["Contexto normativo", _ctx(projeto.contexto), "Normas aplicáveis", normas, "Tensão ref.", f"{_fmt(projeto.tensao_ref, 0)} V"],
        ["Aprovado por", "", "Verificado por", "", "Documento", f"CALCCABOS-{projeto.id}"],
    ]
    table = Table(header, colWidths=[w * cm for w in [4.0, 8.5, 3.6, 8.5, 3.2, 5.2]])
    table.setStyle(TableStyle([
        ("SPAN", (1, 0), (4, 0)),
        ("BACKGROUND", (0, 0), (0, 0), PETROBRAS_BLUE),
        ("BACKGROUND", (1, 0), (5, 0), LIGHT_BLUE),
        ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 1), (2, -1), "Helvetica-Bold"),
        ("FONTNAME", (4, 1), (4, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table
