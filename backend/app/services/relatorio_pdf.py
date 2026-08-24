from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.calculo import CONTEXTOS
from app.services.projeto_eletrico import (
    calcular_sistema_trifasico_projeto,
    calcular_transformador,
    carregar_json,
)
from app.services.aterramento import calcular_aterramento
from app.services.areas_classificadas import calcular_areas_classificadas
from app.services.para_raios import calcular_para_raios
from app.services.protecao import validar_protecao_geral
from app.services.status_utils import (
    is_critico,
    limpar_texto,
    normalizar_status,
    normalizar_tipo_cabo,
    status_global,
    status_visual,
)


import logging
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FASE 4: New architecture imports
# relatorio_pdf.py now acts as a compatibility layer.
# The builder and section modules contain the real implementation.
# Legacy code below is preserved for backward compatibility.
# ---------------------------------------------------------------------------
from .pdf.builder import gerar_pdf as _gerar_pdf_builder, PDFBuilderError
from .pdf.helpers import (
    _ctx as _ctx_helper,
    _resumo_global as _resumo_global_helper,
    _conclusoes_tecnicas as _conclusoes_tecnicas_helper,
    _contagem_status as _contagem_status_helper,
    _contagem_protecoes_circuitos as _contagem_protecoes_helper,
)


# Import shared style constants and formatter utilities
from .pdf.estilos import (
    PETROBRAS_BLUE,
    LIGHT_BLUE,
    LIGHT_GRAY,
    GRID,
    OK_FILL,
    ALERT_FILL,
    CRITICAL_FILL,
    DARK_NAVY,
    SLATE,
    SURFACE,
    BORDER_SOFT,
)

from .pdf.formatters import (
    _fmt,
    _txt,
    _nd,
    _ck,
    _texto_curto,
    _cor_status_pdf,
    _cabo_circuito_pdf,
    _disjuntor_circuito_pdf,
)





def _ctx(contexto):
    if hasattr(contexto, "value"):
        return contexto.value
    texto = str(contexto or "industrial")
    return texto.split(".")[-1]


def _tipo_cabo(tipo):
    return normalizar_tipo_cabo(tipo)


# _txt moved to pdf/formatters.py


# _fmt moved to pdf/formatters.py


# _status_final (duplicate) moved to pdf/formatters.py


def _status_fill(status):
    status = normalizar_status(status)
    if status == "OK":
        return OK_FILL
    if status == "CRITICO":
        return CRITICAL_FILL
    return ALERT_FILL


def _norma_ref(projeto):
    contexto = _ctx(projeto.contexto)
    return CONTEXTOS.get(contexto, CONTEXTOS["industrial"])["norma_ref"]


# _ck moved to pdf/formatters.py



def _critico(status):
    return is_critico(status)


def _status_final(c):
    if getattr(c, "status_final", None):
        return normalizar_status(c.status_final)
    if getattr(c, "status", None) == "ok":
        return "OK"
    if getattr(c, "status", None) == "erro":
        return "CRITICO"
    if getattr(c, "status", None) == "alerta":
        return "ALERTA"
    return "ALERTA"


# _status_fill and _critico defined above (kept single canonical copy)


def _contagem_status(circuitos):
    total = len(circuitos)
    ok = sum(1 for c in circuitos if _status_final(c) == "OK")
    alertas = sum(1 for c in circuitos if _status_final(c) == "ALERTA")
    criticos = sum(1 for c in circuitos if _critico(_status_final(c)))
    status = "CRITICO" if criticos else "ALERTA" if alertas else "OK" if total else "NAO CALCULADO"
    return {"total": total, "ok": ok, "alertas": alertas, "criticos": criticos, "status": status}


def _contagem_protecoes_circuitos(circuitos):
    statuses = [normalizar_status(getattr(c, "protecao_status", None), "OK") for c in circuitos]
    return {
        "ok": sum(1 for status in statuses if status == "OK"),
        "alerta": sum(1 for status in statuses if status == "ALERTA"),
        "critico": sum(1 for status in statuses if status == "CRITICO"),
    }


def _resumo_global(projeto, circuitos, modulos=None):
    circuito_resumo = _contagem_status(circuitos)
    if modulos is None:
        transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
        modulos = {
            "Proteção geral": validar_protecao_geral(carregar_json(getattr(projeto, "protecao_geral_dados", None)), transformador),
            "Para-raios": calcular_para_raios(carregar_json(getattr(projeto, "para_raios_dados", None))),
            "Aterramento": calcular_aterramento(carregar_json(getattr(projeto, "aterramento_dados", None))),
            "Áreas Classificadas": calcular_areas_classificadas(carregar_json(getattr(projeto, "areas_classificadas_dados", None))),
        }

    protecoes = _contagem_protecoes_circuitos(circuitos)
    status_items = [circuito_resumo["status"]]
    status_items.extend(normalizar_status(getattr(c, "protecao_status", None), "OK") for c in circuitos)
    status_items.extend(normalizar_status(dados.get("status"), "ALERTA") for dados in modulos.values())
    geral = status_global(*status_items)

    criticos = []
    alertas = []
    if circuito_resumo["criticos"]:
        criticos.append(f"Circuitos ({circuito_resumo['criticos']} crítico(s))")
    elif circuito_resumo["alertas"]:
        alertas.append(f"Circuitos ({circuito_resumo['alertas']} em alerta)")

    if protecoes["critico"]:
        criticos.append(f"Proteções de circuitos ({protecoes['critico']} crítica(s))")
    elif protecoes["alerta"]:
        alertas.append(f"Proteções de circuitos ({protecoes['alerta']} em alerta)")

    for nome, dados in modulos.items():
        status = normalizar_status(dados.get("status"), "ALERTA")
        mensagem = dados.get("mensagem") or "sem justificativa"
        if status == "CRITICO":
            criticos.append(f"{nome}: {mensagem}")
        elif status == "ALERTA":
            if nome == "Para-raios":
                alertas.append("Para-raios não informado ou incompleto.")
            else:
                alertas.append(f"{nome}: {mensagem}")

    return {
        **circuito_resumo,
        "status": geral,
        "protecoes": protecoes,
        "modulos": modulos,
        "criticos_modulos": criticos,
        "alertas_modulos": alertas,
        "modulos_contagem": {
            "ok": sum(1 for dados in modulos.values() if normalizar_status(dados.get("status"), "ALERTA") == "OK"),
            "alerta": sum(1 for dados in modulos.values() if normalizar_status(dados.get("status"), "ALERTA") == "ALERTA"),
            "critico": sum(1 for dados in modulos.values() if normalizar_status(dados.get("status"), "ALERTA") == "CRITICO"),
        },
        "motivo_status": (
            f"Há {len(criticos)} pendência(s) crítica(s) e {len(alertas)} pendência(s) em alerta."
            if criticos
            else f"Há {len(alertas)} pendência(s) em alerta."
            if alertas
            else "Todos os módulos avaliados estão OK."
        ),
    }


