# backend/app/services/pdf/sections/resumo.py
"""Summary and criteria table renderers for the CalcCabos memorial PDF."""
from __future__ import annotations
from typing import Any, List, Tuple

from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from app.services.calculo import CONTEXTOS
from app.services.pdf.estilos import (
    PETROBRAS_BLUE, LIGHT_BLUE, LIGHT_GRAY, GRID,
    OK_FILL, ALERT_FILL, CRITICAL_FILL, DARK_NAVY,
)
from app.services.pdf.formatters import _fmt, _txt
from app.services.pdf.helpers import (
    _ctx, _norma_ref, _resumo_global,
    _status_fill, _status_final, _critico,
)
from app.services.pdf.sections.tabelas import render_tabela_dados
from app.services.status_utils import status_visual


def render_sumario(
    dto_or_projeto: Any,
    usuario: Any,
    circuitos_or_styles,
    styles: dict = None,
) -> Tuple[List, Table, Table]:
    """Return the three summary components.

    FASE 5: Accepts (dto, usuario, styles) or legacy (projeto, circuitos, usuario, styles).

    Returns (resumo_blocos, criterios, assinatura).
    """
    if isinstance(dto_or_projeto, dict):
        dto = dto_or_projeto
        if styles is None:
            styles = circuitos_or_styles
        resumo_global = dto["resumo_global"]
        circuito_resumo = dto["circuito_resumo"]
        contexto_str = dto["projeto"].get("contexto", "industrial")
    else:
        projeto = dto_or_projeto
        circuitos = circuitos_or_styles
        resumo_global = _resumo_global(projeto, circuitos)
        circuito_resumo = resumo_global
        contexto_str = projeto.contexto

    # Extract circuit KPIs from whichever source was used
    ok = circuito_resumo.get("ok", 0)
    alertas = circuito_resumo.get("alertas", 0)
    criticos = circuito_resumo.get("criticos", 0)
    from app.services.pdf.helpers import _ctx
    contexto = CONTEXTOS.get(_ctx(contexto_str), CONTEXTOS["industrial"])

    resumo = Table(
        [
            ["Circuitos OK", "Circuitos ALERTA", "Circuitos CRÍTICO", "Módulos OK", "Módulos ALERTA", "Módulos CRÍTICO", "Status geral"],
            [
                ok, alertas, criticos,
                resumo_global["modulos_contagem"]["ok"],
                resumo_global["modulos_contagem"]["alerta"],
                resumo_global["modulos_contagem"]["critico"],
                status_visual(resumo_global["status"]),
            ],
        ],
        colWidths=[w * cm for w in [4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 5.0]],
    )
    resumo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("BACKGROUND", (0, 1), (0, 1), OK_FILL),
        ("BACKGROUND", (1, 1), (1, 1), ALERT_FILL),
        ("BACKGROUND", (2, 1), (2, 1), CRITICAL_FILL),
        ("BACKGROUND", (3, 1), (3, 1), OK_FILL),
        ("BACKGROUND", (4, 1), (4, 1), ALERT_FILL),
        ("BACKGROUND", (5, 1), (5, 1), CRITICAL_FILL),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    motivo = render_tabela_dados(
        "Motivo do status geral",
        [
            ["Status geral", status_visual(resumo_global["status"])],
            ["Motivo", resumo_global["motivo_status"]],
        ],
        styles,
    )

    criterios = Table(
        [
            ["Critério", "Referência", "Aplicação no CalcCabos"],
            ["Ampacidade", "NBR 5410 seção 6.2 / N-1997", "Ib' = Ib / (K1 × K2 × K3); seleção por ICOND ≥ Ib' por formação."],
            ["Queda de tensão", contexto["norma_ref"], f"Limite normal adotado: {contexto['qt_terminal']}%."],
            ["Curto-circuito térmico", "IEC 60909 / N-2918", "S ≥ Icc × √t / K; K por material e isolação."],
            ["Condutor PE", "NBR 5410 tabela 54.2", "SPE = Sfase até 16 mm²; 16 mm² até 35 mm²; Sfase/2 acima de 35 mm²."],
            ["Seção final", "IEC 60228", "Maior seção normalizada entre ampacidade, queda de tensão e Joule."],
        ],
        colWidths=[w * cm for w in [6, 8, 20]],
    )
    criterios.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    assinatura = Table(
        [
            ["Responsável técnico", "CREA", "Assinatura", "Data"],
            [_txt(usuario.nome), _txt(usuario.crea, ""), "", ""],
        ],
        colWidths=[w * cm for w in [8, 6, 12, 6]],
    )
    assinatura.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BLUE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
    ]))

    return [resumo, Spacer(1, 0.35 * cm), motivo], criterios, assinatura
