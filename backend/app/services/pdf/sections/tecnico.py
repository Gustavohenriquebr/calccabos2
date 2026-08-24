# backend/app/services/pdf/sections/tecnico.py
"""Technical memorial sections renderer for the CalcCabos PDF.

FASE 5: This module is now a pure renderer.
It receives a pre-computed MemorialDTO and performs ZERO electrical
calculations. All data aggregation lives in data_provider.get_memorial_data().

``render_secoes_memorial(dto, styles)`` builds sections 1-15 of the memorial.
``render_secoes_tecnicas_projeto(dto, styles)`` builds the transformer /
  three-phase system detail tables used on the technical header page.
"""
from __future__ import annotations
from typing import Any, Dict, List

from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Spacer

from app.services.pdf.formatters import _fmt, _txt, _nd
from app.services.pdf.helpers import _ctx, _status_final, _tem_dados_tecnicos
from app.services.pdf.sections.tabelas import (
    render_tabela_dados,
    render_tabela_lista_tecnica,
    render_tabela_circuitos_memorial,
    render_tabela_medicoes_aterramento,
    render_tabela_areas_classificadas,
)
from app.services.pdf.sections.diagramas import render_diagrama_unifilar
from app.services.status_utils import status_visual


def render_secoes_tecnicas_projeto(dto: Dict[str, Any], styles: dict) -> List:
    """Build transformer / three-phase system detail tables.

    Parameters
    ----------
    dto : MemorialDTO
        Pre-computed project DTO from ``data_provider.get_memorial_data``.
    styles : dict
        ReportLab stylesheet.
    """
    elementos: List = []
    transformador = dto.get("transformador", {})
    sistema = dto.get("sistema_trifasico", {})

    # Only render if meaningful data is present
    from app.services.projeto_eletrico import carregar_json
    import types

    # Use flags from DTO project blob to decide rendering
    projeto = dto.get("_projeto_obj")  # set by builder when available

    # Fallback: render if transformador has non-None potencia
    if transformador.get("potencia_kva") is not None:
        elementos.extend([
            render_tabela_dados(
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

    if sistema.get("potencia_aparente_kva") is not None:
        elementos.extend([
            render_tabela_dados(
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


def render_secoes_memorial(dto: Dict[str, Any], styles: dict) -> List:
    """Build sections 1-15 of the CalcCabos technical memorial.

    FASE 5: Pure renderer — no electrical calculations performed here.
    All data is extracted from the pre-computed DTO.

    Parameters
    ----------
    dto : MemorialDTO
        Pre-computed project DTO from ``data_provider.get_memorial_data``.
    styles : dict
        ReportLab stylesheet.
    """
    # --- Extract all data from DTO (zero calculations below this line) ---
    projeto_dto = dto.get("projeto", {})
    transformador = dto.get("transformador", {})
    sistema = dto.get("sistema_trifasico", {})
    protecao_geral = dto.get("protecao_geral", {})
    para_raios = dto.get("para_raios", {})
    aterramento = dto.get("aterramento", {})
    areas_classificadas = dto.get("areas_classificadas", {})
    resumo = dto.get("resumo_global", {})
    circuitos = dto.get("circuitos", [])
    protecoes = resumo.get("protecoes", {})

    # Derived scalars (pre-computed in data_provider)
    icc_max = dto.get("icc_max", 0)
    sem_icc = dto.get("sem_icc", 0)
    qt_max = dto.get("qt_max", 0.0)
    automaticos = dto.get("automaticos", 0)
    selecao_critica = dto.get("selecao_critica", 0)
    conclusoes = dto.get("conclusoes_tecnicas", [])
    tensao_secundaria = dto.get("tensao_secundaria")
    interpretacoes = dto.get("interpretacoes_automaticas", [])
    memorias_calculo = dto.get("memorias_calculo", [])
    benchmark_validacao = dto.get("benchmark_validacao", [])
    formulas_base = [
        ["Corrente trifasica", "Ib = P*1000/(sqrt(3)*V*FP*eta)", "NBR 5410 / fundamentos CA", "Corrente de projeto"],
        ["Ampacidade corrigida", "Ib' = Ib/(K1*K2*K3)", "NBR 5410 secao 6.2", "Temperatura, agrupamento e metodo"],
        ["Queda de tensao", "dV% = 100*sqrt(3)*Ib*L*(R*cos(phi)+X*sen(phi))/V", "NBR 5410 / IEC 60228", "Limite por circuito e acumulado"],
        ["Curto-circuito termico", "S >= Icc*sqrt(t)/K", "IEC 60909 / NBR 5410", "Verificacao termica do condutor"],
        ["Protecao", "Ib <= In <= Iz e Icu >= Icc", "NBR 5410 / IEC 60947", "Compatibilidade cabo-disjuntor"],
        ["Wenner", "rho(a) = K(a)*R(a)", "Metodo de Wenner", "Resistividade aparente do solo"],
    ]

    # Context string from DTO
    from app.services.pdf.helpers import _ctx
    contexto_str = _ctx(projeto_dto.get("contexto", "industrial"))

    # --- Story assembly (rendering only) ---
    story: List = [
        Paragraph("1. Dados do projeto", styles["cc_section"]),
        render_tabela_dados("Dados do projeto", [
            ["Projeto", projeto_dto.get("nome", "")],
            ["Cliente", projeto_dto.get("cliente") or "não informado"],
            ["Contexto normativo", contexto_str],
            ["Tensao de referencia", f"{_fmt(projeto_dto.get('tensao_ref'), 0)} V"],
            ["Total de circuitos", resumo.get("total", 0)],
            ["Status geral", status_visual(resumo.get("status", ""))],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("2. Entrada de energia", styles["cc_section"]),
        render_tabela_dados("Entrada de energia", [
            ["Tensao primaria", transformador.get("tensao_primaria_formatada") or f"{_fmt(transformador.get('tensao_primaria'), 0)} V"],
            ["Tensao secundaria", transformador.get("tensao_secundaria_formatada") or f"{_fmt(tensao_secundaria, 0)} V"],
            ["Frequencia", f"{_fmt(transformador.get('frequencia'), 0)} Hz"],
            ["Icc origem", f"{_fmt(transformador.get('corrente_curto_secundario_ka'), 3)} kA"],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("3. Transformador", styles["cc_section"]),
        render_tabela_dados("Transformador", [
            ["Potencia nominal", f"{_fmt(transformador.get('potencia_kva'), 2)} kVA"],
            ["Impedancia", f"{_fmt(transformador.get('impedancia_percentual'), 2)} %"],
            ["In primario", f"{_fmt(transformador.get('corrente_nominal_primario'), 3)} A"],
            ["In secundario", f"{_fmt(transformador.get('corrente_nominal_secundario'), 3)} A"],
            ["Ligação primária/secundária", f"{transformador.get('ligacao_primaria') or 'não informado'} / {transformador.get('ligacao_secundaria') or 'não informado'}"],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("4. Sistema elétrico", styles["cc_section"]),
        render_tabela_dados("Sistema elétrico", [
            ["Potencia nominal das cargas", f"{_fmt(sistema.get('potencia_nominal_cargas_kw'), 3)} kW"],
            ["Potencia ativa eletrica estimada", f"{_fmt(sistema.get('potencia_ativa_eletrica_kw') or sistema.get('potencia_ativa_kw'), 3)} kW"],
            ["Potencia aparente", f"{_fmt(sistema.get('potencia_aparente_kva'), 3)} kVA"],
            ["Potencia reativa", f"{_fmt(sistema.get('potencia_reativa_kvar'), 3)} kvar"],
            ["Corrente de linha", f"{_fmt(sistema.get('corrente_linha'), 3)} A"],
            ["Fator de potencia", _fmt(sistema.get("fator_potencia"), 4)],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("5. Curto-circuito (Icc)", styles["cc_section"]),
        render_tabela_dados("Curto-circuito", [
            ["Icc maximo cadastrado", f"{_fmt(icc_max or None, 2)} kA"],
            ["Circuitos sem Icc", sem_icc],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("6. Diagrama unifilar", styles["cc_section"]),
        *render_diagrama_unifilar(dto, styles),
        Spacer(1, 0.35 * cm),
        Paragraph("7. Circuitos", styles["cc_section"]),
        render_tabela_circuitos_memorial(circuitos, styles),
        Spacer(1, 0.35 * cm),
        Paragraph("8. Cabos", styles["cc_section"]),
        render_tabela_dados("Cabos", [
            ["Maior queda de tensao calculada", f"{_fmt(qt_max, 2)} %"],
            ["Circuitos com cabo sugerido", sum(1 for c in circuitos if getattr(c, "cabo_sugerido_tipo_comercial", None))],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("9. Sistema de Proteção", styles["cc_section"]),
        render_tabela_dados("Sistema de Proteção", [
            ["Circuitos OK", protecoes.get("ok", 0)],
            ["Circuitos em ALERTA", protecoes.get("alerta", 0)],
            ["Circuitos CRÍTICOS", protecoes.get("critico", 0)],
            ["Disjuntor geral In", f"{_nd(protecao_geral.get('in'), 0)} A"],
            ["Disjuntor geral Icu", f"{_nd(protecao_geral.get('icu'), 1)} kA"],
            ["Status", status_visual(protecao_geral.get("status"))],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("10. Para-Raios", styles["cc_section"]),
        render_tabela_dados("Para-Raios", [
            ["Norma aplicavel", para_raios.get("norma_aplicavel") or "não informado"],
            ["Nivel de protecao", para_raios.get("nivel_protecao") or "não informado"],
            ["Uc minimo", _nd(para_raios.get("uc_minimo"), 3)],
            ["Vn escolhido", _nd(para_raios.get("tensao_nominal_escolhida_vn"), 3)],
            ["Distancia de escoamento", _nd(para_raios.get("distancia_escoamento"), 3)],
            ["Margem de protecao", f"{_nd(para_raios.get('margem_protecao_pct'), 2)} %"],
            ["Status", status_visual(para_raios.get("status"))],
            ["Justificativa", para_raios.get("mensagem") or "não informado"],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("11. Sistema de Aterramento", styles["cc_section"]),
        render_tabela_dados("Sistema de Aterramento", [
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
        render_tabela_medicoes_aterramento(aterramento, styles),
        Spacer(1, 0.25 * cm),
        Paragraph("12. Áreas Classificadas", styles["cc_section"]),
        render_tabela_dados("Áreas Classificadas", [
            ["Total de areas", areas_classificadas.get("resumo", {}).get("total_areas", 0)],
            ["Equipamentos Ex", areas_classificadas.get("resumo", {}).get("total_equipamentos", 0)],
            ["Equipamentos criticos", areas_classificadas.get("resumo", {}).get("equipamentos_criticos", 0)],
            ["Status", status_visual(areas_classificadas.get("status"))],
            ["Resumo", areas_classificadas.get("mensagem") or "não informado"],
        ], styles),
        Spacer(1, 0.20 * cm),
        render_tabela_areas_classificadas(areas_classificadas, styles),
        Spacer(1, 0.25 * cm),
        Paragraph("13. Seleção automática", styles["cc_section"]),
        render_tabela_dados("Seleção automática", [
            ["Circuitos automaticos", automaticos],
            ["Selecoes criticas", selecao_critica],
        ], styles),
        Spacer(1, 0.25 * cm),
        Paragraph("14. Validação normativa", styles["cc_section"]),
        render_tabela_lista_tecnica(
            "Formulas e referencias aplicadas",
            ["Grandeza", "Formula", "Referencia", "Aplicacao"],
            formulas_base,
            styles,
            [5.2, 11.2, 7.2, 10.4],
        ),
        Spacer(1, 0.25 * cm),
        render_tabela_lista_tecnica(
            "Interpretacao automatica dos resultados",
            ["Circuito", "Achado tecnico", "Evidencia", "Status"],
            interpretacoes,
            styles,
            [4.8, 7.0, 18.2, 4.0],
        ),
        Spacer(1, 0.25 * cm),
        render_tabela_lista_tecnica(
            "Memoria de calculo por circuito",
            ["Circuito", "Grandeza", "Formula", "Substituicao numerica", "Resultado", "Referencia"],
            memorias_calculo,
            styles,
            [3.8, 4.0, 7.0, 9.2, 4.0, 6.0],
        ),
        Spacer(1, 0.25 * cm),
        Paragraph("15. Benchmark e convergencia", styles["cc_section"]),
        render_tabela_lista_tecnica(
            "Benchmark tecnico e rastreabilidade",
            ["Base", "Origem", "Evidencia", "Convergencia", "Status"],
            benchmark_validacao,
            styles,
            [5.2, 6.0, 14.0, 5.0, 3.8],
        ),
        Spacer(1, 0.25 * cm),
        Paragraph("16. Conclusão técnica", styles["cc_section"]),
        render_tabela_dados(
            "Conclusão técnica",
            [[f"Item {i}", linha] for i, linha in enumerate(conclusoes, start=1)],
            styles,
        ),
    ]
    return story