def _conclusoes_tecnicas(circuitos, resumo_global=None):
    if not circuitos and not resumo_global:
        return ["Nenhum circuito cadastrado para emissão do memorial técnico."]

    fora_qt = sum(
        1 for c in circuitos
        if (c.queda_tensao_acumulada if c.queda_tensao_acumulada is not None else c.queda_tensao_pct) is not None
        and c.queda_tensao_max is not None
        and (c.queda_tensao_acumulada if c.queda_tensao_acumulada is not None else c.queda_tensao_pct) > c.queda_tensao_max
    )
    protecao_critica = sum(1 for c in circuitos if _critico(getattr(c, "protecao_status", None)))
    selecao_critica = sum(1 for c in circuitos if getattr(c, "selecao_componentes_status", None) == "CRITICO")
    validacao_critica = sum(1 for c in circuitos if _critico(getattr(c, "validacao_status", None)))
    alertas = sum(1 for c in circuitos if _status_final(c) == "ALERTA")

    linhas = []
    status_geral = (resumo_global or {}).get("status") or ("CRITICO" if any([fora_qt, protecao_critica, selecao_critica, validacao_critica]) else "ALERTA" if alertas else "OK")
    criticos_modulos = (resumo_global or {}).get("criticos_modulos", [])
    alertas_modulos = (resumo_global or {}).get("alertas_modulos", [])

    if status_geral == "CRITICO":
        linhas.append("Projeto NÃO está liberado para emissão final pelo CalcCabos.")
        if criticos_modulos:
            linhas.append("Módulos críticos: " + "; ".join(criticos_modulos))
    elif status_geral == "ALERTA":
        linhas.append("Projeto requer revisão técnica antes da emissão final.")
    else:
        linhas.append("Projeto atende aos critérios de dimensionamento calculados pelo CalcCabos.")

    if fora_qt:
        linhas.append(f"{fora_qt} circuito(s) estão fora do limite de queda de tensão.")
    if protecao_critica:
        linhas.append(f"{protecao_critica} circuito(s) possuem proteção/disjuntor inadequado.")
    if selecao_critica:
        linhas.append(f"{selecao_critica} circuito(s) não possuem componente automático compatível na série cadastrada.")
    if validacao_critica:
        linhas.append(f"{validacao_critica} circuito(s) possuem validação normativa crítica.")
    if alertas or alertas_modulos:
        itens_alerta = []
        if alertas:
            itens_alerta.append(f"{alertas} circuito(s) exigem atenção por margem baixa ou dados incompletos")
        itens_alerta.extend(alertas_modulos)
        linhas.append("Pendências em alerta: " + "; ".join(itens_alerta))
    return linhas


def _tem_dados_tecnicos(dados):
    """Return True if dict has at least one meaningful value. Guards against None input."""
    if not dados or not isinstance(dados, dict):
        return False
    return any(valor not in (None, "", {}) for valor in dados.values())



def _tabela_dados_tecnicos(titulo, linhas, styles):
    """Build a two-column data table. Handles empty linhas list safely."""
    data = [[Paragraph(_txt(titulo), styles["cc_small_section"]), ""]]
    if not linhas:
        data.append(["-", "-"])  # fallback row – prevents empty-table LayoutError
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


