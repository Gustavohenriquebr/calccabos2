from typing import Any, Dict, List
from app.services.status_utils import normalizar_status

def _valor(obj: Any, campo: str, padrao: Any = "N/A") -> Any:
    valor = getattr(obj, campo, None)
    if valor is None or valor == "":
        return padrao
    return valor

def montar_memorial_cabos(projeto: Any, circuitos: List[Any]) -> Dict[str, Any]:
    circuitos_organizados = []
    
    total_circuitos = len(circuitos)
    ok_count = 0
    alerta_count = 0
    critico_count = 0
    pendencias = []

    for c in circuitos:
        status_final = normalizar_status(_valor(c, "status_final", "N/A"))
        if status_final == "OK":
            ok_count += 1
        elif status_final == "ALERTA":
            alerta_count += 1
        elif status_final == "CRITICO":
            critico_count += 1

        justificativa = _valor(c, "validacao_mensagem", _valor(c, "protecao_nota", ""))
        
        if status_final in ["CRITICO", "ALERTA"]:
            pendencias.append({
                "tag": _valor(c, "tag", _valor(c, "descricao", "Sem Tag")),
                "status": status_final,
                "motivo": justificativa
            })

        cabo_selecionado = _valor(c, "tipo_cabo_comercial", "N/A")
        if cabo_selecionado == "N/A":
            formacao = _valor(c, "formacao", 1)
            fases = _valor(c, "fases", 3)
            secao = _valor(c, "secao_mm2", "?")
            cabo_selecionado = f"{formacao}x{fases}/C#{secao}"

        queda_acum = _valor(c, "queda_tensao_acumulada", None)
        if queda_acum is None:
            queda_acum = _valor(c, "queda_tensao_pct", 0)

        circuito_dados = {
            "tag": _valor(c, "tag"),
            "descricao": _valor(c, "descricao"),
            "origem": _valor(c, "from_barramento"),
            "destino": _valor(c, "to_equipamento"),
            "tensao": _valor(c, "tensao"),
            "fases": _valor(c, "fases"),
            "potencia_kw": _valor(c, "potencia_kw"),
            "potencia_kva": _valor(c, "potencia_kva", _valor(c, "potencia_kw")),
            "fator_potencia": _valor(c, "fator_potencia"),
            "eficiencia": _valor(c, "fator_eficiencia"),
            "corrente_projeto_ib": _valor(c, "corrente_projeto", _valor(c, "corrente_nominal")),
            "corrente_corrigida_ib_linha": _valor(c, "corrente_corrigida"),
            "fator_k1": _valor(c, "fator_k1"),
            "fator_k2": _valor(c, "fator_k2"),
            "fator_k3": _valor(c, "fator_k3"),
            "metodo_instalacao": _valor(c, "metodo_instalacao"),
            "temperatura_ambiente": _valor(c, "temp_ambiente"),
            "agrupamento": _valor(c, "agrupamento"),
            "formacao": _valor(c, "formacao"),
            "cabo_selecionado": cabo_selecionado,
            "ampacidade_icond": _valor(c, "corrente_condutor", _valor(c, "ampacidade")),
            "queda_tensao": _valor(c, "queda_tensao_pct"),
            "queda_acumulada": queda_acum,
            "corrente_curto_icc": _valor(c, "isc_local"),
            "disjuntor_in": _valor(c, "disjuntor_corrente_nominal", _valor(c, "disjuntor_a")),
            "disjuntor_curva": _valor(c, "disjuntor_curva", _valor(c, "disjuntor_sugerido_curva", "C")),
            "disjuntor_icu": _valor(c, "disjuntor_icu"),
            "criterio_termico_joule": _valor(c, "secao_joule"),
            "condutor_pe": _valor(c, "secao_pe_mm2"),
            "status_final": status_final,
            "status_protecao": normalizar_status(_valor(c, "protecao_status", status_final)),
            "justificativa_protecao": _valor(c, "protecao_nota", justificativa),
            "justificativa": justificativa,
        }
        circuitos_organizados.append(circuito_dados)

    # ── Estatísticas de ΔV% acumulada ────────────────────────────────────────
    quedas_validas = [
        (c["tag"], c["queda_acumulada"])
        for c in circuitos_organizados
        if c["queda_acumulada"] not in (None, "N/A")
        and isinstance(c["queda_acumulada"], (int, float))
    ]
    if quedas_validas:
        tag_maior, maior_queda = max(quedas_validas, key=lambda x: x[1])
        media_queda = round(sum(v for _, v in quedas_validas) / len(quedas_validas), 2)
    else:
        tag_maior, maior_queda, media_queda = None, None, None

    return {
        "resumo": {
            "total_circuitos": total_circuitos,
            "ok": ok_count,
            "alertas": alerta_count,
            "criticos": critico_count,
            "maior_queda_acumulada_pct": maior_queda,
            "circuito_maior_queda": tag_maior,
            "media_queda_acumulada_pct": media_queda,
        },
        "circuitos": circuitos_organizados,
        "pendencias": pendencias,
        "criterios": [
            "Ampacidade (NBR 5410 / N-1997): Ib' = Ib / (K1 × K2 × K3); seleção por ICOND >= Ib'.",
            "Queda de Tensão acumulada (NBR 5410): ΔV_acum% <= 5% (industrial) | 3% (offshore).",
            "Curto-Circuito (IEC 60909): Seção Joule S >= Icc × √t / K.",
            "Proteção (Disjuntor): In >= Ib, In <= Iz, Icu >= Icc.",
        ],
    }
