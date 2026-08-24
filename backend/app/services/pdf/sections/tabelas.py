# backend/app/services/pdf/sections/tabelas.py
"""All ReportLab Table builders for the CalcCabos memorial PDF.

Each function:
  - receives pre-computed data (dicts / circuit objects) + a styles dict
  - returns a ReportLab Flowable (Table)
  - performs NO electrical calculations
  - does NOT access the database
"""
from __future__ import annotations
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Table, TableStyle

from app.services.pdf.estilos import (
    PETROBRAS_BLUE, LIGHT_BLUE, LIGHT_GRAY, GRID,
    OK_FILL, ALERT_FILL, CRITICAL_FILL,
    DARK_NAVY, SLATE, SURFACE, BORDER_SOFT,
)
from app.services.pdf.formatters import _fmt, _txt, _nd, _ck, _texto_curto
from app.services.pdf.helpers import _status_final, _status_fill, _tipo_cabo
from app.services.status_utils import status_visual


# ---------------------------------------------------------------------------
# Generic data table
# ---------------------------------------------------------------------------

def render_tabela_dados(titulo: str, linhas: List[List], styles: dict) -> Table:
    """Two-column key/value data table with a coloured title row."""
    data = [[Paragraph(_txt(titulo), styles["cc_small_section"]), ""]]
    if not linhas:
        data.append(["-", "-"])
    else:
        data.extend([[_txt(label), _txt(valor)] for label, valor in linhas])
    table = Table(data, colWidths=[8 * cm, 10 * cm])
    table.setStyle(TableStyle([
        ("SPAN", (0, 0), (1, 0)),
        ("BACKGROUND", (0, 0), (1, 0), DARK_NAVY),
        ("TEXTCOLOR", (0, 0), (1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.30, BORDER_SOFT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return table


def render_tabela_lista_tecnica(
    titulo: str,
    headers: List[str],
    linhas: List[List],
    styles: dict,
    col_widths: List[float] = None,
) -> Table:
    """Generic professional multi-column table for technical evidence blocks."""
    total_cols = max(len(headers), 1)
    data = [[Paragraph(_txt(titulo), styles["cc_small_section"])] + [""] * (total_cols - 1)]
    data.append([Paragraph(_txt(header), styles["cc_prot_header"]) for header in headers])

    if not linhas:
        data.append([Paragraph("nao informado", styles["cc_prot_cell"])] + [""] * (total_cols - 1))
    else:
        for row in linhas:
            safe_row = list(row)[:total_cols] + [""] * max(0, total_cols - len(row))
            data.append([Paragraph(_txt(value), styles["cc_prot_cell"]) for value in safe_row])

    if not col_widths:
        col_widths = [34.0 / total_cols] * total_cols

    table = Table(data, colWidths=[w * cm for w in col_widths], repeatRows=2)
    style = [
        ("SPAN", (0, 0), (-1, 0)),
        ("BACKGROUND", (0, 0), (-1, 0), DARK_NAVY),
        ("BACKGROUND", (0, 1), (-1, 1), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 1), colors.white),
        ("FONTNAME", (0, 0), (-1, 1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 2), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    table.setStyle(TableStyle(style))
    return table


# ---------------------------------------------------------------------------
# Main dimensioning table (38 columns)
# ---------------------------------------------------------------------------

def _linha_principal(c: Any) -> List:
    """Build a 38-element row for the main circuit table."""
    qt_acum = getattr(c, "queda_tensao_acumulada", None)
    qt_pct = getattr(c, "queda_tensao_pct", None)
    qt_calc = qt_acum if qt_acum is not None else qt_pct
    qt_max = getattr(c, "queda_tensao_max", None)
    corrente_condutor = getattr(c, "corrente_condutor", None) or getattr(c, "ampacidade", None) or 0
    corrente_corrigida = getattr(c, "corrente_corrigida", None) or getattr(c, "corrente_nominal", None) or 0
    formacao = getattr(c, "formacao", None)
    amp_ok = corrente_condutor >= (corrente_corrigida / max(formacao or 1, 1))
    qt_ok = qt_calc is None or qt_max is None or qt_calc <= qt_max
    status = _status_final(c)
    return [
        c.tag or c.descricao,
        c.from_barramento or "-",
        c.to_equipamento or "-",
        c.protection_device or "-",
        _fmt(c.tensao, 0),
        _fmt(c.fases, 0),
        c.corrente_ac_dc or "AC",
        _fmt(c.potencia_kw, 2),
        _fmt(c.potencia_kva, 2),
        _fmt(c.fator_potencia, 2),
        _fmt(c.fator_eficiencia, 2),
        _fmt(c.fator_demanda, 2),
        _fmt(c.distancia_m, 1),
        _tipo_cabo(c.tipo_cabo),
        c.metodo_instalacao or "-",
        _fmt(c.fator_k1, 3),
        _fmt(c.fator_k2, 3),
        _fmt(c.fator_k3, 3),
        _fmt(c.corrente_projeto or c.corrente_nominal, 2),
        _fmt(c.corrente_corrigida, 2),
        _fmt(c.corrente_condutor or c.ampacidade, 2),
        f"{_fmt(c.secao_mm2, 1)} / PE {_fmt(c.secao_pe_mm2, 1)}",
        _ck(amp_ok),
        _fmt(c.impedancia_rdc, 6),
        _fmt(c.impedancia_rac, 6),
        _fmt(c.impedancia_xl, 6),
        _fmt(qt_max, 2),
        _fmt(qt_calc, 3),
        _ck(qt_ok),
        _fmt(c.isc_local, 2),
        _fmt(c.isc_cabo, 2),
        _fmt(c.tempo_atuacao, 3),
        _fmt(c.formacao, 0),
        status_visual(status),
        c.tipo_cabo_comercial or "-",
        _fmt(c.comprimento_real or c.distancia_m, 1),
        c.revisao or "0",
        c.nota_tecnica or "",
    ]


def render_tabela_principal(circuitos: List[Any], styles: dict) -> Table:
    headers = [
        "CIRCUIT", "FROM", "TO", "PROT.DEVICE", "Vn", "PHASE", "AC/DC",
        "kW", "kVA", "PF", "η", "n", "L(m)", "Type of cable", "install.",
        "K1", "K2", "K3", "Ib", "Ib'", "ICOND", "CP×Ø", "CK",
        "RDC", "RAC", "XL", "ΔVmax", "ΔVcalc", "CK", "Isc_LOC",
        "Isc_CAB", "t(s)", "FORMATION", "FINAL CONTROL", "CABLE TYPE",
        "LENGTH", "REV", "NOTE",
    ]
    data = [[Paragraph(h, styles["cc_table_header"]) for h in headers]]
    for c in circuitos:
        data.append([Paragraph(_txt(v), styles["cc_table_cell"]) for v in _linha_principal(c)])

    col_widths = [
        1.45, 1.7, 1.7, 1.3, 0.75, 0.75, 0.75, 0.75, 0.85, 0.60,
        0.60, 0.60, 0.75, 1.05, 0.95, 0.55, 0.55, 0.55, 0.80, 0.80,
        0.85, 1.15, 0.55, 0.80, 0.80, 0.70, 0.85, 0.90, 0.55, 0.85,
        0.85, 0.60, 0.95, 1.25, 1.25, 0.85, 0.55, 2.05,
    ]
    table = Table(data, colWidths=[w * cm for w in col_widths], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.25, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 1), (36, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
    ]
    for row_index, c in enumerate(circuitos, start=1):
        fill = _status_fill(_status_final(c))
        style.append(("BACKGROUND", (33, row_index), (33, row_index), fill))
        style.append(("FONTNAME", (33, row_index), (33, row_index), "Helvetica-Bold"))
    table.setStyle(TableStyle(style))
    return table


# ---------------------------------------------------------------------------
# Protection table
# ---------------------------------------------------------------------------

def render_tabela_protecao(circuitos: List[Any], styles: dict) -> Table:
    headers = ["CIRCUIT", "DEVICE", "Vn", "CURVE", "In", "Icu", "Ib", "ICOND", "Icc", "PROTECTION CHECK", "NOTE"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    for c in circuitos:
        data.append([
            Paragraph(_txt(c.tag or c.descricao), styles["cc_prot_cell"]),
            Paragraph(_txt(c.protection_device or "-"), styles["cc_prot_cell"]),
            Paragraph(_fmt(getattr(c, "disjuntor_tensao_nominal", None), 0), styles["cc_prot_cell"]),
            Paragraph(_txt(getattr(c, "disjuntor_curva", None) or "-"), styles["cc_prot_cell"]),
            Paragraph(_fmt(getattr(c, "disjuntor_corrente_nominal", None) or c.disjuntor_a, 0), styles["cc_prot_cell"]),
            Paragraph(_fmt(getattr(c, "disjuntor_icu", None), 2), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.corrente_projeto or c.corrente_nominal, 2), styles["cc_prot_cell"]),
            Paragraph(_fmt((c.corrente_condutor or c.ampacidade or 0) * max(c.formacao or 1, 1), 2), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.isc_local, 2), styles["cc_prot_cell"]),
            Paragraph(_txt(getattr(c, "protecao_status", None) or "-"), styles["cc_prot_cell"]),
            Paragraph(_txt(getattr(c, "protecao_nota", None) or "-"), styles["cc_prot_cell"]),
        ])
    table = Table(data, colWidths=[3.2, 2.0, 1.5, 1.4, 1.5, 1.5, 1.6, 1.8, 1.6, 2.4, 13.5], repeatRows=1)
    table = Table(data, colWidths=[w * cm for w in [3.2, 2.0, 1.5, 1.4, 1.5, 1.5, 1.6, 1.8, 1.6, 2.4, 13.5]], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 1), (9, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for row_index, c in enumerate(circuitos, start=1):
        fill = _status_fill(getattr(c, "protecao_status", None) or "ALERTA")
        style.append(("BACKGROUND", (9, row_index), (9, row_index), fill))
        style.append(("FONTNAME", (9, row_index), (9, row_index), "Helvetica-Bold"))
    table.setStyle(TableStyle(style))
    return table


# ---------------------------------------------------------------------------
# Normative validation table
# ---------------------------------------------------------------------------

def render_tabela_validacao(circuitos: List[Any], styles: dict) -> Table:
    headers = ["CIRCUIT", "STATUS", "JUSTIFICATIVA TECNICA"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    for c in circuitos:
        data.append([
            Paragraph(_txt(c.tag or c.descricao), styles["cc_prot_cell"]),
            Paragraph(_txt(getattr(c, "validacao_status", None) or _status_final(c)), styles["cc_prot_cell"]),
            Paragraph(_txt(getattr(c, "validacao_mensagem", None) or "-"), styles["cc_prot_cell"]),
        ])
    table = Table(data, colWidths=[5.0 * cm, 3.0 * cm, 26.0 * cm], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for row_index, c in enumerate(circuitos, start=1):
        fill = _status_fill(getattr(c, "validacao_status", None) or _status_final(c))
        style.append(("BACKGROUND", (1, row_index), (1, row_index), fill))
        style.append(("FONTNAME", (1, row_index), (1, row_index), "Helvetica-Bold"))
    table.setStyle(TableStyle(style))
    return table


# ---------------------------------------------------------------------------
# Automatic component selection table
# ---------------------------------------------------------------------------

def render_tabela_automaticos(circuitos: List[Any], styles: dict) -> Table:
    headers = [
        "CIRCUIT", "MODO", "Ib", "Ib'", "SECAO", "MOTIVO DA ESCOLHA",
        "DISJUNTOR", "In>=Ib", "In<=Iz", "Icu>=Icc", "DV FINAL",
    ]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    for c in circuitos:
        disj = "-"
        if getattr(c, "disjuntor_sugerido_in", None):
            curva = getattr(c, "disjuntor_sugerido_curva", None) or "-"
            icu = _fmt(getattr(c, "disjuntor_sugerido_icu", None), 2)
            disj = f"{_fmt(c.disjuntor_sugerido_in, 0)}A / {icu}kA / {curva}"
        ib = getattr(c, "corrente_projeto", None) or getattr(c, "corrente_nominal", None)
        ib_corr = getattr(c, "corrente_corrigida", None)
        iz = getattr(c, "cabo_sugerido_ampacidade", None) or (
            (getattr(c, "corrente_condutor", None) or getattr(c, "ampacidade", None) or 0)
            * max(getattr(c, "formacao", None) or 1, 1)
        )
        in_disj = getattr(c, "disjuntor_sugerido_in", None)
        icu_v = getattr(c, "disjuntor_sugerido_icu", None)
        icc = getattr(c, "isc_local", None)
        qt = (
            getattr(c, "queda_tensao_acumulada", None)
            if getattr(c, "queda_tensao_acumulada", None) is not None
            else getattr(c, "queda_tensao_pct", None)
        )
        motivo = getattr(c, "selecao_componentes_justificativa", None) or "-"
        data.append([
            Paragraph(_txt(c.tag or c.descricao), styles["cc_prot_cell"]),
            Paragraph(_txt(getattr(c, "modo_dimensionamento", None) or getattr(c, "modo_selecao_componentes", None) or "manual"), styles["cc_prot_cell"]),
            Paragraph(_fmt(ib, 2), styles["cc_prot_cell"]),
            Paragraph(_fmt(ib_corr, 2), styles["cc_prot_cell"]),
            Paragraph(_txt(getattr(c, "cabo_sugerido_tipo_comercial", None) or c.tipo_cabo_comercial or "-"), styles["cc_prot_cell"]),
            Paragraph(_txt(motivo), styles["cc_prot_cell"]),
            Paragraph(disj, styles["cc_prot_cell"]),
            Paragraph(_ck(bool(in_disj and ib and in_disj >= ib)), styles["cc_prot_cell"]),
            Paragraph(_ck(bool(in_disj and iz and in_disj <= iz)), styles["cc_prot_cell"]),
            Paragraph(_ck(bool(icu_v and icc and icu_v >= icc)) if icc else "-", styles["cc_prot_cell"]),
            Paragraph(_fmt(qt, 3), styles["cc_prot_cell"]),
        ])
    table = Table(
        data,
        colWidths=[w * cm for w in [2.7, 1.7, 1.5, 1.5, 2.5, 11.5, 3.2, 1.5, 1.5, 1.7, 1.7]],
        repeatRows=1,
    )
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (4, -1), "CENTER"),
        ("ALIGN", (6, 1), (10, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for row_index, c in enumerate(circuitos, start=1):
        fill = _status_fill(getattr(c, "selecao_componentes_status", None) or "ALERTA")
        style.append(("BACKGROUND", (4, row_index), (4, row_index), fill))
        style.append(("FONTNAME", (4, row_index), (4, row_index), "Helvetica-Bold"))
    table.setStyle(TableStyle(style))
    return table


# ---------------------------------------------------------------------------
# Circuit summary table (memorial)
# ---------------------------------------------------------------------------

def render_tabela_circuitos_memorial(circuitos: List[Any], styles: dict) -> Table:
    headers = ["TAG", "DESCRICAO", "Ib", "Ib'", "CABO", "DISJUNTOR", "DV", "STATUS", "OBSERVACAO"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    for c in circuitos:
        qt = (
            getattr(c, "queda_tensao_acumulada", None)
            if getattr(c, "queda_tensao_acumulada", None) is not None
            else getattr(c, "queda_tensao_pct", None)
        )
        disj = "-"
        if getattr(c, "disjuntor_sugerido_in", None):
            disj = f"{_fmt(c.disjuntor_sugerido_in, 0)}A / {_fmt(c.disjuntor_sugerido_icu, 1)}kA"
        elif getattr(c, "disjuntor_corrente_nominal", None) or getattr(c, "disjuntor_a", None):
            disj = f"{_fmt(getattr(c, 'disjuntor_corrente_nominal', None) or c.disjuntor_a, 0)}A"
        data.append([
            Paragraph(_txt(c.tag or "-"), styles["cc_prot_cell"]),
            Paragraph(_txt(c.descricao or "-"), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.corrente_projeto or c.corrente_nominal, 2), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.corrente_corrigida, 2), styles["cc_prot_cell"]),
            Paragraph(_txt(c.cabo_sugerido_tipo_comercial or c.tipo_cabo_comercial or "-"), styles["cc_prot_cell"]),
            Paragraph(disj, styles["cc_prot_cell"]),
            Paragraph(_fmt(qt, 2), styles["cc_prot_cell"]),
            Paragraph(_status_final(c), styles["cc_prot_cell"]),
            Paragraph(_txt(c.validacao_mensagem or c.selecao_componentes_justificativa or "-"), styles["cc_prot_cell"]),
        ])
    table = Table(
        data,
        colWidths=[w * cm for w in [2.5, 5.0, 1.7, 1.7, 3.0, 3.0, 1.5, 2.0, 14.0]],
        repeatRows=1,
    )
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 1), (7, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for row_index, c in enumerate(circuitos, start=1):
        style.append(("BACKGROUND", (7, row_index), (7, row_index), _status_fill(_status_final(c))))
        style.append(("FONTNAME", (7, row_index), (7, row_index), "Helvetica-Bold"))
    table.setStyle(TableStyle(style))
    return table


# ---------------------------------------------------------------------------
# Grounding measurements table
# ---------------------------------------------------------------------------

def render_tabela_medicoes_aterramento(aterramento: Dict[str, Any], styles: dict) -> Table:
    headers = ["Linha", "a (m)", "p (m)", "R (ohm)", "rho (ohm.m)", "Status"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    medicoes = aterramento.get("medicoes") or []
    if not medicoes:
        data.append([Paragraph("não informado", styles["cc_prot_cell"]), "", "", "", "", ""])
    else:
        for m in medicoes:
            data.append([
                Paragraph(_txt(m.get("linha") or "-"), styles["cc_prot_cell"]),
                Paragraph(_nd(m.get("espacamento_a_m"), 3), styles["cc_prot_cell"]),
                Paragraph(_nd(m.get("profundidade_p_m"), 3), styles["cc_prot_cell"]),
                Paragraph(_nd(m.get("resistencia_ohm"), 3), styles["cc_prot_cell"]),
                Paragraph(_nd(m.get("resistividade_ohm_m"), 3), styles["cc_prot_cell"]),
                Paragraph("valida" if m.get("valido") else (m.get("erro") or "nao calculavel"), styles["cc_prot_cell"]),
            ])
    table = Table(data, colWidths=[w * cm for w in [3, 2.2, 2.2, 2.4, 3.0, 21.2]], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (4, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


# ---------------------------------------------------------------------------
# Classified areas table
# ---------------------------------------------------------------------------

def render_tabela_areas_classificadas(areas_classificadas: Dict[str, Any], styles: dict) -> Table:
    headers = ["Área", "Zona", "Grupo", "Temp.", "Equipamento Ex", "Proteção", "Grupo Eq.", "Temp. Eq.", "Status", "Justificativa"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    areas = areas_classificadas.get("areas") or []
    if not areas:
        data.append([Paragraph("não informado", styles["cc_prot_cell"]), "", "", "", "", "", "", "", "", ""])
    else:
        for area in areas:
            equipamentos = area.get("equipamentos") or [{"nome_tag": "não informado", "status": area.get("status"), "mensagem": area.get("mensagem")}]
            for eq in equipamentos:
                data.append([
                    Paragraph(_txt(area.get("nome") or "não informado"), styles["cc_prot_cell"]),
                    Paragraph(_txt(area.get("zona") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(area.get("grupo") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(area.get("classe_temperatura") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(eq.get("nome_tag") or "não informado"), styles["cc_prot_cell"]),
                    Paragraph(_txt(eq.get("tipo_protecao_ex") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(eq.get("grupo") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(eq.get("classe_temperatura") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(eq.get("status") or area.get("status") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(eq.get("mensagem") or area.get("mensagem") or "-"), styles["cc_prot_cell"]),
                ])
    table = Table(data, colWidths=[w * cm for w in [3.2, 1.8, 1.6, 1.5, 3.4, 2.2, 1.8, 1.8, 2.0, 15.7]], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (8, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


# ---------------------------------------------------------------------------
# Análise de Proteção Elétrica (Aula 4)
# ---------------------------------------------------------------------------

def render_tabela_analise_protecao_eletrica(circuitos: List[Any], styles: dict) -> Table:
    headers = ["CIRCUITO", "CORRENTE (Ib)", "ICC CALC. (kA)", "DISJUNTOR", "CURVA", "STATUS FINAL", "JUSTIFICATIVA NORMATIVA"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    for c in circuitos:
        disj = "-"
        if getattr(c, "disjuntor_sugerido_in", None):
            disj = f"{_fmt(c.disjuntor_sugerido_in, 0)}A"
        elif getattr(c, "disjuntor_corrente_nominal", None) or getattr(c, "disjuntor_a", None):
            disj = f"{_fmt(getattr(c, 'disjuntor_corrente_nominal', None) or c.disjuntor_a, 0)}A"

        curva = getattr(c, "disjuntor_curva", None) or getattr(c, "disjuntor_sugerido_curva", None) or "C"
        status = _status_final(c)

        # Destacar status CRITICO em vermelho
        status_color = "red" if status == "CRITICO" else "black"
        status_para = Paragraph(f"<font color='{status_color}'>{status}</font>", styles["cc_prot_cell"])

        justificativa = getattr(c, "protecao_nota", None) or getattr(c, "selecao_componentes_justificativa", None) or "-"

        data.append([
            Paragraph(_txt(c.tag or c.descricao), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.corrente_projeto or c.corrente_nominal, 2), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.isc_local, 2), styles["cc_prot_cell"]),
            Paragraph(disj, styles["cc_prot_cell"]),
            Paragraph(_txt(curva), styles["cc_prot_cell"]),
            status_para,
            Paragraph(_txt(justificativa), styles["cc_prot_cell"]),
        ])
    
    table = Table(
        data,
        colWidths=[w * cm for w in [4.0, 2.5, 2.5, 2.5, 1.5, 3.0, 21.0]],
        repeatRows=1,
    )
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.30, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (5, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    table.setStyle(TableStyle(style))
    return table