def _secoes_tecnicas_projeto(projeto, circuitos, styles):
    elementos = []
    transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
    sistema = calcular_sistema_trifasico_projeto(carregar_json(getattr(projeto, "sistema_trifasico_dados", None)), circuitos, getattr(projeto, "tensao_ref", None))

    if _tem_dados_tecnicos(carregar_json(getattr(projeto, "transformador_dados", None))):
        elementos.extend([
            _tabela_dados_tecnicos(
                "Transformador / Entrada",
                [
                    ["Potencia nominal", f"{_fmt(transformador.get('potencia_kva'), 2)} kVA"],
                    ["Tensao primaria", transformador.get("tensao_primaria_formatada") or f"{_fmt(transformador.get('tensao_primaria'), 2)} V"],
                    ["Tensao secundaria", transformador.get("tensao_secundaria_formatada") or f"{_fmt(transformador.get('tensao_secundaria'), 2)} V"],
                    ["Impedancia", f"{_fmt(transformador.get('impedancia_percentual'), 2)} %"],
                    ["Ligação primária/secundária", f"{transformador.get('ligacao_primaria') or '-'} / {transformador.get('ligacao_secundaria') or '-'}"],
                    ["Relacao de transformacao", _fmt(transformador.get("relacao_transformacao"), 4)],
                    ["In primario", f"{_fmt(transformador.get('corrente_nominal_primario'), 3)} A"],
                    ["In secundario", f"{_fmt(transformador.get('corrente_nominal_secundario'), 3)} A"],
                    ["Icc presumida secundaria", f"{_fmt(transformador.get('corrente_curto_secundario_ka'), 3)} kA"],
                    ["Observações", transformador.get("observacoes") or "-"],
                ],
                styles,
            ),
            Spacer(1, 0.25 * cm),
        ])

    if _tem_dados_tecnicos(carregar_json(getattr(projeto, "sistema_trifasico_dados", None))):
        elementos.extend([
            _tabela_dados_tecnicos(
                "Sistema Trifasico",
                [
                    ["Potencia nominal das cargas", f"{_fmt(sistema.get('potencia_nominal_cargas_kw'), 3)} kW"],
                    ["Potencia ativa eletrica estimada", f"{_fmt(sistema.get('potencia_ativa_eletrica_kw') or sistema.get('potencia_ativa_kw'), 3)} kW"],
                    ["Potencia aparente", f"{_fmt(sistema.get('potencia_aparente_kva'), 3)} kVA"],
                    ["Potencia reativa", f"{_fmt(sistema.get('potencia_reativa_kvar'), 3)} kvar"],
                    ["Tensao de linha", f"{_fmt(sistema.get('tensao_linha'), 2)} V"],
                    ["Corrente de linha", f"{_fmt(sistema.get('corrente_linha'), 3)} A"],
                    ["Fator de potencia", _fmt(sistema.get("fator_potencia"), 4)],
                    ["Rendimento", _fmt(sistema.get("rendimento"), 4)],
                    ["Ligação", sistema.get("ligacao") or "-"],
                    ["Tensao de fase", f"{_fmt(sistema.get('tensao_fase'), 3)} V"],
                    ["Corrente de fase", f"{_fmt(sistema.get('corrente_fase'), 3)} A"],
                ],
                styles,
            ),
            Spacer(1, 0.25 * cm),
        ])

    return elementos


def _cabecalho_tecnico(projeto, usuario, styles):
    normas = f"NBR 5410 / IEC 60909 / {_norma_ref(projeto)}"
    data = datetime.now().strftime("%d/%m/%Y %H:%M")
    header = [
        [
            Paragraph("<b>CALCCABOS</b>", styles["cc_logo"]),
            Paragraph("<b>MEMORY CALCULATION FOR LV/MV CABLES</b>", styles["cc_title"]),
            "",
            "",
            "",
            Paragraph(f"<b>REV.</b><br/>{getattr(projeto, 'revisao', None) or '0'}", styles["cc_meta_center"]),
        ],
        [
            "Projeto",
            _txt(projeto.nome),
            "Cliente",
            _txt(projeto.cliente, "-"),
            "Data",
            data,
        ],
        [
            "Engenheiro responsável",
            _txt(usuario.nome),
            "CREA",
            _txt(usuario.crea, "-"),
            "Empresa",
            _txt(usuario.empresa, "-"),
        ],
        [
            "Contexto normativo",
            _ctx(projeto.contexto),
            "Normas aplicáveis",
            normas,
            "Tensão ref.",
            f"{_fmt(projeto.tensao_ref, 0)} V",
        ],
        [
            "Aprovado por",
            "",
            "Verificado por",
            "",
            "Documento",
            f"CALCCABOS-{projeto.id}",
        ],
    ]
    table = Table(header, colWidths=[4.0 * cm, 8.5 * cm, 3.6 * cm, 8.5 * cm, 3.2 * cm, 5.2 * cm])
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


def _status_hex(status):
    status = normalizar_status(status, "ALERTA")
    if status == "OK":
        return OK_FILL
    if status == "CRITICO":
        return CRITICAL_FILL
    return ALERT_FILL


def _capa_memorial(projeto, usuario, circuitos, styles):
    resumo = _resumo_global(projeto, circuitos)
    data = datetime.now().strftime("%d/%m/%Y %H:%M")
    status = normalizar_status(resumo["status"], "ALERTA")

    titulo = Table(
        [
            [Paragraph("CALCCABOS", styles["cc_cover_brand"]), Paragraph("MEMORIAL TÉCNICO DE DIMENSIONAMENTO ELÉTRICO", styles["cc_cover_title"])],
            ["", Paragraph(_txt(projeto.nome), styles["cc_cover_project"])],
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
        colWidths=[4.0 * cm, 3.4 * cm, 3.8 * cm, 3.8 * cm, 4.1 * cm, 4.3 * cm, 4.4 * cm, 6.2 * cm],
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

    dados = _tabela_dados_tecnicos(
        "Identificação técnica",
        [
            ["Projeto", projeto.nome],
            ["Cliente", projeto.cliente or "não informado"],
            ["Engenheiro responsável", usuario.nome],
            ["CREA", usuario.crea or "não informado"],
            ["Empresa", usuario.empresa or "não informado"],
            ["Contexto normativo", _ctx(projeto.contexto)],
            ["Versão/Revisão", getattr(projeto, "revisao", None) or "0"],
            ["Data de emissão", data],
            ["Status geral", status_visual(status)],
        ],
        styles,
    )

    motivo = _tabela_dados_tecnicos(
        "Sumário executivo",
        [
            ["Síntese", resumo.get("motivo_status") or "Todos os módulos avaliados estão OK."],
            ["Critério de emissão", "Documento gerado automaticamente pelo CalcCabos e sujeito à validação do responsável técnico."],
        ],
        styles,
    )
    return [titulo, Spacer(1, 0.6 * cm), kpis, Spacer(1, 0.45 * cm), dados, Spacer(1, 0.35 * cm), motivo]


def _linha_circuito(c):
    """Return a row for the main circuit table.

    All attribute accesses use getattr so that a partially-filled circuit
    object never raises AttributeError here.
    """
    status = _status_final(c)
    qt_acum = getattr(c, "queda_tensao_acumulada", None)
    qt_pct = getattr(c, "queda_tensao_pct", None)
    qt_calc = qt_acum if qt_acum is not None else qt_pct
    qt_max = getattr(c, "queda_tensao_max", None)
    corrente_condutor = getattr(c, "corrente_condutor", None) or getattr(c, "ampacidade", None) or 0
    corrente_corrigida = getattr(c, "corrente_corrigida", None) or getattr(c, "corrente_nominal", None) or 0
    formacao = getattr(c, "formacao", None)
    amp_ok = corrente_condutor >= (corrente_corrigida / max(formacao or 1, 1))
    qt_ok = qt_calc is None or qt_max is None or qt_calc <= qt_max

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
        _fmt(c.queda_tensao_max, 2),
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


def _tabela_principal(circuitos, styles):
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
        data.append([Paragraph(_txt(v), styles["cc_table_cell"]) for v in _linha_circuito(c)])

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


def _tabela_protecao(circuitos, styles):
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

    table = Table(data, colWidths=[3.2 * cm, 2.0 * cm, 1.5 * cm, 1.4 * cm, 1.5 * cm, 1.5 * cm, 1.6 * cm, 1.8 * cm, 1.6 * cm, 2.4 * cm, 13.5 * cm], repeatRows=1)
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


def _tabela_validacao_normativa(circuitos, styles):
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


def _tabela_componentes_automaticos(circuitos, styles):
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
        iz = getattr(c, "cabo_sugerido_ampacidade", None) or ((getattr(c, "corrente_condutor", None) or getattr(c, "ampacidade", None) or 0) * max(getattr(c, "formacao", None) or 1, 1))
        in_disj = getattr(c, "disjuntor_sugerido_in", None)
        icu = getattr(c, "disjuntor_sugerido_icu", None)
        icc = getattr(c, "isc_local", None)
        qt = getattr(c, "queda_tensao_acumulada", None) if getattr(c, "queda_tensao_acumulada", None) is not None else getattr(c, "queda_tensao_pct", None)
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
            Paragraph(_ck(bool(icu and icc and icu >= icc)) if icc else "-", styles["cc_prot_cell"]),
            Paragraph(_fmt(qt, 3), styles["cc_prot_cell"]),
        ])

    table = Table(
        data,
        colWidths=[2.7 * cm, 1.7 * cm, 1.5 * cm, 1.5 * cm, 2.5 * cm, 11.5 * cm, 3.2 * cm, 1.5 * cm, 1.5 * cm, 1.7 * cm, 1.7 * cm],
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


# _texto_curto moved to pdf/formatters.py


def _nd(valor, casas=2):
    """Local alias – delegates to formatters._nd via _fmt."""
    return _fmt(valor, casas, "N/D")


# _cor_status_pdf moved to pdf/formatters.py


# _cabo_circuito_pdf and _disjuntor_circuito_pdf moved to pdf/formatters.py


def _bloco_diagrama(drawing, x, y, w, h, titulo, linhas, fill, stroke=GRID):
    drawing.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=1))
    drawing.add(String(x + w / 2, y + h - 11, _texto_curto(titulo, 36), fontName="Helvetica-Bold", fontSize=7, fillColor=colors.black, textAnchor="middle"))
    for index, linha in enumerate(linhas[:4]):
        drawing.add(String(x + w / 2, y + h - 24 - index * 10, _texto_curto(linha, 48), fontName="Helvetica", fontSize=6.2, fillColor=colors.HexColor("#475569"), textAnchor="middle"))


def _diagrama_unifilar_pdf(projeto, circuitos, styles):
    transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
    protecao_geral = validar_protecao_geral(carregar_json(getattr(projeto, "protecao_geral_dados", None)), transformador)
    tensao_secundaria = transformador.get("tensao_secundaria") or getattr(projeto, "tensao_ref", None)
    circuitos_visiveis = circuitos[:6]
    ocultos = max(len(circuitos) - len(circuitos_visiveis), 0)

    largura = 34 * cm
    altura = max(13 * cm, 7.8 * cm + max(len(circuitos_visiveis), 1) * 1.35 * cm)
    desenho = Drawing(largura, altura)

    tronco_x = 4.2 * cm
    box_x = 1.0 * cm
    box_w = 6.4 * cm
    top_y = altura - 1.15 * cm

    desenho.add(String(largura / 2, altura - 0.45 * cm, "Diagrama unifilar simplificado", fontName="Helvetica-Bold", fontSize=10, fillColor=PETROBRAS_BLUE, textAnchor="middle"))

    entrada_y = top_y - 1.25 * cm
    _bloco_diagrama(
        desenho,
        box_x,
        entrada_y,
        box_w,
        1.25 * cm,
        "Entrada de Energia",
        [f"Tensao: {_nd(getattr(projeto, 'tensao_ref', None), 0)} V", f"Contexto: {_ctx(getattr(projeto, 'contexto', None)) or 'N/D'}"],
        colors.HexColor("#F8FAFC"),
    )
    desenho.add(Line(tronco_x, entrada_y, tronco_x, entrada_y - 0.45 * cm, strokeColor=colors.HexColor("#334155"), strokeWidth=1.4))

    transformador_y = entrada_y - 1.9 * cm
    _bloco_diagrama(
        desenho,
        box_x,
        transformador_y,
        box_w,
        1.45 * cm,
        "Transformador",
        [
            f"Potencia: {_nd(transformador.get('potencia_kva'), 1)} kVA",
            f"Prim/Sec: {transformador.get('tensao_primaria_formatada') or _nd(transformador.get('tensao_primaria'), 0)} / {transformador.get('tensao_secundaria_formatada') or (_nd(tensao_secundaria, 0) + ' V')}",
            f"Icc sec.: {_nd(transformador.get('corrente_curto_secundario_ka'), 2)} kA",
        ],
        colors.HexColor("#EFF6FF"),
        colors.HexColor("#2563EB"),
    )
    disjuntor_y = transformador_y - 1.55 * cm
    _bloco_diagrama(
        desenho,
        box_x,
        disjuntor_y,
        box_w,
        1.05 * cm,
        "Disjuntor geral",
        [f"In: {_nd(protecao_geral.get('in'), 0)} A", f"Icu: {_nd(protecao_geral.get('icu'), 1)} kA | {protecao_geral.get('status') or 'N/D'}"],
        colors.HexColor("#FFF7ED"),
        colors.HexColor("#C2410C"),
    )
    desenho.add(Line(tronco_x, transformador_y, tronco_x, disjuntor_y + 1.05 * cm, strokeColor=colors.HexColor("#334155"), strokeWidth=1.4))

    barramento_y = disjuntor_y - 1.55 * cm
    desenho.add(Line(tronco_x, disjuntor_y, tronco_x, barramento_y + 1.10 * cm, strokeColor=colors.HexColor("#334155"), strokeWidth=1.4))
    _bloco_diagrama(
        desenho,
        box_x,
        barramento_y,
        box_w,
        1.10 * cm,
        "Barramento principal",
        [f"Tensao: {_nd(tensao_secundaria, 0)} V", f"Circuitos: {len(circuitos)}"],
        colors.HexColor("#F1F5F9"),
        colors.HexColor("#0F172A"),
    )

    if not circuitos_visiveis:
        _bloco_diagrama(
            desenho,
            10.0 * cm,
            barramento_y - 1.2 * cm,
            9.0 * cm,
            1.0 * cm,
            "Sem circuitos",
            ["Nenhum ramal cadastrado."],
            colors.HexColor("#F8FAFC"),
        )
        return [desenho]

    primeiro_y = barramento_y - 0.95 * cm
    ultimo_y = primeiro_y - (len(circuitos_visiveis) - 1) * 1.35 * cm
    desenho.add(Line(tronco_x, barramento_y, tronco_x, ultimo_y, strokeColor=colors.HexColor("#0F172A"), strokeWidth=2.0))

    for index, c in enumerate(circuitos_visiveis):
        y = primeiro_y - index * 1.35 * cm
        status = _status_final(c)
        cor = _cor_status_pdf(status)
        nome = getattr(c, "tag", None) or getattr(c, "descricao", None) or f"Circuito {index + 1}"
        desenho.add(Line(tronco_x, y, 8.1 * cm, y, strokeColor=cor, strokeWidth=1.4))
        _bloco_diagrama(desenho, 8.1 * cm, y - 0.35 * cm, 2.6 * cm, 0.7 * cm, "DJ", [_disjuntor_circuito_pdf(c)], colors.white, cor)
        desenho.add(Line(10.7 * cm, y, 11.6 * cm, y, strokeColor=cor, strokeWidth=1.4))
        _bloco_diagrama(
            desenho,
            11.6 * cm,
            y - 0.55 * cm,
            20.6 * cm,
            1.1 * cm,
            nome,
            [
                f"Ib: {_nd(getattr(c, 'corrente_projeto', None) or getattr(c, 'corrente_nominal', None), 1)} A",
                f"Cabo: {_cabo_circuito_pdf(c)} | Icc: {_nd(getattr(c, 'isc_local', None), 2)} kA | Status: {status}",
            ],
            colors.white,
            cor,
        )

    if ocultos:
        desenho.add(String(11.6 * cm, 0.55 * cm, f"+ {ocultos} circuito(s) adicionais listados nas tabelas do memorial.", fontName="Helvetica", fontSize=7, fillColor=colors.HexColor("#64748B")))

    return [desenho]


def _tabela_circuitos_memorial(circuitos, styles):
    headers = ["TAG", "DESCRICAO", "Ib", "Ib'", "CABO", "DISJUNTOR", "DV", "STATUS", "OBSERVACAO"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    for c in circuitos:
        qt = c.queda_tensao_acumulada if c.queda_tensao_acumulada is not None else c.queda_tensao_pct
        disjuntor = "-"
        if getattr(c, "disjuntor_sugerido_in", None):
            disjuntor = f"{_fmt(c.disjuntor_sugerido_in, 0)}A / {_fmt(c.disjuntor_sugerido_icu, 1)}kA"
        elif getattr(c, "disjuntor_corrente_nominal", None) or getattr(c, "disjuntor_a", None):
            disjuntor = f"{_fmt(getattr(c, 'disjuntor_corrente_nominal', None) or c.disjuntor_a, 0)}A"
        data.append([
            Paragraph(_txt(c.tag or "-"), styles["cc_prot_cell"]),
            Paragraph(_txt(c.descricao or "-"), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.corrente_projeto or c.corrente_nominal, 2), styles["cc_prot_cell"]),
            Paragraph(_fmt(c.corrente_corrigida, 2), styles["cc_prot_cell"]),
            Paragraph(_txt(c.cabo_sugerido_tipo_comercial or c.tipo_cabo_comercial or "-"), styles["cc_prot_cell"]),
            Paragraph(disjuntor, styles["cc_prot_cell"]),
            Paragraph(_fmt(qt, 2), styles["cc_prot_cell"]),
            Paragraph(_status_final(c), styles["cc_prot_cell"]),
            Paragraph(_txt(c.validacao_mensagem or c.selecao_componentes_justificativa or "-"), styles["cc_prot_cell"]),
        ])

    table = Table(data, colWidths=[2.5 * cm, 5.0 * cm, 1.7 * cm, 1.7 * cm, 3.0 * cm, 3.0 * cm, 1.5 * cm, 2.0 * cm, 14.0 * cm], repeatRows=1)
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


def _tabela_medicoes_aterramento(aterramento, styles):
    headers = ["Linha", "a (m)", "p (m)", "R (ohm)", "rho (ohm.m)", "Status"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    medicoes = aterramento.get("medicoes") or []
    if not medicoes:
        data.append([Paragraph("não informado", styles["cc_prot_cell"]), "", "", "", "", ""])
    else:
        for medicao in medicoes:
            data.append([
                Paragraph(_txt(medicao.get("linha") or "-"), styles["cc_prot_cell"]),
                Paragraph(_nd(medicao.get("espacamento_a_m"), 3), styles["cc_prot_cell"]),
                Paragraph(_nd(medicao.get("profundidade_p_m"), 3), styles["cc_prot_cell"]),
                Paragraph(_nd(medicao.get("resistencia_ohm"), 3), styles["cc_prot_cell"]),
                Paragraph(_nd(medicao.get("resistividade_ohm_m"), 3), styles["cc_prot_cell"]),
                Paragraph("valida" if medicao.get("valido") else (medicao.get("erro") or "nao calculavel"), styles["cc_prot_cell"]),
            ])

    table = Table(data, colWidths=[3 * cm, 2.2 * cm, 2.2 * cm, 2.4 * cm, 3.0 * cm, 21.2 * cm], repeatRows=1)
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


def _tabela_areas_classificadas(areas_classificadas, styles):
    headers = ["Área", "Zona", "Grupo", "Temp.", "Equipamento Ex", "Proteção", "Grupo Eq.", "Temp. Eq.", "Status", "Justificativa"]
    data = [[Paragraph(h, styles["cc_prot_header"]) for h in headers]]
    areas = areas_classificadas.get("areas") or []

    if not areas:
        data.append([Paragraph("não informado", styles["cc_prot_cell"]), "", "", "", "", "", "", "", "", ""])
    else:
        for area in areas:
            equipamentos = area.get("equipamentos") or [{"nome_tag": "não informado", "status": area.get("status"), "mensagem": area.get("mensagem")}]
            for equipamento in equipamentos:
                data.append([
                    Paragraph(_txt(area.get("nome") or "não informado"), styles["cc_prot_cell"]),
                    Paragraph(_txt(area.get("zona") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(area.get("grupo") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(area.get("classe_temperatura") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(equipamento.get("nome_tag") or "não informado"), styles["cc_prot_cell"]),
                    Paragraph(_txt(equipamento.get("tipo_protecao_ex") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(equipamento.get("grupo") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(equipamento.get("classe_temperatura") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(equipamento.get("status") or area.get("status") or "-"), styles["cc_prot_cell"]),
                    Paragraph(_txt(equipamento.get("mensagem") or area.get("mensagem") or "-"), styles["cc_prot_cell"]),
                ])

    table = Table(data, colWidths=[3.2 * cm, 1.8 * cm, 1.6 * cm, 1.5 * cm, 3.4 * cm, 2.2 * cm, 1.8 * cm, 1.8 * cm, 2.0 * cm, 15.7 * cm], repeatRows=1)
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


def _secoes_memorial_pdf(projeto, circuitos, styles):
    transformador = calcular_transformador(carregar_json(getattr(projeto, "transformador_dados", None)))
    sistema = calcular_sistema_trifasico_projeto(carregar_json(getattr(projeto, "sistema_trifasico_dados", None)), circuitos, getattr(projeto, "tensao_ref", None))
    protecao_geral = validar_protecao_geral(carregar_json(getattr(projeto, "protecao_geral_dados", None)), transformador)
    para_raios = calcular_para_raios(carregar_json(getattr(projeto, "para_raios_dados", None)))
    aterramento = calcular_aterramento(carregar_json(getattr(projeto, "aterramento_dados", None)))
    areas_classificadas = calcular_areas_classificadas(carregar_json(getattr(projeto, "areas_classificadas_dados", None)))
    resumo = _resumo_global(projeto, circuitos, {
        "Proteção geral": protecao_geral,
        "Para-raios": para_raios,
        "Aterramento": aterramento,
        "Áreas Classificadas": areas_classificadas,
    })
    icc_max = max([c.isc_local or 0 for c in circuitos], default=0)
    sem_icc = sum(1 for c in circuitos if not c.isc_local)
    qt_max = max([(c.queda_tensao_acumulada if c.queda_tensao_acumulada is not None else c.queda_tensao_pct) or 0 for c in circuitos], default=0)
    automaticos = sum(1 for c in circuitos if (getattr(c, "modo_dimensionamento", None) or getattr(c, "modo_selecao_componentes", None)) == "automatico")
    selecao_critica = sum(1 for c in circuitos if getattr(c, "selecao_componentes_status", None) == "CRITICO")
    protecoes = resumo["protecoes"]

    story = [
        Paragraph("1. Dados do projeto", styles["cc_section"]),
        _tabela_dados_tecnicos("Dados do projeto", [
            ["Projeto", projeto.nome],
            ["Cliente", projeto.cliente or "não informado"],
            ["Contexto normativo", _ctx(projeto.contexto)],
            ["Tensao de referencia", f"{_fmt(projeto.tensao_ref, 0)} V"],
            ["Total de circuitos", resumo["total"]],
            ["Status geral", status_visual(resumo["status"])],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("2. Entrada de energia", styles["cc_section"]),
        _tabela_dados_tecnicos("Entrada de energia", [
            ["Tensao primaria", transformador.get("tensao_primaria_formatada") or f"{_fmt(transformador.get('tensao_primaria'), 0)} V"],
            ["Tensao secundaria", transformador.get("tensao_secundaria_formatada") or f"{_fmt(transformador.get('tensao_secundaria'), 0)} V"],
            ["Frequencia", f"{_fmt(transformador.get('frequencia'), 0)} Hz"],
            ["Icc origem", f"{_fmt(transformador.get('corrente_curto_secundario_ka'), 3)} kA"],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("3. Transformador", styles["cc_section"]),
        _tabela_dados_tecnicos("Transformador", [
            ["Potencia nominal", f"{_fmt(transformador.get('potencia_kva'), 2)} kVA"],
            ["Impedancia", f"{_fmt(transformador.get('impedancia_percentual'), 2)} %"],
            ["In primario", f"{_fmt(transformador.get('corrente_nominal_primario'), 3)} A"],
            ["In secundario", f"{_fmt(transformador.get('corrente_nominal_secundario'), 3)} A"],
            ["Ligação primária/secundária", f"{transformador.get('ligacao_primaria') or 'não informado'} / {transformador.get('ligacao_secundaria') or 'não informado'}"],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("4. Sistema elétrico", styles["cc_section"]),
        _tabela_dados_tecnicos("Sistema elétrico", [
            ["Potencia nominal das cargas", f"{_fmt(sistema.get('potencia_nominal_cargas_kw'), 3)} kW"],
            ["Potencia ativa eletrica estimada", f"{_fmt(sistema.get('potencia_ativa_eletrica_kw') or sistema.get('potencia_ativa_kw'), 3)} kW"],
            ["Potencia aparente", f"{_fmt(sistema.get('potencia_aparente_kva'), 3)} kVA"],
            ["Potencia reativa", f"{_fmt(sistema.get('potencia_reativa_kvar'), 3)} kvar"],
            ["Corrente de linha", f"{_fmt(sistema.get('corrente_linha'), 3)} A"],
            ["Fator de potencia", _fmt(sistema.get("fator_potencia"), 4)],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("5. Curto-circuito (Icc)", styles["cc_section"]),
        _tabela_dados_tecnicos("Curto-circuito", [
            ["Icc maximo cadastrado", f"{_fmt(icc_max or None, 2)} kA"],
            ["Circuitos sem Icc", sem_icc],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("6. Diagrama unifilar", styles["cc_section"]),
        *_diagrama_unifilar_pdf(projeto, circuitos, styles),
        Spacer(1, 0.35 * cm),
        Paragraph("7. Circuitos", styles["cc_section"]),
        _tabela_circuitos_memorial(circuitos, styles),
        Spacer(1, 0.35 * cm),
        Paragraph("8. Cabos", styles["cc_section"]),
        _tabela_dados_tecnicos("Cabos", [
            ["Maior queda de tensao calculada", f"{_fmt(qt_max, 2)} %"],
            ["Circuitos com cabo sugerido", sum(1 for c in circuitos if getattr(c, "cabo_sugerido_tipo_comercial", None))],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("9. Sistema de Proteção", styles["cc_section"]),
        _tabela_dados_tecnicos("Sistema de Proteção", [
            ["Disjuntor geral - tag", protecao_geral.get("tag") or "-"],
            ["Disjuntor geral - tipo", protecao_geral.get("tipo") or "-"],
            ["Disjuntor geral - Vn", f"{_nd(protecao_geral.get('vn'), 0)} V"],
            ["Disjuntor geral - In", f"{_nd(protecao_geral.get('in'), 0)} A"],
            ["Disjuntor geral - Icu", f"{_nd(protecao_geral.get('icu'), 2)} kA"],
            ["Disjuntor geral - curva", protecao_geral.get("curva") or "-"],
            ["Status do disjuntor geral", status_visual(protecao_geral.get("status"))],
            ["Verificação do disjuntor geral", protecao_geral.get("mensagem") or "-"],
            ["Proteções de circuitos OK", protecoes["ok"]],
            ["Proteções de circuitos ALERTA", protecoes["alerta"]],
            ["Proteções de circuitos CRÍTICO", protecoes["critico"]],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("10. Para-raios de Linha", styles["cc_section"]),
        _tabela_dados_tecnicos("Para-raios de Linha", [
            ["Identificação / TAG", para_raios.get("tag") or "não informado"],
            ["Ponto de instalação", para_raios.get("ponto_instalacao") or "não informado"],
            ["Vmax", f"{_nd(para_raios.get('classe_tensao_vmax'), 3)}"],
            ["Fator de aterramento FA", _nd(para_raios.get("fator_aterramento_fa"), 3)],
            ["Vn minimo", _nd(para_raios.get("vn_minimo"), 3)],
            ["Vn escolhido", _nd(para_raios.get("tensao_nominal_escolhida_vn"), 3)],
            ["Distancia de escoamento", _nd(para_raios.get("distancia_escoamento"), 3)],
            ["Margem de protecao", f"{_nd(para_raios.get('margem_protecao_pct'), 2)} %"],
            ["Status", status_visual(para_raios.get("status"))],
            ["Justificativa", para_raios.get("mensagem") or "não informado"],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("11. Sistema de Aterramento", styles["cc_section"]),
        _tabela_dados_tecnicos("Sistema de Aterramento", [
            ["Tipo de aterramento", aterramento.get("tipo_aterramento") or "não informado"],
            ["Finalidade", aterramento.get("finalidade") or "não informado"],
            ["Formula Wenner usada", aterramento.get("formula") or "rho = 2*pi*a*R"],
            ["Resistividade media", f"{_nd(aterramento.get('resistividade_media'), 3)} ohm.m"],
            ["Menor resistividade", f"{_nd(aterramento.get('menor_resistividade'), 3)} ohm.m"],
            ["Maior resistividade", f"{_nd(aterramento.get('maior_resistividade'), 3)} ohm.m"],
            ["Variacao", f"{_nd(aterramento.get('variacao_percentual'), 2)} %"],
            ["Classificacao do solo", aterramento.get("classificacao_solo") or "nao calculavel"],
            ["Status", status_visual(aterramento.get("status"))],
            ["Observações técnicas", aterramento.get("observacoes_tecnicas") or "não informado"],
        ], styles),
        Spacer(1, 0.20 * cm),
        Paragraph("Medições Wenner", styles["cc_small_section"]),
        _tabela_medicoes_aterramento(aterramento, styles),
        Spacer(1, 0.25 * cm),
        Paragraph("12. Áreas Classificadas", styles["cc_section"]),
        _tabela_dados_tecnicos("Áreas Classificadas", [
            ["Total de areas", areas_classificadas.get("resumo", {}).get("total_areas", 0)],
            ["Equipamentos Ex", areas_classificadas.get("resumo", {}).get("total_equipamentos", 0)],
            ["Equipamentos criticos", areas_classificadas.get("resumo", {}).get("equipamentos_criticos", 0)],
            ["Status", status_visual(areas_classificadas.get("status"))],
            ["Resumo", areas_classificadas.get("mensagem") or "não informado"],
        ], styles),
        Spacer(1, 0.20 * cm),
        _tabela_areas_classificadas(areas_classificadas, styles),
        Spacer(1, 0.25 * cm),
        Paragraph("13. Seleção automática", styles["cc_section"]),
        _tabela_dados_tecnicos("Seleção automática", [
            ["Circuitos automaticos", automaticos],
            ["Selecoes criticas", selecao_critica],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("14. Validação normativa", styles["cc_section"]),
        _tabela_validacao_normativa(circuitos, styles),
        Spacer(1, 0.35 * cm),
        Paragraph("15. Conclusão técnica", styles["cc_section"]),
        _tabela_dados_tecnicos("Conclusão técnica", [[f"Item {i}", linha] for i, linha in enumerate(_conclusoes_tecnicas(circuitos, resumo), start=1)], styles),
    ]
    return story


def _sumario(projeto, circuitos, usuario, styles):
    total = len(circuitos)
    ok = sum(1 for c in circuitos if _status_final(c) == "OK")
    alertas = sum(1 for c in circuitos if _status_final(c) == "ALERTA")
    criticos = sum(1 for c in circuitos if _critico(_status_final(c)))
    resumo_global = _resumo_global(projeto, circuitos)
    contexto = CONTEXTOS.get(_ctx(projeto.contexto), CONTEXTOS["industrial"])
    resumo = Table(
        [
            ["Circuitos OK", "Circuitos ALERTA", "Circuitos CRÍTICO", "Módulos OK", "Módulos ALERTA", "Módulos CRÍTICO", "Status geral"],
            [
                ok,
                alertas,
                criticos,
                resumo_global["modulos_contagem"]["ok"],
                resumo_global["modulos_contagem"]["alerta"],
                resumo_global["modulos_contagem"]["critico"],
                status_visual(resumo_global["status"]),
            ],
        ],
        colWidths=[4.4 * cm, 4.4 * cm, 4.4 * cm, 4.4 * cm, 4.4 * cm, 4.4 * cm, 5.0 * cm],
    )
    resumo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PETROBRAS_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("BACKGROUND", (1, 1), (1, 1), OK_FILL),
        ("BACKGROUND", (2, 1), (2, 1), ALERT_FILL),
        ("BACKGROUND", (3, 1), (3, 1), CRITICAL_FILL),
        ("BACKGROUND", (4, 1), (4, 1), OK_FILL),
        ("BACKGROUND", (5, 1), (5, 1), ALERT_FILL),
        ("BACKGROUND", (6, 1), (6, 1), CRITICAL_FILL),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    motivo = _tabela_dados_tecnicos("Motivo do status geral", [
        ["Status geral", status_visual(resumo_global["status"])],
        ["Motivo", resumo_global["motivo_status"]],
    ], styles)

    criterios = Table(
        [
            ["Critério", "Referência", "Aplicação no CalcCabos"],
            ["Ampacidade", "NBR 5410 seção 6.2 / N-1997", "Ib' = Ib / (K1 × K2 × K3); seleção por ICOND ≥ Ib' por formação."],
            ["Queda de tensão", contexto["norma_ref"], f"Limite normal adotado: {contexto['qt_terminal']}%."],
            ["Curto-circuito térmico", "IEC 60909 / N-2918", "S ≥ Icc × √t / K; K por material e isolação."],
            ["Condutor PE", "NBR 5410 tabela 54.2", "SPE = Sfase até 16 mm²; 16 mm² até 35 mm²; Sfase/2 acima de 35 mm²."],
            ["Seção final", "IEC 60228", "Maior seção normalizada entre ampacidade, queda de tensão e Joule."],
        ],
        colWidths=[6 * cm, 8 * cm, 20 * cm],
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
        colWidths=[8 * cm, 6 * cm, 12 * cm, 6 * cm],
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


class PDFGenerationError(RuntimeError):
    """Compatibility alias for PDFBuilderError.

    Kept so that any existing code catching PDFGenerationError continues
    to work unchanged.  The canonical exception is now PDFBuilderError
    defined in pdf/builder.py.
    """


def gerar_pdf(projeto, circuitos, usuario):
    """Generate the full CalcCabos memorial PDF.

    COMPATIBILITY LAYER (Fase 4)
    ----------------------------
    This function delegates to ``pdf.builder.gerar_pdf`` which contains
    the new modular implementation.  The legacy code in this file is
    preserved below for reference and will be removed in a future phase.

    Raises
    ------
    PDFGenerationError
        When any step of the PDF build fails.
    """
    try:
        return _gerar_pdf_builder(projeto, circuitos, usuario)
    except PDFBuilderError as exc:
        # Re-raise as the legacy exception type for backward compatibility
        raise PDFGenerationError(str(exc)) from exc
    except Exception as exc:
        logger.exception(
            "gerar_pdf (compat layer) FALHOU: projeto=%s",
            getattr(projeto, "id", "?"),
        )
        raise PDFGenerationError(f"Falha ao gerar PDF: {exc}") from exc
